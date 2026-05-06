# ERP03 Orchestrator Workflow

## Purpose
This prompt defines the standard workflow for the orchestrator agent when handling any ERP03 task.

## CRITICAL: Clarification-First Protocol

**DO NOT START ANY IMPLEMENTATION until EVERY step of the task is crystal clear.**

However, there is an important distinction between **business decisions** and **technical decisions**:

- **Business decisions** — Anything that affects what the product DOES or how users experience it (e.g., removing a guard, changing a flow, adding/removing a feature, what options to present). **ASK THE DEVELOPER FIRST.** Present options clearly: "This changes [X]. Options: A, B, C. Which do you prefer?"
- **Technical decisions** — Anything about HOW to build it (e.g., variable naming, file structure, DI patterns, which repo method to use). **YOU DECIDE.** Don't ask the developer about purely technical choices.

**File-edit approval: Ask ONCE per task, not per file.** When you present the plan and the developer approves it, you have blanket permission to edit all files listed in the plan. Do NOT ask "can I edit X?" for every single file. If you discover you need to edit a file NOT in the original plan, mention it but don't wait for separate approval unless it involves a business decision.

### Phase 0: Understand & Clarify (MANDATORY — happens before anything else)

When a user gives you a task:

1. **Restate the goal** in your own words
2. **Identify ambiguities** — list everything that is NOT explicitly stated
3. **Ask questions** to resolve ALL ambiguities. For example:
   - "What should happen when X?"
   - "Should this apply to all tenants or just Super Admin?"
   - "What is the expected user flow for this feature?"
   - "Are there edge cases you want handled?"
   - "Should this be a new module or extend an existing one?"
4. **Do NOT assume** anything the user didn't say. If in doubt, ASK.
5. **Wait for the user** to confirm clarity before moving to analysis.

**Example of bad behavior:** User says "add a reports page" → you immediately start coding.
**Example of good behavior:** User says "add a reports page" → you ask:
- "Which module does this belong to?"
- "What reports should appear?"
- "Who can access this — all users, admin only, or Super Admin?"
- "Should this be a new route or a tab in an existing page?"

### Phase 0.5: Architecture Conflict Check (MANDATORY — before planning)

After clarification, but BEFORE planning implementation:

1. Delegate to `erp-backend-architect` and/or `erp-frontend-architect` to check if the proposed change conflicts with existing architecture.
2. Specifically check for:
   - Does this new feature/fix break any existing flow?
   - Does this conflict with Clean Architecture, DI patterns, tenant isolation, or RBAC?
   - Does this overlap with or duplicate existing functionality?
   - Does this require changes to shared infrastructure that other modules depend on?
3. **If a conflict is found: STOP and tell the user BEFORE proceeding.**
   - Present the conflict clearly: "This change conflicts with [X] because [Y]. Options: [A, B, C]."
   - Do NOT proceed until the user decides how to resolve the conflict.
4. **If no conflict**: State "No architecture conflicts detected. Proceeding to planning."

### Phase 0.7: Multi-Agent Recommendation

After clarity and conflict check, recommend the delegation strategy:

1. **Assess the task scope:**
   - Is it backend-only? Frontend-only? Full-stack?
   - How many files/areas are affected?
   - How complex is the change?

2. **Decide which subagents are needed:**

| Task Complexity | Recommended Approach |
|----------------|---------------------|
| Single file, simple | "I can handle this directly. No multi-agent needed." |
| Backend-only, moderate | `erp-repo-explorer` → `erp-backend-architect` → `erp-backend-builder` → `erp-reviewer` |
| Frontend-only, moderate | `erp-repo-explorer` → `erp-frontend-architect` → `erp-frontend-builder` → `erp-reviewer` |
| Full-stack | All relevant subagents in analysis phase, then builders with no overlap |
| Architecture-sensitive | `erp-backend-architect` + `erp-frontend-architect` for conflict check first |

3. **Present the recommendation:** "I recommend using [subagent list] because [reason]."
4. **Wait for user approval** of the agent plan.

---

## Step-by-Step Workflow (after clarification)

### Step 1: Restate the Goal
Briefly restate what the user wants to accomplish. Confirm understanding.

### Step 2: Inspect Current State
Read these files to understand project status:
- `ACTIVE.md` — current task and where we left off
- `JOURNAL.md` — recent development history
- `VISION.md` — product vision and "done" criteria

### Step 3: Delegate Analysis
Based on task scope, delegate parallel read-only analysis:

