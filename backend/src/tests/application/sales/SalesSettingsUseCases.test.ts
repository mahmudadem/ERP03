import { describe, expect, it, jest } from '@jest/globals';
import {
  GetSalesSettingsUseCase,
  InitializeSalesUseCase,
} from '../../../application/sales/use-cases/SalesSettingsUseCases';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { PostingRole } from '../../../domain/designer/entities/PostingRole';
import { VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';

const COMPANY_ID = 'cmp-sales';
const USER_ID = 'u-sales';

const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

const makeExistingSettings = (): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requireSOForStockItems: false,
    defaultARAccountId: 'AR-100',
    defaultRevenueAccountId: 'REV-100',
    defaultCOGSAccountId: 'COGS-100',
    defaultInventoryAccountId: 'INV-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    salesVoucherTypeId: 'VT-SI',
    defaultWarehouseId: 'wh-1',
    soNumberPrefix: 'SO',
    soNumberNextSeq: 1,
    dnNumberPrefix: 'DN',
    dnNumberNextSeq: 1,
    siNumberPrefix: 'SI',
    siNumberNextSeq: 1,
    srNumberPrefix: 'SR',
    srNumberNextSeq: 1,
  });

const makeSystemVoucherType = (code: 'sales_invoice' | 'sales_return'): VoucherTypeDefinition =>
  new VoucherTypeDefinition(
    code,
    'SYSTEM',
    code === 'sales_invoice' ? 'Sales Invoice' : 'Sales Return',
    code,
    'ACCOUNTING',
    [
      {
        id: 'date',
        label: 'Date',
        type: 'DATE',
        required: true,
        isPosting: true,
        postingRole: PostingRole.DATE,
      },
      {
        id: 'description',
        label: 'Description',
        type: 'TEXT',
        isPosting: false,
        postingRole: null,
      },
    ] as any,
    [{ fieldId: 'accountId', width: '220px' }] as any,
    { sections: [{ id: 'header', title: 'Header', fieldIds: ['date', 'description'] }] },
    2
  );

const makeSystemVoucherForm = (code: 'sales_invoice' | 'sales_return'): VoucherFormDefinition => ({
  id: code,
  companyId: 'SYSTEM',
  typeId: code,
  name: code === 'sales_invoice' ? 'Sales Invoice' : 'Sales Return',
  code,
  isDefault: true,
  isSystemGenerated: true,
  isLocked: true,
  enabled: true,
  headerFields: [
    {
      id: 'date',
      label: 'Date',
      type: 'DATE',
      required: true,
      isPosting: true,
      postingRole: PostingRole.DATE,
    },
  ] as any,
  tableColumns: [{ fieldId: 'accountId', width: '220px' }] as any,
  layout: { sections: [{ id: 'header', title: 'Header', fieldIds: ['date'] }] },
  createdAt: nowDate(),
  updatedAt: nowDate(),
});

const makeVoucherTypeRepo = (seed: VoucherTypeDefinition[] = []) => {
  const store = [...seed];
  return {
    store,
    repo: {
      createVoucherType: jest.fn(async (definition: VoucherTypeDefinition) => {
        store.push(definition);
      }),
      updateVoucherType: jest.fn(),
      getVoucherType: jest.fn(),
      getVoucherTypesForModule: jest.fn(),
      getByCompanyId: jest.fn(async (companyId: string) => store.filter((entry) => entry.companyId === companyId)),
      getByCode: jest.fn(async (companyId: string, code: string) => {
        return (
          store.find((entry) => entry.companyId === companyId && entry.code === code)
          || store.find((entry) => entry.companyId === 'SYSTEM' && entry.code === code)
          || null
        );
      }),
      updateLayout: jest.fn(),
      getSystemTemplates: jest.fn(async () => store.filter((entry) => entry.companyId === 'SYSTEM')),
      deleteVoucherType: jest.fn(),
    },
  };
};

