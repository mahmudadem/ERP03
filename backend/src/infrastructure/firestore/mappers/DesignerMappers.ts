
import { FormDefinition } from '../../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';

export class FormDefinitionMapper {
  static toDomain(data: any): FormDefinition {
    // Assuming simple JSON storage for complex nested objects
    return new FormDefinition(
      data.id,
      data.name || 'Untitled Form',
      data.module,
      data.type,
      data.fields || [],
      data.sections || []
    );
  }
  static toPersistence(entity: FormDefinition): any {
    return {
      id: entity.id,
      name: entity.name,
      module: entity.module,
      type: entity.type,
      fields: entity.fields,
      sections: entity.sections
    };
  }
}

export class VoucherTypeDefinitionMapper {
  static toDomain(data: any): VoucherTypeDefinition {
    return new VoucherTypeDefinition(
      data.id,
      data.companyId || '',
      data.name,
      data.code || 'UNKNOWN',
      data.module,
      data.headerFields || [],
      data.tableColumns || [],
      data.layout || {},
      data.schemaVersion || 1,
      data.requiredPostingRoles || [],
      data.workflow || null,
      data.uiModeOverrides || null,
      data.isMultiLine ?? true,
      data.rules || [],
      data.actions || [],
      data.defaultCurrency || 'USD'
    );
  }
  static toPersistence(entity: VoucherTypeDefinition): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      name: entity.name,
      code: entity.code,
      module: entity.module,
      headerFields: (entity.headerFields || []).map(f => ({ ...f })),
      tableColumns: entity.tableColumns,
      layout: entity.layout,
      schemaVersion: entity.schemaVersion,
      workflow: entity.workflow,
      uiModeOverrides: entity.uiModeOverrides,
      isMultiLine: entity.isMultiLine,
      rules: entity.rules,
      actions: entity.actions,
      defaultCurrency: entity.defaultCurrency
    };
  }
}
