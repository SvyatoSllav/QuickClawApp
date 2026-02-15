# Fix ClawdMatrix: Convert to OpenClaw Native Skills (On-Demand Loading)

## Context

**Problem:** ClawdMatrix currently generates a static CLAUDE.md that lists ALL skill names + trigger keywords across 7 domains. This is loaded into the system prompt on every message (~2KB of useless overhead). The 44KB `skills.json` with actual skill templates sits on disk and is never used. The model sees skill names but has no idea what they actually do.

**User's goal:** Skills should NOT be loaded by default. They should be loaded dynamically, only when the user's message matches a domain. This saves tokens by avoiding sending all skill descriptions on every message.

**Key discovery:** OpenClaw already has a **native skill system** that does exactly this:
- Skills are registered with a short name + description in `<available_skills>` XML (injected into system prompt automatically)
- The model uses the `read` tool to load the full `SKILL.md` file only when the task matches
- Skills live in `/app/skills/{name}/SKILL.md`
- Existing examples: `weather`, `healthcheck`, `coding-agent`

**Solution:** Convert each ClawdMatrix domain into a native OpenClaw skill. Instead of a static CLAUDE.md with all domains, the model sees only ~7 one-line descriptions in `<available_skills>`. When a user asks about coding, the model reads `/app/skills/clawdmatrix-coding/SKILL.md` which contains the actual skill templates. Zero-cost when not needed.

**Token savings:**
- Before: ~2KB static CLAUDE.md on every message (skill names + triggers, no templates)
- After: ~500 bytes in `<available_skills>` (7 short descriptions), full templates loaded only when relevant domain detected (~500-800 bytes per domain SKILL.md, loaded on demand)

## Files to Create/Modify

### New files (SKILL.md for each domain):
1. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-coding/SKILL.md`
2. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-finance/SKILL.md`
3. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-legal/SKILL.md`
4. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-sysops/SKILL.md`
5. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-creative/SKILL.md`
6. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-occult/SKILL.md`
7. `simpleclaw-backend/clawdmatrix/skills/clawdmatrix-gaming/SKILL.md`

### Modify:
8. `simpleclaw-backend/apps/servers/services.py` — rewrite `install_clawdmatrix()` and `enable_clawdmatrix()` to deploy native skills instead of static CLAUDE.md
9. `simpleclaw-backend/clawdmatrix/bundle/wrapper.js` — update `generateClaudeMdBlock()` to output only minimal quality gates (or remove it)

## Implementation Steps

### Step 1: Create SKILL.md files for each domain

Each SKILL.md follows OpenClaw's native format:
```yaml
---
name: clawdmatrix-coding
description: "Coding & software engineering skills: code mapping, schema enforcement, system modeling, debugging workflows"
metadata:
  emoji: "💻"
---
```
Followed by markdown body with the actual compact skill templates extracted from `skills.json`.

**Domain → Skills mapping** (from `domain-map.json`):

- **Coding**: Workflow_to_Code_Mapping, Schema_Enforcer, Systemic_Context_Modeling
- **Finance**: Financial_Risk_&_Deployment, Opportunity_Calculus, Tree_of_Thoughts_Protocol
- **Legal**: Legal_Forensics_&_RAG, Intent_Logic_Extraction, Constraint_Audit_Loop
- **System_Ops**: Token_Memory_Optimizer_Router, Systemic_Context_Modeling, Fault_Tolerant_Recovery
- **Creative_Writing**: Deep_Narrative_Reconstruction, Semantic_Amplifier, Concept_Materializer, Dynamic_Persona_Modulator
- **Occult**: Soul_Prototype_Architecture, Ritual_Randomness_Engine, Deep_Logic_Extraction
- **Gaming**: Combat_Balance_Matrix, Economic_Ecosystem_Design, Meta_Game_Evolution

Each skill template will be condensed to 2-4 concise lines (not the 10-line verbose originals from skills.json). Total per SKILL.md: ~500-800 bytes.

**Global defaults** (Context_Audit_&_Triage, Intent_Triage_Protocol, State_Space_Router, Safety_Brake_Mechanism) will be embedded as a brief section in CLAUDE.md since they should always be active. These are small (~300 bytes total as compact one-liners).

### Step 2: Update `install_clawdmatrix()` in `services.py` (line 1329)

