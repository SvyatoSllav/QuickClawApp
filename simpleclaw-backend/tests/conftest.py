"""Fixtures for SimpleClaw integration tests.

Run with:
    cd simpleclaw-backend && TEST_AUTH_TOKEN=<token> pytest tests/ -v
"""

import os
import json
import asyncio
import hashlib
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
    """Reusable async WebSocket client for OpenClaw protocol."""

    def __init__(self):
        self.ws = None
        self._msg_id = 0

    async def connect(self, ws_uri: str, token: str):
        self.ws = await websockets.connect(ws_uri, open_timeout=WS_TIMEOUT)
        # Handle challenge-response auth
        raw = await asyncio.wait_for(self.ws.recv(), timeout=WS_TIMEOUT)
        msg = json.loads(raw)
        if msg.get("type") == "challenge":
            challenge = msg["challenge"]
            response_hash = hashlib.sha256(
                f"{challenge}:{token}".encode()
            ).hexdigest()
            await self.ws.send(json.dumps({
                "type": "auth",
                "token": token,
                "response": response_hash,
            }))
            raw = await asyncio.wait_for(self.ws.recv(), timeout=WS_TIMEOUT)
            auth_result = json.loads(raw)
            if not auth_result.get("ok"):
                raise ConnectionError(f"WS auth failed: {auth_result}")
            return auth_result
        elif msg.get("ok"):
            return msg
        else:
            raise ConnectionError(f"Unexpected WS message: {msg}")

    async def send_request(self, method: str, params: dict | None = None) -> dict:
        """Send a JSON-RPC-style request and wait for matching response."""
        self._msg_id += 1
        msg_id = self._msg_id
        payload = {"id": msg_id, "method": method}
        if params:
            payload["params"] = params
        await self.ws.send(json.dumps(payload))
        return await self._wait_for_id(msg_id)

    async def _wait_for_id(self, msg_id: int) -> dict:
        """Read messages until we find one with matching id."""
        deadline = asyncio.get_event_loop().time() + WS_TIMEOUT
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise TimeoutError(f"No response for id={msg_id}")
            raw = await asyncio.wait_for(self.ws.recv(), timeout=remaining)
            msg = json.loads(raw)
            if msg.get("id") == msg_id:
                return msg

    async def wait_for_event(self, event_name: str, timeout: float = WS_TIMEOUT) -> dict:
        """Read messages until we find an event with the given name."""
        deadline = asyncio.get_event_loop().time() + timeout
        while True:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                raise TimeoutError(f"No event '{event_name}' received")
            raw = await asyncio.wait_for(self.ws.recv(), timeout=remaining)
            msg = json.loads(raw)
            if msg.get("event") == event_name or msg.get("type") == event_name:
                return msg

    async def collect_until_done(self, timeout: float = 30) -> list[dict]:
        """Collect all messages until a 'done' event or timeout."""
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
                if msg.get("type") == "done" or msg.get("event") == "done":
                    break
            except asyncio.TimeoutError:
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
    """
    if not wss_url:
        pytest.skip("No WSS URL available")

    # Extract token from URL query param
    parsed = urlparse(wss_url)
    token = parse_qs(parsed.query).get("token", [gateway_token])[0]

    client = OpenClawWsClient()
    try:
        await client.connect(wss_url, token)
    except (websockets.exceptions.InvalidStatus, OSError, ConnectionError) as e:
        pytest.skip(f"OpenClaw WS not reachable (server may be down): {e}")
    yield client
    await client.close()
