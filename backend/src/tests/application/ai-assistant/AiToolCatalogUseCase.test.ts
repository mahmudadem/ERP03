/**
 * AiToolCatalogUseCase Tests
 *
 * Verifies:
 * 1. List catalog with filters
 * 2. Get single tool definition
 * 3. Enable/disable tool status
 * 4. WRITE TOOLS CAN NEVER BE ENABLED
 * 5. Proposal tools require explicit enablement
 * 6. Merge behavior: DB overrides take precedence for status
 * 7. Sync catalog to DB
 * 8. Enablement policy: DENY takes precedence
 * 9. Model tool policy: write tools ALWAYS blocked
 */

import { AiToolCatalogUseCase } from '../../../application/ai-assistant/use-cases/AiToolCatalogUseCase';
import { AiToolDefinition, AiToolStatus } from '../../../domain/ai-assistant/entities/AiToolDefinition';
import { AiToolEnablementPolicy } from '../../../domain/ai-assistant/entities/AiToolEnablementPolicy';
import { AiModelToolPolicy } from '../../../domain/ai-assistant/entities/AiModelToolPolicy';

// ─── Mock Repositories ──────────────────────────────────────────────────────

const createMockCatalogRepo = () => ({
  getById: jest.fn(),
  list: jest.fn(),
  listByModule: jest.fn(),
  listByCategory: jest.fn(),
  listByStatus: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const createMockEnablementRepo = () => ({
  getByToolId: jest.fn(),
  list: jest.fn(() => Promise.resolve([])),
  listByToolIds: jest.fn(() => Promise.resolve([])),
  save: jest.fn(),
  delete: jest.fn(),
});

const createMockModelPolicyRepo = () => ({
  getById: jest.fn(),
  list: jest.fn(() => Promise.resolve([])),
  listByProvider: jest.fn(() => Promise.resolve([])),
  listByModel: jest.fn(() => Promise.resolve([])),
  save: jest.fn(),
  delete: jest.fn(),
});

describe('AiToolCatalogUseCase', () => {
  let useCase: AiToolCatalogUseCase;
  let catalogRepo: ReturnType<typeof createMockCatalogRepo>;
  let enablementRepo: ReturnType<typeof createMockEnablementRepo>;
  let modelPolicyRepo: ReturnType<typeof createMockModelPolicyRepo>;

  beforeEach(() => {
    catalogRepo = createMockCatalogRepo();
    enablementRepo = createMockEnablementRepo();
    modelPolicyRepo = createMockModelPolicyRepo();
    useCase = new AiToolCatalogUseCase(catalogRepo as any, enablementRepo as any, modelPolicyRepo as any);
  });

  describe('listCatalog', () => {
    it('should return catalog entries from seed when DB is empty', async () => {
      catalogRepo.list.mockResolvedValue([]);

      const result = await useCase.listCatalog();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by module', async () => {
      catalogRepo.list.mockResolvedValue([]);

      const result = await useCase.listCatalog({ module: 'accounting' });
      expect(result.every(t => t.moduleId === 'accounting')).toBe(true);
    });

    it('should filter by status', async () => {
      catalogRepo.list.mockResolvedValue([]);

      const result = await useCase.listCatalog({ status: 'active' });
      expect(result.every(t => t.status === 'active')).toBe(true);
    });

    it('should filter by mode', async () => {
      catalogRepo.list.mockResolvedValue([]);

      const result = await useCase.listCatalog({ mode: 'read-only' });
      expect(result.every(t => t.mode === 'read-only')).toBe(true);
    });
  });

  describe('getCatalogEntry', () => {
    it('should return a tool definition from seed', async () => {
      catalogRepo.getById.mockResolvedValue(null);

      const result = await useCase.getCatalogEntry('accounting.getTrialBalanceSummary');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('accounting.getTrialBalanceSummary');
    });

    it('should return null for unknown tool', async () => {
      catalogRepo.getById.mockResolvedValue(null);

      const result = await useCase.getCatalogEntry('nonexistent.tool');
      expect(result).toBeNull();
    });

    it('should merge DB status override with seed definition', async () => {
      const dbOverride = new AiToolDefinition(
        'accounting.getTrialBalanceSummary',
        'accounting.getTrialBalanceSummary',
        'accounting',
        'accounting',
        'Get trial balance summary',
        'accounting',
        'disabled' as AiToolStatus, // DB says disabled
        'read-only',
        ['accounting.reports.trialBalance.view'],
        ['accounting'],
        {},
        {},
        false, // DB says not enabled by default
        true,
        true,
        'low',
        'medium',
      );
      catalogRepo.getById.mockResolvedValue(dbOverride);

      const result = await useCase.getCatalogEntry('accounting.getTrialBalanceSummary');
      expect(result).not.toBeNull();
      expect(result!.status).toBe('disabled'); // DB override takes effect for status
      expect(result!.mode).toBe('read-only'); // But mode is ALWAYS from seed (safety)
      expect(result!.riskLevel).toBe('low'); // And riskLevel is ALWAYS from seed (safety)
    });
  });

  describe('updateToolStatus', () => {
    it('should enable an active tool', async () => {
      catalogRepo.getById.mockResolvedValue(null);

      const result = await useCase.enableTool('accounting.getTrialBalanceSummary', 'admin-123');
      expect(result.status).toBe('active');
      expect(catalogRepo.save).toHaveBeenCalled();
    });

    it('should disable a tool', async () => {
      catalogRepo.getById.mockResolvedValue(null);

      const result = await useCase.disableTool('accounting.getTrialBalanceSummary', 'admin-123');
      expect(result.status).toBe('disabled');
      expect(catalogRepo.save).toHaveBeenCalled();
    });

    it('should THROW when trying to enable a BLOCKED write tool', async () => {
      await expect(
        useCase.enableTool('BLOCKED.create', 'admin-123')
      ).rejects.toThrow('Cannot enable blocked/write tool');
    });

    it('should allow disabling any tool', async () => {
      catalogRepo.getById.mockResolvedValue(null);

      const result = await useCase.disableTool('accounting.getTrialBalanceSummary', 'admin-123');
      expect(result.status).toBe('disabled');
    });

    it('should throw for unknown tool name', async () => {
      await expect(
        useCase.updateToolStatus('nonexistent.tool', 'active', 'admin-123')
      ).rejects.toThrow('Unknown tool');
    });
  });

  describe('Enablement Policies', () => {
    it('should list all enablement policies', async () => {
      const policies = [
        new AiToolEnablementPolicy('accounting.getTrialBalanceSummary'),
      ];
      enablementRepo.list.mockResolvedValue(policies);

      const result = await useCase.listEnablementPolicies();
      expect(result).toEqual(policies);
    });

    it('should get a specific enablement policy', async () => {
      const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
      enablementRepo.getByToolId.mockResolvedValue(policy);

      const result = await useCase.getEnablementPolicy('accounting.getTrialBalanceSummary');
      expect(result).toEqual(policy);
    });

    it('should update enablement policy', async () => {
      const policy = new AiToolEnablementPolicy('accounting.getTrialBalanceSummary');
      policy.globallyEnabled = true;

      const result = await useCase.updateEnablementPolicy(policy, 'admin-123');
      expect(enablementRepo.save).toHaveBeenCalledWith(policy);
    });

    it('should REJECT enabling a blocked/write tool via policy', async () => {
      const policy = new AiToolEnablementPolicy('BLOCKED.create');
      policy.globallyEnabled = true;

      await expect(
        useCase.updateEnablementPolicy(policy, 'admin-123')
      ).rejects.toThrow('Cannot enable policy for blocked/write tool');
    });
  });

  describe('Model Tool Policies', () => {
    it('should list all model tool policies', async () => {
      const policies = [
        new AiModelToolPolicy('mock:mock', '', 'mock', 'mock'),
      ];
      modelPolicyRepo.list.mockResolvedValue(policies);

      const result = await useCase.listModelToolPolicies();
      expect(result).toEqual(policies);
    });

    it('should update model tool policy with write tools ALWAYS forced false', async () => {
      const policy = new AiModelToolPolicy('test:model', 'config-1', 'openai_compatible', 'gpt-4o');
      policy.allowWriteTools = true; // Try to enable write

      const result = await useCase.updateModelToolPolicy(policy, 'admin-123');
      expect(result.allowWriteTools).toBe(false); // Should be forced to false
      expect(modelPolicyRepo.save).toHaveBeenCalled();
    });

    it('should provide default model tool policy', () => {
      const policy = useCase.getDefaultModelToolPolicy('openai_compatible', 'gpt-4o');
      expect(policy.defaultToolPolicy).toBe('read-only');
      expect(policy.allowReadOnlyTools).toBe(true);
      expect(policy.allowProposalTools).toBe(false);
      expect(policy.allowWriteTools).toBe(false);
      expect(policy.requireExplicitUserIntent).toBe(true);
      expect(policy.requireDeterministicMapping).toBe(true);
    });
  });

  describe('syncCatalogToDb', () => {
    it('should sync new tools that do not exist in DB', async () => {
      catalogRepo.getById.mockResolvedValue(null); // All tools are new

      const synced = await useCase.syncCatalogToDb();
      expect(synced).toBeGreaterThan(0);
      expect(catalogRepo.save).toHaveBeenCalled();
    });

    it('should NOT overwrite existing DB overrides', async () => {
      // First tool already exists in DB (disabled override)
      catalogRepo.getById.mockImplementation(async (id: string) => {
        if (id === 'accounting.getTrialBalanceSummary') {
          return new AiToolDefinition(
            id, id, 'accounting', 'accounting', '', 'accounting',
            'disabled' as AiToolStatus, 'read-only', [], ['accounting'], {}, {}, false, true, true, 'low', 'medium',
          );
        }
        return null;
      });

      const synced = await useCase.syncCatalogToDb();
      // Should not save the first tool since it already exists
      const savedToolNames = catalogRepo.save.mock.calls.map((call: any) => call[0].id);
      expect(savedToolNames).not.toContain('accounting.getTrialBalanceSummary');
    });
  });
});