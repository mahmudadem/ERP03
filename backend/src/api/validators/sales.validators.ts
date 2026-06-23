import { DNStatus } from '../../domain/sales/entities/DeliveryNote';
import { PaymentStatus, SIStatus } from '../../domain/sales/entities/SalesInvoice';
import { SOStatus } from '../../domain/sales/entities/SalesOrder';
import { SRStatus } from '../../domain/sales/entities/SalesReturn';
import { ApiError } from '../errors/ApiError';

const SO_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const DN_STATUSES: DNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SI_STATUSES: SIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SR_STATUSES: SRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const RETURN_CONTEXTS = ['AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];
const RETURN_SETTLEMENT_MODES = ['CREDIT_NOTE', 'REFUND'];
const RETURN_REASON_CODES = ['DEFECTIVE', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER'];
const RESTOCKING_FEE_TYPES = ['PERCENT', 'AMOUNT'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const VALID_DOCUMENT_SOURCES = ['native', 'default_form', 'custom_form'];

const ensureRequiredString = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required`);
  }
};

const ensureNumber = (value: any, fieldName: string) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw ApiError.badRequest(`${fieldName} must be a number`);
  }
};

const ensurePositiveNumber = (value: any, fieldName: string) => {
  ensureNumber(value, fieldName);
  if (value <= 0) {
    throw ApiError.badRequest(`${fieldName} must be a positive number`);
  }
};

const ensureNonNegativeNumber = (value: any, fieldName: string) => {
  ensureNumber(value, fieldName);
  if (value < 0) {
    throw ApiError.badRequest(`${fieldName} must be greater than or equal to 0`);
  }
};

const ensureBoolean = (value: any, fieldName: string) => {
  if (typeof value !== 'boolean') {
    throw ApiError.badRequest(`${fieldName} must be boolean`);
  }
};

const ensureIsoDate = (value: any, fieldName: string) => {
  if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ensureOptionalNumber = (value: any, fieldName: string) => {
  if (value === undefined) return;
  ensureNumber(value, fieldName);
};

const ensureOptionalString = (value: any, fieldName: string) => {
  if (value === undefined) return;
  ensureRequiredString(value, fieldName);
};

const normalizeDocumentSource = (value: any): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const validateDocumentSource = (value: any) => {
  ensureOptionalString(value, 'source');
  if (value !== undefined && !VALID_DOCUMENT_SOURCES.includes(normalizeDocumentSource(value))) {
    throw ApiError.badRequest(`source must be one of: ${VALID_DOCUMENT_SOURCES.join(', ')}`);
  }
};

const ensureOptionalUuid = (value: any, fieldName: string) => {
  if (value === undefined) return;
  ensureRequiredString(value, fieldName);
};

const ensureWorkflowMode = (value: any, fieldName: string) => {
  ensureRequiredString(value, fieldName);
  if (value !== 'SIMPLE' && value !== 'OPERATIONAL') {
    throw ApiError.badRequest(`${fieldName} must be SIMPLE or OPERATIONAL`);
  }
};

const validateSOLine = (line: any, index: number) => {
  ensureRequiredString(line.itemId, `lines[${index}].itemId`);
  ensurePositiveNumber(line.orderedQty, `lines[${index}].orderedQty`);
  ensureNonNegativeNumber(line.unitPriceDoc, `lines[${index}].unitPriceDoc`);

  if (line.lineNo !== undefined) {
    ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  }

  if (line.taxCodeId !== undefined) {
    ensureOptionalString(line.taxCodeId, `lines[${index}].taxCodeId`);
  }

  if (line.uom !== undefined) {
    ensureOptionalString(line.uom, `lines[${index}].uom`);
  }
  if (line.uomId !== undefined) {
    ensureOptionalString(line.uomId, `lines[${index}].uomId`);
  }

  if (line.warehouseId !== undefined) {
    ensureOptionalString(line.warehouseId, `lines[${index}].warehouseId`);
  }

  if (line.discountType !== undefined && line.discountType !== null) {
    if (line.discountType !== 'PERCENT' && line.discountType !== 'AMOUNT') {
      throw ApiError.badRequest(`lines[${index}].discountType must be PERCENT or AMOUNT`);
    }
  }
  if (line.discountValue !== undefined && line.discountValue !== null) {
    ensureNonNegativeNumber(line.discountValue, `lines[${index}].discountValue`);
  }

  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateDNLine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (!line.itemId && !line.soLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or soLineId`);
  }

  ensurePositiveNumber(line.deliveredQty, `lines[${index}].deliveredQty`);

  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.uomId !== undefined) ensureOptionalString(line.uomId, `lines[${index}].uomId`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateSILine = (line: any, index: number) => {
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (!line.itemId && !line.soLineId) {
    throw ApiError.badRequest(`lines[${index}] must include itemId or soLineId`);
  }

  ensurePositiveNumber(line.invoicedQty, `lines[${index}].invoicedQty`);

  if (line.lineNo !== undefined) ensurePositiveNumber(line.lineNo, `lines[${index}].lineNo`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.uomId !== undefined) ensureOptionalString(line.uomId, `lines[${index}].uomId`);
  if (line.unitPriceDoc !== undefined) ensureNonNegativeNumber(line.unitPriceDoc, `lines[${index}].unitPriceDoc`);
  if (line.discountType !== undefined && !['PERCENT', 'AMOUNT'].includes(String(line.discountType))) {
    throw ApiError.badRequest(`lines[${index}].discountType must be PERCENT or AMOUNT`);
  }
  if (line.discountValue !== undefined) ensureNonNegativeNumber(line.discountValue, `lines[${index}].discountValue`);
  if (line.discountAmountDoc !== undefined) ensureNonNegativeNumber(line.discountAmountDoc, `lines[${index}].discountAmountDoc`);
  if (line.taxCodeId !== undefined) ensureOptionalString(line.taxCodeId, `lines[${index}].taxCodeId`);
  if (line.warehouseId !== undefined) ensureOptionalString(line.warehouseId, `lines[${index}].warehouseId`);
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const validateSICharge = (charge: any, index: number) => {
  if (!charge.name || typeof charge.name !== 'string') {
    throw ApiError.badRequest(`charges[${index}].name is required`);
  }
  if (charge.kind !== undefined && !['CHARGE', 'DISCOUNT'].includes(String(charge.kind))) {
    throw ApiError.badRequest(`charges[${index}].kind must be CHARGE or DISCOUNT`);
  }
  ensureNonNegativeNumber(charge.amountDoc, `charges[${index}].amountDoc`);
  if (charge.chargeId !== undefined) ensureOptionalString(charge.chargeId, `charges[${index}].chargeId`);
  if (charge.code !== undefined) ensureOptionalString(charge.code, `charges[${index}].code`);
  if (charge.taxCodeId !== undefined) ensureOptionalString(charge.taxCodeId, `charges[${index}].taxCodeId`);
  if (charge.revenueAccountId !== undefined) ensureOptionalString(charge.revenueAccountId, `charges[${index}].revenueAccountId`);
  if (charge.description !== undefined && typeof charge.description !== 'string') {
    throw ApiError.badRequest(`charges[${index}].description must be a string`);
  }
};

const validateSalesPaymentMethodConfig = (config: any, index: number) => {
  if (!config || typeof config !== 'object') {
    throw ApiError.badRequest(`paymentMethodConfigs[${index}] must be an object`);
  }
  if (!['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'].includes(String(config.method))) {
    throw ApiError.badRequest(`paymentMethodConfigs[${index}].method must be one of: CASH, BANK_TRANSFER, CHECK, CREDIT_CARD, OTHER`);
  }
  ensureRequiredString(config.settlementAccountId, `paymentMethodConfigs[${index}].settlementAccountId`);
  if (config.label !== undefined) ensureOptionalString(config.label, `paymentMethodConfigs[${index}].label`);
  if (config.isEnabled !== undefined) ensureBoolean(config.isEnabled, `paymentMethodConfigs[${index}].isEnabled`);
};

const validateSRLine = (line: any, index: number) => {
  if (line.siLineId !== undefined) ensureOptionalString(line.siLineId, `lines[${index}].siLineId`);
  if (line.dnLineId !== undefined) ensureOptionalString(line.dnLineId, `lines[${index}].dnLineId`);
  if (line.soLineId !== undefined) ensureOptionalString(line.soLineId, `lines[${index}].soLineId`);
  if (line.itemId !== undefined) ensureOptionalString(line.itemId, `lines[${index}].itemId`);
  if (line.returnQty !== undefined) ensurePositiveNumber(line.returnQty, `lines[${index}].returnQty`);
  if (line.uom !== undefined) ensureOptionalString(line.uom, `lines[${index}].uom`);
  if (line.uomId !== undefined) ensureOptionalString(line.uomId, `lines[${index}].uomId`);
  if (line.discountType !== undefined && line.discountType !== null) {
    if (line.discountType !== 'PERCENT' && line.discountType !== 'AMOUNT') {
      throw ApiError.badRequest(`lines[${index}].discountType must be PERCENT or AMOUNT`);
    }
  }
  if (line.discountValue !== undefined && line.discountValue !== null) {
    ensureNonNegativeNumber(line.discountValue, `lines[${index}].discountValue`);
  }
  if (line.description !== undefined && typeof line.description !== 'string') {
    throw ApiError.badRequest(`lines[${index}].description must be a string`);
  }
};

const SALES_MESSAGING_CHANNELS = ['WHATSAPP', 'EMAIL', 'TELEGRAM'];
const SALES_MESSAGING_PROVIDERS = ['META_WHATSAPP_CLOUD', 'SMTP', 'TELEGRAM_BOT'];

const validateSalesMessagingAccount = (account: any, index: number) => {
  if (!account || typeof account !== 'object') {
    throw ApiError.badRequest(`messagingAccounts[${index}] must be an object`);
  }
  ensureRequiredString(account.id, `messagingAccounts[${index}].id`);
  ensureRequiredString(account.channel, `messagingAccounts[${index}].channel`);
  ensureRequiredString(account.provider, `messagingAccounts[${index}].provider`);
  ensureRequiredString(account.label, `messagingAccounts[${index}].label`);
  if (!SALES_MESSAGING_CHANNELS.includes(String(account.channel))) {
    throw ApiError.badRequest(
      `messagingAccounts[${index}].channel must be one of: ${SALES_MESSAGING_CHANNELS.join(', ')}`
    );
  }
  if (!SALES_MESSAGING_PROVIDERS.includes(String(account.provider))) {
    throw ApiError.badRequest(
      `messagingAccounts[${index}].provider must be one of: ${SALES_MESSAGING_PROVIDERS.join(', ')}`
    );
  }

  if (account.isDefault !== undefined) ensureBoolean(account.isDefault, `messagingAccounts[${index}].isDefault`);
  if (account.isActive !== undefined) ensureBoolean(account.isActive, `messagingAccounts[${index}].isActive`);
  if (account.phoneNumberE164 !== undefined) ensureOptionalString(account.phoneNumberE164, `messagingAccounts[${index}].phoneNumberE164`);
  if (account.phoneNumberId !== undefined) ensureOptionalString(account.phoneNumberId, `messagingAccounts[${index}].phoneNumberId`);
  if (account.fromAddress !== undefined) ensureOptionalString(account.fromAddress, `messagingAccounts[${index}].fromAddress`);
  if (account.fromDisplayName !== undefined) ensureOptionalString(account.fromDisplayName, `messagingAccounts[${index}].fromDisplayName`);
  if (account.botUsername !== undefined) ensureOptionalString(account.botUsername, `messagingAccounts[${index}].botUsername`);
  if (account.apiVersion !== undefined) ensureOptionalString(account.apiVersion, `messagingAccounts[${index}].apiVersion`);
  if (account.credential !== undefined) ensureOptionalString(account.credential, `messagingAccounts[${index}].credential`);

  const hasExistingCredential = account.hasCredential === true;
  const hasNewCredential = typeof account.credential === 'string' && account.credential.trim().length > 0;

  if (String(account.channel) === 'WHATSAPP' && !String(account.phoneNumberId || '').trim()) {
    throw ApiError.badRequest(`messagingAccounts[${index}].phoneNumberId is required for WHATSAPP accounts`);
  }
  if (account.isActive !== false && !hasExistingCredential && !hasNewCredential) {
    throw ApiError.badRequest(
      `messagingAccounts[${index}] must include credential for active sender accounts`
    );
  }
};

const validateRestockingFeeInput = (body: any) => {
  if (body.restockingFeeType !== undefined) {
    ensureOptionalString(body.restockingFeeType, 'restockingFeeType');
    if (!RESTOCKING_FEE_TYPES.includes(String(body.restockingFeeType))) {
      throw ApiError.badRequest(`restockingFeeType must be one of: ${RESTOCKING_FEE_TYPES.join(', ')}`);
    }
  }
  if (body.restockingFeeValue !== undefined) {
    ensureNonNegativeNumber(body.restockingFeeValue, 'restockingFeeValue');
    const type = String(body.restockingFeeType || '');
    if (type === 'PERCENT' && Number(body.restockingFeeValue) > 100) {
      throw ApiError.badRequest('restockingFeeValue cannot exceed 100 when restockingFeeType=PERCENT');
    }
  }
  if (body.refundSettlementAccountId !== undefined) ensureOptionalString(body.refundSettlementAccountId, 'refundSettlementAccountId');
};

export const validateInitializeSalesInput = (body: any) => {
  ensureRequiredString(body.defaultRevenueAccountId, 'defaultRevenueAccountId');

  if (body.workflowMode !== undefined) ensureWorkflowMode(body.workflowMode, 'workflowMode');
  if (body.allowDirectInvoicing !== undefined) ensureBoolean(body.allowDirectInvoicing, 'allowDirectInvoicing');
  if (body.requireSOForStockItems !== undefined) ensureBoolean(body.requireSOForStockItems, 'requireSOForStockItems');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.allowOverpayment !== undefined) ensureBoolean(body.allowOverpayment, 'allowOverpayment');
  if (body.deriveLinePriceAcrossUom !== undefined) ensureBoolean(body.deriveLinePriceAcrossUom, 'deriveLinePriceAcrossUom');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');
  if (body.paymentMethodConfigs !== undefined) {
    if (!Array.isArray(body.paymentMethodConfigs)) {
      throw ApiError.badRequest('paymentMethodConfigs must be an array');
    }
    body.paymentMethodConfigs.forEach((config: any, index: number) => validateSalesPaymentMethodConfig(config, index));
  }
  if (body.messagingAccounts !== undefined) {
    if (!Array.isArray(body.messagingAccounts)) {
      throw ApiError.badRequest('messagingAccounts must be an array');
    }
    body.messagingAccounts.forEach((account: any, index: number) => validateSalesMessagingAccount(account, index));
  }

  ensureOptionalString(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
  ensureOptionalString(body.defaultARAccountId, 'defaultARAccountId');
  ensureOptionalString(body.arParentAccountId, 'arParentAccountId');
  ensureOptionalString(body.partyAccountCodeFormat, 'partyAccountCodeFormat');
  ensureOptionalUuid(body.defaultInventoryAccountId, 'defaultInventoryAccountId');
  ensureOptionalString(body.defaultSalesExpenseAccountId, 'defaultSalesExpenseAccountId');
  ensureOptionalString(body.defaultSalesReturnAccountId, 'defaultSalesReturnAccountId');
  if (body.governanceRules !== undefined) {
    if (!Array.isArray(body.governanceRules)) {
      throw ApiError.badRequest('governanceRules must be an array');
    }
    for (const rule of body.governanceRules) {
      if (!rule.scope || !['company', 'branch', 'form'].includes(rule.scope)) {
        throw ApiError.badRequest('governanceRules.scope must be company, branch, or form');
      }
      if (!rule.action || !['allow', 'block'].includes(rule.action)) {
        throw ApiError.badRequest('governanceRules.action must be allow or block');
      }
      if (!rule.persona || !['direct', 'linked', 'service'].includes(rule.persona)) {
        throw ApiError.badRequest('governanceRules.persona must be direct, linked, or service');
      }
    }
  }
  if (body.defaultSalesInvoicePersona !== undefined) {
    ensureRequiredString(body.defaultSalesInvoicePersona, 'defaultSalesInvoicePersona');
    if (!['direct', 'linked', 'service'].includes(body.defaultSalesInvoicePersona)) {
      throw ApiError.badRequest('defaultSalesInvoicePersona must be direct, linked, or service');
    }
  }
  ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  ensureOptionalString(body.soNumberPrefix, 'soNumberPrefix');
  ensureOptionalString(body.dnNumberPrefix, 'dnNumberPrefix');
  ensureOptionalString(body.siNumberPrefix, 'siNumberPrefix');
  ensureOptionalString(body.srNumberPrefix, 'srNumberPrefix');

  ensureOptionalNumber(body.soNumberNextSeq, 'soNumberNextSeq');
  ensureOptionalNumber(body.dnNumberNextSeq, 'dnNumberNextSeq');
  ensureOptionalNumber(body.siNumberNextSeq, 'siNumberNextSeq');
  ensureOptionalNumber(body.srNumberNextSeq, 'srNumberNextSeq');

  if (body.selectedVoucherTypes !== undefined) {
    if (!Array.isArray(body.selectedVoucherTypes)
      || body.selectedVoucherTypes.some((id: unknown) => typeof id !== 'string')) {
      throw ApiError.badRequest('selectedVoucherTypes must be an array of strings');
    }
  }
};

export const validateUpdateSalesSettingsInput = (body: any) => {
  if (body.workflowMode !== undefined) ensureWorkflowMode(body.workflowMode, 'workflowMode');
  if (body.showOperationalDocsInSimple !== undefined) ensureBoolean(body.showOperationalDocsInSimple, 'showOperationalDocsInSimple');
  if (body.allowCreditOverride !== undefined) ensureBoolean(body.allowCreditOverride, 'allowCreditOverride');
  if (body.allowDirectInvoicing !== undefined) ensureBoolean(body.allowDirectInvoicing, 'allowDirectInvoicing');
  if (body.requireSOForStockItems !== undefined) ensureBoolean(body.requireSOForStockItems, 'requireSOForStockItems');
  if (body.defaultARAccountId !== undefined) ensureOptionalString(body.defaultARAccountId, 'defaultARAccountId');
  if (body.arParentAccountId !== undefined) ensureOptionalString(body.arParentAccountId, 'arParentAccountId');
  if (body.partyAccountCodeFormat !== undefined) ensureOptionalString(body.partyAccountCodeFormat, 'partyAccountCodeFormat');
  if (body.defaultRevenueAccountId !== undefined) ensureRequiredString(body.defaultRevenueAccountId, 'defaultRevenueAccountId');
  if (body.defaultCOGSAccountId !== undefined) ensureOptionalString(body.defaultCOGSAccountId, 'defaultCOGSAccountId');
  if (body.defaultInventoryAccountId !== undefined) ensureOptionalUuid(body.defaultInventoryAccountId, 'defaultInventoryAccountId');
  if (body.defaultSalesExpenseAccountId !== undefined) ensureOptionalString(body.defaultSalesExpenseAccountId, 'defaultSalesExpenseAccountId');
  if (body.defaultSalesReturnAccountId !== undefined) ensureOptionalString(body.defaultSalesReturnAccountId, 'defaultSalesReturnAccountId');
  if (body.defaultRefundAccountId !== undefined) ensureOptionalString(body.defaultRefundAccountId, 'defaultRefundAccountId');
  if (body.restockingFeeAccountId !== undefined) ensureOptionalString(body.restockingFeeAccountId, 'restockingFeeAccountId');
  if (body.allowOverDelivery !== undefined) ensureBoolean(body.allowOverDelivery, 'allowOverDelivery');
  if (body.allowOverpayment !== undefined) ensureBoolean(body.allowOverpayment, 'allowOverpayment');
  if (body.deriveLinePriceAcrossUom !== undefined) ensureBoolean(body.deriveLinePriceAcrossUom, 'deriveLinePriceAcrossUom');
  if (body.overDeliveryTolerancePct !== undefined) ensureNonNegativeNumber(body.overDeliveryTolerancePct, 'overDeliveryTolerancePct');
  if (body.overInvoiceTolerancePct !== undefined) ensureNonNegativeNumber(body.overInvoiceTolerancePct, 'overInvoiceTolerancePct');
  if (body.defaultPaymentTermsDays !== undefined) ensureNonNegativeNumber(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays');
  if (body.paymentMethodConfigs !== undefined) {
    if (!Array.isArray(body.paymentMethodConfigs)) {
      throw ApiError.badRequest('paymentMethodConfigs must be an array');
    }
    body.paymentMethodConfigs.forEach((config: any, index: number) => validateSalesPaymentMethodConfig(config, index));
  }
  if (body.messagingAccounts !== undefined) {
    if (!Array.isArray(body.messagingAccounts)) {
      throw ApiError.badRequest('messagingAccounts must be an array');
    }
    body.messagingAccounts.forEach((account: any, index: number) => validateSalesMessagingAccount(account, index));
  }
  if (body.governanceRules !== undefined) {
    if (!Array.isArray(body.governanceRules)) {
      throw ApiError.badRequest('governanceRules must be an array');
    }
    for (const rule of body.governanceRules) {
      if (!rule.scope || !['company', 'branch', 'form'].includes(rule.scope)) {
        throw ApiError.badRequest('governanceRules.scope must be company, branch, or form');
      }
      if (!rule.action || !['allow', 'block'].includes(rule.action)) {
        throw ApiError.badRequest('governanceRules.action must be allow or block');
      }
      if (!rule.persona || !['direct', 'linked', 'service'].includes(rule.persona)) {
        throw ApiError.badRequest('governanceRules.persona must be direct, linked, or service');
      }
    }
  }
  if (body.defaultSalesInvoicePersona !== undefined) {
    ensureRequiredString(body.defaultSalesInvoicePersona, 'defaultSalesInvoicePersona');
    if (!['direct', 'linked', 'service'].includes(body.defaultSalesInvoicePersona)) {
      throw ApiError.badRequest('defaultSalesInvoicePersona must be direct, linked, or service');
    }
  }
  if (body.defaultWarehouseId !== undefined) ensureOptionalString(body.defaultWarehouseId, 'defaultWarehouseId');
  if (body.soNumberPrefix !== undefined) ensureOptionalString(body.soNumberPrefix, 'soNumberPrefix');
  if (body.dnNumberPrefix !== undefined) ensureOptionalString(body.dnNumberPrefix, 'dnNumberPrefix');
  if (body.siNumberPrefix !== undefined) ensureOptionalString(body.siNumberPrefix, 'siNumberPrefix');
  if (body.srNumberPrefix !== undefined) ensureOptionalString(body.srNumberPrefix, 'srNumberPrefix');
  if (body.soNumberNextSeq !== undefined) ensurePositiveNumber(body.soNumberNextSeq, 'soNumberNextSeq');
  if (body.dnNumberNextSeq !== undefined) ensurePositiveNumber(body.dnNumberNextSeq, 'dnNumberNextSeq');
  if (body.siNumberNextSeq !== undefined) ensurePositiveNumber(body.siNumberNextSeq, 'siNumberNextSeq');
  if (body.srNumberNextSeq !== undefined) ensurePositiveNumber(body.srNumberNextSeq, 'srNumberNextSeq');
};

const SELLING_POLICY_BELOW_COST_MODES = ['BLOCK', 'REQUIRE_APPROVAL', 'ALLOW'];
export const validateUpdateSellingPolicyInput = (body: any) => {
  if (!body || typeof body !== 'object') throw ApiError.badRequest('Request body is required');
  if (body.belowCostMode !== undefined && !SELLING_POLICY_BELOW_COST_MODES.includes(body.belowCostMode)) {
    throw ApiError.badRequest(`belowCostMode must be one of: ${SELLING_POLICY_BELOW_COST_MODES.join(', ')}`);
  }
  if (body.allowManagerOverride !== undefined) ensureBoolean(body.allowManagerOverride, 'allowManagerOverride');
  if (
    body.minMarginPercent !== undefined &&
    body.minMarginPercent !== null &&
    body.minMarginPercent !== ''
  ) {
    ensureNonNegativeNumber(body.minMarginPercent, 'minMarginPercent');
  }
};

export const validateCreateSalesOrderInput = (body: any) => {
  ensureRequiredString(body.customerId, 'customerId');
  ensureIsoDate(body.orderDate, 'orderDate');
  ensureRequiredString(body.currency, 'currency');
  ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw ApiError.badRequest('lines must be a non-empty array');
  }

  body.lines.forEach((line: any, index: number) => validateSOLine(line, index));
};

export const validateUpdateSalesOrderInput = (body: any) => {
  if (body.customerId !== undefined) ensureRequiredString(body.customerId, 'customerId');
  if (body.orderDate !== undefined) ensureIsoDate(body.orderDate, 'orderDate');
  if (body.expectedDeliveryDate !== undefined) ensureIsoDate(body.expectedDeliveryDate, 'expectedDeliveryDate');
  if (body.currency !== undefined) ensureRequiredString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array');
    }
    body.lines.forEach((line: any, index: number) => validateSOLine(line, index));
  }
};

