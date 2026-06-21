import { UpdatePosSettingsUseCase } from '../../../application/pos/use-cases/PosSettingsUseCases';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';

const baseSettings = (): PosSettings =>
  PosSettings.fromJSON({
    companyId: 'cmp_test',
    requireOpenShift: true,
    receiptPrefix: 'R',
    receiptNextSeq: 1,
    cashRounding: 'none',
    allowPosDirectSales: false,
    paymentMethods: [
      { code: 'CASH', settlementAccountId: '', requiresReference: false, allowsChange: true, isEnabled: true },
    ],
  });

const baseAccount = (id: string) => ({
  id,
  companyId: 'cmp_test',
  systemCode: id,
  userCode: id,
  name: id,
  description: null,
  accountRole: 'POSTING',
  classification: 'ASSET',
  balanceNature: 'DEBIT',
  balanceEnforcement: 'WARN_ABNORMAL',
  parentId: null,
  currencyPolicy: 'INHERIT',
  fixedCurrencyCode: null,
  allowedCurrencyCodes: [],
  status: 'ACTIVE',
  isProtected: false,
  replacedByAccountId: null,
  cashFlowCategory: null,
  plSubgroup: null,
  equitySubgroup: null,
  requiresApproval: false,
  requiresCustodyConfirmation: false,
  custodianUserId: null,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  updatedBy: 'u1',
});

const baseSalesSettings = () => ({
  companyId: 'cmp_test',
  workflowMode: 'OPERATIONAL',
  showOperationalDocsInSimple: false,
  allowCreditOverride: true,
  allowDirectInvoicing: true,
  requireSOForStockItems: false,
  defaultARAccountId: undefined,
  arParentAccountId: undefined,
  partyAccountCodeFormat: undefined,
  defaultRevenueAccountId: 'rev1',
  defaultCOGSAccountId: undefined,
  defaultInventoryAccountId: undefined,
  defaultSalesExpenseAccountId: undefined,
  defaultSalesReturnAccountId: undefined,
  defaultRefundAccountId: undefined,
  restockingFeeAccountId: undefined,
  exchangeGainLossAccountId: undefined,
  allowOverDelivery: false,
  allowOverpayment: false,
  deriveLinePriceAcrossUom: false,
  overDeliveryTolerancePct: 0,
  overInvoiceTolerancePct: 0,
  defaultPaymentTermsDays: 30,
  paymentMethodConfigs: [],
  messagingAccounts: [],
  governanceRules: [],
  defaultSalesInvoicePersona: 'direct',
  defaultWarehouseId: undefined,
  soNumberPrefix: 'SO',
  soNumberNextSeq: 1,
  dnNumberPrefix: 'DN',
  dnNumberNextSeq: 1,
  siNumberPrefix: 'SI',
  siNumberNextSeq: 1,
  srNumberPrefix: 'SR',
  srNumberNextSeq: 1,
  quoteNumberPrefix: 'QT',
  quoteNumberNextSeq: 1,
});

describe('PosSettingsUseCases', () => {
  describe('UpdatePosSettingsUseCase', () => {
    it('rejects an enabled payment method with no settlement account', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn() };
      const salesSettingsRepo = { getSettings: jest.fn(), saveSettings: jest.fn() };
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, salesSettingsRepo as any);

      await expect(
        useCase.execute({
          companyId: 'cmp_test',
          paymentMethods: [
            { code: 'CARD', settlementAccountId: '', requiresReference: false, allowsChange: false, isEnabled: true },
          ],
        })
      ).rejects.toThrow(/settlement account/i);
      expect(posSettingsRepo.saveSettings).not.toHaveBeenCalled();
    });

    it('rejects a missing over-account', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn().mockResolvedValue(null) };
      const salesSettingsRepo = { getSettings: jest.fn().mockResolvedValue(baseSalesSettings()), saveSettings: jest.fn() };
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, salesSettingsRepo as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', cashOverAccountId: 'missing-acc' })
      ).rejects.toThrow(/cashOverAccountId/);
    });

    it('rejects a missing short-account', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn().mockResolvedValue(null) };
      const salesSettingsRepo = { getSettings: jest.fn().mockResolvedValue(baseSalesSettings()), saveSettings: jest.fn() };
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, salesSettingsRepo as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', cashShortAccountId: 'missing-acc' })
      ).rejects.toThrow(/cashShortAccountId/);
    });

    it('toggling allowPosDirectSales inserts/removes the pos_sale governance rule', async () => {
      const settings = baseSettings();
      const posSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(settings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const accountRepo = { getById: jest.fn().mockResolvedValue(baseAccount('acc1')) };
      const salesSettings = baseSalesSettings();
      const salesSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(salesSettings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, salesSettingsRepo as any);

      // Enable
      await useCase.execute({ companyId: 'cmp_test', allowPosDirectSales: true });
      expect(salesSettings.governanceRules).toHaveLength(1);
      expect(salesSettings.governanceRules[0]).toMatchObject({
        scope: 'form',
        formType: 'pos_sale',
        action: 'allow',
        persona: 'direct',
      });

      // Disable
      await useCase.execute({ companyId: 'cmp_test', allowPosDirectSales: false });
      expect(salesSettings.governanceRules).toHaveLength(0);
    });

    it('persists POS settings when all referenced accounts exist', async () => {
      const settings = baseSettings();
      const posSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(settings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const accountRepo = {
        getById: jest.fn().mockImplementation(async (_co: string, id: string) => baseAccount(id)),
      };
      const salesSettings = baseSalesSettings();
      const salesSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(salesSettings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, salesSettingsRepo as any);

      const updated = await useCase.execute({
        companyId: 'cmp_test',
        cashOverAccountId: 'over1',
        cashShortAccountId: 'short1',
        paymentMethods: [
          { code: 'CASH', settlementAccountId: 'cash-drawer', requiresReference: false, allowsChange: true, isEnabled: true },
          { code: 'CARD', settlementAccountId: 'card-clear', requiresReference: true, allowsChange: false, isEnabled: true },
        ],
      });
      expect(posSettingsRepo.saveSettings).toHaveBeenCalled();
      expect(updated.cashOverAccountId).toBe('over1');
      expect(updated.paymentMethods.find((m) => m.code === 'CARD')?.settlementAccountId).toBe('card-clear');
    });
  });
});
