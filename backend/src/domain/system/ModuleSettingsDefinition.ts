export type ModuleSettingFieldType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'multi-select';

export interface ModuleSettingField {
  id: string;
  type: ModuleSettingFieldType;
  label: string;
  required?: boolean;
  default?: any;
  optionsSource?: string;
}

export interface ModuleSettingsDefinition {
  moduleId: string;
  fields: ModuleSettingField[];
  createdBy: string;
  updatedAt: Date;
  permissionsDefined?: boolean;
  autoAttachToRoles?: string[];
}