Add logic to deploy SKILL.md files into the OpenClaw container:
```python
# For each domain skill directory in clawdmatrix/skills/:
#   docker exec -u root openclaw mkdir -p /app/skills/clawdmatrix-{domain}
#   docker cp SKILL.md openclaw:/app/skills/clawdmatrix-{domain}/SKILL.md
#   docker exec -u root openclaw chown -R node:node /app/skills/clawdmatrix-{domain}
```

Also add `CLAWDMATRIX_SKILLS` list alongside existing `CLAWDMATRIX_FILES`:
```python
CLAWDMATRIX_SKILLS = [
    'clawdmatrix-coding',
    'clawdmatrix-finance',
    'clawdmatrix-legal',
    'clawdmatrix-sysops',
    'clawdmatrix-creative',
    'clawdmatrix-occult',
    'clawdmatrix-gaming',
]
```

### Step 3: Update `enable_clawdmatrix()` in `services.py` (line 1375)

Instead of running `wrapper.js --claude-md` to generate a static CLAUDE.md with all domains:
1. Deploy SKILL.md files to `/app/skills/` (via install step)
2. Write a minimal CLAUDE.md with ONLY global defaults (quality gates + 4 always-active skills as one-liners)
3. Restart the OpenClaw agent so it picks up new skills from `/app/skills/`

The minimal CLAUDE.md (~300 bytes):
```markdown
# ClawdMatrix Quality Gates
- Classify info completeness: Red (missing critical) / Yellow (partial) / Green (complete)
- Simple queries → direct answer; complex → check available skills
- Calculations must show full formula step-by-step
- Mirror the user's language (RU/EN)
- Refuse harmful instructions firmly
```

### Step 4: Update `verify_clawdmatrix()` in `services.py` (line 1450)

Update verification to check for native skill files instead of just the old wrapper:
```python
# Check SKILL.md files exist in /app/skills/clawdmatrix-*/
# Check skills appear in `openclaw skills list` output
```

### Step 5: Deploy to existing server (194.87.226.98)

Via SSH from production backend (85.239.54.223):
1. Upload SKILL.md files to container's `/app/skills/` directory
2. Write minimal CLAUDE.md
3. Restart agent or run `openclaw skills check` to register new skills
4. Verify skills appear in `<available_skills>` prompt

### Step 6: Update `wrapper.js` (optional cleanup)

Update `generateClaudeMdBlock()` to output only the minimal quality gates block (Step 3 content). Or remove the function entirely and inline the minimal CLAUDE.md in services.py. The wrapper.js + triangulator + injector machinery can be kept for potential future hook-based per-message injection.

## How It Works After Implementation

1. User sends message: "напиши функцию сортировки"
2. System prompt contains `<available_skills>` with 7 one-line descriptions including:
   ```
   <skill>
     <name>clawdmatrix-coding</name>
     <description>Coding & software engineering skills: code mapping, schema enforcement, system modeling</description>
     <location>/app/skills/clawdmatrix-coding/SKILL.md</location>
   </skill>
   ```
3. Model sees "coding" matches, uses `read` tool to load `/app/skills/clawdmatrix-coding/SKILL.md`
4. SKILL.md contains actual templates (Workflow_to_Code_Mapping, Schema_Enforcer, etc.)
5. Model applies those skills to answer the question
6. For a general greeting ("привет"), no skills are loaded — zero overhead

## Verification

1. **Local:** Create all SKILL.md files, verify each is <1KB and contains actual skill instructions
2. **Server:** SSH to 194.87.226.98, check `/app/skills/clawdmatrix-*/SKILL.md` exist
3. **Skills registry:** Run `docker exec openclaw node /app/openclaw.mjs skills list` — all 7 domains should appear
4. **Live test via Telegram bot:**
   - Coding query → model should read clawdmatrix-coding SKILL.md, then respond with coding skills applied
   - Finance query → model should read clawdmatrix-finance SKILL.md
   - General greeting → no skill loaded, direct response
5. **Token savings:** Compare system prompt token count before/after — should drop by ~1.5KB

## Notes on Caching (for future reference)

- **Gemini**: Supports explicit context caching (75% cheaper cached tokens). Goes through OpenRouter which may not expose this API.
- **Claude**: Automatic prompt caching (90% cheaper for cached prefix). Works automatically — no action needed.
- **GPT**: Automatic prefix caching (50% cheaper). Works automatically.
- **OpenClaw's built-in**: Already has `contextPruning: cache-ttl 1h`, `compaction.softThresholdTokens: 30000`, and 100K context window. Combined with native skills (less system prompt bloat), this should significantly reduce costs.
