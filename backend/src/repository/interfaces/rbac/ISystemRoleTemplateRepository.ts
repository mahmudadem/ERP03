
import { SystemRoleTemplate } from '../../../domain/rbac/SystemRoleTemplate';

export interface ISystemRoleTemplateRepository {
  getAll(): Promise<SystemRoleTemplate[]>;
  getById(id: string): Promise<SystemRoleTemplate | null>;
  create(template: SystemRoleTemplate): Promise<void>;
  update(id: string, template: Partial<SystemRoleTemplate>): Promise<void>;
  delete(id: string): Promise<void>;
}
