import { randomUUID } from 'crypto';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { IVoucherFormRepository, VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

const cloneValue = <T = any>(value: T): T => (value ? JSON.parse(JSON.stringify(value)) : value);
const normalizeModule = (value: string | undefined | null): string => String(value || '').trim().toUpperCase();
const normalizeCode = (value: string | undefined | null): string => String(value || '').trim().toLowerCase();
const toFormFieldType = (type: string | undefined): 'text' | 'number' | 'date' | 'select' | 'currency' | 'textarea' | 'checkbox' => {
  const normalized = String(type || '').trim().toUpperCase();
  if (normalized.includes('DATE')) return 'date';
  if (normalized.includes('NUMBER')) return 'number';
  if (normalized.includes('CHECKBOX') || normalized.includes('BOOLEAN')) return 'checkbox';
  if (normalized.includes('SELECT') || normalized.includes('REFERENCE') || normalized.includes('RELATION')) return 'select';
  if (normalized.includes('CURRENCY')) return 'currency';
  if (normalized.includes('TEXTAREA')) return 'textarea';
  return 'text';
};

const toFormColumnType = (type: string | undefined): 'account' | 'text' | 'number' | 'currency' | 'select' => {
  const normalized = String(type || '').trim().toUpperCase();
  if (normalized.includes('ACCOUNT')) return 'account';
  if (normalized.includes('NUMBER')) return 'number';
  if (normalized.includes('CURRENCY')) return 'currency';
  if (normalized.includes('SELECT') || normalized.includes('REFERENCE') || normalized.includes('RELATION')) return 'select';
  return 'text';
};

const cloneVoucherTypeForCompany = (companyId: string, template: VoucherTypeDefinition): VoucherTypeDefinition =>
  new VoucherTypeDefinition(
    randomUUID(),
    companyId,
    template.name,
    template.code,
    template.module,
    cloneValue(template.headerFields) || [],
    cloneValue(template.tableColumns) || [],
    cloneValue(template.layout) || {},
    template.schemaVersion || 2,
    template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined,
    cloneValue(template.workflow),
    cloneValue(template.uiModeOverrides),
    template.isMultiLine ?? true,
    cloneValue(template.rules) || [],
    cloneValue(template.actions) || [],
    template.defaultCurrency
  );

const cloneVoucherFormForCompany = (
  companyId: string,
  typeId: string,
  createdBy: string,
  template: VoucherTypeDefinition
): VoucherFormDefinition => {
  const now = new Date();
  const headerFields = (template.headerFields || []).map((field: any, index: number) => {
    const mapped: any = {
      id: field.id || field.name || `f_${index + 1}`,
      label: field.label || field.name || `Field ${index + 1}`,
      type: toFormFieldType(field.type),
      required: !!field.required,
      order: index,
    };

    if (field.defaultValue !== undefined) {
      mapped.defaultValue = cloneValue(field.defaultValue);
    }
    if (Array.isArray(field.options)) {
      mapped.options = cloneValue(field.options);
    }
    if (field.width !== undefined && field.width !== null && String(field.width).trim() !== '') {
      mapped.width = String(field.width);
    }

    return mapped;
  });

  const tableColumns = (template.tableColumns || []).map((column: any, index: number) => {
    const mapped: any = {
      id: column.fieldId || column.id || `c_${index + 1}`,
      label: column.labelOverride || column.label || column.fieldId || `Column ${index + 1}`,
      type: toFormColumnType(column.type),
      required: !!(column.required || column.mandatory),
      order: index,
    };

    if (column.width !== undefined && column.width !== null && String(column.width).trim() !== '') {
      mapped.width = String(column.width);
    }

    return mapped;
  });

  return {
    id: randomUUID(),
    companyId,
    module: normalizeModule(template.module),
    typeId,
    name: template.name,
    code: template.code,
    description: `Default form for ${template.name}`,
    prefix: template.code?.slice(0, 3).toUpperCase(),
    isDefault: true,
    isSystemGenerated: true,
    isLocked: true,
    enabled: true,
    headerFields,
    tableColumns,
    layout: cloneValue(template.layout) || { sections: [] },
    uiModeOverrides: cloneValue(template.uiModeOverrides),
    rules: cloneValue(template.rules) || [],
    actions: cloneValue(template.actions) || [],
    isMultiLine: template.isMultiLine ?? true,
    tableStyle: 'web',
    defaultCurrency: template.defaultCurrency,
    baseType: template.code,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
};

export interface SyncCompanyVoucherTemplatesInput {
  companyId: string;
  modules: string[];
  createdBy: string;
  voucherTypeRepo: IVoucherTypeDefinitionRepository;
  voucherFormRepo: IVoucherFormRepository;
}

export interface SyncCompanyVoucherTemplatesResult {
  templatesUpserted: number;
  formsCreated: number;
}

/**
 * Ensures company voucher types/forms are sourced from current system templates
 * for the requested module list. Idempotent and safe to run repeatedly.
 */
export const syncCompanyVoucherTemplatesFromSystem = async (
  input: SyncCompanyVoucherTemplatesInput
): Promise<SyncCompanyVoucherTemplatesResult> => {
  const moduleSet = new Set((input.modules || []).map(normalizeModule).filter(Boolean));
  if (moduleSet.size === 0) {
    return { templatesUpserted: 0, formsCreated: 0 };
  }

  const systemTemplates = await input.voucherTypeRepo.getSystemTemplates();
  const scopedTemplates = systemTemplates.filter((template) => moduleSet.has(normalizeModule(template.module)));

  // Keep one template per module+code key to avoid accidental duplicate-code drift.
  const templateMap = new Map<string, VoucherTypeDefinition>();
  for (const template of scopedTemplates) {
    templateMap.set(`${normalizeModule(template.module)}::${normalizeCode(template.code)}`, template);
  }

  let templatesUpserted = 0;
  let formsCreated = 0;
  const companyTypes = await input.voucherTypeRepo.getByCompanyId(input.companyId);
  const existingByKey = new Map<string, VoucherTypeDefinition>();

  for (const existingType of companyTypes) {
    if (existingType.companyId !== input.companyId) continue;
    const key = `${normalizeModule(existingType.module)}::${normalizeCode(existingType.code)}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, existingType);
    }
  }

  for (const template of templateMap.values()) {
    const templateKey = `${normalizeModule(template.module)}::${normalizeCode(template.code)}`;
    const existing = existingByKey.get(templateKey);
    let companyTypeId: string;

    if (existing && existing.companyId === input.companyId) {
      await input.voucherTypeRepo.updateVoucherType(input.companyId, existing.id, {
        name: template.name,
        code: template.code,
        module: template.module,
        headerFields: cloneValue(template.headerFields) || [],
        tableColumns: cloneValue(template.tableColumns) || [],
        layout: cloneValue(template.layout) || {},
        schemaVersion: template.schemaVersion || 2,
        requiredPostingRoles: template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined,
        workflow: cloneValue(template.workflow),
        uiModeOverrides: cloneValue(template.uiModeOverrides),
        isMultiLine: template.isMultiLine ?? true,
        rules: cloneValue(template.rules) || [],
        actions: cloneValue(template.actions) || [],
        defaultCurrency: template.defaultCurrency,
      });
      companyTypeId = existing.id;
    } else {
      const companyType = cloneVoucherTypeForCompany(input.companyId, template);
      await input.voucherTypeRepo.createVoucherType(companyType);
      companyTypeId = companyType.id;
      existingByKey.set(templateKey, companyType);
    }
    templatesUpserted++;

    const existingForms = await input.voucherFormRepo.getByTypeId(input.companyId, companyTypeId);
    if (existingForms.length === 0) {
      const defaultForm = cloneVoucherFormForCompany(input.companyId, companyTypeId, input.createdBy || 'SYSTEM', template);
      await input.voucherFormRepo.create(defaultForm);
      formsCreated++;
    }
  }

  return { templatesUpserted, formsCreated };
};
