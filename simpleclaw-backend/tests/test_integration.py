"""Integration tests for SimpleClaw — runs against live server.

Usage:
    cd simpleclaw-backend
    TEST_AUTH_TOKEN=<token> pytest tests/ -v
"""

import json
import uuid

import pytest
import requests

from .conftest import API_BASE, HTTP_TIMEOUT


def _extract(resp: dict, key: str = "payload") -> any:
    """Extract data from an OpenClaw WS response."""
    return resp.get(key, resp.get("result", resp.get("data")))


def _get_agents(payload) -> list:
    """Normalize agents from various response shapes."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("agents", [])
    return []


# ─── REST API Tests ──────────────────────────────────────────────────────────


class TestRestAPI:
    """REST API tests using DRF token auth."""

    def test_profile_get(self, auth_headers):
        """GET /api/auth/profile/ returns user data with server info."""
        resp = requests.get(f"{API_BASE}/auth/profile/", headers=auth_headers, timeout=HTTP_TIMEOUT)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "email" in data
        assert "profile" in data
        assert "server" in data

    def test_current_user(self, auth_headers):
        """GET /api/auth/me/ returns user email."""
        resp = requests.get(f"{API_BASE}/auth/me/", headers=auth_headers, timeout=HTTP_TIMEOUT)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert "@" in data["email"]

    def test_server_status(self, auth_headers):
        """GET /api/server/status/ returns assigned=True with ws_url and gateway_token."""
        resp = requests.get(f"{API_BASE}/server/status/", headers=auth_headers, timeout=HTTP_TIMEOUT)
        assert resp.status_code == 200
        data = resp.json()
        assert data["assigned"] is True
        assert "ip_address" in data
        assert "gateway_token" in data
        assert data["gateway_token"]
        assert "ws_url" in data

    def test_skills_search(self, auth_headers):
        """GET /api/skills/search/?q=* returns skills list."""
        resp = requests.get(
            f"{API_BASE}/skills/search/", params={"q": "*"},
            headers=auth_headers, timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "skills" in data
        assert isinstance(data["skills"], list)
        assert "total" in data

    def test_skill_detail(self, auth_headers):
        """GET /api/skills/<slug>/ returns skill data using a short name."""
        resp = requests.get(
            f"{API_BASE}/skills/search/", params={"q": "*", "limit": "5"},
            headers=auth_headers, timeout=HTTP_TIMEOUT,
        )
        data = resp.json()
        skills = data.get("skills", [])
        if not skills:
            pytest.skip("No skills available")

        slug = skills[0].get("name") or skills[0].get("id")
        resp2 = requests.get(f"{API_BASE}/skills/{slug}/", headers=auth_headers, timeout=HTTP_TIMEOUT)
        assert resp2.status_code in (200, 502), f"Unexpected status {resp2.status_code}: {resp2.text[:200]}"

    def test_server_pool(self):
        """GET /api/server/pool/ returns available count (no auth needed)."""
        resp = requests.get(f"{API_BASE}/server/pool/", timeout=HTTP_TIMEOUT)
        assert resp.status_code == 200
        data = resp.json()
        assert "available" in data
        assert "total_active" in data
        assert isinstance(data["available"], int)

    def test_unauthorized_access(self):
        """Requests without token return 401."""
        resp = requests.get(f"{API_BASE}/auth/profile/", timeout=HTTP_TIMEOUT)
        assert resp.status_code == 401

    @pytest.mark.xfail(reason="Passes only after OAuth verification patch is deployed")
    def test_google_auth_rejects_raw_email(self):
        """POST /api/auth/google/ with raw email/google_id (no token) returns 400."""
        resp = requests.post(
            f"{API_BASE}/auth/google/",
            json={"email": "fake@gmail.com", "google_id": "fake123"},
            timeout=HTTP_TIMEOUT,
        )
        assert resp.status_code == 400, (
            f"Expected 400 (raw email rejected) but got {resp.status_code}. "
            "Deploy the OAuth verification patch first."
        )


# ─── WebSocket Tests (through WSS proxy) ────────────────────────────────────


class TestWebSocket:
    """WebSocket tests via wss://install-openclow.ru/ws-proxy/.

    Port 18789 on the server is only accessible locally, so all
    WS communication goes through the nginx WSS reverse proxy.
    If OpenClaw is down, tests are skipped automatically.
    """

    @pytest.mark.asyncio
    async def test_ws_connect(self, ws_client):
        """Connect via WSS proxy, handle challenge, authenticate."""
        assert ws_client.ws is not None

    @pytest.mark.asyncio
    async def test_ws_agents_list(self, ws_client):
        """agents.list returns agents."""
        resp = await ws_client.send_request("agents.list")
        agents = _get_agents(_extract(resp))
        assert isinstance(agents, list)
        assert len(agents) >= 1

    @pytest.mark.asyncio
    async def test_ws_config_get(self, ws_client):
        """config.get returns configuration."""
        resp = await ws_client.send_request("config.get")
        payload = _extract(resp)
        assert payload is not None

    @pytest.mark.asyncio
    async def test_ws_sessions_list(self, ws_client):
        """sessions.list returns sessions for an agent."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = _get_agents(_extract(agents_resp))
        if not agents:
            pytest.skip("No agents available")

        agent_id = agents[0].get("id") or agents[0].get("name")
        resp = await ws_client.send_request("sessions.list", {"agent": agent_id})
        result = _extract(resp)
        sessions = result if isinstance(result, list) else (result or {}).get("sessions", [])
        assert isinstance(sessions, list)

    @pytest.mark.asyncio
    async def test_ws_session_create_and_delete(self, ws_client):
        """Create a session via chat.send, then delete it."""
        # Create a new session by sending a message with a fresh sessionKey
        session_key = f"test-session-{uuid.uuid4().hex[:8]}"
        idempotency_key = f"idem-{uuid.uuid4().hex[:8]}"

        resp = await ws_client.send_request("chat.send", {
            "sessionKey": session_key,
            "message": "integration test — reply with one word",
            "idempotencyKey": idempotency_key,
        })
        assert resp.get("ok") is True or resp.get("payload") is not None

        # Collect streaming events until final
        await ws_client.collect_events(timeout=30)

        # Delete the session
        del_resp = await ws_client.send_request("sessions.delete", {"sessionKey": session_key})
        assert del_resp is not None

    @pytest.mark.asyncio
    async def test_ws_agent_switch(self, ws_client):
        """agents.set switches active agent."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = _get_agents(_extract(agents_resp))
        if len(agents) < 2:
            pytest.skip("Need at least 2 agents to test switch")

        target = agents[1].get("id") or agents[1].get("name")
        resp = await ws_client.send_request("agents.set", {"agent": target})
        assert resp is not None

    @pytest.mark.asyncio
    async def test_ws_chat_send(self, ws_client):
        """chat.send with test message, receive streaming response."""
        session_key = f"test-chat-{uuid.uuid4().hex[:8]}"
        idempotency_key = f"idem-{uuid.uuid4().hex[:8]}"

        resp = await ws_client.send_request("chat.send", {
            "sessionKey": session_key,
            "message": "Say exactly: INTEGRATION_TEST_OK",
            "idempotencyKey": idempotency_key,
        })
        assert resp.get("ok") is True or resp.get("payload") is not None

        messages = await ws_client.collect_events(timeout=30)
        assert len(messages) >= 1, "Expected at least one streaming event"

        # Clean up
        await ws_client.send_request("sessions.delete", {"sessionKey": session_key})

    @pytest.mark.asyncio
    async def test_ws_chat_history(self, ws_client):
        """chat.history returns messages for a session."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = _get_agents(_extract(agents_resp))
        if not agents:
            pytest.skip("No agents available")
        agent_id = agents[0].get("id") or agents[0].get("name")

        sessions_resp = await ws_client.send_request("sessions.list", {"agent": agent_id})
        result = _extract(sessions_resp)
        sessions = result if isinstance(result, list) else (result or {}).get("sessions", [])
        if not sessions:
            pytest.skip("No sessions to check history")

        session_key = sessions[0].get("key") or sessions[0].get("id") or sessions[0].get("sessionKey")
        resp = await ws_client.send_request("chat.history", {"sessionKey": session_key})
        result = _extract(resp)
        messages = result if isinstance(result, list) else (result or {}).get("messages", [])
        assert isinstance(messages, list)

    @pytest.mark.asyncio
    async def test_ws_skill_install_uninstall(self, ws_client):
        """config.get → config.patch to add/remove a test skill using baseHash+raw format."""
        config_resp = await ws_client.send_request("config.get")
        config_payload = _extract(config_resp) or {}

        base_hash = config_payload.get("hash")
        config_data = config_payload.get("config", config_payload)
        agents_list = config_data.get("agents", {}).get("list", [])

        if not agents_list:
            pytest.skip("No agents in config")

        test_skill = "veterinarian"

        # Add test skill to first agent
        updated_list = []
        for agent in agents_list:
            a = dict(agent)
            if a.get("id") == agents_list[0].get("id"):
                skills = list(a.get("skills", []))
                if test_skill not in skills:
                    skills.append(test_skill)
                a["skills"] = skills
            updated_list.append(a)

        patch = {"agents": {"list": updated_list}}
        patch_resp = await ws_client.send_request("config.patch", {
            "baseHash": base_hash,
            "raw": json.dumps(patch),
        })
        assert patch_resp is not None

        # Remove test skill (restore original) — re-read config for fresh hash
        config_resp2 = await ws_client.send_request("config.get")
        config_payload2 = _extract(config_resp2) or {}
        base_hash2 = config_payload2.get("hash")
        config_data2 = config_payload2.get("config", config_payload2)
        agents_list2 = config_data2.get("agents", {}).get("list", [])

        restored_list = []
        for agent in agents_list2:
            a = dict(agent)
            skills = [s for s in a.get("skills", []) if s != test_skill]
            a["skills"] = skills
            restored_list.append(a)

        restore_patch = {"agents": {"list": restored_list}}
        restore_resp = await ws_client.send_request("config.patch", {
            "baseHash": base_hash2,
            "raw": json.dumps(restore_patch),
        })
        assert restore_resp is not None
