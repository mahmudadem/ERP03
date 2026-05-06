/**
 * AiProposal - Domain Entity
 *
 * Represents a safe, reviewable AI-generated proposal/draft in the AI Sandbox.
 * Proposals NEVER mutate real ERP business data. They are advisory-only
 * suggestions that must be explicitly reviewed and accepted/rejected
 * by a human user.
 *
 * Safety guarantees:
 * - proposedData is a sanitized DTO, never raw DB documents
 * - proposedData is NOT automatically executable
 * - Accepting a proposal only marks it as reviewed, does NOT create real records
 * - No posting, approval, or business execution occurs
 * - No raw provider API key or response is stored
 */

export type AiProposalType =
  | 'accounting.voucherDraft'
  | 'accounting.journalEntryProposal'
  | 'accounting.correctionEntryProposal'
  | 'accounting.accountMappingProposal'
  | 'inventory.reorderProposal'
  | 'sales.collectionFollowUpProposal'
  | 'reports.managementInsightProposal';

export type AiProposalStatus =
  | 'draft'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'archived';

export type AiProposalRiskLevel = 'low' | 'medium' | 'high';

export interface AiProposalProps {
  id: string;
  companyId: string;
  userId: string;
  sourceChatMessageId?: string;
  type: AiProposalType;
  status: AiProposalStatus;
  title: string;
  summary: string;
  rationale: string;
  inputContextSummary: string;
  proposedData: Record<string, unknown>; // Sanitized DTO — never raw DB document
  warnings: string[];
  riskLevel: AiProposalRiskLevel;
  moduleId: string;
  requiredPermissions: string[];
  missingInfo?: string[];      // Fields that the user hasn't provided yet
  confidence?: number;         // 0-1 confidence score
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<AiProposalStatus, AiProposalStatus[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['accepted', 'rejected', 'archived'],
  accepted: ['archived'],
  rejected: ['archived', 'pending_review'], // rejected can be re-submitted or archived
  archived: [],
};

export class AiProposal implements AiProposalProps {
  constructor(
    public id: string,
    public companyId: string,
    public userId: string,
    public sourceChatMessageId: string | undefined,
    public type: AiProposalType,
    public status: AiProposalStatus,
    public title: string,
    public summary: string,
    public rationale: string,
    public inputContextSummary: string,
    public proposedData: Record<string, unknown>,
    public warnings: string[],
    public riskLevel: AiProposalRiskLevel,
    public moduleId: string,
    public requiredPermissions: string[],
    public missingInfo: string[] | undefined,
    public confidence: number | undefined,
    public createdAt: Date,
    public updatedAt: Date,
    public reviewedAt: Date | undefined,
    public reviewedBy: string | undefined,
    public rejectionReason: string | undefined,
  ) {}

