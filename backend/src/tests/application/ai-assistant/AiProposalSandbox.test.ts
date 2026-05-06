/**
 * AiProposalSandbox.test.ts
 *
 * Comprehensive tests for the AI Proposal + Draft Sandbox.
 * Tests domain entities, policies, use cases, generators, and safety.
 */

import { AiProposal, AiProposalType } from '../../../domain/ai-assistant/entities/AiProposal';
import { AiProposalPolicy } from '../../../domain/ai-assistant/entities/AiProposalPolicy';
import { CreateAiProposalUseCase } from '../../../application/ai-assistant/use-cases/CreateAiProposalUseCase';
import { ListAiProposalsUseCase } from '../../../application/ai-assistant/use-cases/ListAiProposalsUseCase';
import { GetAiProposalUseCase } from '../../../application/ai-assistant/use-cases/GetAiProposalUseCase';
import { UpdateAiProposalStatusUseCase } from '../../../application/ai-assistant/use-cases/UpdateAiProposalStatusUseCase';
import { ArchiveAiProposalUseCase } from '../../../application/ai-assistant/use-cases/ArchiveAiProposalUseCase';
import { AiProposalGeneratorRegistry } from '../../../application/ai-assistant/proposals/AiProposalGeneratorRegistry';
import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';
import { IAiProposalPolicyRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalPolicyRepository';

// ---- Mock Repositories ----

class MockProposalRepository implements IAiProposalRepository {
  private proposals: Map<string, AiProposal> = new Map();

  async create(proposal: AiProposal): Promise<AiProposal> {
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async getById(companyId: string, proposalId: string): Promise<AiProposal | null> {
    const p = this.proposals.get(proposalId);
    if (!p || p.companyId !== companyId) return null;
    return p;
  }

  async list(params: {
    companyId: string;
    type?: string;
    status?: string;
    moduleId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ proposals: AiProposal[]; total: number }> {
    let results = Array.from(this.proposals.values()).filter(p => p.companyId === params.companyId);
    if (params.type) results = results.filter(p => p.type === params.type);
    if (params.status) results = results.filter(p => p.status === params.status);
    if (params.moduleId) results = results.filter(p => p.moduleId === params.moduleId);
    if (params.userId) results = results.filter(p => p.userId === params.userId);
    return { proposals: results, total: results.length };
  }

  async update(proposal: AiProposal): Promise<AiProposal> {
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async countTodayByCompany(companyId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.proposals.values())
      .filter(p => p.companyId === companyId && p.createdAt.toISOString().startsWith(today))
      .length;
  }

  async countTodayByUser(companyId: string, userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    return Array.from(this.proposals.values())
      .filter(p => p.companyId === companyId && p.userId === userId && p.createdAt.toISOString().startsWith(today))
      .length;
  }

  async archiveOlderThan(companyId: string, olderThan: Date): Promise<number> {
    return 0;
  }
}

class MockPolicyRepository implements IAiProposalPolicyRepository {
  private globalPolicy: AiProposalPolicy = AiProposalPolicy.createGlobalDefault();
  private companyPolicies: Map<string, AiProposalPolicy> = new Map();

  async getGlobalPolicy(): Promise<AiProposalPolicy> {
    return this.globalPolicy;
  }

  async getCompanyPolicy(companyId: string): Promise<AiProposalPolicy> {
    const companyPolicy = this.companyPolicies.get(companyId);
    if (!companyPolicy) return this.globalPolicy;
    return companyPolicy.mergeWith(this.globalPolicy);
  }

  async saveGlobalPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy> {
    this.globalPolicy = policy;
    return policy;
  }

  async saveCompanyPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy> {
    if (policy.companyId) this.companyPolicies.set(policy.companyId, policy);
    return policy;
  }

  async listCompanyPolicies(): Promise<AiProposalPolicy[]> {
    return Array.from(this.companyPolicies.values());
  }
}

// ---- Tests ----

describe('AI Proposal Sandbox', () => {

  // ========================
  // DOMAIN: AiProposal Entity
  // ========================
  describe('AiProposal Entity', () => {
    it('should create a proposal with valid required fields', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test Proposal',
        summary: 'A test journal entry proposal',
        rationale: 'Based on user request',
        inputContextSummary: 'User asked for a journal entry',
        proposedData: { lines: [{ debit: 100, credit: 0 }] },
        moduleId: 'accounting',
      });

      expect(proposal.id).toMatch(/^proposal_/);
      expect(proposal.companyId).toBe('company1');
      expect(proposal.type).toBe('accounting.journalEntryProposal');
      expect(proposal.status).toBe('pending_review'); // No missingInfo
      expect(proposal.riskLevel).toBeDefined();
      expect(proposal.warnings).toEqual([]);
    });

    it('should set status to draft when missingInfo is provided', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Incomplete Proposal',
        summary: 'Missing data',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { lines: [] },
        moduleId: 'accounting',
        missingInfo: ['amount', 'debit account'],
      });

      expect(proposal.status).toBe('draft');
      expect(proposal.hasMissingInfo()).toBe(true);
    });

    it('should throw on missing required fields', () => {
      expect(() => AiProposal.create({
        companyId: '',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: {},
        moduleId: 'accounting',
      })).toThrow('companyId is required');
    });

    it('should validate status transitions', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { test: true },
        moduleId: 'accounting',
      });

      expect(proposal.status).toBe('pending_review');
      expect(proposal.canTransitionTo('accepted')).toBe(true);
      expect(proposal.canTransitionTo('rejected')).toBe(true);
      expect(proposal.canTransitionTo('archived')).toBe(true);
      expect(proposal.canTransitionTo('draft')).toBe(false); // Can't go back to draft
    });

    it('should accept proposal without executing business action', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { test: true },
        moduleId: 'accounting',
      });

      proposal.accept('admin1');
      expect(proposal.status).toBe('accepted');
      expect(proposal.reviewedBy).toBe('admin1');
      expect(proposal.reviewedAt).toBeDefined();
      // ACCEPTING DOES NOT CREATE REAL RECORDS — this is just a status change
    });

    it('should reject proposal with optional reason', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { test: true },
        moduleId: 'accounting',
      });

      proposal.reject('admin1', 'Incorrect account mapping');
      expect(proposal.status).toBe('rejected');
      expect(proposal.rejectionReason).toBe('Incorrect account mapping');
    });

    it('should serialize to JSON safely (no secrets)', () => {
      const proposal = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { lines: [{ debit: 100 }] },
        moduleId: 'accounting',
      });

      const json = proposal.toJSON();
      expect(json.id).toBeDefined();
      expect(json.companyId).toBe('company1');
      expect(json).not.toHaveProperty('apiKey');
      expect(json).not.toHaveProperty('secret');
    });

    it('should round-trip through JSON serialization', () => {
      const original = AiProposal.create({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.correctionEntryProposal',
        title: 'Correction',
        summary: 'Fix',
        rationale: 'Error found',
        inputContextSummary: 'Context',
        proposedData: { correctionType: 'reversal' },
        moduleId: 'accounting',
        warnings: ['Verify before accepting'],
        riskLevel: 'high',
      });

      const json = original.toJSON();
      const restored = AiProposal.fromJSON(json);
      expect(restored.companyId).toBe(original.companyId);
      expect(restored.type).toBe(original.type);
      expect(restored.status).toBe(original.status);
      expect(restored.warnings).toEqual(original.warnings);
    });

    it('should list all valid proposal types', () => {
      const types = AiProposal.getValidTypes();
      expect(types).toContain('accounting.journalEntryProposal');
      expect(types).toContain('accounting.correctionEntryProposal');
      expect(types).toContain('accounting.accountMappingProposal');
      expect(types).toContain('accounting.voucherDraft');
      expect(types).toContain('inventory.reorderProposal');
      expect(types).toContain('sales.collectionFollowUpProposal');
      expect(types).toContain('reports.managementInsightProposal');
    });

    it('should validate proposal types', () => {
      expect(AiProposal.isValidType('accounting.journalEntryProposal')).toBe(true);
      expect(AiProposal.isValidType('invalid.type')).toBe(false);
    });

    it('should extract module from type', () => {
      const proposal = AiProposal.create({
        companyId: 'c1',
        userId: 'u1',
        type: 'accounting.journalEntryProposal',
        title: 'T',
        summary: 'S',
        rationale: 'R',
        inputContextSummary: 'C',
        proposedData: {},
        moduleId: 'accounting',
      });
      expect(proposal.getModuleFromType()).toBe('accounting');
    });
  });

  // ========================
  // DOMAIN: AiProposalPolicy
  // ========================
  describe('AiProposalPolicy', () => {
    it('should create global default policy', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      expect(policy.enabled).toBe(true);
      expect(policy.requireReview).toBe(true);
      expect(policy.allowAcceptWithoutExecution).toBe(true);
      expect(policy.allowBusinessExecution).toBe(false); // ALWAYS FALSE
    });

    it('should NEVER allow allowBusinessExecution to be true', () => {
      expect(() => new AiProposalPolicy(
        'test', undefined, true, [], [], 50, 20, true, true, true, new Date(), new Date()
      )).toThrow('allowBusinessExecution must ALWAYS be false');
    });

    it('fromJSON should always set allowBusinessExecution to false', () => {
      const policy = AiProposalPolicy.fromJSON({
        id: 'test',
        enabled: true,
        allowBusinessExecution: true, // Try to sneak it in
        allowedProposalTypes: [],
        disabledProposalTypes: [],
        maxProposalsPerDayPerCompany: 50,
        maxProposalsPerDayPerUser: 20,
        requireReview: true,
        allowAcceptWithoutExecution: true,
      });
      expect(policy.allowBusinessExecution).toBe(false); // SAFETY: always false
    });

    it('should check if a proposal type is allowed', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      expect(policy.isProposalTypeAllowed('accounting.journalEntryProposal')).toBe(true);
      expect(policy.isProposalTypeAllowed('inventory.reorderProposal')).toBe(false); // Disabled by default
    });

    it('should enforce DENY precedence for proposal types', () => {
      const policy = AiProposalPolicy.createForCompany('c1', {
        id: 'test',
        companyId: 'c1',
        enabled: true,
        allowedProposalTypes: ['accounting.journalEntryProposal'],
        disabledProposalTypes: ['accounting.journalEntryProposal'],
        maxProposalsPerDayPerCompany: 50,
        maxProposalsPerDayPerUser: 20,
        requireReview: true,
        allowAcceptWithoutExecution: true,
        allowBusinessExecution: false,
      });
      // Disabled takes precedence
      expect(policy.isProposalTypeAllowed('accounting.journalEntryProposal')).toBe(false);
    });

    it('should check daily limits', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      expect(policy.isWithinDailyLimits(0, 0)).toBe(true);
      expect(policy.isWithinDailyLimits(50, 20)).toBe(false); // At limit
      expect(policy.isWithinDailyLimits(100, 100)).toBe(false); // Over limit
    });

    it('should block all types when disabled', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      const disabled = policy.update({ enabled: false });
      expect(disabled.isProposalTypeAllowed('accounting.journalEntryProposal')).toBe(false);
    });

    it('should update policy fields', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      const updated = policy.update({ maxProposalsPerDayPerCompany: 100 });
      expect(updated.maxProposalsPerDayPerCompany).toBe(100);
      expect(updated.allowBusinessExecution).toBe(false); // Unchanged
    });

    it('should merge company policy with global defaults', () => {
      const globalPolicy = AiProposalPolicy.createGlobalDefault();
      const companyPolicy = AiProposalPolicy.createForCompany('c1', {
        id: 'c1_policy',
        companyId: 'c1',
        enabled: true,
        allowedProposalTypes: [],
        disabledProposalTypes: ['accounting.voucherDraft'],
        maxProposalsPerDayPerCompany: 30,
        maxProposalsPerDayPerUser: 10,
        requireReview: true,
        allowAcceptWithoutExecution: true,
        allowBusinessExecution: false,
      });

      const merged = companyPolicy.mergeWith(globalPolicy);
      // Company override + global disabled types union
      expect(merged.disabledProposalTypes).toContain('accounting.voucherDraft');
      expect(merged.disabledProposalTypes).toContain('inventory.reorderProposal'); // From global
      expect(merged.maxProposalsPerDayPerCompany).toBe(30); // Company override
    });
  });

  // ========================
  // USE CASES
  // ========================
  describe('CreateAiProposalUseCase', () => {
    let useCase: CreateAiProposalUseCase;
    let proposalRepo: MockProposalRepository;
    let policyRepo: MockPolicyRepository;

    beforeEach(() => {
      proposalRepo = new MockProposalRepository();
      policyRepo = new MockPolicyRepository();
      useCase = new CreateAiProposalUseCase(proposalRepo, policyRepo);
    });

    it('should create a proposal successfully', async () => {
      const result = await useCase.execute({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Journal Entry',
        summary: 'A proposed journal entry',
        rationale: 'Based on user request',
        inputContextSummary: 'User asked for a journal entry',
        proposedData: { lines: [{ debit: 100, credit: 100 }] },
        moduleId: 'accounting',
      });

      expect(result.proposal).toBeDefined();
      expect(result.sandboxNotice).toContain('No ERP data was changed');
      expect(result.proposal.type).toBe('accounting.journalEntryProposal');
    });

    it('should reject invalid proposal type', async () => {
      await expect(useCase.execute({
        companyId: 'company1',
        userId: 'user1',
        type: 'invalid.type' as any,
        title: 'Invalid',
        summary: 'Invalid',
        rationale: 'Invalid',
        inputContextSummary: 'Invalid',
        proposedData: {},
        moduleId: 'test',
      })).rejects.toThrow('invalid proposal type');
    });

    it('should reject when proposal system is disabled', async () => {
      const globalPolicy = AiProposalPolicy.createGlobalDefault();
      await policyRepo.saveGlobalPolicy(globalPolicy.update({ enabled: false }));

      await expect(useCase.execute({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: {},
        moduleId: 'accounting',
      })).rejects.toThrow('proposal system is disabled');
    });

    it('should reject when proposal type is disabled by policy', async () => {
      await expect(useCase.execute({
        companyId: 'company1',
        userId: 'user1',
        type: 'inventory.reorderProposal', // Disabled by default
        title: 'Reorder',
        summary: 'Reorder',
        rationale: 'Reorder',
        inputContextSummary: 'Reorder',
        proposedData: {},
        moduleId: 'inventory',
      })).rejects.toThrow('disabled by policy');
    });

    it('should reject proposedData containing raw DB data', async () => {
      await expect(useCase.execute({
        companyId: 'company1',
        userId: 'user1',
        type: 'accounting.journalEntryProposal',
        title: 'Test',
        summary: 'Test',
        rationale: 'Test',
        inputContextSummary: 'Test',
        proposedData: { _firestore_: 'raw', apiKey: 'secret' },
        moduleId: 'accounting',
      })).rejects.toThrow('sanitized DTO');
    });
  });

  describe('ListAiProposalsUseCase', () => {
    it('should list proposals scoped by company', async () => {
      const proposalRepo = new MockProposalRepository();
      const useCase = new ListAiProposalsUseCase(proposalRepo);

      // Create proposals for different companies
      const p1 = AiProposal.create({
        companyId: 'company1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'P1', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: {}, moduleId: 'accounting',
      });
      const p2 = AiProposal.create({
        companyId: 'company2', userId: 'u2', type: 'accounting.journalEntryProposal',
        title: 'P2', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: {}, moduleId: 'accounting',
      });
      await proposalRepo.create(p1);
      await proposalRepo.create(p2);

      const result = await useCase.execute({ companyId: 'company1' });
      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].companyId).toBe('company1');
    });
  });

  describe('GetAiProposalUseCase', () => {
    it('should reject wrong company access', async () => {
      const proposalRepo = new MockProposalRepository();
      const useCase = new GetAiProposalUseCase(proposalRepo);

      const proposal = AiProposal.create({
        companyId: 'company1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'P1', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: {}, moduleId: 'accounting',
      });
      await proposalRepo.create(proposal);

      // Access from different company should fail
      await expect(useCase.execute({
        companyId: 'company2',
        proposalId: proposal.id,
      })).rejects.toThrow('not found');
    });
  });

  describe('UpdateAiProposalStatusUseCase', () => {
    it('should NOT execute business action when accepting', async () => {
      const proposalRepo = new MockProposalRepository();
      const policyRepo = new MockPolicyRepository();
      const useCase = new UpdateAiProposalStatusUseCase(proposalRepo, policyRepo);

      const proposal = AiProposal.create({
        companyId: 'c1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'Test', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: {}, moduleId: 'accounting',
      });
      await proposalRepo.create(proposal);

      const result = await useCase.execute({
        companyId: 'c1',
        proposalId: proposal.id,
        newStatus: 'accepted',
        reviewedBy: 'admin1',
      });

      expect(result.notice).toContain('No ERP data was changed');
      expect(result.proposal.status).toBe('accepted');
    });
  });

  describe('ArchiveAiProposalUseCase', () => {
    it('should archive a proposal', async () => {
      const proposalRepo = new MockProposalRepository();
      const useCase = new ArchiveAiProposalUseCase(proposalRepo);

      const proposal = AiProposal.create({
        companyId: 'c1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'Test', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: {}, moduleId: 'accounting',
      });
      await proposalRepo.create(proposal);

      const result = await useCase.execute({ companyId: 'c1', proposalId: proposal.id });
      expect(result.proposal.status).toBe('archived');
    });
  });

  // ========================
  // PROPOSAL GENERATORS
  // ========================
  describe('AiProposalGeneratorRegistry', () => {
    let registry: AiProposalGeneratorRegistry;

    beforeEach(() => {
      registry = new AiProposalGeneratorRegistry();
    });

    it('should register all 7 proposal generators', () => {
      expect(registry.getRegisteredTypes()).toHaveLength(7);
    });

    it('should detect proposal intent from Arabic messages', () => {
      expect(registry.detectProposalIntent('اقترح قيد')).toBe('accounting.journalEntryProposal');
      expect(registry.detectProposalIntent('اقترح تصحيح')).toBe('accounting.correctionEntryProposal');
      expect(registry.detectProposalIntent('اقترح حساب مناسب')).toBe('accounting.accountMappingProposal');
      expect(registry.detectProposalIntent('اقترح إعادة طلب')).toBe('inventory.reorderProposal');
      expect(registry.detectProposalIntent('اقترح متابعة تحصيل')).toBe('sales.collectionFollowUpProposal');
    });

    it('should detect proposal intent from English messages', () => {
      expect(registry.detectProposalIntent('propose journal entry')).toBe('accounting.journalEntryProposal');
      expect(registry.detectProposalIntent('suggest account mapping')).toBe('accounting.accountMappingProposal');
      expect(registry.detectProposalIntent('draft voucher')).toBe('accounting.voucherDraft');
      expect(registry.detectProposalIntent('suggest reorder')).toBe('inventory.reorderProposal');
      expect(registry.detectProposalIntent('follow up collection')).toBe('sales.collectionFollowUpProposal');
    });

    it('should return null for non-proposal messages', () => {
      expect(registry.detectProposalIntent('hello')).toBeNull();
      expect(registry.detectProposalIntent('show trial balance')).toBeNull();
      expect(registry.detectProposalIntent('create voucher')).toBeNull(); // "create" is not a proposal intent
    });

    it('should generate a journal entry proposal', async () => {
      const output = await registry.generate('accounting.journalEntryProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'propose journal entry for 500',
      });

      expect(output.type).toBe('accounting.journalEntryProposal');
      expect(output.moduleId).toBe('accounting');
      expect(output.proposedData).toBeDefined();
      expect(output.confidence).toBeGreaterThan(0);
    });

    it('should generate an account mapping proposal', async () => {
      const output = await registry.generate('accounting.accountMappingProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'which account for cash payment?',
      });

      expect(output.type).toBe('accounting.accountMappingProposal');
      expect(output.proposedData).toBeDefined();
    });

    it('should generate a correction entry proposal', async () => {
      const output = await registry.generate('accounting.correctionEntryProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'propose correction for voucher #123',
      });

      expect(output.type).toBe('accounting.correctionEntryProposal');
      expect(output.warnings.length).toBeGreaterThan(0); // Corrections always have warnings
    });

    it('should generate a voucher draft proposal', async () => {
      const output = await registry.generate('accounting.voucherDraft', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'draft payment voucher for 1000',
      });

      expect(output.type).toBe('accounting.voucherDraft');
      expect(output.proposedData).toBeDefined();
    });

    it('should generate a reorder proposal', async () => {
      const output = await registry.generate('inventory.reorderProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'suggest reorder for low stock items',
      });

      expect(output.type).toBe('inventory.reorderProposal');
      expect(output.moduleId).toBe('inventory');
    });

    it('should generate a collection follow-up proposal', async () => {
      const output = await registry.generate('sales.collectionFollowUpProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'follow up on overdue invoices',
      });

      expect(output.type).toBe('sales.collectionFollowUpProposal');
      expect(output.moduleId).toBe('sales');
    });

    it('should generate a management insight proposal', async () => {
      const output = await registry.generate('reports.managementInsightProposal', {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'give me management insights',
      });

      expect(output.type).toBe('reports.managementInsightProposal');
      expect(output.moduleId).toBe('reports');
    });

    it('should throw for unregistered type', async () => {
      await expect(registry.generate('invalid.type' as any, {
        companyId: 'c1',
        userId: 'u1',
        userMessage: 'test',
      })).rejects.toThrow('No generator registered');
    });
  });

  // ========================
  // SAFETY TESTS
  // ========================
  describe('Safety Guarantees', () => {
    it('proposal acceptance does NOT create real records', () => {
      const proposal = AiProposal.create({
        companyId: 'c1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'Test', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: { lines: [{ debit: 100, credit: 100 }] },
        moduleId: 'accounting',
      });

      proposal.accept('admin');
      // The proposal only changes status — no voucher/invoice/item/entity is created
      expect(proposal.status).toBe('accepted');
      expect(proposal.reviewedAt).toBeDefined();
    });

    it('policy allowBusinessExecution is ALWAYS false', () => {
      const global = AiProposalPolicy.createGlobalDefault();
      const company = AiProposalPolicy.createForCompany('c1');
      const updated = global.update({ maxProposalsPerDayPerCompany: 200 });

      expect(global.allowBusinessExecution).toBe(false);
      expect(company.allowBusinessExecution).toBe(false);
      expect(updated.allowBusinessExecution).toBe(false);
    });

    it('policy cannot be updated to allow business execution', () => {
      const policy = AiProposalPolicy.createGlobalDefault();
      // update() excludes allowBusinessExecution from the type signature
      const updated = policy.update({ enabled: true });
      expect(updated.allowBusinessExecution).toBe(false);
    });

    it('proposedData is not automatically executable', () => {
      const proposal = AiProposal.create({
        companyId: 'c1', userId: 'u1', type: 'accounting.voucherDraft',
        title: 'Draft', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: { lines: [], note: 'This is a draft proposal' },
        moduleId: 'accounting',
      });

      const json = proposal.toJSON();
      // proposedData should NOT contain executable instructions
      const data = json.proposedData as Record<string, unknown>;
      expect(data).not.toHaveProperty('execute');
      expect(data).not.toHaveProperty('post');
      expect(data).not.toHaveProperty('createVoucher');
    });

    it('write tools remain blocked — proposal system does not bypass', () => {
      // This test validates that the proposal system is separate from write tools
      // Proposals create sandbox drafts, not real data
      const policy = AiProposalPolicy.createGlobalDefault();
      expect(policy.allowBusinessExecution).toBe(false);
      expect(policy.requireReview).toBe(true);
      // The proposal system is additive — it does not open any execution path
    });

    it('API key is never exposed in proposals', () => {
      const proposal = AiProposal.create({
        companyId: 'c1', userId: 'u1', type: 'accounting.journalEntryProposal',
        title: 'Test', summary: 'S', rationale: 'R', inputContextSummary: 'C',
        proposedData: { lines: [{ debit: 100 }] },
        moduleId: 'accounting',
      });

      const json = proposal.toJSON();
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).not.toContain('apiKey');
      expect(jsonStr).not.toContain('api_key');
      expect(jsonStr).not.toContain('secret');
    });
  });
});
