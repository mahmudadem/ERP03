import { SelectPlanUseCase } from '../SelectPlanUseCase';
import { IUserRepository } from '../../../../repository/interfaces/core/IUserRepository';
import { IPlanRegistryRepository } from '../../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { User } from '../../../../domain/core/entities/User';
import { PlanDefinition } from '../../../../domain/super-admin/PlanDefinition';

describe('SelectPlanUseCase', () => {
  const activePlan: PlanDefinition = {
    id: 'plan-basic',
    name: 'Basic',
    description: 'Basic plan',
    price: 0,
    status: 'active',
    limits: {
      maxCompanies: 1,
      maxUsersPerCompany: 1,
      maxModulesAllowed: 5,
      maxStorageMB: 100,
      maxTransactionsPerMonth: 100,
    },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  function makeRepos(overrides?: {
    userById?: User | null;
    userByEmail?: User | null;
    plan?: PlanDefinition | null;
  }) {
    const userById = Object.prototype.hasOwnProperty.call(overrides ?? {}, 'userById')
      ? overrides?.userById
      : new User('user-1', 'user@example.com', 'User', 'USER', new Date());
    const userByEmail = Object.prototype.hasOwnProperty.call(overrides ?? {}, 'userByEmail')
      ? overrides?.userByEmail
      : null;
    const plan = Object.prototype.hasOwnProperty.call(overrides ?? {}, 'plan')
      ? overrides?.plan
      : activePlan;

    const userRepository: jest.Mocked<IUserRepository> = {
      getUserById: jest.fn().mockResolvedValue(userById),
      createUser: jest.fn().mockResolvedValue(undefined),
      updateUser: jest.fn().mockResolvedValue(undefined),
      updateGlobalRole: jest.fn().mockResolvedValue(undefined),
      updateActiveCompany: jest.fn().mockResolvedValue(undefined),
      findByEmail: jest.fn().mockResolvedValue(userByEmail),
      getUserActiveCompany: jest.fn().mockResolvedValue(null),
      listAll: jest.fn().mockResolvedValue([]),
      updatePlan: jest.fn().mockResolvedValue(undefined),
    };

    const planRepository: jest.Mocked<IPlanRegistryRepository> = {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(plan),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    return { userRepository, planRepository };
  }

  it('updates the plan for an existing SQL user', async () => {
    const { userRepository, planRepository } = makeRepos();
    const useCase = new SelectPlanUseCase(userRepository, planRepository);

    const result = await useCase.execute({ userId: 'user-1', planId: 'plan-basic' });

    expect(result).toEqual({ success: true, planId: 'plan-basic', planName: 'Basic' });
    expect(userRepository.createUser).not.toHaveBeenCalled();
    expect(userRepository.updatePlan).toHaveBeenCalledWith('user-1', 'plan-basic');
  });

  it('creates a missing SQL user for a verified auth user selecting a plan', async () => {
    const { userRepository, planRepository } = makeRepos({ userById: null });
    const useCase = new SelectPlanUseCase(userRepository, planRepository);

    await useCase.execute({
      userId: 'firebase-user-1',
      email: 'NewUser@Example.com',
      name: 'New User',
      planId: 'plan-basic',
    });

    expect(userRepository.createUser).toHaveBeenCalledWith(expect.objectContaining({
      id: 'firebase-user-1',
      email: 'newuser@example.com',
      name: 'New User',
      globalRole: 'USER',
    }));
    expect(userRepository.updatePlan).toHaveBeenCalledWith('firebase-user-1', 'plan-basic');
  });

  it('blocks creating a missing SQL user when the auth email belongs to another user id', async () => {
    const { userRepository, planRepository } = makeRepos({
      userById: null,
      userByEmail: new User('other-user', 'user@example.com', 'Other User', 'USER', new Date()),
    });
    const useCase = new SelectPlanUseCase(userRepository, planRepository);

    await expect(useCase.execute({
      userId: 'firebase-user-1',
      email: 'user@example.com',
      planId: 'plan-basic',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'USER_IDENTITY_MISMATCH',
    });

    expect(userRepository.createUser).not.toHaveBeenCalled();
    expect(userRepository.updatePlan).not.toHaveBeenCalled();
  });
});
