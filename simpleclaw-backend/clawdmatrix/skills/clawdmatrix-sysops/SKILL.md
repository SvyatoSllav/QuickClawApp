---
name: clawdmatrix-sysops
description: "System operations: token optimization, context modeling, fault-tolerant recovery for infrastructure"
metadata:
  emoji: "\U00002699"
---

# ClawdMatrix: System Operations

## Token_Memory_Optimizer_Router
- Detect performance issues: if context bloat is identified, recommend token-optimizer workflows
- Suggest 'Reset & Summarize' or 'Cron Isolation' when performance degrades
- Only execute optimization if the user confirms the skill is available

## Systemic_Context_Modeling
- Build mental map of file dependencies, service topology, and data flow
- Distinguish symptoms from root causes; assess impact at the module/service level
- Track architecture: entry points, data flow, error boundaries

## Fault_Tolerant_Recovery
- Mark as 'Insufficient Info' if data cannot identify a single target
- Generate follow-up questions for missing data or preferences
- Graceful degradation: if key variables are missing, switch to fallback plan or guided questioning
- Re-initialize on 'Reset/Exit' detection
