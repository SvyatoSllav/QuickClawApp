# OpenClaw Server Testing Checklist

Comprehensive checklist for verifying new servers before they go into the pool.
Run these checks **after** `warm_deploy_standby()` or `deploy_openclaw()` completes.

---

## 1. SSH & OS Level

- [ ] **SSH accessible** — `ssh root@<IP>` connects without timeout
- [ ] **IPv4 address assigned** — no IPv6-only (TimeWeb sometimes gives only v6)
- [ ] **Docker installed** — `docker --version` returns 20+
- [ ] **Docker running** — `systemctl status docker` shows active
- [ ] **OpenClaw directory exists** — `ls /root/openclaw/` has Dockerfile, docker-compose.yml, .env
- [ ] **Disk space sufficient** — `df -h /` shows >10GB free (images ~3-5GB)
- [ ] **RAM sufficient** — `free -h` shows >=4GB total (server preset: 4GB)

## 2. Docker Containers (6 total)

Run `docker ps` and verify ALL 6 containers are **running** (not restarting):

- [ ] **`openclaw`** — main agent container (custom image with Chrome + python-pptx + SearXNG sed-patch)
- [ ] **`searxng`** — private search instance (`searxng/searxng:latest`)
- [ ] **`searxng-redis`** — Valkey/Redis cache for SearXNG (`valkey/valkey:8-alpine`)
- [ ] **`searxng-adapter`** — Brave-to-SearXNG API translator (listens on port 3000 inside Docker network)
- [ ] **`lightpanda`** — lightweight headless browser (`lightpanda/browser:nightly`)
- [ ] **`lightpanda-adapter`** — CDP HTTP bridge for Lightpanda (listens on port 9223 inside Docker network)

### Container health checks:
```bash
docker inspect openclaw --format='{{.State.Status}}'        # must be "running"
docker inspect searxng --format='{{.State.Status}}'          # must be "running"
docker inspect searxng-redis --format='{{.State.Status}}'    # must be "running"
docker inspect searxng-adapter --format='{{.State.Status}}'  # must be "running"
docker inspect lightpanda --format='{{.State.Status}}'       # must be "running"
docker inspect lightpanda-adapter --format='{{.State.Status}}'# must be "running"
```

### No restart loops:
```bash
docker inspect openclaw --format='{{.RestartCount}}'  # should be 0 or very low
docker logs openclaw --tail 20 2>&1 | grep -c "EACCES"  # must be 0
```

## 3. SearXNG Search (replaces Brave API)

- [ ] **SearXNG container running** (see above)
- [ ] **SearXNG settings.yml exists** — `docker exec searxng ls /etc/searxng/settings.yml`
- [ ] **SearXNG accepts JSON requests** — test from inside openclaw:
  ```bash
  docker exec openclaw wget -qO- "http://searxng:8080/search?q=test&format=json" | head -c 200
  ```
  Should return JSON with `"results"` array.

- [ ] **SearXNG adapter running** (see above)
- [ ] **Adapter translates Brave format** — test from inside openclaw:
  ```bash
  docker exec openclaw wget -qO- "http://searxng-adapter:3000/res/v1/web/search?q=test&count=3" | head -c 300
  ```
  Must return `{"web":{"results":[...]}}` (Brave API format).

- [ ] **Brave URL sed-patched in OpenClaw binary** — verify the Dockerfile sed worked:
  ```bash
  docker exec openclaw grep -r "searxng-adapter" /app/dist/ | head -3
  ```
  Should find the patched URL `http://searxng-adapter:3000/res/v1/web/search`.

