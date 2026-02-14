# 26 — Production Logging & Observability

> **Priority:** P2 (Required before production deployment)
> **Estimated Effort:** 2 days
> **Dependencies:** None
> **Source:** Final Audit — GAP E

---

## Problem Statement

The backend uses `console.log` extensively and the `StructuredLogger` (80 lines) is a thin wrapper around `console.*`. Critical issues:

1. **Sensitive data leakage** — `tenantContextMiddleware.ts` logs `userId`, `roleId`, `companyId`, and `permissions` on EVERY request (lines 58-59)
2. **No log levels** — Cannot filter debug vs error in production
3. **No request tracing** — Cannot correlate logs across a single API call
4. **No centralized aggregation** — Logs go to stdout only
5. **No performance metrics** — No API response time tracking

---

## Current State

- ✅ `StructuredLogger.ts` exists with `info/error/warn/debug` methods
- ✅ JSON-formatted output (good foundation)
- ❌ Not used in most files (raw `console.log` used instead)
- ❌ No request ID generation or propagation
- ❌ No log level filtering (all levels always printed)
- ❌ No performance monitoring
- ❌ Sensitive data logged in plain text

---

## Architecture: SQL Migration Ready

Logging is **database-agnostic** by nature. However:
- When running on Firestore/Firebase: logs go to Cloud Logging (GCP)
- When running on SQL/Docker: logs should go to ELK stack, Datadog, or similar
- The StructuredLogger abstraction should support **pluggable transports**

---

## Implementation Plan

### Step 1: Enhance StructuredLogger

**File:** `backend/src/infrastructure/logging/StructuredLogger.ts` (MODIFY)

Add:
- Configurable log level (`LOG_LEVEL` env var)
- Request context injection (requestId, userId, companyId)
- Sensitive data redaction
- Performance timing utility

```typescript
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

class StructuredLogger {
  private context: Record<string, any> = {};

  withContext(ctx: Record<string, any>): StructuredLogger {
    const child = new StructuredLogger();
    child.context = { ...this.context, ...ctx };
    return child;
  }

  info(event: string, data: LogData = {}) {
    if (currentLevel > LOG_LEVELS.info) return;
    this.emit('info', event, data);
  }

  // ... similar for debug, warn, error

  private emit(level: string, event: string, data: LogData) {
    const entry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...this.redact(data)
    };
    console.log(JSON.stringify(entry));
  }

  private redact(data: LogData): LogData {
    // Redact sensitive fields
    const sensitive = ['password', 'token', 'secret', 'authorization'];
    // ... implementation
  }
}
```

### Step 2: Add Request ID Middleware

**File:** `backend/src/api/middlewares/requestIdMiddleware.ts` (NEW)

```typescript
import { v4 as uuid } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuid();
  res.setHeader('x-request-id', req.requestId);
  next();
};
```

### Step 3: Add Request Logging Middleware

**File:** `backend/src/api/middlewares/requestLoggingMiddleware.ts` (NEW)

Logs:
- Request: method, URL, user ID (no body/headers)
- Response: status code, duration in ms
- Does NOT log request/response bodies (PII risk)

### Step 4: Remove Verbose Console Logs

- Remove `console.log` from `tenantContextMiddleware.ts` (lines 58-59)
- Replace scattered `console.log` with `logger.info/debug` calls throughout
- Search for and remove or downgrade all `console.log` in production code paths

### Step 5: API Response Time Tracking

Add response time header:
```typescript
res.setHeader('x-response-time', `${duration}ms`);
```

Log slow requests (>1000ms) at WARN level.

---

## Verification Plan

### Manual
1. Set `LOG_LEVEL=warn` → verify info/debug messages suppressed
2. Make an API call → verify `x-request-id` header in response
3. Verify request/response logged with duration
4. Verify no sensitive data (passwords, tokens) in logs
5. Verify `tenantContextMiddleware` no longer logs permissions on every request

---

## Acceptance Criteria

- [ ] Configurable log levels via `LOG_LEVEL` env var
- [ ] Request ID generated and propagated through all logs
- [ ] API response time tracked and logged
- [ ] Sensitive data redacted from logs
- [ ] Verbose `console.log` removed from `tenantContextMiddleware`
- [ ] Slow request warnings (>1000ms)
- [ ] Existing `StructuredLogger` enhanced, not replaced
