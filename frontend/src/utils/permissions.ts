
export function hasPermission(permissions: string[], required?: string): boolean {
  if (!required) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: string[], requiredList: string[]): boolean {
  if (permissions.includes('*')) return true;
  return requiredList.some(req => permissions.includes(req));
}