const makeVoucherFormRepo = (seed: VoucherFormDefinition[] = []) => {
  const store = [...seed];
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
      getDefaultForType: jest.fn(async (companyId: string, typeId: string) => {
        return (
          store.find((entry) => entry.companyId === companyId && entry.typeId === typeId && entry.isDefault)
          || store.find((entry) => entry.companyId === 'SYSTEM' && entry.code === typeId && entry.isDefault)
          || null
        );
      }),
      getAllByCompany: jest.fn(async (companyId: string) => store.filter((entry) => entry.companyId === companyId)),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
};

describe('Sales settings use-cases', () => {
  it('initialization creates company-specific sales voucher types and forms from system templates', async () => {
    const storedSettings: { current: SalesSettings | null } = { current: null };
    const moduleState: { current: any } = { current: null };
    const typeRepo = makeVoucherTypeRepo([
      makeSystemVoucherType('sales_invoice'),
      makeSystemVoucherType('sales_return'),
    ]);
    const formRepo = makeVoucherFormRepo([
      makeSystemVoucherForm('sales_invoice'),
      makeSystemVoucherForm('sales_return'),
    ]);

    const useCase = new InitializeSalesUseCase(
      {
        saveSettings: jest.fn(async (settings: SalesSettings) => {
          storedSettings.current = settings;
        }),
        getSettings: jest.fn(async () => storedSettings.current),
      } as any,
      {
        getById: jest.fn(async (_companyId: string, accountId: string) => ({ id: accountId })),
      } as any,
      {
        get: jest.fn(async () => moduleState.current),
        update: jest.fn(async (_companyId: string, _code: string, updates: any) => {
          moduleState.current = { ...(moduleState.current || {}), ...updates };
        }),
        create: jest.fn(async (module: any) => {
          moduleState.current = module;
        }),
      } as any,
      typeRepo.repo as any,
      formRepo.repo as any
    );

    await useCase.execute({
      companyId: COMPANY_ID,
      userId: USER_ID,
      defaultRevenueAccountId: 'REV-100',
      defaultInventoryAccountId: 'INV-100',
      defaultARAccountId: 'AR-100',
    });

    const companyTypes = typeRepo.store.filter((entry) => entry.companyId === COMPANY_ID);
    const companyForms = formRepo.store.filter((entry) => entry.companyId === COMPANY_ID);

    expect(companyTypes).toHaveLength(4);
    expect(companyTypes.map((entry) => entry.code).sort()).toEqual([
      'delivery_note',
      'sales_invoice',
      'sales_order',
      'sales_return',
    ]);
    expect(companyForms).toHaveLength(4);
    expect(companyForms.map((entry) => entry.code).sort()).toEqual([
      'delivery_note',
      'sales_invoice',
      'sales_order',
      'sales_return',
    ]);
    expect(companyForms.every((entry) => companyTypes.some((type) => type.id === entry.typeId))).toBe(true);
    expect(moduleState.current?.initialized).toBe(true);
    expect(storedSettings.current?.companyId).toBe(COMPANY_ID);
  });

  it('get settings backfills sales voucher types and forms even when system templates are absent', async () => {
    const existingSettings = makeExistingSettings();
    const typeRepo = makeVoucherTypeRepo();
    const formRepo = makeVoucherFormRepo();

    const useCase = new GetSalesSettingsUseCase(
      {
        getSettings: jest.fn(async () => existingSettings),
      } as any,
      typeRepo.repo as any,
      formRepo.repo as any
    );

    const result = await useCase.execute(COMPANY_ID);
    const companyTypes = typeRepo.store.filter((entry) => entry.companyId === COMPANY_ID);
    const companyForms = formRepo.store.filter((entry) => entry.companyId === COMPANY_ID);

    expect(result).toBe(existingSettings);
    expect(companyTypes).toHaveLength(4);
    expect(companyForms).toHaveLength(4);
    expect(companyTypes.map((entry) => entry.code).sort()).toEqual([
      'delivery_note',
      'sales_invoice',
      'sales_order',
      'sales_return',
    ]);
    expect(companyForms.map((entry) => entry.code).sort()).toEqual([
      'delivery_note',
      'sales_invoice',
      'sales_order',
      'sales_return',
    ]);
  });
});
