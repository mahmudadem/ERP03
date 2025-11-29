
export interface SystemRoleTemplate {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isCore: boolean;
}