export const validateListSalesOrdersQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SOStatus;
    if (!SO_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SO_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }

  if (query.dateFrom !== undefined) ensureIsoDate(query.dateFrom, 'dateFrom');
  if (query.dateTo !== undefined) ensureIsoDate(query.dateTo, 'dateTo');

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }

  if (query.offset !== undefined) {
    const offset = Number(query.offset);
    if (Number.isNaN(offset) || offset < 0) {
      throw ApiError.badRequest('offset must be a number greater than or equal to 0');
    }
  }
};

export const validateCreateDeliveryNoteInput = (body: any) => {
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');
  ensureIsoDate(body.deliveryDate, 'deliveryDate');
  ensureRequiredString(body.warehouseId, 'warehouseId');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateDNLine(line, index));
  }
};

export const validateListDeliveryNotesQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as DNStatus;
    if (!DN_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${DN_STATUSES.join(', ')}`);
    }
  }

  if (query.salesOrderId !== undefined && typeof query.salesOrderId !== 'string') {
    throw ApiError.badRequest('salesOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreateSalesInvoiceInput = (body: any) => {
  validateDocumentSource(body.source);
  if (body.voucherFormId !== undefined) ensureOptionalString(body.voucherFormId, 'voucherFormId');
  if (body.formType !== undefined) ensureOptionalString(body.formType, 'formType');
  const isNativeSource = normalizeDocumentSource(body.source) === 'native';
  if (!isNativeSource) {
    ensureRequiredString(body.formType || body.voucherTypeId, 'formType');
    ensureRequiredString(body.voucherType, 'voucherType');
    ensureRequiredString(body.persona, 'persona');
  }
  const validPersonas = ['direct', 'linked', 'service'];
  if (body.persona !== undefined && !validPersonas.includes(body.persona)) {
    throw ApiError.badRequest(`persona must be one of: ${validPersonas.join(', ')}`);
  }
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  ensureRequiredString(body.customerId, 'customerId');
  ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.customerInvoiceNumber !== undefined) ensureOptionalString(body.customerInvoiceNumber, 'customerInvoiceNumber');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSILine(line, index));
  }
  if (body.charges !== undefined) {
    if (!Array.isArray(body.charges)) {
      throw ApiError.badRequest('charges must be an array when provided');
    }
    body.charges.forEach((charge: any, index: number) => validateSICharge(charge, index));
  }

  if (body.settlementInput !== undefined) {
    validateSettlementInput(body.settlementInput);
  }
};

export const validateUpdateSalesInvoiceInput = (body: any) => {
  if (body.voucherFormId !== undefined) ensureOptionalString(body.voucherFormId, 'voucherFormId');
  if (body.formType !== undefined) ensureOptionalString(body.formType, 'formType');
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');
  if (body.customerInvoiceNumber !== undefined) ensureOptionalString(body.customerInvoiceNumber, 'customerInvoiceNumber');
  if (body.invoiceDate !== undefined) ensureIsoDate(body.invoiceDate, 'invoiceDate');
  if (body.dueDate !== undefined) ensureIsoDate(body.dueDate, 'dueDate');
  if (body.currency !== undefined) ensureOptionalString(body.currency, 'currency');
  if (body.exchangeRate !== undefined) ensurePositiveNumber(body.exchangeRate, 'exchangeRate');

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSILine(line, index));
  }
  if (body.charges !== undefined) {
    if (!Array.isArray(body.charges)) {
      throw ApiError.badRequest('charges must be an array when provided');
    }
    body.charges.forEach((charge: any, index: number) => validateSICharge(charge, index));
  }

  if (body.settlementInput !== undefined) {
    validateSettlementInput(body.settlementInput);
  }
};

const VALID_SETTLEMENT_MODES = ['DEFERRED', 'CASH_FULL', 'MULTI'];
const VALID_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];

const validateSettlementInput = (settlement: any) => {
  if (!settlement.settlementMode) {
    throw ApiError.badRequest('settlementInput.settlementMode is required');
  }
  if (!VALID_SETTLEMENT_MODES.includes(settlement.settlementMode)) {
    throw ApiError.badRequest(`settlementMode must be one of: ${VALID_SETTLEMENT_MODES.join(', ')}`);
  }
  if (settlement.receivablePayableAccountId !== undefined) {
    ensureOptionalString(settlement.receivablePayableAccountId, 'receivablePayableAccountId');
  }
  if (settlement.settlements !== undefined) {
    if (!Array.isArray(settlement.settlements)) {
      throw ApiError.badRequest('settlementInput.settlements must be an array');
    }
    settlement.settlements.forEach((s: any, index: number) => {
      if (s.settlementAccountId !== undefined) {
        ensureOptionalString(s.settlementAccountId, `settlements[${index}].settlementAccountId`);
      }
      if (typeof s.amountBase !== 'number' || s.amountBase <= 0) {
        throw ApiError.badRequest(`settlements[${index}].amountBase must be a positive number`);
      }
      if (s.paymentMethod && !VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
        throw ApiError.badRequest(`settlements[${index}].paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
      }
    });
  }
};

