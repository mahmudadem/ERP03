# Graphify Usage

## Purpose

Graphify is a supplementary architecture map for ERP03. It helps agents answer cross-module questions without repeatedly scanning the whole repository.

Primary project truth remains:

1. `ACTIVE.md`
2. `JOURNAL.md`
3. `VISION.md`
4. Actual source files and tests

Graphify does not replace source-code reading, task status files, or verification.

## Commands

Use these root commands:

```bash
npm run graph:update
npm run graph:check
npm run graph:query -- "How does Sales connect to Accounting?"
npm run graph:explain -- "SendChatMessageUseCase"
npm run graph:path -- "Sales" "Accounting"
```

On Windows, direct wrappers are also available:

```bat
scripts\graphify.bat query "How does AI Assistant connect to Accounting tools?"
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\graphify.ps1 explain "SendChatMessageUseCase"
```

## When To Use It

Use graphify for:

- unfamiliar module orientation,
- cross-module architecture questions,
- dependency/risk checks before broad changes,
- tracing relationships between domains, use cases, repositories, and controllers.

Do not use graphify for:

- exact function or filename lookup,
- current task status,
- small local edits,
- test/build verification,
- replacing direct source review.

## Maintenance

Run `npm run graph:update` after code changes that should be reflected in the architecture map. The update is AST-only and does not require LLM/API tokens.

If the graph is stale, compare:

```bash
git rev-parse HEAD
```

with the `Built from commit` line in `graphify-out/GRAPH_REPORT.md`.