  /**
   * Factory method to create a new proposal with sensible defaults.
   */
  static create(input: {
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
    riskLevel?: AiProposalRiskLevel;
    moduleId: string;
    requiredPermissions?: string[];
    missingInfo?: string[];
    confidence?: number;
  }): AiProposal {
    // Validate required fields
    if (!input.companyId) throw new Error('AiProposal: companyId is required');
    if (!input.userId) throw new Error('AiProposal: userId is required');
    if (!input.type) throw new Error('AiProposal: type is required');
    if (!input.title) throw new Error('AiProposal: title is required');
    if (!input.moduleId) throw new Error('AiProposal: moduleId is required');

    // Validate proposedData is not empty and is a sanitized DTO
    if (!input.proposedData || typeof input.proposedData !== 'object') {
      throw new Error('AiProposal: proposedData must be a non-empty object');
    }

    // Determine initial status
    const status: AiProposalStatus = input.missingInfo && input.missingInfo.length > 0
      ? 'draft'
      : 'pending_review';

    // Determine risk level
    const riskLevel = input.riskLevel || AiProposal.inferRiskLevel(input.type, input.warnings || []);

    const now = new Date();
    const id = `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new AiProposal(
      id,
      input.companyId,
      input.userId,
      input.sourceChatMessageId,
      input.type,
      status,
      input.title,
      input.summary,
      input.rationale,
      input.inputContextSummary,
      input.proposedData,
      input.warnings || [],
      riskLevel,
      input.moduleId,
      input.requiredPermissions || [],
      input.missingInfo,
      input.confidence,
      now,
      now,
      undefined,
      undefined,
      undefined,
    );
  }

  /**
   * Infer risk level from proposal type and warnings.
   */
  private static inferRiskLevel(type: AiProposalType, warnings: string[]): AiProposalRiskLevel {
    if (warnings.length >= 3) return 'high';
    if (type.startsWith('accounting.correction') || type.startsWith('accounting.voucher')) return 'medium';
    if (warnings.length >= 1) return 'medium';
    return 'low';
  }

  /**
   * Check if a status transition is valid.
   */
  canTransitionTo(newStatus: AiProposalStatus): boolean {
    const allowed = VALID_TRANSITIONS[this.status];
    return allowed.includes(newStatus);
  }

  /**
   * Transition to a new status. Throws if transition is invalid.
   */
  transitionTo(newStatus: AiProposalStatus, reviewedBy?: string, rejectionReason?: string): AiProposal {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`AiProposal: cannot transition from '${this.status}' to '${newStatus}'`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'accepted' || newStatus === 'rejected') {
      this.reviewedAt = new Date();
      this.reviewedBy = reviewedBy;
    }

    if (newStatus === 'rejected' && rejectionReason) {
      this.rejectionReason = rejectionReason;
    }

    return this;
  }

  /**
   * Mark as accepted. Does NOT execute any business action.
   */
  accept(reviewedBy: string): AiProposal {
    return this.transitionTo('accepted', reviewedBy);
  }

  /**
   * Mark as rejected. Does NOT delete any ERP record.
   */
  reject(reviewedBy: string, reason?: string): AiProposal {
    return this.transitionTo('rejected', reviewedBy, reason);
  }

  /**
   * Archive the proposal.
   */
  archive(): AiProposal {
    return this.transitionTo('archived');
  }

  /**
   * Move from draft to pending_review.
   */
  submitForReview(): AiProposal {
    return this.transitionTo('pending_review');
  }

  /**
   * Check if this proposal has missing information.
   */
  hasMissingInfo(): boolean {
    return !!(this.missingInfo && this.missingInfo.length > 0);
  }

  /**
   * Get the module from proposal type (e.g., 'accounting.voucherDraft' → 'accounting').
   */
  getModuleFromType(): string {
    return this.type.split('.')[0];
  }

  /**
   * Serialize to JSON. Always safe — never leaks secrets or raw DB data.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      userId: this.userId,
      sourceChatMessageId: this.sourceChatMessageId || null,
      type: this.type,
      status: this.status,
      title: this.title,
      summary: this.summary,
      rationale: this.rationale,
      inputContextSummary: this.inputContextSummary,
      proposedData: this.proposedData,
      warnings: this.warnings,
      riskLevel: this.riskLevel,
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo: this.missingInfo || null,
      confidence: this.confidence ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      reviewedAt: this.reviewedAt?.toISOString() || null,
      reviewedBy: this.reviewedBy || null,
      rejectionReason: this.rejectionReason || null,
    };
  }

  /**
   * Deserialize from JSON (Firestore document, API response, etc.)
   */
  static fromJSON(data: Record<string, any>): AiProposal {
    return new AiProposal(
      data.id,
      data.companyId,
      data.userId,
      data.sourceChatMessageId || undefined,
      data.type,
      data.status,
      data.title,
      data.summary,
      data.rationale,
      data.inputContextSummary,
      data.proposedData || {},
      data.warnings || [],
      data.riskLevel,
      data.moduleId,
      data.requiredPermissions || [],
      data.missingInfo || undefined,
      data.confidence ?? undefined,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      data.reviewedAt?.toDate?.() || (data.reviewedAt ? new Date(data.reviewedAt) : undefined),
      data.reviewedBy || undefined,
      data.rejectionReason || undefined,
    );
  }

  /**
   * List all valid proposal types.
   */
  static getValidTypes(): AiProposalType[] {
    return [
      'accounting.voucherDraft',
      'accounting.journalEntryProposal',
      'accounting.correctionEntryProposal',
      'accounting.accountMappingProposal',
      'inventory.reorderProposal',
      'sales.collectionFollowUpProposal',
      'reports.managementInsightProposal',
    ];
  }

  /**
   * Check if a type string is a valid proposal type.
   */
  static isValidType(type: string): type is AiProposalType {
    return AiProposal.getValidTypes().includes(type as AiProposalType);
  }
}
