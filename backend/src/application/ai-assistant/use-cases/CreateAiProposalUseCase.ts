/**
 * CreateAiProposalUseCase
 *
 * Creates a new AI proposal in the sandbox.
 * Enforces proposal policies — disabled types and daily limits are checked.
 * Never creates real ERP records. Only stores a reviewable draft.
 */

import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';
import { IAiProposalPolicyRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalPolicyRepository';
import { AiProposal, AiProposalType } from '../../../domain/ai-assistant/entities/AiProposal';

export interface CreateAiProposalInput {
  companyId: string;
  userId: string;
  sourceChatMessageId?: string;
  type: AiProposalType;
  title: string;
  summary: string;
  rationale: string;
  inputContextSummary: string;
  proposedData: Record<string, unknown>;
  warnings?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  moduleId: string;
  requiredPermissions?: string[];
  missingInfo?: string[];
  confidence?: number;
}

export interface CreateAiProposalOutput {
  proposal: Record<string, unknown>;
  sandboxNotice: string;
}

export class CreateAiProposalUseCase {
  constructor(
    private readonly proposalRepository: IAiProposalRepository,
    private readonly policyRepository: IAiProposalPolicyRepository,
  ) {}

  async execute(input: CreateAiProposalInput): Promise<CreateAiProposalOutput> {
    // 1. Validate proposal type
    if (!AiProposal.isValidType(input.type)) {
      throw new Error(`CreateAiProposal: invalid proposal type '${input.type}'`);
    }

    // 2. Check policy — is this proposal type allowed?
    const policy = await this.policyRepository.getCompanyPolicy(input.companyId);

    if (!policy.enabled) {
      throw new Error('CreateAiProposal: proposal system is disabled for this company');
    }

    if (!policy.isProposalTypeAllowed(input.type)) {
      throw new Error(`CreateAiProposal: proposal type '${input.type}' is disabled by policy`);
    }

    // 3. Check daily limits
    const companyCount = await this.proposalRepository.countTodayByCompany(input.companyId);
    const userCount = await this.proposalRepository.countTodayByUser(input.companyId, input.userId);

    if (!policy.isWithinDailyLimits(companyCount, userCount)) {
      throw new Error('CreateAiProposal: daily proposal limit exceeded');
    }

    // 4. Validate proposedData is a sanitized DTO (not raw DB document)
    if (this.containsRawDbData(input.proposedData)) {
      throw new Error('CreateAiProposal: proposedData must be a sanitized DTO, not raw DB documents');
    }

    // 5. Create the proposal entity
    const proposal = AiProposal.create({
      companyId: input.companyId,
      userId: input.userId,
      sourceChatMessageId: input.sourceChatMessageId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      rationale: input.rationale,
      inputContextSummary: input.inputContextSummary,
      proposedData: input.proposedData,
      warnings: input.warnings,
      riskLevel: input.riskLevel,
      moduleId: input.moduleId,
      requiredPermissions: input.requiredPermissions,
      missingInfo: input.missingInfo,
      confidence: input.confidence,
    });

    // 6. Persist
    await this.proposalRepository.create(proposal);

    // 7. Return with sandbox notice
    return {
      proposal: proposal.toJSON(),
      sandboxNotice: 'AI Proposal created in sandbox. No ERP data was changed.',
    };
  }

  /**
   * Basic heuristic to detect raw DB document patterns.
   * Real validation would be more sophisticated, but this catches obvious cases.
   */
  private containsRawDbData(data: Record<string, unknown>): boolean {
    const jsonStr = JSON.stringify(data);
    // Detect common raw DB document patterns
    if (jsonStr.includes('_firestore_') || jsonStr.includes('_admin_')) return true;
    if (jsonStr.includes('apiKey') || jsonStr.includes('api_key')) return true;
    if (jsonStr.includes('_password') || jsonStr.includes('_secret')) return true;
    return false;
  }
}
