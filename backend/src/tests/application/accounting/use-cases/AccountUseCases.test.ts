/**
 * Account Use Case Tests
 * 
 * Tests for CreateAccountUseCase, UpdateAccountUseCase, and DeleteAccountUseCase.
 */

import { CreateAccountUseCase } from '../../../../application/accounting/use-cases/accounts/CreateAccountUseCase';
import { UpdateAccountUseCase } from '../../../../application/accounting/use-cases/accounts/UpdateAccountUseCase';
import { DeleteAccountUseCase } from '../../../../application/accounting/use-cases/accounts/DeleteAccountUseCase';
import { Account } from '../../../../domain/accounting/entities/Account';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

// Mock repository
const createMockRepo = (): jest.Mocked<IAccountRepository> => ({
  list: jest.fn(),
  getById: jest.fn(),
  getByUserCode: jest.fn(),
  getByCode: jest.fn(),
  getAccounts: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deactivate: jest.fn(),
  isUsed: jest.fn(),
  hasChildren: jest.fn(),
  countChildren: jest.fn(),
  existsByUserCode: jest.fn(),
  generateNextSystemCode: jest.fn(),
  countByCurrency: jest.fn(),
  recordAuditEvent: jest.fn()
});

const createMockAccount = (overrides: Partial<any> = {}): Account => {
  return new Account({
    id: 'test-id',
    systemCode: 'ACC-000001',
    companyId: 'company-1',
    userCode: '1001',
    name: 'Test Account',
    accountRole: 'POSTING',
    classification: 'ASSET',
    balanceNature: 'DEBIT',
    balanceEnforcement: 'WARN_ABNORMAL',
    currencyPolicy: 'INHERIT',
    status: 'ACTIVE',
    isProtected: false,
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    updatedBy: 'user-1',
    ...overrides
  });
};

