# Server Deployment Checklist

Use this checklist when provisioning new servers or auditing existing ones.

## A. Docker Containers (6 total)

- [ ] `openclaw` — main agent (custom image with Chrome + python-pptx + SearXNG sed-patch)
- [ ] `searxng` — private search instance (searxng/searxng:latest)
- [ ] `searxng-redis` — Redis cache for SearXNG (valkey/valkey:8-alpine)
- [ ] `searxng-adapter` — Brave->SearXNG API translator (port 3000)
- [ ] `lightpanda` — lightweight secondary browser (lightpanda/browser:nightly)
- [ ] `lightpanda-adapter` — CDP HTTP bridge for Lightpanda (port 9223)

## B. OpenClaw Configuration

- [ ] Provider: openrouter
- [ ] Search provider: brave (sed-patched to SearXNG adapter in Dockerfile)
- [ ] Search enabled: true
- [ ] Browser default profile: lightpanda
- [ ] Browser headless: true
- [ ] Browser noSandbox: true
- [ ] Lightpanda profile: cdpUrl = http://lightpanda-adapter:9223
- [ ] Gateway mode: local

## C. Token Optimization

- [ ] contextTokens: 100000 (trigger compaction at 100K, not 200K)
- [ ] bootstrapMaxChars: 20000 (limit system prompt bloat)
- [ ] heartbeat: disabled ("every": "0m") — saves ~30% tokens
- [ ] subagents model: gemini-3-flash-preview (cheap)
- [ ] imageModel: gemini-2.5-flash (cheap)
- [ ] compaction: memoryFlush enabled, softThresholdTokens: 30000
- [ ] contextPruning: cache-ttl 1h, keepLastAssistants: 3
- [ ] maxConcurrent: 2
- [ ] memorySearch: local (semantic memory across sessions)
- [ ] Fallback models: gemini-2.5-flash -> claude-haiku-4.5
- [ ] Model aliases: opus, sonnet, haiku, flash, gemini3

## D. Skills

### Essential skills in /app/skills/ (~26 total)

- [ ] bird, canvas, clawhub, coding-agent, gemini, healthcheck
- [ ] model-usage, nano-pdf, openai-image-gen, oracle
- [ ] session-logs, spotify-player, summarize, weather
- [ ] sag, openai-whisper, openai-whisper-api, songsee, video-frames (audio/media)
- [ ] clawdmatrix-coding, clawdmatrix-finance, clawdmatrix-legal (domain skills)
- [ ] clawdmatrix-sysops, clawdmatrix-creative, clawdmatrix-occult, clawdmatrix-gaming

### Restorable skills in /app/skills-disabled/

- [ ] 1password, blogwatcher, gifgrep, github, gog, goplaces
- [ ] himalaya, local-places, mcporter, notion, obsidian, skill-creator, tmux, trello
- [ ] Model can restore via `mv /app/skills-disabled/<name> /app/skills/<name>`

### Permanently removed (VPS-useless)

macOS-only, smart home, messaging (no accounts), food ordering, nano-banana-pro.

### File permissions

- [ ] /app/skills/ — owned by node:node (model can mv skills)
- [ ] /app/skills-disabled/ — owned by node:node

## E. CLAUDE.md (/home/node/.openclaw/CLAUDE.md)

- [ ] Quality Gates present (Red/Yellow/Green classification)
- [ ] Language mirroring rule (RU/EN)
- [ ] Skill restore instructions present (mv /app/skills-disabled/)
- [ ] File sending instructions present (mediaUrl, correct action values)
- [ ] Link verification rule present (ПРАВИЛО ПРОВЕРКИ ССЫЛОК)

## F. Dockerfile Extras

- [ ] python3-pip installed (apt)
- [ ] python-pptx installed (pip, survives container recreation)
- [ ] /app/clawdmatrix/ does NOT exist (old JS bundle removed)
- [ ] /home/node/.openclaw/clawdmatrix/ does NOT exist (old on-demand dir removed)

## G. Session Watchdog

- [ ] Script installed: /usr/local/bin/openclaw-watchdog.sh
- [ ] Cron job running: */2 * * * * (every 2 min)
- [ ] Detects "Thought signature is not valid" errors
- [ ] Auto-triggers /compact on active sessions

## H. Auth & Telegram (user-specific, only after quick_deploy_user)

- [ ] auth-profiles.json with OpenRouter API key
- [ ] telegram-allowFrom.json with owner's Telegram ID
- [ ] dmPolicy: open
- [ ] Telegram provider starting (visible in logs)

## I. File Permissions

- [ ] /home/node/.openclaw — owned by node:node
- [ ] /app/skills/* — owned by node:node
- [ ] /app/skills-disabled/* — owned by node:node
- [ ] No EACCES errors in docker logs
