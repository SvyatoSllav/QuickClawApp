# Multi-Agent Support — Implementation Report

**Commit:** `c8127f5` | **Branch:** `main` | **Files:** 26 changed, 595 insertions

---

## Backend: Agent Workspace Configs

Location: `simpleclaw-backend/openclaw-config/agents/{id}/`

| Agent ID | Name | Emoji | Skills |
|----------|------|-------|--------|
| `researcher` | Research Analyst | 🔍 | summarize, blogwatcher, weather, session-logs, mcporter |
| `writer` | Content Creator | ✍️ | summarize, nano-banana-pro, openai-image-gen, gifgrep, obsidian, session-logs |
| `coder` | Coding Assistant | 💻 | github, coding-agent, tmux, session-logs, mcporter |
| `analyst` | Data Analyst | 📊 | summarize, nano-pdf, gog, session-logs |
| `assistant` | Personal Assistant | 📋 | gog, trello, notion, himalaya, weather, session-logs |

Each agent has 3 workspace files:

- **SOUL.md** — persona, personality, capabilities, work style, constraints
- **IDENTITY.md** — name, emoji, theme
- **TOOLS.md** — available tools/skills and usage guidelines

Config file: `openclaw-agents.json` — the `agents` block to merge into `openclaw.json`, with `tools.allow` per agent.

---

## Mobile App: New Files

| File | Purpose |
|------|---------|
| `src/types/agent.ts` | `Agent` interface — `id`, `name`, `identity: { name, emoji, avatar }` |
| `src/stores/agentStore.ts` | Zustand store — `fetchAgents()` via `agents.list` RPC, `switchAgent(id)`, `getActiveAgent()` |
| `src/screens/AgentsScreen.tsx` | Card-based agent picker with emoji, name, description, checkmark on active |

## Mobile App: Modified Files

| File | What changed |
|------|-------------|
| `src/stores/sessionStore.ts` | Sessions filtered by `agent:{activeAgentId}:*` prefix; `createSession` generates `agent:{id}:chat-{ts}` keys; `deleteSession` guards `:main` suffix and falls back to agent-scoped main |
| `src/stores/chatStore.ts` | On WebSocket connect, calls `agentStore.fetchAgents()` instead of `loadHistory()` directly. Agent fetch handles setting session key + loading history |
| `src/stores/navigationStore.ts` | Added `'agents'` to `AppScreen` type union |
| `src/screens/ChatScreen.tsx` | `onContentSizeChange` for reliable scroll-to-bottom on history load; scroll-to-bottom FAB when user scrolls up; `isLoadingHistory` tracking for post-load scroll |
| `src/components/chat/ChatHeader.tsx` | Shows active agent emoji before session title |
| `src/components/sidebar/Sidebar.tsx` | "Agents" menu item as first entry (`Users` icon); sidebar header shows active agent emoji + name |
| `app/index.tsx` | Router: added `case 'agents': return <AgentsScreen />` |

---

## Key Architecture Decisions

### Session Key Format

```
agent:{agentId}:main          — default session per agent
agent:{agentId}:chat-{ts}     — additional sessions per agent
```

Sessions are inherently scoped per agent. `sessionStore.fetchSessions()` filters by `agent:{activeAgentId}:*` prefix.

### Connect Flow

```
WebSocket connect
  → chatStore receives connect-init OK
  → calls agentStore.fetchAgents()
    → RPC: agents.list
    → finds default agent (researcher)
    → sets activeSessionKey to "agent:researcher:main"
    → loads history for that session
    → fetches filtered session list
    → syncs model from server via session.config.get
```

### Circular Dependency Avoidance

`chatStore` uses `require('./agentStore')` inside the connect handler (lazy import) to avoid circular import since `agentStore` already imports `chatStore`.

### Agent Switching

```
agentStore.switchAgent(id)
  → sets activeAgentId
  → sets chatStore.activeSessionKey to "agent:{id}:main"
  → clears messages
  → loads history for new agent's main session
  → re-fetches sessions (now filtered to new agent)
```

---

## Deployment Steps

1. Copy `simpleclaw-backend/openclaw-config/agents/` directories to server's OpenClaw workspace path
2. Merge contents of `openclaw-agents.json` into your main `openclaw.json` config
3. Install community skills:
   - **coder:** `npx clawhub@latest install git-essentials conventional-commits debug-pro test-runner`
   - **researcher:** `npx clawhub@latest install deepwiki`
4. Restart OpenClaw gateway
5. Reload mobile app — should auto-fetch 5 agents, default to Research Analyst

---

## Verification Checklist

- [ ] App connects and fetches 5 agents via `agents.list` RPC
- [ ] Sidebar → "Agents" → all 5 listed with emoji, name, description
- [ ] Selecting agent switches chat to `agent:{id}:main` session
- [ ] Session drawer shows only that agent's sessions
- [ ] Creating new session scopes it under active agent (`agent:{id}:chat-{ts}`)
- [ ] Chat header shows agent emoji before session title
- [ ] Sidebar header shows active agent emoji + name
- [ ] Sending "what is your role?" returns agent-specific persona
- [ ] Switching between agents — sessions are isolated (no message leakage)
- [ ] Chat scrolls to bottom on history load
- [ ] Scroll-to-bottom FAB appears when scrolled up, hides at bottom
