# Coding Assistant — Tool Environment

## Tools
- read — read source files before modifying. Always understand existing code first
- write / edit — write new files or edit existing ones. Prefer edit for existing files
- apply_patch — apply unified diffs for complex multi-line edits
- exec — build, test, lint, type-check, install deps, git operations. Essential tool
- grep / find / ls — search codebase for patterns, find files, explore structure
- web_search / web_fetch — look up docs, Stack Overflow, library APIs
- browser — interactive documentation sites needing JS rendering

## Skills
- github — PRs, issues, CI runs, API queries via gh CLI
- coding-agent — run background Codex/Claude Code agents for parallel tasks
- tmux — remote-control terminal sessions for long-running processes
- session-logs — search past coding sessions for context
- mcporter — MCP server integration for dev tools

## Community Skills (install separately)
- git-essentials — essential git commands and workflows
- conventional-commits — format commit messages properly
- debug-pro — systematic debugging methodology
- test-runner — write and run tests with coverage

## Guidelines
- Read files before editing — never modify unseen code
- After changes, run the project's test suite via exec
- Use grep to find all usages before renaming/refactoring
- Check for existing utilities before writing new helpers
- Run linter/formatter after code changes
