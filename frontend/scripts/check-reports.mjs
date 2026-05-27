#!/usr/bin/env node
/**
 * check-reports.mjs
 *
 * Enforces two project rules for report pages:
 *
 *  RULE 1 — Sidebar registration:
 *    Every route in `routes.config.ts` whose path matches `/<module>/reports/*`
 *    MUST be present in `moduleMenuMap.ts` (anywhere under that module).
 *
 *  RULE 2 — ReportContainer usage:
 *    Every page component referenced by such a route MUST import
 *    `components/reports/ReportContainer`. This also guarantees UI-mode
 *    awareness (windows-mode routing) for free.
 *
 * An allowlist file `frontend/scripts/check-reports.allowlist.json` may
 * contain pages temporarily exempt from RULE 2 (during migration). The
 * allowlist must shrink to zero — when it does, delete the file and this
 * comment.
 *
 * Exit codes: 0 = pass, 1 = violations.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const srcRoot = join(frontendRoot, 'src');

const routesFile = join(srcRoot, 'router', 'routes.config.ts');
const menuFile   = join(srcRoot, 'config', 'moduleMenuMap.ts');
const allowlistFile = join(__dirname, 'check-reports.allowlist.json');

const reportPathRegex = /^\/([a-z-]+)\/reports\/[a-z0-9-]+/i;

// ── Parse routes.config.ts ───────────────────────────────────────────────────

const routesSrc = readFileSync(routesFile, 'utf8');

// Build a map: ComponentName -> "lazy(() => import('../modules/.../X'))"
const lazyImportRegex = /const\s+(\w+)\s*=\s*lazy\(\s*\(\s*\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g;
const componentToImport = new Map();
for (const m of routesSrc.matchAll(lazyImportRegex)) {
  componentToImport.set(m[1], m[2]);
}

// Extract route entries: { path: '...', ..., component: X, ... }
const routeEntryRegex = /\{\s*path:\s*['"]([^'"]+)['"][^}]*?component:\s*(\w+)[^}]*?\}/g;
const reportRoutes = [];
for (const m of routesSrc.matchAll(routeEntryRegex)) {
  const path = m[1];
  const component = m[2];
  if (reportPathRegex.test(path)) {
    reportRoutes.push({ path, component });
  }
}

// ── Parse moduleMenuMap.ts ───────────────────────────────────────────────────

const menuSrc = readFileSync(menuFile, 'utf8');
const menuPathRegex = /path:\s*['"]([^'"]+)['"]/g;
const menuPaths = new Set();
for (const m of menuSrc.matchAll(menuPathRegex)) {
  menuPaths.add(m[1]);
}

// ── Load allowlist (optional) ────────────────────────────────────────────────

let allowlist = { reportContainerExceptions: [] };
if (existsSync(allowlistFile)) {
  try {
    allowlist = JSON.parse(readFileSync(allowlistFile, 'utf8'));
  } catch (err) {
    console.error(`[check-reports] FAILED to parse ${allowlistFile}:`, err.message);
    process.exit(1);
  }
}
const allowSet = new Set(allowlist.reportContainerExceptions || []);

// ── Rule 1: sidebar registration ─────────────────────────────────────────────

const rule1Violations = [];
for (const r of reportRoutes) {
  if (!menuPaths.has(r.path)) {
    rule1Violations.push(r);
  }
}

// ── Rule 2: ReportContainer usage ────────────────────────────────────────────

const rule2Violations = [];
const stillAllowedButPassing = [];
const importRelRegex = /^['"]?\.\.\//;

for (const r of reportRoutes) {
  const importPath = componentToImport.get(r.component);
  if (!importPath) {
    // Component imported some other way (named export, eager import). Skip.
    continue;
  }
  // Resolve relative to src/router/
  const absPath = resolve(join(srcRoot, 'router'), importPath + '.tsx');
  if (!existsSync(absPath)) {
    // try .ts
    const altPath = absPath.replace(/\.tsx$/, '.ts');
    if (!existsSync(altPath)) continue;
  }
  const pageSrc = readFileSync(existsSync(absPath) ? absPath : absPath.replace(/\.tsx$/, '.ts'), 'utf8');

  const usesContainer = /from\s+['"][^'"]*components\/reports\/ReportContainer['"]/.test(pageSrc);
  const relPath = (existsSync(absPath) ? absPath : absPath.replace(/\.tsx$/, '.ts'))
    .replace(frontendRoot + '\\', '')
    .replace(frontendRoot + '/', '')
    .replace(/\\/g, '/');

  if (!usesContainer) {
    if (allowSet.has(relPath)) {
      // Exempt for now.
      continue;
    }
    rule2Violations.push({ ...r, file: relPath });
  } else if (allowSet.has(relPath)) {
    // Allowlisted but now conforms — tell user to remove from allowlist.
    stillAllowedButPassing.push(relPath);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

let failed = false;

if (rule1Violations.length > 0) {
  failed = true;
  console.error('\n[check-reports] RULE 1 — Sidebar registration violations:');
  console.error('  These report routes are NOT registered in moduleMenuMap.ts.');
  console.error('  Add each one under its module\'s Reports parent.\n');
  for (const v of rule1Violations) {
    console.error(`    ✗ ${v.path}  (component: ${v.component})`);
  }
}

if (rule2Violations.length > 0) {
  failed = true;
  console.error('\n[check-reports] RULE 2 — ReportContainer usage violations:');
  console.error('  These report pages do NOT use <ReportContainer>.');
  console.error('  They will not be UI-mode aware (windows-mode routing).');
  console.error('  Refactor each to import from components/reports/ReportContainer,');
  console.error('  or add the file path to scripts/check-reports.allowlist.json\n');
  for (const v of rule2Violations) {
    console.error(`    ✗ ${v.file}  (route: ${v.path})`);
  }
}

if (stillAllowedButPassing.length > 0) {
  failed = true;
  console.error('\n[check-reports] Allowlist stale:');
  console.error('  These files are in the allowlist but DO now use <ReportContainer>.');
  console.error('  Remove them from scripts/check-reports.allowlist.json:\n');
  for (const f of stillAllowedButPassing) {
    console.error(`    ✗ ${f}`);
  }
}

if (failed) {
  console.error('\n[check-reports] FAIL\n');
  process.exit(1);
}

console.log(`[check-reports] OK — ${reportRoutes.length} report route(s) checked. ${allowSet.size} allowlisted.`);
