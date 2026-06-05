#!/usr/bin/env node
/**
 * check-sod-approve.mjs
 *
 * Enforces Segregation of Duties (SoD) for source-document approval at the
 * frontend layer. The architecture says approval is owned by Accounting; source
 * modules (Sales, Purchases) must never invoke the approve endpoints.
 *
 * What's banned (outside the allowed scopes below):
 *   - References to the symbols `approveSI` and `approvePI`
 *   - The HTTP route fragments `/invoices/:id/approve` (sales/purchase scoped)
 *
 * Why static-check:
 *   The backend permission guard (`accounting.approve.finance`) is the real
 *   authority. This check stops well-meaning copy-paste from re-introducing a
 *   UI button that calls the approve endpoint from a source-module page, even
 *   though the API call would still require the permission. The leak pattern
 *   has already happened twice (commits 83b8d187, e3b71e4f) — this guard
 *   ensures the third time fails the build instead of shipping.
 *
 * Allowed scopes:
 *   - frontend/src/api/accountingApi.ts (defines the two methods)
 *   - frontend/src/modules/accounting/** (Approval Center is the sole caller)
 *
 * Exit codes: 0 = pass, 1 = violations.
 *
 * See docs/architecture/posting-authority.md §4.1 for the SoD rulebook and
 * planning/tasks/167.md for the UX side.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const srcRoot = join(frontendRoot, 'src');

// Symbols and route fragments that signal an approval call.
const SYMBOL_RE = /\b(approveSI|approvePI)\b/;
const ROUTE_SI_RE = /\/tenant\/sales\/invoices\/[^'"`]+\/approve\b/;
const ROUTE_PI_RE = /\/tenant\/purchase\/invoices\/[^'"`]+\/approve\b/;

// Files allowed to reference the symbols/routes.
const ALLOWED_PATH_PREFIXES = [
  'src/api/accountingApi.ts',
  'src/modules/accounting/',
];

// Files that mention the symbols only in a comment / doc explaining the SoD
// rule itself are still ignored line-by-line by the comment stripper below.
// But if a whole file is documented exposition (e.g. an architecture page),
// list it here.
const SELF_EXEMPT = new Set([
  // Source-module files where the symbol survives only inside SoD comments
  // describing why the symbol moved away. Comments are stripped per-line,
  // so these usually don't need to be exempt — listed if needed.
]);

function isAllowed(rel) {
  if (SELF_EXEMPT.has(rel)) return true;
  return ALLOWED_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

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
    if (!/\.(tsx?|jsx?|mjs)$/.test(entry)) continue;
    const rel = relative(frontendRoot, full).replace(/\\/g, '/');
    if (isAllowed(rel)) continue;

    const src = readFileSync(full, 'utf8');
    const lines = src.split(/\r?\n/);
    let inBlockComment = false;

    lines.forEach((line, i) => {
      let working = line;

      // Track multi-line /* ... */ block comments crudely. We strip the
      // commented part so identifier checks ignore documentation.
      if (inBlockComment) {
        const end = working.indexOf('*/');
        if (end === -1) return; // entire line is comment
        working = working.slice(end + 2);
        inBlockComment = false;
      }
      const blockStart = working.indexOf('/*');
      if (blockStart !== -1) {
        const blockEnd = working.indexOf('*/', blockStart + 2);
        if (blockEnd === -1) {
          working = working.slice(0, blockStart);
          inBlockComment = true;
        } else {
          working = working.slice(0, blockStart) + working.slice(blockEnd + 2);
        }
      }
      // Strip single-line comments.
      working = working.replace(/\/\/.*$/, '');
      if (!working.trim()) return;

      if (SYMBOL_RE.test(working)) {
        violations.push({
          rel,
          line: i + 1,
          kind: 'symbol',
          snippet: line.trim(),
        });
      } else if (ROUTE_SI_RE.test(working) || ROUTE_PI_RE.test(working)) {
        violations.push({
          rel,
          line: i + 1,
          kind: 'route',
          snippet: line.trim(),
        });
      }
    });
  }
}

walk(srcRoot);

if (violations.length === 0) {
  console.log(
    '[check-sod-approve] OK — no source-module reference to approveSI/approvePI.',
  );
  process.exit(0);
}

console.error(
  `[check-sod-approve] Found ${violations.length} SoD violation(s):`,
);
for (const v of violations) {
  console.error(`  ${v.rel}:${v.line}  [${v.kind}]  ${v.snippet}`);
}
console.error('');
console.error('Segregation of Duties: Sales and Purchases UI must not call the approve');
console.error('endpoint. Approval is owned by Accounting and lives in:');
console.error('  - frontend/src/api/accountingApi.ts (accountingApi.approveSI / approvePI)');
console.error('  - frontend/src/modules/accounting/pages/ApprovalsPage.tsx');
console.error('');
console.error('If the source module needs to surface approval state, render a banner that');
console.error('links to Accounting → Approval Center instead.');
console.error('');
console.error('See docs/architecture/posting-authority.md §4.1.');
process.exit(1);
