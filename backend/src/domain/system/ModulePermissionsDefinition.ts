export interface ModulePermissionEntry {
  id: string;
  label: string;
  enabled?: boolean;
}

export interface ModulePermissionsDefinition {
  moduleId: string;
  permissions: ModulePermissionEntry[];
  autoAttachToRoles: string[];
  createdAt: Date;
  updatedAt: Date;
  permissionsDefined?: boolean;
}
