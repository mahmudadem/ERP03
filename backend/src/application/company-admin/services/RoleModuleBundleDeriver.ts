const NON_MODULE_PERMISSION_PREFIXES = new Set(['system']);

export function deriveModuleBundlesFromPermissions(permissions: string[] = []): string[] {
  const modules = new Set<string>();

  for (const permission of permissions) {
    const moduleId = String(permission || '').split('.')[0]?.trim().toLowerCase();
    if (!moduleId || NON_MODULE_PERMISSION_PREFIXES.has(moduleId) || moduleId === '*') {
      continue;
    }
    modules.add(moduleId);
  }

  return Array.from(modules).sort();
}