export const validateListSalesInvoicesQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SIStatus;
    if (!SI_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SI_STATUSES.join(', ')}`);
    }
  }

  if (query.paymentStatus !== undefined) {
    const paymentStatus = String(query.paymentStatus).toUpperCase() as PaymentStatus;
    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw ApiError.badRequest(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }

  if (query.salesOrderId !== undefined && typeof query.salesOrderId !== 'string') {
    throw ApiError.badRequest('salesOrderId must be a string');
  }

  if (query.limit !== undefined) {
    const limit = Number(query.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw ApiError.badRequest('limit must be a positive number');
    }
  }
};

export const validateCreateSalesReturnInput = (body: any) => {
  if (body.returnContext !== undefined) {
    ensureOptionalString(body.returnContext, 'returnContext');
    if (!RETURN_CONTEXTS.includes(String(body.returnContext))) {
      throw ApiError.badRequest(`returnContext must be one of: ${RETURN_CONTEXTS.join(', ')}`);
    }
  }
  const returnContext = String(body.returnContext || '').trim();

  if (body.salesInvoiceId !== undefined) ensureOptionalString(body.salesInvoiceId, 'salesInvoiceId');
  if (body.deliveryNoteId !== undefined) ensureOptionalString(body.deliveryNoteId, 'deliveryNoteId');
  if (body.salesOrderId !== undefined) ensureOptionalString(body.salesOrderId, 'salesOrderId');
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');

  if (returnContext === 'AFTER_INVOICE') {
    ensureRequiredString(body.salesInvoiceId, 'salesInvoiceId');
  } else if (returnContext === 'BEFORE_INVOICE') {
    ensureRequiredString(body.deliveryNoteId, 'deliveryNoteId');
  } else if (returnContext === 'DIRECT') {
    ensureRequiredString(body.customerId, 'customerId');
  } else if (!body.salesInvoiceId && !body.deliveryNoteId) {
    if (body.customerId) {
      // Backward-compatible DIRECT inference when returnContext is omitted.
    } else {
      throw ApiError.badRequest('salesInvoiceId or deliveryNoteId is required when returnContext is not DIRECT');
    }
  }

  ensureIsoDate(body.returnDate, 'returnDate');
  if (body.warehouseId !== undefined) ensureOptionalString(body.warehouseId, 'warehouseId');
  if (body.settlementMode !== undefined) {
    ensureOptionalString(body.settlementMode, 'settlementMode');
    if (!RETURN_SETTLEMENT_MODES.includes(String(body.settlementMode))) {
      throw ApiError.badRequest(`settlementMode must be one of: ${RETURN_SETTLEMENT_MODES.join(', ')}`);
    }
  }
  if (body.reasonCode !== undefined) {
    ensureOptionalString(body.reasonCode, 'reasonCode');
    if (!RETURN_REASON_CODES.includes(String(body.reasonCode))) {
      throw ApiError.badRequest(`reasonCode must be one of: ${RETURN_REASON_CODES.join(', ')}`);
    }
  }
  ensureRequiredString(body.reason, 'reason');
  validateRestockingFeeInput(body);
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    throw ApiError.badRequest('notes must be a string');
  }

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSRLine(line, index));
  }
};

export const validateListSalesReturnsQuery = (query: any) => {
  if (query.status !== undefined) {
    const status = String(query.status).toUpperCase() as SRStatus;
    if (!SR_STATUSES.includes(status)) {
      throw ApiError.badRequest(`status must be one of: ${SR_STATUSES.join(', ')}`);
    }
  }

  if (query.customerId !== undefined && typeof query.customerId !== 'string') {
    throw ApiError.badRequest('customerId must be a string');
  }
  if (query.salesInvoiceId !== undefined && typeof query.salesInvoiceId !== 'string') {
    throw ApiError.badRequest('salesInvoiceId must be a string');
  }
  if (query.deliveryNoteId !== undefined && typeof query.deliveryNoteId !== 'string') {
    throw ApiError.badRequest('deliveryNoteId must be a string');
  }
};

export const validateUpdateSalesInvoicePaymentStatusInput = (body: any) => {
  ensureNumber(body.paidAmountBase, 'paidAmountBase');
};

export const validateRecordSalesInvoicePaymentInput = (body: any) => {
  ensurePositiveNumber(body.paymentAmountBase, 'paymentAmountBase');
  if (body.settlementAccountId !== undefined) ensureOptionalString(body.settlementAccountId, 'settlementAccountId');
  if (body.receivablePayableAccountId !== undefined) ensureOptionalString(body.receivablePayableAccountId, 'receivablePayableAccountId');
  if (body.arAccountId !== undefined) ensureOptionalString(body.arAccountId, 'arAccountId');
  if (body.paymentMethod !== undefined && !VALID_PAYMENT_METHODS.includes(String(body.paymentMethod))) {
    throw ApiError.badRequest(`paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }
};

