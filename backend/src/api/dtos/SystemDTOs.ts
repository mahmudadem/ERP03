
/**
 * SystemDTOs.ts
 */
import { Role } from '../../domain/system/entities/Role';
import { Module } from '../../domain/system/entities/Module';

export interface RoleDTO {
  id: string;
  name: string;
  permissions: string[];
}

export interface ModuleDTO {
  id: string;
  name: string;
  enabled: boolean;
}

export class SystemDTOMapper {
  static toRoleDTO(role: Role): RoleDTO {
    return {
      id: role.id,
      name: role.name,
      permissions: role.permissions,
    };
  }

  static toModuleDTO(module: Module): ModuleDTO {
    return {
      id: module.id,
      name: module.name,
      enabled: module.enabled,
    };
  }
}
