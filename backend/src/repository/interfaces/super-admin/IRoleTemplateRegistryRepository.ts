import { RoleTemplateDefinition } from '../../../domain/super-admin/RoleTemplateDefinition';

export interface IRoleTemplateRegistryRepository {
  getAll(): Promise<RoleTemplateDefinition[]>;
  getById(id: string): Promise<RoleTemplateDefinition | null>;
  create(roleTemplate: RoleTemplateDefinition): Promise<void>;
  update(id: string, roleTemplate: Partial<RoleTemplateDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
