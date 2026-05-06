/**
 * AiProposalGenerator - Base Proposal Generator Interface
 *
 * Controlled proposal generators that create safe, reviewable proposals.
 * These do NOT let the AI create arbitrary JSON freely.
 * They use deterministic templates + AI explanation.
 */

import { AiProposalType } from '../../../domain/ai-assistant/entities/AiProposal';

export interface ProposalGeneratorInput {
  companyId: string;
  userId: string;
  sourceChatMessageId?: string;
  userMessage: string;
  toolResultData?: Record<string, unknown>; // Optional output from a read-only tool
  context?: Record<string, unknown>;        // Optional additional context
}

export interface ProposalLineItem {
  accountCode?: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  description?: string;
  [key: string]: unknown;
}

export interface ProposalGeneratorOutput {
  type: AiProposalType;
  title: string;
  summary: string;
  rationale: string;
  inputContextSummary: string;
  proposedData: Record<string, unknown>;
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high';
  moduleId: string;
  requiredPermissions: string[];
  missingInfo: string[];
  confidence: number;
}

export abstract class AiProposalGenerator {
  abstract readonly proposalType: AiProposalType;
  abstract readonly moduleId: string;
  abstract readonly requiredPermissions: string[];

  abstract generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput>;
}
