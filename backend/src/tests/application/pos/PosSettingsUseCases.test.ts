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

const basePolicy = (allowPosDirectSales = false) => ({
  companyId: 'cmp_test',
  allowPosDirectSales,
  terminalPolicies: [],
  cashierRolePolicies: [],
  updatedAt: new Date(),
});

const makePosPolicyRepo = (policy: any = basePolicy()) => ({
  getPolicy: jest.fn().mockResolvedValue(policy),
  savePolicy: jest.fn().mockImplementation(async (next: any) => {
    Object.assign(policy, next);
  }),
});
describe('PosSettingsUseCases', () => {
  describe('UpdatePosSettingsUseCase', () => {
    it('allows enabled payment methods without company-level settlement accounts', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn() };
      const posPolicyRepo = makePosPolicyRepo();
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

      const updated = await useCase.execute({
        companyId: 'cmp_test',
        paymentMethods: [
          { code: 'CARD', settlementAccountId: '', requiresReference: false, allowsChange: false, isEnabled: true },
        ],
      });

      expect(updated.paymentMethods[0].code).toBe('CARD');
      expect(posSettingsRepo.saveSettings).toHaveBeenCalled();
      expect(accountRepo.getById).not.toHaveBeenCalled();
    });

    it('rejects a missing over-account', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn().mockResolvedValue(null) };
      const posPolicyRepo = makePosPolicyRepo();
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', cashOverAccountId: 'missing-acc' })
      ).rejects.toThrow(/cashOverAccountId/);
    });

    it('rejects a missing short-account', async () => {
      const settings = baseSettings();
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const accountRepo = { getById: jest.fn().mockResolvedValue(null) };
      const posPolicyRepo = makePosPolicyRepo();
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', cashShortAccountId: 'missing-acc' })
      ).rejects.toThrow(/cashShortAccountId/);
    });

    it('toggling allowPosDirectSales writes POSPolicy without touching SalesSettings governance', async () => {
      const settings = baseSettings();
      const posSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(settings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const accountRepo = { getById: jest.fn().mockResolvedValue(baseAccount('acc1')) };
      const policy = basePolicy();
      const posPolicyRepo = makePosPolicyRepo(policy);
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

      await useCase.execute({ companyId: 'cmp_test', allowPosDirectSales: true });
      expect(policy.allowPosDirectSales).toBe(true);
      expect(posPolicyRepo.savePolicy).toHaveBeenCalledTimes(1);

      await useCase.execute({ companyId: 'cmp_test', allowPosDirectSales: false });
      expect(policy.allowPosDirectSales).toBe(false);
      expect(posPolicyRepo.savePolicy).toHaveBeenCalledTimes(2);
    });

    it('enables POS direct sale without SalesSettings present', async () => {
      const settings = baseSettings();
      const posSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(settings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const accountRepo = { getById: jest.fn().mockResolvedValue(baseAccount('acc1')) };
      const policy = basePolicy();
      const posPolicyRepo = makePosPolicyRepo(policy);
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

      const updated = await useCase.execute({ companyId: 'cmp_test', allowPosDirectSales: true });
      expect(updated.allowPosDirectSales).toBe(true);
      expect(policy.allowPosDirectSales).toBe(true);
      expect(posPolicyRepo.savePolicy).toHaveBeenCalledTimes(1);
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
      const posPolicyRepo = makePosPolicyRepo();
      const useCase = new UpdatePosSettingsUseCase(posSettingsRepo as any, accountRepo as any, posPolicyRepo as any);

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

    it('records POS settings changes through the audit engine', async () => {
      const settings = baseSettings();
      const posSettingsRepo = {
        getSettings: jest.fn().mockResolvedValue(settings),
        saveSettings: jest.fn().mockResolvedValue(undefined),
      };
      const accountRepo = {
        getById: jest.fn().mockImplementation(async (_co: string, id: string) => baseAccount(id)),
      };
      const posPolicyRepo = makePosPolicyRepo();
      const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
      const useCase = new UpdatePosSettingsUseCase(
        posSettingsRepo as any,
        accountRepo as any,
        posPolicyRepo as any,
        auditEngine as any
      );

      await useCase.execute({
        companyId: 'cmp_test',
        cashOverAccountId: 'over1',
        actor: { userId: 'admin_1', userEmail: 'admin@example.com' },
      });

      expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
        companyId: 'cmp_test',
        entity: expect.objectContaining({ type: 'POS_SETTINGS', id: 'cmp_test' }),
        action: 'UPDATE',
        actor: expect.objectContaining({ userId: 'admin_1', userEmail: 'admin@example.com' }),
        before: expect.objectContaining({ companyId: 'cmp_test' }),
        after: expect.objectContaining({ cashOverAccountId: 'over1' }),
      }));
    });
  });
});
