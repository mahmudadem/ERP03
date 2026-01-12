# Voucher Handlers

## ⚠️ TESTING ONLY - Not Used in Production

This directory contains **test helpers** for voucher creation.

## Purpose

Handlers provide a clean API for **tests and seeders**:
- Unit tests
- Integration tests  
- Seeder scripts (optional)

## NOT for Production

**Production uses strategies** (see `../strategies/`).

Handlers were introduced in ADR-005 for cleaner testing, but the production API uses the strategy pattern to support custom forms.

## When to Use

✅ **Use handlers when:**
- Writing unit tests
- Writing integration tests
- Creating seeder data

❌ **Don't use handlers for:**
- Production API endpoints
- Custom voucher forms
- User-facing features

## See Also

- `../ARCHITECTURE.md` - Full architecture documentation
- `../strategies/` - Production posting logic