- [ ] **BRAVE_API_KEY set in .env** — `grep BRAVE_API_KEY /root/openclaw/.env`
  Should be `BRAVE_API_KEY=local-searxng` (satisfies OpenClaw's API key check).

- [ ] **OpenClaw search provider = brave** (adapter handles translation):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get tools.web.search.provider
  ```
  Must return `brave`.

- [ ] **OpenClaw search enabled = true**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get tools.web.search.enabled
  # or: docker exec openclaw node /app/openclaw.mjs config get web.enabled
  ```
  Must return `true`.

## 4. Lightpanda Browser (default) + Chrome (fallback)

### Lightpanda (default profile):
- [ ] **Lightpanda container running** (see above)
- [ ] **Lightpanda adapter running** (see above)
- [ ] **Adapter health endpoint**:
  ```bash
  docker exec openclaw wget -qO- "http://lightpanda-adapter:9223/health"
  ```
  Must return `{"healthy":true,...}`.

- [ ] **Lightpanda adapter JSON discovery**:
  ```bash
  docker exec openclaw wget -qO- "http://lightpanda-adapter:9223/json/version"
  ```
  Must return JSON with `"Browser":"Lightpanda/nightly"`.

- [ ] **Lightpanda profile configured**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get browser.profiles.lightpanda.cdpUrl
  ```
  Must return `http://lightpanda-adapter:9223`.

- [ ] **Default browser profile = lightpanda**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get browser.defaultProfile
  ```
  Must return `lightpanda`.

### Chrome headless (fallback profile):
- [ ] **Chrome installed in container**:
  ```bash
  docker exec openclaw google-chrome --version
  ```
  Must return a version string.

- [ ] **Headless profile exists**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get browser.headless
  ```
  Must return `true`.

- [ ] **browser.noSandbox = true**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get browser.noSandbox
  ```
  Must return `true`.

- [ ] **No stale Chrome lock files**:
  ```bash
  docker exec openclaw ls /home/node/.openclaw/browser/headless/user-data/SingletonLock 2>&1
  ```
  Should return "No such file" (not exist).

## 5. OpenClaw Configuration

### Provider & Model:
- [ ] **Provider = openrouter**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get provider
  ```
- [ ] **Model set to openrouter/***:
  ```bash
  docker logs openclaw --tail 50 2>&1 | grep "agent model:" | tail -1
  ```
  Must contain `openrouter/`.

### Gateway:
- [ ] **Gateway mode = local**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get gateway.mode
  ```

### Auth (only after `quick_deploy_user`):
- [ ] **auth-profiles.json exists with correct API key**:
  ```bash
  docker exec openclaw cat /home/node/.openclaw/agents/main/agent/auth-profiles.json
  ```
  Must contain user's OpenRouter API key.

- [ ] **telegram-allowFrom.json has owner's Telegram ID**:
  ```bash
  docker exec openclaw cat /home/node/.openclaw/credentials/telegram-allowFrom.json
  ```
  Must contain `"allowFrom":["<telegram_id>"]` or `["*"]`.

### Telegram (only after `quick_deploy_user`):
- [ ] **dmPolicy = open**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get channels.telegram.dmPolicy
  ```
- [ ] **Telegram provider started** — check logs:
  ```bash
  docker logs openclaw --tail 50 2>&1 | grep "\[telegram\]" | tail -3
  ```
  Must contain `starting provider`.

## 6. Token Optimization

- [ ] **contextTokens = 100000** (compaction triggered at 100K, not default 200K):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.contextTokens
  ```
- [ ] **bootstrapMaxChars = 20000** (limits system prompt bloat):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.bootstrapMaxChars
  ```
- [ ] **Heartbeat disabled** (`every: "0m"` — saves ~30% tokens):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.heartbeat
  ```
  Must contain `"every":"0m"`.

- [ ] **Sub-agents model = gemini-3-flash-preview** (cheap):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.subagents
  ```
  Must contain `gemini-3-flash-preview`.

- [ ] **imageModel = gemini-2.5-flash** (cheap):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.imageModel
  ```

- [ ] **Compaction with memoryFlush enabled**, softThresholdTokens = 30000:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.compaction
  ```

- [ ] **Context pruning: cache-ttl 1h, keepLastAssistants: 3**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.contextPruning
  ```

- [ ] **maxConcurrent = 2**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.maxConcurrent
  ```

- [ ] **Memory search enabled (local RAG)**:
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.memorySearch
  ```
  Must contain `"enabled":true,"provider":"local"`.

- [ ] **Fallback models configured** (gemini-2.5-flash -> haiku):
  ```bash
  docker exec openclaw node /app/openclaw.mjs models fallbacks 2>/dev/null || echo "check models config"
  ```

- [ ] **Model aliases set** (opus, sonnet, haiku, flash, deepseek, gemini3):
  ```bash
  docker exec openclaw node /app/openclaw.mjs config get agents.defaults.models
  ```

## 7. Skills

### Essential skills in `/app/skills/` (~26 total):
```bash
docker exec openclaw ls /app/skills/
```

- [ ] **Core skills present**: bird, canvas, clawhub, coding-agent, gemini, healthcheck, model-usage, nano-pdf, openai-image-gen, oracle, session-logs, spotify-player, summarize, weather
- [ ] **Audio/media skills**: sag, openai-whisper, openai-whisper-api, songsee, video-frames
- [ ] **ClawdMatrix domain skills** (7 total): clawdmatrix-coding, clawdmatrix-finance, clawdmatrix-legal, clawdmatrix-sysops, clawdmatrix-creative, clawdmatrix-occult, clawdmatrix-gaming

### ClawdMatrix SKILL.md files:
```bash
for s in clawdmatrix-coding clawdmatrix-finance clawdmatrix-legal clawdmatrix-sysops clawdmatrix-creative clawdmatrix-occult clawdmatrix-gaming; do
  docker exec openclaw ls /app/skills/$s/SKILL.md 2>/dev/null && echo "OK: $s" || echo "MISSING: $s"
done
```
- [ ] All 7 SKILL.md files present

### Disabled skills in `/app/skills-disabled/`:
```bash
docker exec openclaw ls /app/skills-disabled/
```
- [ ] **Restorable skills present**: 1password, blogwatcher, gifgrep, github, gog, goplaces, himalaya, local-places, mcporter, notion, obsidian, skill-creator, tmux, trello, etc.
- [ ] **Model can restore** via `mv /app/skills-disabled/<name> /app/skills/<name>`

### VPS-useless skills permanently removed:
```bash
docker exec openclaw ls /app/skills/ /app/skills-disabled/ 2>/dev/null | grep -E "apple-notes|apple-reminders|bear-notes|things-mac|peekaboo|imsg|openhue|eightctl|blucli|sonoscli|camsnap|discord|slack|wacli|bluebubbles|food-order|ordercli|nano-banana-pro"
```
- [ ] **No output** — these should be completely deleted

### File permissions:
```bash
docker exec openclaw ls -la /app/skills/ | head -5
docker exec openclaw ls -la /app/skills-disabled/ | head -5
```
- [ ] `/app/skills/` — owned by `node:node`
- [ ] `/app/skills-disabled/` — owned by `node:node`

## 8. CLAUDE.md

```bash
docker exec openclaw cat /home/node/.openclaw/CLAUDE.md
```

- [ ] **Quality Gates present** (Red/Yellow/Green classification)
- [ ] **Language mirroring rule** (RU/EN)
- [ ] **Skill restore instructions** (mv /app/skills-disabled/)
- [ ] **File sending instructions** (mediaUrl, correct `action` values)
- [ ] **Browser strategy** (lightpanda default, headless for heavy JS)
- [ ] **Link verification rule** (ПРАВИЛО ПРОВЕРКИ ССЫЛОК — never invent URLs)
- [ ] **Owned by node:node**:
  ```bash
  docker exec openclaw ls -la /home/node/.openclaw/CLAUDE.md
  ```

## 9. Dockerfile Extras

- [ ] **python3-pip installed** (needed for python-pptx):
  ```bash
  docker exec openclaw pip3 --version
  ```
- [ ] **python-pptx installed** (survives container recreation via Dockerfile):
  ```bash
  docker exec openclaw python3 -c "import pptx; print(pptx.__version__)"
  ```
- [ ] **Old /app/clawdmatrix/ does NOT exist**:
  ```bash
  docker exec openclaw ls /app/clawdmatrix/ 2>&1
  ```
  Should return "No such file".
- [ ] **Old /home/node/.openclaw/clawdmatrix/ does NOT exist**:
  ```bash
  docker exec openclaw ls /home/node/.openclaw/clawdmatrix/ 2>&1
  ```
  Should return "No such file".

## 10. Session Watchdog (auto-recovery)

- [ ] **Script installed**:
  ```bash
  ls -la /usr/local/bin/openclaw-watchdog.sh
  ```
- [ ] **Script is executable**:
  ```bash
  file /usr/local/bin/openclaw-watchdog.sh
  ```
- [ ] **Cron job running** (every 2 minutes):
  ```bash
  crontab -l | grep openclaw-watchdog
  ```
  Must show `*/2 * * * * /usr/local/bin/openclaw-watchdog.sh`.
- [ ] **Detects "Thought signature is not valid"** error and triggers `/compact`.

## 11. File Permissions (critical — most common deploy failure)

```bash
docker exec openclaw ls -la /home/node/.openclaw/
```

- [ ] `/home/node/.openclaw/` — owned by `node:node` (not root)
- [ ] `/home/node/.openclaw/CLAUDE.md` — owned by `node:node`
- [ ] `/home/node/.openclaw/agents/` — owned by `node:node`
- [ ] `/home/node/.openclaw/credentials/` — owned by `node:node`
- [ ] `/app/skills/*` — owned by `node:node`
- [ ] `/app/skills-disabled/*` — owned by `node:node`
- [ ] **No EACCES errors in recent logs**:
  ```bash
  docker logs openclaw --tail 50 2>&1 | grep "EACCES"
  ```
  Must return nothing.

## 12. Docker Volume

- [ ] **openclaw_config volume exists**:
  ```bash
  docker volume inspect openclaw_config
  ```
- [ ] **Volume accessible on host** (for emergency config fixes):
  ```bash
  ls /var/lib/docker/volumes/openclaw_config/_data/
  ```
- [ ] **No stale openclaw.json with invalid config** (e.g., `provider: searxng`):
  ```bash
  cat /var/lib/docker/volumes/openclaw_config/_data/openclaw.json 2>/dev/null | grep -E '"provider".*searxng'
  ```
  Must return nothing (should be `brave`, not `searxng`).

## 13. Network & Ports

- [ ] **Gateway port 18789 exposed** (if using gateway mode):
  ```bash
  docker port openclaw
  ```
- [ ] **No port conflicts** — verify nothing else uses 3000, 9222, 9223, 8080 on host:
  ```bash
  ss -tlnp | grep -E '3000|9222|9223|8080'
  ```
  (These are internal Docker ports, should NOT appear on host.)

- [ ] **Inter-container networking works** — openclaw can reach all services:
  ```bash
  docker exec openclaw wget -qO- http://searxng:8080/ --timeout=5 | head -c 100
  docker exec openclaw wget -qO- http://searxng-adapter:3000/res/v1/web/search?q=test --timeout=5 | head -c 100
  docker exec openclaw wget -qO- http://lightpanda-adapter:9223/health --timeout=5
  ```

## 14. End-to-End Functional Tests

### Search test (most critical):
```bash
# From inside openclaw, simulate what the agent does when searching:
docker exec openclaw wget -qO- "http://searxng-adapter:3000/res/v1/web/search?q=weather+moscow&count=5" 2>/dev/null
```
- [ ] Returns valid JSON with `web.results[]` containing titles, URLs, descriptions
- [ ] Results are real (not empty/error)

### Browser test (Lightpanda):
```bash
docker exec openclaw wget -qO- "http://lightpanda-adapter:9223/json/list"
```
- [ ] Returns JSON array with at least one page entry

### OpenClaw CLI works:
```bash
docker exec openclaw node /app/openclaw.mjs --version
docker exec openclaw node /app/openclaw.mjs doctor
```
- [ ] Version returns successfully
- [ ] Doctor shows no critical issues

---

## Quick Verify Script

Run this all-in-one script on the server to check critical items:

```bash
#!/bin/bash
echo "=== OpenClaw Server Verification ==="
echo ""

# Containers
echo "--- Containers ---"
for c in openclaw searxng searxng-redis searxng-adapter lightpanda lightpanda-adapter; do
  STATUS=$(docker inspect $c --format='{{.State.Status}}' 2>/dev/null)
  if [ "$STATUS" = "running" ]; then
    echo "  ✅ $c: running"
  else
    echo "  ❌ $c: $STATUS"
  fi
done

echo ""
echo "--- Search ---"
SEARCH=$(docker exec openclaw wget -qO- "http://searxng-adapter:3000/res/v1/web/search?q=test&count=1" 2>/dev/null)
if echo "$SEARCH" | grep -q '"web"'; then
  echo "  ✅ SearXNG adapter: responding"
else
  echo "  ❌ SearXNG adapter: NOT responding"
fi

PROVIDER=$(docker exec openclaw node /app/openclaw.mjs config get tools.web.search.provider 2>/dev/null)
echo "  Search provider: $PROVIDER"

echo ""
echo "--- Browser ---"
HEALTH=$(docker exec openclaw wget -qO- "http://lightpanda-adapter:9223/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"healthy":true'; then
  echo "  ✅ Lightpanda: healthy"
else
  echo "  ❌ Lightpanda: $HEALTH"
fi

DEFAULT_PROFILE=$(docker exec openclaw node /app/openclaw.mjs config get browser.defaultProfile 2>/dev/null)
echo "  Default browser: $DEFAULT_PROFILE"

CHROME=$(docker exec openclaw google-chrome --version 2>/dev/null)
if [ -n "$CHROME" ]; then
  echo "  ✅ Chrome: $CHROME"
else
  echo "  ❌ Chrome: not installed"
fi

echo ""
echo "--- Config ---"
echo "  Provider: $(docker exec openclaw node /app/openclaw.mjs config get provider 2>/dev/null)"
echo "  Gateway: $(docker exec openclaw node /app/openclaw.mjs config get gateway.mode 2>/dev/null)"
echo "  contextTokens: $(docker exec openclaw node /app/openclaw.mjs config get agents.defaults.contextTokens 2>/dev/null)"
echo "  bootstrapMaxChars: $(docker exec openclaw node /app/openclaw.mjs config get agents.defaults.bootstrapMaxChars 2>/dev/null)"
echo "  maxConcurrent: $(docker exec openclaw node /app/openclaw.mjs config get agents.defaults.maxConcurrent 2>/dev/null)"
echo "  dmPolicy: $(docker exec openclaw node /app/openclaw.mjs config get channels.telegram.dmPolicy 2>/dev/null)"

echo ""
echo "--- Permissions ---"
EACCES=$(docker logs openclaw --tail 50 2>&1 | grep -c "EACCES")
if [ "$EACCES" = "0" ]; then
  echo "  ✅ No EACCES errors"
else
  echo "  ❌ $EACCES EACCES errors in recent logs"
fi

OWNER=$(docker exec openclaw ls -ld /home/node/.openclaw/ 2>/dev/null | awk '{print $3":"$4}')
echo "  /home/node/.openclaw/ owner: $OWNER"

echo ""
echo "--- Skills ---"
SKILL_COUNT=$(docker exec openclaw ls /app/skills/ 2>/dev/null | wc -l)
DISABLED_COUNT=$(docker exec openclaw ls /app/skills-disabled/ 2>/dev/null | wc -l)
echo "  Active skills: $SKILL_COUNT"
echo "  Disabled skills: $DISABLED_COUNT"

echo ""
echo "--- Watchdog ---"
CRON=$(crontab -l 2>/dev/null | grep -c openclaw-watchdog)
if [ "$CRON" -gt 0 ]; then
  echo "  ✅ Watchdog cron active"
else
  echo "  ❌ Watchdog cron missing"
fi

echo ""
echo "--- CLAUDE.md ---"
CLAUDE_MD=$(docker exec openclaw cat /home/node/.openclaw/CLAUDE.md 2>/dev/null)
if echo "$CLAUDE_MD" | grep -q "Quality Gates"; then
  echo "  ✅ Quality Gates present"
else
  echo "  ❌ Quality Gates missing"
fi
if echo "$CLAUDE_MD" | grep -q "ПРАВИЛО ПРОВЕРКИ ССЫЛОК"; then
  echo "  ✅ Link verification rule present"
else
  echo "  ❌ Link verification rule missing"
fi

echo ""
echo "=== Done ==="
```

---

## Common Issues & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container crash-looping | Invalid config in openclaw.json | Fix via volume: `cat /var/lib/docker/volumes/openclaw_config/_data/openclaw.json` then patch and `docker restart openclaw` |
| EACCES errors | Volume created as root | `docker exec -u root openclaw chown -R node:node /home/node/.openclaw` |
| Search returns empty | SearXNG not ready or adapter down | `docker compose restart searxng searxng-adapter` |
| Lightpanda hangs | Consecutive timeouts trigger auto-restart | Check adapter logs: `docker logs lightpanda-adapter --tail 20` |
| Telegram bot not responding | dmPolicy not "open" or allowFrom wrong | Re-run `_apply_config_with_retry()` or fix manually |
| "Thought signature" errors | Gemini model cache corruption | Watchdog should auto-compact; manual: `docker exec openclaw node /app/openclaw.mjs agent --message "/compact"` |
| `provider: searxng` in config | Old config remnant | Run `_clean_invalid_searxng_config()` or fix openclaw.json manually |
| Skills not loading | Wrong permissions on /app/skills/ | `docker exec -u root openclaw chown -R node:node /app/skills /app/skills-disabled` |
| HTTP chat endpoint not responding | Port 18789 not exposed or chatCompletions not enabled | Check docker-compose ports and run `config set gateway.http.endpoints.chatCompletions '{"enabled": true}'` |

---

## 15. HTTP Chat Endpoint (Mobile App)

Port 18789 exposes an OpenAI-compatible `POST /v1/chat/completions` endpoint for the mobile app.

- [ ] **Port 18789 exposed** — `docker port openclaw` shows `18789/tcp -> 0.0.0.0:18789`
- [ ] **Port accessible externally** — `curl -s http://<IP>:18789/ -o /dev/null -w "%{http_code}"` returns non-connection-refused
- [ ] **chatCompletions enabled in config** — verify via:
```bash
docker exec openclaw node /app/openclaw.mjs config get gateway.http.endpoints.chatCompletions
# Expected: {"enabled": true}
```
- [ ] **Gateway token auth works** — unauthenticated request is rejected:
```bash
# Without token — should fail (401/403)
curl -s http://<IP>:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"hi"}]}' \
  -w "\n%{http_code}"

# With token — should get a response
GATEWAY_TOKEN=$(grep OPENCLAW_GATEWAY_TOKEN /root/openclaw/.env | cut -d= -f2)
curl -s http://<IP>:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GATEWAY_TOKEN" \
  -d '{"model":"test","messages":[{"role":"user","content":"Say hello in one word"}]}' \
  -w "\n%{http_code}"
# Expected: 200 with JSON response containing choices[0].message.content
```
- [ ] **gateway_token stored in DB** — Server model has non-empty `gateway_token` field
