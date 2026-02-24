"""Integration tests for SimpleClaw — runs against live server.

Usage:
    cd simpleclaw-backend
    TEST_AUTH_TOKEN=<token> pytest tests/ -v
"""

import pytest
import requests

from .conftest import API_BASE, HTTP_TIMEOUT


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
        # Use the skill `name` field (e.g. "feature-flags") which is a valid Django slug
        resp = requests.get(
            f"{API_BASE}/skills/search/", params={"q": "*", "limit": "5"},
            headers=auth_headers, timeout=HTTP_TIMEOUT,
        )
        data = resp.json()
        skills = data.get("skills", [])
        if not skills:
            pytest.skip("No skills available")

        # Prefer the short `name` field which works with Django's <slug:slug> URL
        slug = skills[0].get("name") or skills[0].get("id")
        resp2 = requests.get(f"{API_BASE}/skills/{slug}/", headers=auth_headers, timeout=HTTP_TIMEOUT)
        # The search-based detail endpoint may not find an exact match; accept 200 or 502 (marketplace down)
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

    Port 18789 on the server is not externally accessible, so all
    WS communication goes through the nginx WSS reverse proxy.
    If OpenClaw is down, tests are skipped automatically.
    """

    @pytest.mark.asyncio
    async def test_ws_connect(self, ws_client):
        """Connect via WSS proxy, handle challenge, authenticate."""
        assert ws_client.ws is not None
        assert ws_client.ws.open

    @pytest.mark.asyncio
    async def test_ws_agents_list(self, ws_client):
        """agents.list returns agents."""
        resp = await ws_client.send_request("agents.list")
        agents = resp.get("result", resp.get("agents", resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        assert isinstance(agents, list)
        assert len(agents) >= 1

    @pytest.mark.asyncio
    async def test_ws_config_get(self, ws_client):
        """config.get returns configuration."""
        resp = await ws_client.send_request("config.get")
        result = resp.get("result", resp)
        assert result is not None
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_ws_sessions_list(self, ws_client):
        """sessions.list returns sessions for an agent."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if not agents:
            pytest.skip("No agents available")

        agent_id = agents[0].get("id") or agents[0].get("name")
        resp = await ws_client.send_request("sessions.list", {"agent": agent_id})
        result = resp.get("result", resp.get("sessions", resp.get("data", [])))
        if isinstance(result, dict):
            result = result.get("sessions", [])
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_ws_session_create_and_delete(self, ws_client):
        """Create a session via chat.send, then delete it."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if not agents:
            pytest.skip("No agents available")
        agent_id = agents[0].get("id") or agents[0].get("name")

        resp = await ws_client.send_request("chat.send", {
            "agent": agent_id,
            "message": "integration test — please reply with one word",
        })

        messages = await ws_client.collect_until_done(timeout=30)

        # Find session ID
        session_id = resp.get("result", {}).get("session_id") or resp.get("session_id")
        if not session_id:
            for m in messages:
                sid = m.get("session_id") or (m.get("result", {}) or {}).get("session_id")
                if sid:
                    session_id = sid
                    break

        if session_id:
            del_resp = await ws_client.send_request("sessions.delete", {"session_id": session_id})
            assert del_resp is not None

    @pytest.mark.asyncio
    async def test_ws_agent_switch(self, ws_client):
        """agents.set switches active agent."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if len(agents) < 2:
            pytest.skip("Need at least 2 agents to test switch")

        target = agents[1].get("id") or agents[1].get("name")
        resp = await ws_client.send_request("agents.set", {"agent": target})
        assert resp is not None

    @pytest.mark.asyncio
    async def test_ws_chat_send(self, ws_client):
        """chat.send with test message, receive streaming response."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if not agents:
            pytest.skip("No agents available")
        agent_id = agents[0].get("id") or agents[0].get("name")

        resp = await ws_client.send_request("chat.send", {
            "agent": agent_id,
            "message": "Say exactly: INTEGRATION_TEST_OK",
        })

        messages = await ws_client.collect_until_done(timeout=30)
        assert len(messages) >= 1, "Expected at least one streaming message"

    @pytest.mark.asyncio
    async def test_ws_chat_history(self, ws_client):
        """chat.history returns messages for a session."""
        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if not agents:
            pytest.skip("No agents available")
        agent_id = agents[0].get("id") or agents[0].get("name")

        sessions_resp = await ws_client.send_request("sessions.list", {"agent": agent_id})
        sessions = sessions_resp.get("result", sessions_resp.get("sessions", sessions_resp.get("data", [])))
        if isinstance(sessions, dict):
            sessions = sessions.get("sessions", [])
        if not sessions:
            pytest.skip("No sessions to check history")

        session_id = sessions[0].get("id") or sessions[0].get("session_id")
        resp = await ws_client.send_request("chat.history", {"session_id": session_id})
        result = resp.get("result", resp.get("messages", resp.get("data", [])))
        if isinstance(result, dict):
            result = result.get("messages", [])
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_ws_skill_install_uninstall(self, ws_client):
        """config.get → config.patch to add/remove a test skill."""
        config_resp = await ws_client.send_request("config.get")
        config = config_resp.get("result", config_resp)

        agents_resp = await ws_client.send_request("agents.list")
        agents = agents_resp.get("result", agents_resp.get("agents", agents_resp.get("data", [])))
        if isinstance(agents, dict):
            agents = agents.get("agents", [])
        if not agents:
            pytest.skip("No agents available")

        agent_id = agents[0].get("id") or agents[0].get("name")

        # Extract current skills
        agent_config = None
        if isinstance(config, dict):
            agents_config = config.get("agents", {})
            if isinstance(agents_config, dict):
                agent_config = agents_config.get(agent_id, {})
            elif isinstance(agents_config, list):
                for a in agents_config:
                    if a.get("id") == agent_id or a.get("name") == agent_id:
                        agent_config = a
                        break

        current_skills = []
        if agent_config:
            current_skills = agent_config.get("skills", [])

        test_skill = "veterinarian"

        # Add test skill
        new_skills = list(current_skills) + [test_skill]
        patch_resp = await ws_client.send_request("config.patch", {
            "agent": agent_id,
            "skills": new_skills,
        })
        assert patch_resp is not None

        # Remove test skill (restore original)
        restore_resp = await ws_client.send_request("config.patch", {
            "agent": agent_id,
            "skills": current_skills,
        })
        assert restore_resp is not None