export const validateSendSalesInvoiceWhatsAppInput = (body: any) => {
  if (body.messagingAccountId !== undefined) ensureOptionalString(body.messagingAccountId, 'messagingAccountId');
  if (body.toPhoneNumber !== undefined) ensureOptionalString(body.toPhoneNumber, 'toPhoneNumber');
  if (body.messageText !== undefined) ensureOptionalString(body.messageText, 'messageText');
  if (body.documentUrl !== undefined) ensureOptionalString(body.documentUrl, 'documentUrl');
};

export const validateSendSalesInvoiceTelegramInput = (body: any) => {
  if (body.messagingAccountId !== undefined) ensureOptionalString(body.messagingAccountId, 'messagingAccountId');
  if (body.toChatId !== undefined) ensureOptionalString(body.toChatId, 'toChatId');
  if (body.messageText !== undefined) ensureOptionalString(body.messageText, 'messageText');
  if (body.documentUrl !== undefined) ensureOptionalString(body.documentUrl, 'documentUrl');
};

export const validateUpdateDeliveryNoteInput = (body: any) => {
  if (body.customerId !== undefined) ensureOptionalString(body.customerId, 'customerId');
  if (body.deliveryDate !== undefined) ensureIsoDate(body.deliveryDate, 'deliveryDate');
  if (body.warehouseId !== undefined) ensureOptionalString(body.warehouseId, 'warehouseId');
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    throw ApiError.badRequest('notes must be a string');
  }

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateDNLine(line, index));
  }
};

