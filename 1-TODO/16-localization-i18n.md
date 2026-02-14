# 16 — Localization / i18n

> **Priority:** P3 (Lower)
> **Estimated Effort:** Ongoing (initial setup: 3 days, then incremental)
> **Dependencies:** None

---

## Business Context

For a multi-country ERP, all UI text must be translatable. Target languages based on likely customer base:
- **English** (default)
- **Arabic** (requires RTL layout support)
- **Turkish**

---

## Current State

- ❌ All UI text is hardcoded English strings
- ❌ No i18n library integrated
- ❌ No RTL support
- ❌ No locale-aware number/date formatting (partially handled by `dateUtils`)

---

## Requirements

1. Integrate `react-i18next` (or similar) for string management
2. Extract all hardcoded strings into translation files
3. Language selector in user profile/settings
4. RTL layout support for Arabic
5. Locale-aware number formatting (1,000.00 vs 1.000,00)
6. Locale-aware date formatting (MM/DD vs DD/MM)

---

## Implementation Plan

### Step 1: Setup
```bash
cd frontend && npm install i18next react-i18next i18next-browser-languagedetector
```

### Step 2: Create Translation Files
```
frontend/src/locales/
  en/
    common.json
    accounting.json
  ar/
    common.json
    accounting.json
  tr/
    common.json
    accounting.json
```

### Step 3: Configure i18next
- Initialize with fallback language (en)
- Detect browser language
- Store user preference

### Step 4: Replace Hardcoded Strings
- Start with the most-used pages (dashboard, voucher list, voucher entry)
- Use `t('key')` function calls
- Gradually cover all pages

### Step 5: RTL Support
- Add `dir="rtl"` to root element when Arabic is selected
- Use CSS logical properties (margin-inline-start vs margin-left)
- Test all layouts in RTL mode

---

## Acceptance Criteria

- [ ] i18next configured and working
- [ ] At least one complete page translated to a second language
- [ ] Language switcher in UI
- [ ] RTL layout works for Arabic (no overlapping, correct alignment)
- [ ] Number and date formatting respects locale
