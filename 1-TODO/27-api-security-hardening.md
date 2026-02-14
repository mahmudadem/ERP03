# 27 — API Security Hardening

> **Priority:** P2 (Required before production deployment)
> **Estimated Effort:** 1–2 days
> **Dependencies:** None
> **Source:** Final Audit — GAP F

---

## Problem Statement

The API server has **no security hardening** beyond authentication:
- ❌ No rate limiting — vulnerable to brute-force and DoS attacks
- ❌ No security headers (helmet) — vulnerable to XSS, clickjacking
- ❌ No CORS configuration — any origin can call the API
- ❌ No request body size limits — can accept arbitrarily large payloads
- ❌ No input sanitization middleware

---

## Current State

- ✅ Auth middleware exists and validates Firebase tokens
- ✅ Permission guards check RBAC on every endpoint
- ✅ Tenant context ensures company isolation at the application level
- ❌ No express-rate-limit
- ❌ No helmet
- ❌ No cors configuration
- ❌ No compression

---

## Architecture: SQL Migration Ready

Security middleware is **fully database-agnostic** — it sits in the Express pipeline before any database calls. No changes needed for SQL migration.

---

## Implementation Plan

### Step 1: Install Dependencies

```bash
cd backend && npm install helmet cors express-rate-limit compression
cd backend && npm install -D @types/cors @types/compression
```

### Step 2: Add Security Middleware

**File:** `backend/src/api/server/app.ts` or main Express setup (MODIFY)

```typescript
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

// Security headers
app.use(helmet());

// CORS — restrict to known origins
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id', 'x-request-id']
}));

// Compression
app.use(compression());

// Body size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' }
});
app.use('/api/', globalLimiter);

// Stricter rate limit on auth endpoints: 10 per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts. Please try again later.' }
});
app.use('/api/auth/', authLimiter);
```

### Step 3: Add ALLOWED_ORIGINS to Environment Config

**File:** `.env` or environment configuration

```
ALLOWED_ORIGINS=http://localhost:5173,https://your-production-domain.com
```

### Step 4: Add Security Headers Check

After deployment, verify headers with:
```bash
curl -I https://your-api-url/api/health
# Should see: X-Content-Type-Options, X-Frame-Options, etc.
```

---

## Verification Plan

### Manual
1. Start the server → verify no startup errors
2. Make an API call from an allowed origin → should succeed
3. Make an API call from a disallowed origin → should be blocked by CORS
4. Send 101 requests in 15 minutes → should get 429 (Too Many Requests) on the 101st
5. Send a POST with a >1MB body → should be rejected
6. Check response headers with curl → should include security headers

---

## Acceptance Criteria

- [ ] `helmet` security headers present on all responses
- [ ] CORS restricts origins to configured whitelist
- [ ] Rate limiting active: 100/15min global, 10/15min on auth
- [ ] Request body limited to 1MB
- [ ] Response compression enabled
- [ ] No startup errors or regressions
- [ ] `ALLOWED_ORIGINS` configurable via environment variable
