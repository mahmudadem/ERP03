// Re-export shared types if this were a real monorepo with workspaces
// For now, mirroring the important ones

export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  subItems?: NavItem[];
}

export enum ModuleType {
  CORE = 'CORE',
  ACCOUNTING = 'ACCOUNTING',
  INVENTORY = 'INVENTORY',
  HR = 'HR',
  POS = 'POS',
  DESIGNER = 'DESIGNER'
}