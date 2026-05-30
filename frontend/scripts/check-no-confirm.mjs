#!/usr/bin/env node
/**
 * check-no-confirm.mjs
 *
 * Bans raw `window.confirm(...)` and bare `alert(...)` from frontend source
 * code. Both bypass the toast taxonomy and the ConfirmDialog tone system, and
 * yield un-styled native browser modals that don't honor i18n direction,
 * theme, or RTL.
 *
 * Use instead:
 *   - `useConfirm()` hook (frontend/src/hooks/useConfirm.tsx) for confirmations
 *   - `errorHandler.showWarning|showInfo|showError|showSuccess` for messages
 *
 * Allowlist: `frontend/scripts/check-no-confirm.allowlist.json` — pages still
 * carrying legacy usages during migration. The list must shrink to zero.
 *
 * Exit codes: 0 = pass, 1 = violations.
 *
 * See docs/architecture/frontend-toast-taxonomy.md for the full feedback
 * category contract.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const srcRoot = join(frontendRoot, 'src');
const allowlistFile = join(__dirname, 'check-no-confirm.allowlist.json');

const CONFIRM_RE = /\bwindow\.confirm\s*\(/;
const ALERT_RE = /(?:^|[^a-zA-Z0-9_.])alert\s*\(/;

// Files where the pattern is part of the taxonomy itself, not a violation.
const SELF_EXEMPT = new Set([
  'src/hooks/useConfirm.tsx',
  'src/services/errorHandler.ts', // contains documented fallback `alert(message)`
  'src/utils/mathUtils.ts',       // contains the string "alert('x')" in a comment
]);

let allowlist = [];
if (existsSync(allowlistFile)) {
  try {
    allowlist = JSON.parse(readFileSync(allowlistFile, 'utf8'));
  } catch {
    console.error(`[check-no-confirm] Could not parse ${allowlistFile}; treating as empty.`);
  }
}
const allowSet = new Set(allowlist.map((p) => p.replace(/\\/g, '/')));

const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
      walk(full);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    const rel = relative(frontendRoot, full).replace(/\\/g, '/');
    if (SELF_EXEMPT.has(rel)) continue;
    if (allowSet.has(rel)) continue;
    const src = readFileSync(full, 'utf8');
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      // Skip line comments.
      const stripped = line.replace(/\/\/.*$/, '');
      if (CONFIRM_RE.test(stripped)) {
        violations.push({ rel, line: i + 1, kind: 'window.confirm', snippet: line.trim() });
      }
      if (ALERT_RE.test(stripped)) {
        // Allow `errorHandler.alert(` or similar member access. The regex
        // already excludes `.alert` via the preceding-char check, but double
        // verify there's no `.` immediately before the captured `alert`.
        const idx = stripped.search(/\balert\s*\(/);
        if (idx > 0 && stripped[idx - 1] === '.') return;
        violations.push({ rel, line: i + 1, kind: 'alert', snippet: line.trim() });
      }
    });
  }
}

walk(srcRoot);

if (violations.length === 0) {
  console.log('[check-no-confirm] OK — no raw window.confirm / alert in frontend/src.');
  process.exit(0);
}

console.error(`[check-no-confirm] Found ${violations.length} disallowed usage(s):`);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}  [${v.kind}]  ${v.snippet}`);
}
console.error('');
console.error('Fix: use useConfirm() for confirmations or errorHandler.show* for messages.');
console.error('See docs/architecture/frontend-toast-taxonomy.md.');
console.error('To temporarily exempt a file during migration, add its path to');
console.error('  frontend/scripts/check-no-confirm.allowlist.json');
console.error('and shrink the allowlist over time.');
process.exit(1);
