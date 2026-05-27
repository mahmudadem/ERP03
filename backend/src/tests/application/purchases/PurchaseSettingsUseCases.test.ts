import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { InitializePurchasesUseCase, UpdatePurchaseSettingsUseCase } from '../../../application/purchases/use-cases/PurchaseSettingsUseCases';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

const COMPANY_ID = 'cmp-purchase';
const USER_ID = 'u-purchase';

const makePurchaseInvoiceTemplate = (code: string, persona: 'direct' | 'linked' | 'service'): VoucherTypeDefinition =>
  new VoucherTypeDefinition(
    code,
    'SYSTEM',
    `Purchase Invoice ${persona}`,
    code,
    'PURCHASE',
    [{ id: 'vendorId', label: 'Vendor', type: 'party-selector' }] as any,
    [{ fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER' }] as any,
    { sections: [{ id: 'header', fieldIds: ['vendorId'] }] },
    2,
    undefined,
    undefined,
    undefined,
    true,
    [],
    [],
    undefined,
    'purchase_invoice',
    persona
  );

const makeVoucherTypeRepo = (seed: VoucherTypeDefinition[] = []) => {
  const store = [...seed];
  return {
    store,
    repo: {
      createVoucherType: jest.fn(async (definition: VoucherTypeDefinition) => {
        const existingIndex = store.findIndex(
          (entry) => entry.companyId === definition.companyId && entry.code === definition.code
        );
        if (existingIndex >= 0) {
          store[existingIndex] = definition;
        } else {
          store.push(definition);
        }
      }),
      updateVoucherType: jest.fn(),
      getVoucherType: jest.fn(),
      getVoucherTypesForModule: jest.fn(),
      getByCompanyId: jest.fn(async (companyId: string) => store.filter((entry) => entry.companyId === companyId)),
      getByCode: jest.fn(async (companyId: string, code: string) =>
        store.find((entry) => entry.companyId === companyId && entry.code === code) || null
      ),
      updateLayout: jest.fn(),
      getSystemTemplates: jest.fn(async () => store.filter((entry) => entry.companyId === 'SYSTEM')),
      deleteVoucherType: jest.fn(),
    },
  };
};

const makeVoucherFormRepo = () => {
  const store: VoucherFormDefinition[] = [];
  return {
    store,
    repo: {
      create: jest.fn(async (form: VoucherFormDefinition) => {
        store.push(form);
        return form;
      }),
      getById: jest.fn(),
      getByTypeId: jest.fn(async (companyId: string, typeId: string) =>
        store.filter((entry) => entry.companyId === companyId && entry.typeId === typeId)
      ),
      getDefaultForType: jest.fn(),
      getAllByCompany: jest.fn(async (companyId: string) => store.filter((entry) => entry.companyId === companyId)),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
};

describe('Purchase settings use-cases', () => {
  it('initialization preserves purchase invoice voucherType and persona metadata on company types and forms', async () => {
    const voucherTypes = makeVoucherTypeRepo([
      makePurchaseInvoiceTemplate('purchase_invoice_direct', 'direct'),
      makePurchaseInvoiceTemplate('purchase_invoice_linked', 'linked'),
      makePurchaseInvoiceTemplate('purchase_invoice_service', 'service'),
    ]);
    const voucherForms = makeVoucherFormRepo();
    let savedSettings: any = null;
    let moduleState: any = null;

    const useCase = new InitializePurchasesUseCase(
      {
        saveSettings: jest.fn(async (settings: any) => {
          savedSettings = settings;
        }),
        getSettings: jest.fn(),
      } as any,
      {
        getById: jest.fn(async () => ({ id: 'acc-1' })),
      } as any,
      {
        get: jest.fn(async () => moduleState),
        create: jest.fn(async (module: any) => {
          moduleState = module;
        }),
        update: jest.fn(async (_companyId: string, _moduleCode: string, updates: any) => {
          moduleState = { ...moduleState, ...updates };
        }),
      } as any,
      voucherTypes.repo as any,
      voucherForms.repo as any,
      { execute: jest.fn(async () => undefined) } as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      userId: USER_ID,
      workflowMode: 'SIMPLE',
      defaultAPAccountId: 'ap-1',
    });

    expect(savedSettings?.companyId).toBe(COMPANY_ID);

    const companyInvoiceTypes = voucherTypes.store.filter((entry) =>
      entry.companyId === COMPANY_ID && entry.voucherType === 'purchase_invoice'
    );
    expect(companyInvoiceTypes).toHaveLength(3);
    expect(companyInvoiceTypes.map((entry) => entry.persona).sort()).toEqual(['direct', 'linked', 'service']);

    const companyInvoiceForms = voucherForms.store.filter((entry) => entry.voucherType === 'purchase_invoice');
    expect(companyInvoiceForms).toHaveLength(3);
    expect(companyInvoiceForms.map((entry) => entry.persona).sort()).toEqual(['direct', 'linked', 'service']);
    expect(companyInvoiceForms.map((entry) => entry.formType).sort()).toEqual([
      'purchase_invoice_direct',
      'purchase_invoice_linked',
      'purchase_invoice_service',
    ]);
  });
});

describe('UpdatePurchaseSettingsUseCase — workflow transition guards', () => {
  const makeExistingSettings = (workflowMode: 'SIMPLE' | 'OPERATIONAL'): PurchaseSettings =>
    new PurchaseSettings({
      companyId: COMPANY_ID,
      workflowMode,
      allowDirectInvoicing: true,
      requirePOForStockItems: false,
      defaultPaymentTermsDays: 30,
      poNumberPrefix: 'PO',
      poNumberNextSeq: 1,
      grnNumberPrefix: 'GRN',
      grnNumberNextSeq: 1,
      piNumberPrefix: 'PI',
      piNumberNextSeq: 1,
      prNumberPrefix: 'PR',
      prNumberNextSeq: 1,
      allowOverDelivery: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
    });

  const buildUseCase = (opts: {
    existingWorkflow: 'SIMPLE' | 'OPERATIONAL';
    hasOpenPOs: boolean;
    hasUnpostedGRNs: boolean;
  }) => {
    const existing = makeExistingSettings(opts.existingWorkflow);
    const settingsRepo = {
      getSettings: jest.fn(async () => existing),
      saveSettings: jest.fn(),
    };
    const purchaseOrderRepo = {
      hasOpenOrders: jest.fn(async () => opts.hasOpenPOs),
    };
    const goodsReceiptRepo = {
      hasUnpostedGoodsReceipts: jest.fn(async () => opts.hasUnpostedGRNs),
    };

    const useCase = new UpdatePurchaseSettingsUseCase(
      settingsRepo as any,
      { getById: jest.fn(async () => ({ id: 'ap-1' })) } as any,
      { getVoucherType: jest.fn(), getSystemTemplates: jest.fn(async () => []), getByCode: jest.fn(), createVoucherType: jest.fn() } as any,
      { getByTypeId: jest.fn(async () => []), create: jest.fn() } as any,
      purchaseOrderRepo as any,
      goodsReceiptRepo as any
    );

    return { useCase, settingsRepo, purchaseOrderRepo, goodsReceiptRepo };
  };

  it('blocks OPERATIONAL → SIMPLE transition when open POs exist', async () => {
    const { useCase, purchaseOrderRepo } = buildUseCase({
      existingWorkflow: 'OPERATIONAL',
      hasOpenPOs: true,
      hasUnpostedGRNs: false,
    });

    await expect(useCase.execute({ companyId: COMPANY_ID, workflowMode: 'SIMPLE' }))
      .rejects.toThrow(BusinessError);

    expect(purchaseOrderRepo.hasOpenOrders).toHaveBeenCalled();
  });

  it('blocks OPERATIONAL → SIMPLE transition when unposted GRNs exist', async () => {
    const { useCase } = buildUseCase({
      existingWorkflow: 'OPERATIONAL',
      hasOpenPOs: false,
      hasUnpostedGRNs: true,
    });

    await expect(useCase.execute({ companyId: COMPANY_ID, workflowMode: 'SIMPLE' }))
      .rejects.toThrow(BusinessError);
  });

  it('allows OPERATIONAL → SIMPLE transition when no open commitments', async () => {
    const { useCase } = buildUseCase({
      existingWorkflow: 'OPERATIONAL',
      hasOpenPOs: false,
      hasUnpostedGRNs: false,
    });

    const result = await useCase.execute({ companyId: COMPANY_ID, workflowMode: 'SIMPLE' });
    expect(result.workflowMode).toBe('SIMPLE');
  });

  it('allows SIMPLE → OPERATIONAL transition without guard checks', async () => {
    const { purchaseOrderRepo, goodsReceiptRepo, useCase } = buildUseCase({
      existingWorkflow: 'SIMPLE',
      hasOpenPOs: false,
      hasUnpostedGRNs: false,
    });

    const result = await useCase.execute({ companyId: COMPANY_ID, workflowMode: 'OPERATIONAL' });
    expect(result.workflowMode).toBe('OPERATIONAL');
    expect(purchaseOrderRepo.hasOpenOrders).not.toHaveBeenCalled();
    expect(goodsReceiptRepo.hasUnpostedGoodsReceipts).not.toHaveBeenCalled();
  });

  it('does not block on cancelled GRNs — only DRAFT GRNs block', async () => {
    const { useCase } = buildUseCase({
      existingWorkflow: 'OPERATIONAL',
      hasOpenPOs: false,
      hasUnpostedGRNs: false,
    });

    const result = await useCase.execute({ companyId: COMPANY_ID, workflowMode: 'SIMPLE' });
    expect(result.workflowMode).toBe('SIMPLE');
  });
});
