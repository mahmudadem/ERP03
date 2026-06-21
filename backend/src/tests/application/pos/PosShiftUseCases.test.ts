import {
  OpenPosShiftUseCase,
  ClosePosShiftUseCase,
  CreatePosCashMovementUseCase,
} from '../../../application/pos/use-cases/PosShiftUseCases';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';
import { PosCashMovement } from '../../../domain/pos/entities/PosCashMovement';

const makeRegister = (overrides: Partial<any> = {}): PosRegister =>
  PosRegister.fromJSON({
    id: 'reg_1',
    companyId: 'cmp_test',
    code: 'POS-01',
    name: 'Front Till',
    warehouseId: 'wh1',
    cashDrawerAccountId: 'cash-acc',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const makeSettings = (overrides: Partial<any> = {}): PosSettings =>
  PosSettings.fromJSON({
    companyId: 'cmp_test',
    requireOpenShift: true,
    cashOverAccountId: 'over-acc',
    cashShortAccountId: 'short-acc',
    paymentMethods: [],
    ...overrides,
  });

const makeOpenShift = (): PosShift =>
  PosShift.fromJSON({
    id: 'shift_1',
    companyId: 'cmp_test',
    registerId: 'reg_1',
    cashierUserId: 'cashier_1',
    status: 'OPEN',
    openedAt: new Date(),
    openingFloat: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
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

describe('PosShiftUseCases', () => {
  describe('OpenPosShiftUseCase', () => {
    it('rejects a 2nd open shift on the same register', async () => {
      const existing = makeOpenShift();
      const register = makeRegister();
      const settings = makeSettings();
      const shiftRepo = {
        getOpenShiftForRegister: jest.fn().mockResolvedValue(existing),
        getOpenShiftForCashier: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        getById: jest.fn(),
        list: jest.fn(),
      };
      const registerRepo = { getById: jest.fn().mockResolvedValue(register), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const cashMovementRepo = { create: jest.fn(), listByShift: jest.fn(), sumByShift: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new OpenPosShiftUseCase(shiftRepo as any, registerRepo as any, posSettingsRepo as any, cashMovementRepo as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', registerId: 'reg_1', cashierUserId: 'cashier_1', openingFloat: 50, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/already has an open shift/i);
      expect(shiftRepo.create).not.toHaveBeenCalled();
    });

    it('opens a shift and creates an OPENING_FLOAT cash movement', async () => {
      const register = makeRegister();
      const settings = makeSettings();
      const shiftRepo = {
        getOpenShiftForRegister: jest.fn().mockResolvedValue(null),
        getOpenShiftForCashier: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn(),
        getById: jest.fn(),
        list: jest.fn(),
      };
      const registerRepo = { getById: jest.fn().mockResolvedValue(register), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const cashMovementRepo = { create: jest.fn().mockResolvedValue(undefined), listByShift: jest.fn(), sumByShift: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new OpenPosShiftUseCase(shiftRepo as any, registerRepo as any, posSettingsRepo as any, cashMovementRepo as any, tx as any);

      const shift = await useCase.execute({
        companyId: 'cmp_test',
        registerId: 'reg_1',
        cashierUserId: 'cashier_1',
        openingFloat: 150.5,
        actor: { userId: 'cashier_1' },
      });
      expect(shift.status).toBe('OPEN');
      expect(shift.openingFloat).toBe(150.5);
      expect(shiftRepo.create).toHaveBeenCalled();
      expect(cashMovementRepo.create).toHaveBeenCalled();
      const openingArg = cashMovementRepo.create.mock.calls[0][0] as PosCashMovement;
      expect(openingArg.type).toBe('OPENING_FLOAT');
      expect(openingArg.amount).toBe(150.5);
    });

    it('rejects an INACTIVE register', async () => {
      const register = makeRegister({ status: 'INACTIVE' });
      const settings = makeSettings();
      const shiftRepo = {
        getOpenShiftForRegister: jest.fn().mockResolvedValue(null),
        getOpenShiftForCashier: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        getById: jest.fn(),
        list: jest.fn(),
      };
      const registerRepo = { getById: jest.fn().mockResolvedValue(register), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const cashMovementRepo = { create: jest.fn(), listByShift: jest.fn(), sumByShift: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new OpenPosShiftUseCase(shiftRepo as any, registerRepo as any, posSettingsRepo as any, cashMovementRepo as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', registerId: 'reg_1', cashierUserId: 'cashier_1', openingFloat: 0, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/INACTIVE/);
    });
  });

  describe('CreatePosCashMovementUseCase', () => {
    it('rejects SALE_CASH as a cashier-driven movement', async () => {
      const shift = makeOpenShift();
      const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), create: jest.fn(), update: jest.fn(), getOpenShiftForRegister: jest.fn(), getOpenShiftForCashier: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { create: jest.fn(), listByShift: jest.fn(), sumByShift: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new CreatePosCashMovementUseCase(shiftRepo as any, cashMovementRepo as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', type: 'SALE_CASH' as any, amount: 10, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/PAYIN, PAYOUT, or DROP/);
    });

    it('rejects movements on a CLOSED shift', async () => {
      const shift = PosShift.fromJSON({
        id: 'shift_1',
        companyId: 'cmp_test',
        registerId: 'reg_1',
        cashierUserId: 'cashier_1',
        status: 'CLOSED',
        openedAt: new Date(),
        openingFloat: 100,
        closedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const shiftRepo = { getById: jest.fn().mockResolvedValue(shift), create: jest.fn(), update: jest.fn(), getOpenShiftForRegister: jest.fn(), getOpenShiftForCashier: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { create: jest.fn(), listByShift: jest.fn(), sumByShift: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new CreatePosCashMovementUseCase(shiftRepo as any, cashMovementRepo as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', type: 'PAYIN', amount: 50, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/closed shift/);
    });
  });

  describe('ClosePosShiftUseCase', () => {
    it('closes a balanced shift without posting a voucher', async () => {
      const shift = makeOpenShift(); // openingFloat=100, no movements
      const totals = {
        OPENING_FLOAT: 100, PAYIN: 0, PAYOUT: 0, DROP: 0, SALE_CASH: 0, REFUND_CASH: 0, expectedCash: 100,
      };
      const shiftRepo = {
        getById: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        getOpenShiftForRegister: jest.fn(),
        getOpenShiftForCashier: jest.fn(),
        list: jest.fn(),
      };
      const posSettingsRepo = { getSettings: jest.fn(), saveSettings: jest.fn() };
      const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { sumByShift: jest.fn().mockResolvedValue(totals), create: jest.fn(), listByShift: jest.fn() };
      const accountRepo = { getById: jest.fn() };
      const accountingBridge = { recordFinancialEvent: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new ClosePosShiftUseCase(shiftRepo as any, posSettingsRepo as any, registerRepo as any, cashMovementRepo as any, accountRepo as any, accountingBridge as any, tx as any);

      const result = await useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', countedCash: 100, actor: { userId: 'cashier_1' } });
      expect(result.overShortAmount).toBe(0);
      expect(result.overShortVoucherId).toBeUndefined();
      expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
      expect(shiftRepo.update).toHaveBeenCalled();
    });

    it('posts a balanced over-voucher Dr cash / Cr over when counted > expected', async () => {
      const shift = makeOpenShift();
      const totals = {
        OPENING_FLOAT: 100, PAYIN: 0, PAYOUT: 0, DROP: 0, SALE_CASH: 0, REFUND_CASH: 0, expectedCash: 100,
      };
      const shiftRepo = {
        getById: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        getOpenShiftForRegister: jest.fn(),
        getOpenShiftForCashier: jest.fn(),
        list: jest.fn(),
      };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(makeSettings()), saveSettings: jest.fn() };
      const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { sumByShift: jest.fn().mockResolvedValue(totals), create: jest.fn(), listByShift: jest.fn() };
      const accountRepo = { getById: jest.fn().mockImplementation(async (_c: string, id: string) => baseAccount(id)) };
      const postedVoucher = { id: 'voucher_over_1' };
      const accountingBridge = { recordFinancialEvent: jest.fn().mockResolvedValue({ mode: 'full', voucher: postedVoucher }) };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new ClosePosShiftUseCase(shiftRepo as any, posSettingsRepo as any, registerRepo as any, cashMovementRepo as any, accountRepo as any, accountingBridge as any, tx as any);

      const result = await useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', countedCash: 110, actor: { userId: 'cashier_1' } });
      expect(result.overShortAmount).toBe(10);
      expect(result.overShortVoucherId).toBe('voucher_over_1');
      expect(accountingBridge.recordFinancialEvent).toHaveBeenCalled();
      const call = accountingBridge.recordFinancialEvent.mock.calls[0][0].subledgerVoucher;
      const debit = call.lines.find((l: any) => l.side === 'Debit');
      const credit = call.lines.find((l: any) => l.side === 'Credit');
      expect(debit.accountId).toBe('cash-acc');     // Dr cash drawer
      expect(credit.accountId).toBe('over-acc');    // Cr cash over
      expect(debit.amount).toBe(credit.amount);
    });

    it('posts a balanced short-voucher Dr short / Cr cash when counted < expected', async () => {
      const shift = makeOpenShift();
      const totals = {
        OPENING_FLOAT: 100, PAYIN: 0, PAYOUT: 0, DROP: 0, SALE_CASH: 0, REFUND_CASH: 0, expectedCash: 100,
      };
      const shiftRepo = {
        getById: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        getOpenShiftForRegister: jest.fn(),
        getOpenShiftForCashier: jest.fn(),
        list: jest.fn(),
      };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(makeSettings()), saveSettings: jest.fn() };
      const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { sumByShift: jest.fn().mockResolvedValue(totals), create: jest.fn(), listByShift: jest.fn() };
      const accountRepo = { getById: jest.fn().mockImplementation(async (_c: string, id: string) => baseAccount(id)) };
      const accountingBridge = { recordFinancialEvent: jest.fn().mockResolvedValue({ mode: 'full', voucher: { id: 'voucher_short_1' } }) };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new ClosePosShiftUseCase(shiftRepo as any, posSettingsRepo as any, registerRepo as any, cashMovementRepo as any, accountRepo as any, accountingBridge as any, tx as any);

      const result = await useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', countedCash: 90, actor: { userId: 'cashier_1' } });
      expect(result.overShortAmount).toBe(-10);
      const call = accountingBridge.recordFinancialEvent.mock.calls[0][0].subledgerVoucher;
      const debit = call.lines.find((l: any) => l.side === 'Debit');
      const credit = call.lines.find((l: any) => l.side === 'Credit');
      expect(debit.accountId).toBe('short-acc');    // Dr cash short
      expect(credit.accountId).toBe('cash-acc');    // Cr cash drawer
    });

    it('blocks close with a short and no short-account configured', async () => {
      const shift = makeOpenShift();
      const totals = {
        OPENING_FLOAT: 100, PAYIN: 0, PAYOUT: 0, DROP: 0, SALE_CASH: 0, REFUND_CASH: 0, expectedCash: 100,
      };
      const settings = makeSettings({ cashShortAccountId: undefined });
      const shiftRepo = {
        getById: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        update: jest.fn(),
        getOpenShiftForRegister: jest.fn(),
        getOpenShiftForCashier: jest.fn(),
        list: jest.fn(),
      };
      const posSettingsRepo = { getSettings: jest.fn().mockResolvedValue(settings), saveSettings: jest.fn() };
      const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { sumByShift: jest.fn().mockResolvedValue(totals), create: jest.fn(), listByShift: jest.fn() };
      const accountRepo = { getById: jest.fn().mockResolvedValue(baseAccount('cash-acc')) };
      const accountingBridge = { recordFinancialEvent: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new ClosePosShiftUseCase(shiftRepo as any, posSettingsRepo as any, registerRepo as any, cashMovementRepo as any, accountRepo as any, accountingBridge as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', countedCash: 90, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/Cash Short account/);
      expect(accountingBridge.recordFinancialEvent).not.toHaveBeenCalled();
      expect(shiftRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a re-close (shift must be OPEN)', async () => {
      const shift = PosShift.fromJSON({
        id: 'shift_1',
        companyId: 'cmp_test',
        registerId: 'reg_1',
        cashierUserId: 'cashier_1',
        status: 'CLOSED',
        openedAt: new Date(),
        openingFloat: 100,
        closedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const shiftRepo = {
        getById: jest.fn().mockResolvedValue(shift),
        create: jest.fn(),
        update: jest.fn(),
        getOpenShiftForRegister: jest.fn(),
        getOpenShiftForCashier: jest.fn(),
        list: jest.fn(),
      };
      const posSettingsRepo = { getSettings: jest.fn(), saveSettings: jest.fn() };
      const registerRepo = { getById: jest.fn(), create: jest.fn(), update: jest.fn(), list: jest.fn() };
      const cashMovementRepo = { sumByShift: jest.fn(), create: jest.fn(), listByShift: jest.fn() };
      const accountRepo = { getById: jest.fn() };
      const accountingBridge = { recordFinancialEvent: jest.fn() };
      const tx = { runTransaction: async (fn: any) => fn({}) };
      const useCase = new ClosePosShiftUseCase(shiftRepo as any, posSettingsRepo as any, registerRepo as any, cashMovementRepo as any, accountRepo as any, accountingBridge as any, tx as any);

      await expect(
        useCase.execute({ companyId: 'cmp_test', shiftId: 'shift_1', countedCash: 100, actor: { userId: 'cashier_1' } })
      ).rejects.toThrow(/not OPEN/);
    });
  });
});
