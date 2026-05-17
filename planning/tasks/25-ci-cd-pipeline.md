# 25 — CI/CD Pipeline & Test Runner

> **Priority:** P1 (Required for code quality)
> **Estimated Effort:** 2–3 days
> **Dependencies:** None
> **Source:** Final Audit — GAP D

---

## Problem Statement

The project has **14 domain test files** in `backend/src/tests/` but:
- No visible test runner configuration (`jest.config` / `vitest.config`)
- No CI/CD pipeline (no `.github/workflows/`)
- No pre-commit hooks
- No automated type-checking in CI
- Unknown whether existing tests even run

Without automated testing, every code change is a gamble.

---

## Current State

- ✅ `backend/src/tests/domain/accounting/` — 14 test files exist
- ✅ `backend/src/application/accounting/use-cases/__tests__/` — 4 test files exist
- ❌ No CI/CD pipeline
- ❌ No pre-commit hooks
- ❌ No automated lint/format enforcement
- ❌ Frontend has zero tests

---

## Architecture: SQL Migration Ready

CI pipeline should be **database-agnostic**:
- Domain tests should NOT depend on Firestore or any specific database
- Integration tests that hit Firestore should use the Firebase emulator
- When migrating to SQL, swap the emulator step for a PostgreSQL testcontainer
- The pipeline structure itself (lint → typecheck → test → build) is universal

---

## Implementation Plan

### Step 1: Verify & Configure Test Runner

**Backend:**
```bash
# Check if jest or vitest is already in dependencies
cd backend && cat package.json | grep -E "jest|vitest|mocha"

# If not present, install:
npm install -D jest ts-jest @types/jest
```

Create `backend/jest.config.ts`:
```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 30,    // Start low, increase over time
      functions: 30,
      lines: 30,
      statements: 30
    }
  }
};
```

Add to `backend/package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc --noEmit"
  }
}
```

### Step 2: Run Existing Tests

```bash
cd backend && npm test
```

Fix any broken tests. Document test results.

### Step 3: Create GitHub Actions CI Pipeline

**File:** `.github/workflows/ci.yml` (NEW)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: TypeScript type check
        working-directory: backend
        run: npx tsc --noEmit

      - name: Run tests
        working-directory: backend
        run: npm test -- --ci --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()
        with:
          directory: backend/coverage

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: TypeScript type check
        working-directory: frontend
        run: npx tsc --noEmit

      - name: Build
        working-directory: frontend
        run: npm run build
```

### Step 4: Add Pre-Commit Hooks

```bash
# At project root
npm install -D husky lint-staged
npx husky init
```

**File:** `.husky/pre-commit` (NEW)
```bash
npx lint-staged
```

**File:** `package.json` (root — add)
```json
{
  "lint-staged": {
    "backend/src/**/*.ts": [
      "cd backend && npx tsc --noEmit"
    ],
    "frontend/src/**/*.{ts,tsx}": [
      "cd frontend && npx tsc --noEmit"
    ]
  }
}
```

### Step 5: Add ESLint (Optional but Recommended)

```bash
cd backend && npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
cd frontend && npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
```

---

## Verification Plan

### Automated
1. `cd backend && npm test` — All existing tests pass
2. `cd backend && npx tsc --noEmit` — No type errors
3. `cd frontend && npx tsc --noEmit` — No type errors
4. `cd frontend && npm run build` — Build succeeds
5. Push to a branch → verify GitHub Actions runs and passes

---

## Acceptance Criteria

- [ ] `npm test` works in backend and runs all existing tests
- [ ] All existing tests pass (or broken ones documented)
- [ ] TypeScript type-checking runs without errors (or known errors documented)
- [ ] GitHub Actions CI pipeline runs on push/PR
- [ ] Pre-commit hooks prevent pushing type errors
- [ ] Test coverage report generated