export const validateUpdateSalesReturnInput = (body: any) => {
  if (body.returnDate !== undefined) ensureIsoDate(body.returnDate, 'returnDate');
  if (body.warehouseId !== undefined) ensureOptionalString(body.warehouseId, 'warehouseId');
  if (body.settlementMode !== undefined) {
    ensureOptionalString(body.settlementMode, 'settlementMode');
    if (!RETURN_SETTLEMENT_MODES.includes(String(body.settlementMode))) {
      throw ApiError.badRequest(`settlementMode must be one of: ${RETURN_SETTLEMENT_MODES.join(', ')}`);
    }
  }
  if (body.reasonCode !== undefined) {
    ensureOptionalString(body.reasonCode, 'reasonCode');
    if (!RETURN_REASON_CODES.includes(String(body.reasonCode))) {
      throw ApiError.badRequest(`reasonCode must be one of: ${RETURN_REASON_CODES.join(', ')}`);
    }
  }
  if (body.reason !== undefined) ensureOptionalString(body.reason, 'reason');
  validateRestockingFeeInput(body);
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    throw ApiError.badRequest('notes must be a string');
  }

  if (body.lines !== undefined) {
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      throw ApiError.badRequest('lines must be a non-empty array when provided');
    }
    body.lines.forEach((line: any, index: number) => validateSRLine(line, index));
  }
};