describe('Account Use Cases', () => {
  // ==========================================================================
  // CreateAccountUseCase Tests
  // ==========================================================================
  
  describe('CreateAccountUseCase', () => {
    let useCase: CreateAccountUseCase;
    let mockRepo: jest.Mocked<IAccountRepository>;

    beforeEach(() => {
      mockRepo = createMockRepo();
      useCase = new CreateAccountUseCase(mockRepo);
    });

    it('should create an account with valid data', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(false);
      mockRepo.generateNextSystemCode.mockResolvedValue('ACC-000001');
      mockRepo.create.mockResolvedValue(createMockAccount());

      const result = await useCase.execute('company-1', {
        userCode: '1001',
        name: 'Cash',
        classification: 'ASSET',
        createdBy: 'user-1'
      });

      expect(result).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should reject duplicate userCode', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(true);

      await expect(useCase.execute('company-1', {
        userCode: '1001',
        name: 'Cash',
        classification: 'ASSET',
        createdBy: 'user-1'
      })).rejects.toThrow(/already exists/i);
    });

    it('should map INCOME to REVENUE classification', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(false);
      mockRepo.generateNextSystemCode.mockResolvedValue('ACC-000001');
      mockRepo.create.mockImplementation(async (companyId, data) => {
        return createMockAccount({ classification: data.classification });
      });

      const result = await useCase.execute('company-1', {
        userCode: '1001',
        name: 'Sales',
        classification: 'INCOME' as any, // Legacy
        createdBy: 'user-1'
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        'company-1',
        expect.objectContaining({ classification: 'REVENUE' })
      );
    });

    it('should validate parent classification match', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(false);
      mockRepo.getById.mockResolvedValue(createMockAccount({
        id: 'parent-id',
        classification: 'ASSET'
      }));

      await expect(useCase.execute('company-1', {
        userCode: '1001',
        name: 'Expense',
        classification: 'EXPENSE',
        parentId: 'parent-id',
        createdBy: 'user-1'
      })).rejects.toThrow(/must match parent/i);
    });

    it('should reject BOTH balance nature for REVENUE', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(false);

      await expect(useCase.execute('company-1', {
        userCode: '1001',
        name: 'Sales',
        classification: 'REVENUE',
        balanceNature: 'BOTH',
        createdBy: 'user-1'
      })).rejects.toThrow(/BOTH.*not allowed/i);
    });

    it('should require fixedCurrencyCode when policy is FIXED', async () => {
      mockRepo.existsByUserCode.mockResolvedValue(false);

      await expect(useCase.execute('company-1', {
        userCode: '1001',
        name: 'USD Cash',
        classification: 'ASSET',
        currencyPolicy: 'FIXED',
        createdBy: 'user-1'
      })).rejects.toThrow(/fixedCurrencyCode/i);
    });
  });

  // ==========================================================================
  // UpdateAccountUseCase Tests
  // ==========================================================================
  
  describe('UpdateAccountUseCase', () => {
    let useCase: UpdateAccountUseCase;
    let mockRepo: jest.Mocked<IAccountRepository>;

    beforeEach(() => {
      mockRepo = createMockRepo();
      useCase = new UpdateAccountUseCase(mockRepo);
    });

    it('should update mutable fields (name, description)', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.isUsed.mockResolvedValue(false);
      mockRepo.update.mockResolvedValue(createMockAccount({ name: 'New Name' }));

      const result = await useCase.execute('company-1', 'test-id', {
        name: 'New Name',
        updatedBy: 'user-1'
      });

      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should allow name change when account is USED', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.isUsed.mockResolvedValue(true);
      mockRepo.update.mockResolvedValue(createMockAccount({ name: 'New Name' }));

      // Name is mutable even after USED
      await expect(useCase.execute('company-1', 'test-id', {
        name: 'New Name',
        updatedBy: 'user-1'
      })).resolves.toBeDefined();
    });

    it('should block classification change when account is USED', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount({ classification: 'ASSET' }));
      mockRepo.isUsed.mockResolvedValue(true);

      await expect(useCase.execute('company-1', 'test-id', {
        classification: 'EXPENSE',
        updatedBy: 'user-1'
      })).rejects.toThrow(/been used/i);
    });

    it('should block balanceNature change when account is USED', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.isUsed.mockResolvedValue(true);

      await expect(useCase.execute('company-1', 'test-id', {
        balanceNature: 'CREDIT',
        updatedBy: 'user-1'
      })).rejects.toThrow(/been used/i);
    });

    it('should auto-set INACTIVE when replacedByAccountId is set', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.isUsed.mockResolvedValue(false);
      mockRepo.update.mockImplementation(async (c, id, data) => createMockAccount(data));

      await useCase.execute('company-1', 'test-id', {
        replacedByAccountId: 'other-account',
        updatedBy: 'user-1'
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        'company-1',
        'test-id',
        expect.objectContaining({ status: 'INACTIVE' })
      );
    });

    it('should reject POSTING role if account has children', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount({ accountRole: 'HEADER' }));
      mockRepo.isUsed.mockResolvedValue(false);
      mockRepo.countChildren.mockResolvedValue(3);

      await expect(useCase.execute('company-1', 'test-id', {
        accountRole: 'POSTING',
        updatedBy: 'user-1'
      })).rejects.toThrow(/has children/i);
    });

    it('should record audit events for key changes', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount({ name: 'Old Name' }));
      mockRepo.isUsed.mockResolvedValue(false);
      mockRepo.update.mockResolvedValue(createMockAccount({ name: 'New Name' }));

      await useCase.execute('company-1', 'test-id', {
        name: 'New Name',
        updatedBy: 'user-1'
      });

      expect(mockRepo.recordAuditEvent).toHaveBeenCalledWith(
        'company-1',
        'test-id',
        expect.objectContaining({
          type: 'NAME_CHANGED',
          field: 'name',
          oldValue: 'Old Name',
          newValue: 'New Name'
        })
      );
    });
  });

  // ==========================================================================
  // DeleteAccountUseCase Tests
  // ==========================================================================
  
  describe('DeleteAccountUseCase', () => {
    let useCase: DeleteAccountUseCase;
    let mockRepo: jest.Mocked<IAccountRepository>;

    beforeEach(() => {
      mockRepo = createMockRepo();
      useCase = new DeleteAccountUseCase(mockRepo);
    });

    it('should delete unused account with no children', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.hasChildren.mockResolvedValue(false);
      mockRepo.isUsed.mockResolvedValue(false);
      mockRepo.delete.mockResolvedValue();

      await expect(useCase.execute('company-1', 'test-id')).resolves.toBeUndefined();
      expect(mockRepo.delete).toHaveBeenCalledWith('company-1', 'test-id');
    });

    it('should reject deleting protected account', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount({ isProtected: true }));

      await expect(useCase.execute('company-1', 'test-id'))
        .rejects.toThrow(/protected/i);
    });

    it('should reject deleting account with children', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.hasChildren.mockResolvedValue(true);

      await expect(useCase.execute('company-1', 'test-id'))
        .rejects.toThrow(/child accounts/i);
    });

    it('should reject deleting USED account', async () => {
      mockRepo.getById.mockResolvedValue(createMockAccount());
      mockRepo.hasChildren.mockResolvedValue(false);
      mockRepo.isUsed.mockResolvedValue(true);

      await expect(useCase.execute('company-1', 'test-id'))
        .rejects.toThrow(/used in vouchers/i);
    });
  });
});
