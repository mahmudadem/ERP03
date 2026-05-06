/**
 * AiProposalPolicy - Domain Entity
 *
 * Controls which proposal types are enabled for a company or globally.
 * Enforced at the use-case layer — if a proposal type is disabled,
 * the CreateAiProposalUseCase will reject the creation request.
 *
 * Safety guarantees:
 * - allowBusinessExecution is ALWAYS false — proposals never execute real actions
 * - allowAcceptWithoutExecution is true — accepting a proposal only marks it reviewed
 * - requireReview is true by default — proposals must be reviewed before acceptance
 *
 * Storage:
 * - Global default policy: system_metadata/ai_proposal_policies/global
 * - Per-company override: companies/{companyId}/ai-assistant/Data/proposal_policy
 */

export interface AiProposalPolicyProps {
  id: string;
  companyId?: string;             // undefined for global policy
  enabled: boolean;               // Master switch for proposal system
  allowedProposalTypes: string[]; // Explicitly allowed types (empty = all allowed if enabled)
  disabledProposalTypes: string[];// Explicitly blocked types (takes precedence over allowed)
  maxProposalsPerDayPerCompany: number;
  maxProposalsPerDayPerUser: number;
  requireReview: boolean;         // Proposals must be reviewed before acceptance
  allowAcceptWithoutExecution: boolean;  // Always true — accept does not execute
  allowBusinessExecution: boolean;       // ALWAYS false — never execute
  createdAt: Date;
  updatedAt: Date;
}

export class AiProposalPolicy implements AiProposalPolicyProps {
  constructor(
    public id: string,
    public companyId: string | undefined,
    public enabled: boolean,
    public allowedProposalTypes: string[],
    public disabledProposalTypes: string[],
    public maxProposalsPerDayPerCompany: number,
    public maxProposalsPerDayPerUser: number,
    public requireReview: boolean,
    public allowAcceptWithoutExecution: boolean,
    public allowBusinessExecution: boolean,
    public createdAt: Date,
    public updatedAt: Date,
  ) {
    // SAFETY: allowBusinessExecution is ALWAYS false
    if (this.allowBusinessExecution === true) {
      throw new Error('AiProposalPolicy: allowBusinessExecution must ALWAYS be false. Proposals must never execute real business actions.');
    }
  }

  /**
   * Create the global default policy.
   */
  static createGlobalDefault(): AiProposalPolicy {
    const now = new Date();
    return new AiProposalPolicy(
      'global',
      undefined,
      true,   // enabled
      [],     // allowedProposalTypes: empty = all allowed if enabled
      ['inventory.reorderProposal', 'sales.collectionFollowUpProposal'], // disabled until modules ready
      50,     // maxProposalsPerDayPerCompany
      20,     // maxProposalsPerDayPerUser
      true,   // requireReview
      true,   // allowAcceptWithoutExecution
      false,  // allowBusinessExecution — ALWAYS FALSE
      now,
      now,
    );
  }

  /**
   * Create a per-company override policy.
   */
  static createForCompany(companyId: string, overrides?: Partial<AiProposalPolicyProps>): AiProposalPolicy {
    const defaults = AiProposalPolicy.createGlobalDefault();
    const now = new Date();

    return new AiProposalPolicy(
      overrides?.id || `policy_${companyId}`,
      companyId,
      overrides?.enabled ?? defaults.enabled,
      overrides?.allowedProposalTypes ?? defaults.allowedProposalTypes,
      overrides?.disabledProposalTypes ?? defaults.disabledProposalTypes,
      overrides?.maxProposalsPerDayPerCompany ?? defaults.maxProposalsPerDayPerCompany,
      overrides?.maxProposalsPerDayPerUser ?? defaults.maxProposalsPerDayPerUser,
      overrides?.requireReview ?? defaults.requireReview,
      overrides?.allowAcceptWithoutExecution ?? defaults.allowAcceptWithoutExecution,
      false,  // allowBusinessExecution — ALWAYS FALSE, no override possible
      now,
      now,
    );
  }

  /**
   * Check if a specific proposal type is allowed by this policy.
   * DENY takes precedence: if a type is in disabledProposalTypes, it's blocked.
   */
  isProposalTypeAllowed(type: string): boolean {
    if (!this.enabled) return false;
    if (this.disabledProposalTypes.includes(type)) return false;
    if (this.allowedProposalTypes.length > 0 && !this.allowedProposalTypes.includes(type)) return false;
    return true;
  }

  /**
   * Check if daily limits are exceeded.
   */
  isWithinDailyLimits(companyCount: number, userCount: number): boolean {
    return companyCount < this.maxProposalsPerDayPerCompany
      && userCount < this.maxProposalsPerDayPerUser;
  }

  /**
   * Merge a company policy with the global default.
   * Company overrides take precedence, but allowBusinessExecution is ALWAYS false.
   */
  mergeWith(globalPolicy: AiProposalPolicy): AiProposalPolicy {
    return new AiProposalPolicy(
      this.id,
      this.companyId,
      this.enabled,
      this.allowedProposalTypes.length > 0
        ? this.allowedProposalTypes
        : globalPolicy.allowedProposalTypes,
      // Merge disabled types: union of both
      [...new Set([...this.disabledProposalTypes, ...globalPolicy.disabledProposalTypes])],
      this.maxProposalsPerDayPerCompany || globalPolicy.maxProposalsPerDayPerCompany,
      this.maxProposalsPerDayPerUser || globalPolicy.maxProposalsPerDayPerUser,
      this.requireReview,
      this.allowAcceptWithoutExecution,
      false, // ALWAYS false
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Update policy fields. allowBusinessExecution can NEVER be set to true.
   */
  update(changes: Partial<Omit<AiProposalPolicyProps, 'allowBusinessExecution' | 'id' | 'companyId' | 'createdAt'>>): AiProposalPolicy {
    return new AiProposalPolicy(
      this.id,
      this.companyId,
      changes.enabled ?? this.enabled,
      changes.allowedProposalTypes ?? this.allowedProposalTypes,
      changes.disabledProposalTypes ?? this.disabledProposalTypes,
      changes.maxProposalsPerDayPerCompany ?? this.maxProposalsPerDayPerCompany,
      changes.maxProposalsPerDayPerUser ?? this.maxProposalsPerDayPerUser,
      changes.requireReview ?? this.requireReview,
      changes.allowAcceptWithoutExecution ?? this.allowAcceptWithoutExecution,
      false, // ALWAYS false, cannot be overridden
      this.createdAt,
      new Date(),
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId || null,
      enabled: this.enabled,
      allowedProposalTypes: this.allowedProposalTypes,
      disabledProposalTypes: this.disabledProposalTypes,
      maxProposalsPerDayPerCompany: this.maxProposalsPerDayPerCompany,
      maxProposalsPerDayPerUser: this.maxProposalsPerDayPerUser,
      requireReview: this.requireReview,
      allowAcceptWithoutExecution: this.allowAcceptWithoutExecution,
      allowBusinessExecution: this.allowBusinessExecution,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiProposalPolicy {
    return new AiProposalPolicy(
      data.id,
      data.companyId || undefined,
      data.enabled ?? true,
      data.allowedProposalTypes || [],
      data.disabledProposalTypes || [],
      data.maxProposalsPerDayPerCompany ?? 50,
      data.maxProposalsPerDayPerUser ?? 20,
      data.requireReview ?? true,
      data.allowAcceptWithoutExecution ?? true,
      false, // ALWAYS false — never read from stored data
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
    );
  }
}