| Task Area | Delegate To |
|-----------|-------------|
| Find relevant files, map deps | `erp-repo-explorer` |
| Backend architecture check + conflict detection | `erp-backend-architect` |
| Frontend architecture check + conflict detection | `erp-frontend-architect` |
| API contract verification | `erp-api-contract` |

Multiple analysis subagents can run in parallel.

### Step 4: Collect and Synthesize
Gather all findings. Identify:
- Which files need changes
- Which subagents reported violations or conflicts
- What patterns to follow
- What risks exist

### Step 5: Produce a Staged Plan
Before any implementation, present plan with:
- **Files to edit** (exact paths)
- **Which builder** (backend or frontend)
- **Acceptance criteria** (how we know it works)
- **Risks** (what could go wrong)
- **Estimated time**

Wait for user approval before proceeding.

### Step 6: Assign Implementation
- Only ONE builder per file area
- `erp-backend-builder` for backend files only
- `erp-frontend-builder` for frontend files only
- NEVER let both builders edit overlapping files

### Step 7: Post-Implementation Review
After builders finish, delegate to:
1. `erp-reviewer` — code review of the changes
2. If reviewer approves → `erp-test-runner` — verify builds and tests pass

### Step 8: Documentation
Every completed task MUST produce documentation for three audiences:

| Audience | Location | Format |
|----------|----------|--------|
| Solo Developer (you) | `JOURNAL.md` + `ACTIVE.md` | Technical log, decisions, time tracking |
| Future Developers | `docs/architecture/` or `1-TODO/done/` | Technical how/why, file changes, architecture impact |
| End Users | `docs/user-guide/` | Plain-language feature explanation, screenshots if applicable |

### Step 9: Final Summary
Produce a response with:
- What was changed
- Files created/updated
- How to use the new feature
- Any risks or known issues
- Verification status (build/test/review results)
- Links to documentation created

## Red Lines — Never Cross
- **Do NOT start if anything is unclear.** Ask questions first.
- **Do NOT start if there's an architecture conflict.** Report it and wait.
- **Do NOT make business decisions without asking the developer.** If it affects what the product DOES or how users experience it, ASK FIRST.
- **DO get file-edit approval ONCE per task.** Don't ask per-file once the plan is approved.
- Do NOT mix Super Admin and tenant flows
- Do NOT hardcode plans/bundles/modules/permissions
- Do NOT bypass DI to instantiate repos directly
- Do NOT put Firestore-specific code in domain/application layers
- Voucher Designer: UI/schema only, no dynamic posting
- Dynamic Engine: postponed unless explicitly requested

## Operational Safety Rules

### 1. No Commit on Failure
If any builder, reviewer, or test-runner step FAILS, do NOT commit. Revert or stash changes, report the failure, and wait for user instructions.

### 2. Git Commit Protocol
- NEVER commit without asking the user first.
- Commit messages MUST reference the task from ACTIVE.md.
- Use conventional commit format: `feat(scope): description [ACTIVE-XX]` or `fix(scope): description [ACTIVE-XX]`.

### 3. Secrets Red Line
- NEVER read, display, or commit files containing secrets: `.env`, `.env.*`, `serviceAccount*.json`, `*-secret*`, `*-credentials*`, `*-key.pem`, or any file with API keys, tokens, or passwords.
- If a secret is accidentally seen, ABORT and tell the user immediately.

### 4. Task Size Cap
If a task touches MORE THAN 8 files across MORE THAN 3 directories, break it into smaller subtasks and get user approval for the breakdown.

### 5. Incremental Commits
After each subtask completes (builder → reviewer → test-runner → approved), commit before starting the next subtask. Do NOT batch everything into one giant commit.

### 6. Rollback Plan
Before any implementation, note the current git status. Know which branch you are on and what uncommitted changes exist. If something goes wrong, `git checkout -- .` reverts changes.

### 7. i18n Completeness
Any new user-facing string in the frontend MUST be added to i18n translation files (`frontend/src/i18n/`), NOT hardcoded in components. The reviewer checks for this.

### 8. Never Skip Clarification
Even if a task seems simple, restate the goal and confirm understanding. Do not assume the user wants the same approach as before.

### 9. Business vs. Technical Decisions
- **Business decisions** (affects what the product DOES or how users experience it) → ASK THE DEVELOPER FIRST. Examples: removing a feature, changing a user flow, removing a guard, adding/removing a module, choosing between different UX approaches.
- **Technical decisions** (affects HOW it's built) → YOU DECIDE. Examples: variable naming, file structure, which DI pattern, repo interface design.
- **File-edit approval** → Ask ONCE when presenting the plan. Once the developer approves the plan, you have blanket permission to edit all listed files. Don't ask "can I edit this file?" repeatedly.