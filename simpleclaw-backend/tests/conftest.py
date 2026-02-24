"""Fixtures for SimpleClaw integration tests.

Run with:
    cd simpleclaw-backend && TEST_AUTH_TOKEN=<token> pytest tests/ -v
"""

import os
import json
import asyncio
from urllib.parse import urlparse, parse_qs

import pytest
import requests
import websockets

API_BASE = "https://install-openclow.ru/api"

# Timeouts
HTTP_TIMEOUT = 15
WS_TIMEOUT = 15


@pytest.fixture(scope="session")
def auth_token():
    """DRF auth token from environment."""
    token = os.environ.get("TEST_AUTH_TOKEN", "")
    if not token:
        pytest.skip("TEST_AUTH_TOKEN not set")
    return token


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Headers dict with Authorization for REST requests."""
    return {"Authorization": f"Token {auth_token}"}


@pytest.fixture(scope="session")
def server_info(auth_headers):
    """Fetch server status once per session — provides ip, gateway_token, ws_url."""
    resp = requests.get(f"{API_BASE}/server/status/", headers=auth_headers, timeout=HTTP_TIMEOUT)
    assert resp.status_code == 200
    data = resp.json()
    if not data.get("assigned"):
        pytest.skip("No server assigned to test user")
    return data


@pytest.fixture(scope="session")
def gateway_token(server_info):
    return server_info["gateway_token"]


@pytest.fixture(scope="session")
def wss_url(server_info):
    return server_info.get("ws_url")


class OpenClawWsClient:
    """Async WebSocket client implementing the OpenClaw gateway protocol.

    Protocol:
      1. Server sends event: {"type":"event","event":"connect.challenge","payload":{"nonce":"..."}}
      2. Client sends request: {"type":"req","id":"connect-init","method":"connect","params":{...,"auth":{"token":"..."}}}
      3. Server responds: {"type":"res","id":"connect-init","ok":true,...}
      4. RPC: {"type":"req","id":"<id>","method":"<method>","params":{...}}
      5. Response: {"type":"res","id":"<id>","ok":true,"payload":{...}}
    """

    def __init__(self):
        self.ws = None
        self._msg_counter = 0

    async def connect(self, ws_uri: str, token: str):
        self.ws = await websockets.connect(ws_uri, open_timeout=WS_TIMEOUT)

        # Wait for challenge
        raw = await asyncio.wait_for(self.ws.recv(), timeout=WS_TIMEOUT)
        msg = json.loads(raw)

        if msg.get("type") == "event" and msg.get("event") == "connect.challenge":
            # Send connect request with auth token
            await self.ws.send(json.dumps({
                "type": "req",
                "id": "connect-init",
                "method": "connect",
                "params": {
                    "minProtocol": 3,
                    "maxProtocol": 3,
                    "client": {
                        "id": "test",
                        "displayName": "IntegrationTest",
                        "version": "1.0.0",
                        "platform": "linux",
                        "mode": "test",
                    },
                    "caps": [],
                    "scopes": ["operator.read", "operator.write", "operator.admin"],
                    "auth": {"token": token},
                },
            }))

            # Wait for connect response
            raw = await asyncio.wait_for(self.ws.recv(), timeout=WS_TIMEOUT)
            resp = json.loads(raw)
            if resp.get("type") == "res" and resp.get("id") == "connect-init":
                if not resp.get("ok"):
                    raise ConnectionError(f"Connect failed: {resp.get('error', resp)}")
            return resp
        else:
            raise ConnectionError(f"Expected connect.challenge, got: {msg}")

    async def send_request(self, method: str, params: dict | None = None) -> dict:
        """Send an RPC request and wait for the matching response."""
        self._msg_counter += 1
        msg_id = f"test-{self._msg_counter}-{id(self)}"
        payload = {"type": "req", "id": msg_id, "method": method}
        if params is not None:
            payload["params"] = params
        await self.ws.send(json.dumps(payload))
        return await self._wait_for_response(msg_id)

    async def _wait_for_response(self, msg_id: str) -> dict:
        """Read messages until we find a response with matching id."""
        deadline = asyncio.get_event_loop().time() + WS_TIMEOUT
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise TimeoutError(f"No response for id={msg_id}")
            raw = await asyncio.wait_for(self.ws.recv(), timeout=remaining)
            msg = json.loads(raw)
            if msg.get("type") == "res" and msg.get("id") == msg_id:
                return msg

    async def collect_events(self, timeout: float = 30) -> list[dict]:
        """Collect all messages until timeout or connection close."""
        messages = []
        deadline = asyncio.get_event_loop().time() + timeout
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                break
            try:
                raw = await asyncio.wait_for(self.ws.recv(), timeout=remaining)
                msg = json.loads(raw)
                messages.append(msg)
                # Stop on chat final state
                if (msg.get("type") == "event" and msg.get("event") == "chat"
                        and msg.get("payload", {}).get("state") == "final"):
                    break
            except asyncio.TimeoutError:
                break
            except websockets.exceptions.ConnectionClosed:
                break
        return messages

    async def close(self):
        if self.ws:
            await self.ws.close()


@pytest.fixture
async def ws_client(wss_url, gateway_token):
    """WebSocket connection to OpenClaw through WSS proxy.

    Port 18789 is only accessible from the server itself,
    so all external WS tests go through the nginx WSS proxy.
    If OpenClaw is down, tests are skipped automatically.
    """
    if not wss_url:
        pytest.skip("No WSS URL available")

    # Extract token from URL query param
    parsed = urlparse(wss_url)
    token = parse_qs(parsed.query).get("token", [gateway_token])[0]

    client = OpenClawWsClient()
    try:
        await client.connect(wss_url, token)
    except (websockets.exceptions.InvalidStatus, OSError, ConnectionError, TimeoutError) as e:
        pytest.skip(f"OpenClaw WS not reachable (server may be down): {e}")
    yield client
    await client.close()
