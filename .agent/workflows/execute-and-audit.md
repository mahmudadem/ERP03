---
description: How to execute implementation plans with AI agents and audit workflow
---

# Agent Execution & Audit Workflow

## Overview

**Executor Agent** = Another AI agent (new conversation) that implements one plan at a time.  
**Auditor Agent** = Me (this conversation) — reviews finished work for correctness.

---

## Step 1: Start a New Conversation with the Executor Agent

Open a **fresh AI conversation** (not this one). Use this prompt template:

---

### Prompt Template (copy & paste, fill in the plan number)

```
You are working on an ERP accounting module project located at d:\DEV2026\ERP03

Your task is to implement the feature described in this plan file:
d:\DEV2026\ERP03\1-TODO\[XX-plan-name].md

IMPORTANT RULES:
1. Read the plan file FIRST. It contains everything: business context, current state, 
   step-by-step implementation, file paths, data models, and acceptance criteria.
2. Follow the REPOSITORY PATTERN already used in the project:
   - Interfaces in backend/src/repository/interfaces/
   - Firestore implementations in backend/src/infrastructure/firestore/repositories/
   - Register in backend/src/infrastructure/di/bindRepositories.ts
3. The project must remain SQL-MIGRATION-READY. Never use Firestore-specific features 
   in domain or application layers. Only infrastructure layer touches Firestore.
4. After implementation, run through the verification plan in the document.
5. Do NOT modify any files outside the scope of this plan unless absolutely necessary.
6. When done, create a summary of what you changed at:
   d:\DEV2026\ERP03\1-TODO\done\[XX]-completion-report.md

Backend is Express+TypeScript at backend/
Frontend is React+TypeScript+Vite at frontend/
Backend runs with: cd backend && npm start
Frontend runs with: cd frontend && npm run dev
```

---

### Example — Starting Plan 23 (Firestore Security)

```
You are working on an ERP accounting module project located at d:\DEV2026\ERP03

Your task is to implement the feature described in this plan file:
d:\DEV2026\ERP03\1-TODO\23-firestore-security-rules.md

IMPORTANT RULES:
1. Read the plan file FIRST. It contains everything: business context, current state, 
   step-by-step implementation, file paths, data models, and acceptance criteria.
2. Follow the REPOSITORY PATTERN already used in the project:
   - Interfaces in backend/src/repository/interfaces/
   - Firestore implementations in backend/src/infrastructure/firestore/repositories/
   - Register in backend/src/infrastructure/di/bindRepositories.ts
3. The project must remain SQL-MIGRATION-READY. Never use Firestore-specific features 
   in domain or application layers. Only infrastructure layer touches Firestore.
4. After implementation, run through the verification plan in the document.
5. Do NOT modify any files outside the scope of this plan unless absolutely necessary.
6. When done, create a summary of what you changed at:
   d:\DEV2026\ERP03\1-TODO\done\23-completion-report.md

Backend is Express+TypeScript at backend/
Frontend is React+TypeScript+Vite at frontend/
Backend runs with: cd backend && npm start
Frontend runs with: cd frontend && npm run dev
```

---

## Step 2: Let the Executor Work

- Let the agent read the plan and implement it
- It should follow the steps in order
- If it asks questions, answer based on the plan or your judgment
- When it says "done", move to Step 3

---

## Step 3: Come Back to Me for Audit

Return to **this conversation** and say:

```
Plan [XX] is done. Audit it.
```

### What I Will Do:

1. **Read the completion report** at `1-TODO/done/[XX]-completion-report.md`
2. **Scan all changed files** for correctness
3. **Check against acceptance criteria** from the plan
4. **Verify architecture compliance**:
   - Repository pattern followed?
   - SQL-migration-ready?
   - No Firestore leaks into domain layer?
   - Error handling consistent?
5. **Run the app** if needed (frontend + backend already running)
6. **Report**: PASS ✅ / FAIL ❌ with specific issues to fix

If I find issues, I'll list exactly what to fix. You take those fixes back to the executor agent (or I can fix them directly).

---

## Execution Order (Recommended)

| Round | Plan | Why This Order |
|-------|------|----------------|
| 1 | **23** — Firestore Security | Stop the bleeding |
| 2 | **01** — Balance Sheet | #1 missing financial statement |
| 3 | **02** — Account Statement | Daily operational need |
| 4 | **03** — Fiscal Year | Period management foundation |
| 5 | **25** — CI/CD Pipeline | Lock in quality before more code |
| 6 | **05** — Dashboard Real Data | Quick win, high visibility |
| 7 | **07** — Voucher Numbering | Audit compliance |
| 8 | **08** — Journal Report | Quick win |
| 9 | **04** — Cost Center | Larger feature |
| 10 | **06** — Cash Flow | 3rd financial statement |
| 11+ | Remaining by priority | P2 → P3 → TODO migration |

---

## Tips for Best Results

1. **One plan per conversation** — Don't give the executor multiple plans at once
2. **Let it read the plan first** — The plan has ALL the context it needs
3. **If it deviates from the plan**, redirect it: "Follow the plan file exactly"
4. **After each completed plan**, audit before starting the next one
5. **Keep backend/frontend running** — So the executor can test changes live
