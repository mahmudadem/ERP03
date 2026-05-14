import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { randomUUID } from 'crypto';

const SYSTEM_COMPANY_ID = 'SYSTEM';

const inferFieldClass = (field: any): 'system_core' | 'system_optional' | 'computed' | 'custom_metadata' => {
  if (field.fieldClass) return field.fieldClass;
  if (field.bindingTarget === 'metadata.customFields') return 'custom_metadata';
  if (field.computed || field.calculated || field.autoManaged || field.readOnly) return 'computed';
  if (field.required || field.mandatory || field.isPosting) return 'system_core';
  return 'system_optional';
};

const normalizeFields = (fields: any[] = []) => fields.map((field) => ({
  ...field,
  id: field.id || field.name,
  name: field.name || field.id,
  type: field.type || 'TEXT',
  required: field.required ?? false,
  readOnly: field.readOnly ?? false,
  isPosting: field.isPosting ?? false,
  postingRole: field.isPosting ? (field.postingRole ?? null) : null,
  schemaVersion: field.schemaVersion ?? 2,
  fieldClass: inferFieldClass(field),
  bindingTarget: field.bindingTarget || (inferFieldClass(field) === 'custom_metadata' ? 'metadata.customFields' : 'payload'),
  nameLocked: field.nameLocked ?? false,
  computed: field.computed ?? field.calculated ?? field.autoManaged ?? false,
}));

const inferLineFieldsFromTableColumns = (tableColumns: any[] = []) =>
  tableColumns.map((column) => ({
    id: column.fieldId || column.id,
    name: column.fieldId || column.id,
    label: column.label || column.labelOverride || column.fieldId || column.id || '',
    type: column.type || 'TEXT',
    required: column.required ?? column.mandatory ?? false,
    readOnly: column.readOnly ?? false,
    isPosting: false,
    postingRole: null,
    schemaVersion: 2,
    fieldClass: inferFieldClass(column),
    bindingTarget: 'payload',
    nameLocked: column.nameLocked ?? false,
    computed: column.readOnly ?? false,
  }));

const normalizeLayout = (layout: any = {}, tableColumns: any[] = []) => ({
  ...layout,
  lineFields: Array.isArray(layout.lineFields) && layout.lineFields.length > 0
    ? normalizeFields(layout.lineFields)
    : inferLineFieldsFromTableColumns(tableColumns),
});

const normalizeTemplateForResponse = (template: any) => ({
  ...template,
  headerFields: normalizeFields(template.headerFields || []),
  layout: normalizeLayout(template.layout || {}, template.tableColumns || []),
});

const findSystemTemplate = async (id: string, payload?: any) => {
  const byId = await diContainer.voucherTypeDefinitionRepository.getVoucherType(SYSTEM_COMPANY_ID, id);
  if (byId) return byId;

  const byCode = await diContainer.voucherTypeDefinitionRepository.getByCode(SYSTEM_COMPANY_ID, id);
  if (byCode) return byCode;

  if (payload?.code) {
    const byPayloadCode = await diContainer.voucherTypeDefinitionRepository.getByCode(SYSTEM_COMPANY_ID, payload.code);
    if (byPayloadCode) return byPayloadCode;
  }

  const templates = await diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
  return templates.find((template) =>
    template.id === id ||
    template.code === id ||
    (payload?.code && template.code === payload.code)
  ) || null;
};

const buildSystemTemplate = (payload: any) => new VoucherTypeDefinition(
  randomUUID(),
  SYSTEM_COMPANY_ID,
  payload.name,
  payload.code,
  payload.module,
  normalizeFields(payload.headerFields || []),
  payload.tableColumns || [],
  normalizeLayout(payload.layout || {}, payload.tableColumns || []),
  Math.max(Number(payload.schemaVersion) || 2, 2),
  payload.requiredPostingRoles || [],
  payload.workflow,
  payload.uiModeOverrides,
  payload.isMultiLine ?? true,
  payload.rules || [],
  payload.actions || [],
  payload.defaultCurrency
);

const buildSystemTemplateUpdates = (payload: any): Partial<VoucherTypeDefinition> => {
  const updates: any = {};

  const copyKeys = [
    'name',
    'code',
    'module',
    'tableColumns',
    'requiredPostingRoles',
    'workflow',
    'uiModeOverrides',
    'isMultiLine',
    'rules',
    'actions',
    'defaultCurrency',
  ];

  copyKeys.forEach((key) => {
    if (payload[key] !== undefined) updates[key] = payload[key];
  });

  if (payload.headerFields !== undefined) {
    updates.headerFields = normalizeFields(payload.headerFields || []);
  }
  if (payload.layout !== undefined || payload.tableColumns !== undefined) {
    const nextTableColumns = payload.tableColumns !== undefined ? (payload.tableColumns || []) : undefined;
    updates.layout = normalizeLayout(payload.layout || {}, nextTableColumns || []);
  }
  updates.schemaVersion = Math.max(Number(payload.schemaVersion) || 2, 2);

  return updates;
};

export class SuperAdminVoucherTypeController {
  
  static async listSystemTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
      (res as any).status(200).json({
        success: true,
        data: templates.map(normalizeTemplateForResponse)
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body;
      const template = buildSystemTemplate(payload);

      await diContainer.voucherTypeDefinitionRepository.createVoucherType(template);

      (res as any).status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const payload = req.body;

      // Ensure we are updating a SYSTEM template
      const existing = await findSystemTemplate(id, payload);
      if (!existing) throw ApiError.notFound('System template not found');
      const targetId = existing.id || id;

      await diContainer.voucherTypeDefinitionRepository.updateVoucherType(
        SYSTEM_COMPANY_ID,
        targetId,
        buildSystemTemplateUpdates(payload)
      );

      (res as any).status(200).json({
        success: true,
        message: 'Template updated'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;

      // Ensure we are deleting a SYSTEM template
      const existing = await findSystemTemplate(id);
      if (!existing) throw ApiError.notFound('System template not found');
      const targetId = existing.id || id;

      await diContainer.voucherTypeDefinitionRepository.deleteVoucherType(SYSTEM_COMPANY_ID, targetId);

      (res as any).status(200).json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSystemTemplateLayout(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const { uiModeOverrides } = req.body;

      if (!uiModeOverrides || typeof uiModeOverrides !== 'object') {
        throw ApiError.badRequest('uiModeOverrides is required');
      }

      const existing = await findSystemTemplate(id);
      if (!existing) throw ApiError.notFound('System template not found');
      const targetId = existing.id || id;

      await diContainer.voucherTypeDefinitionRepository.updateVoucherType(
        SYSTEM_COMPANY_ID,
        targetId,
        { uiModeOverrides }
      );

      (res as any).status(200).json({
        success: true,
        message: 'Layout updated'
      });
    } catch (error) {
      next(error);
    }
  }
}
