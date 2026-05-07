"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProposalPolicy = void 0;
class AiProposalPolicy {
    constructor(id, companyId, enabled, allowedProposalTypes, disabledProposalTypes, maxProposalsPerDayPerCompany, maxProposalsPerDayPerUser, requireReview, allowAcceptWithoutExecution, allowBusinessExecution, createdAt, updatedAt) {
        this.id = id;
        this.companyId = companyId;
        this.enabled = enabled;
        this.allowedProposalTypes = allowedProposalTypes;
        this.disabledProposalTypes = disabledProposalTypes;
        this.maxProposalsPerDayPerCompany = maxProposalsPerDayPerCompany;
        this.maxProposalsPerDayPerUser = maxProposalsPerDayPerUser;
        this.requireReview = requireReview;
        this.allowAcceptWithoutExecution = allowAcceptWithoutExecution;
        this.allowBusinessExecution = allowBusinessExecution;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        // SAFETY: allowBusinessExecution is ALWAYS false
        if (this.allowBusinessExecution === true) {
            throw new Error('AiProposalPolicy: allowBusinessExecution must ALWAYS be false. Proposals must never execute real business actions.');
        }
    }
    /**
     * Create the global default policy.
     */
    static createGlobalDefault() {
        const now = new Date();
        return new AiProposalPolicy('global', undefined, true, // enabled
        [], // allowedProposalTypes: empty = all allowed if enabled
        ['inventory.reorderProposal', 'sales.collectionFollowUpProposal'], // disabled until modules ready
        50, // maxProposalsPerDayPerCompany
        20, // maxProposalsPerDayPerUser
        true, // requireReview
        true, // allowAcceptWithoutExecution
        false, // allowBusinessExecution — ALWAYS FALSE
        now, now);
    }
    /**
     * Create a per-company override policy.
     */
    static createForCompany(companyId, overrides) {
        var _a, _b, _c, _d, _e, _f, _g;
        const defaults = AiProposalPolicy.createGlobalDefault();
        const now = new Date();
        return new AiProposalPolicy((overrides === null || overrides === void 0 ? void 0 : overrides.id) || `policy_${companyId}`, companyId, (_a = overrides === null || overrides === void 0 ? void 0 : overrides.enabled) !== null && _a !== void 0 ? _a : defaults.enabled, (_b = overrides === null || overrides === void 0 ? void 0 : overrides.allowedProposalTypes) !== null && _b !== void 0 ? _b : defaults.allowedProposalTypes, (_c = overrides === null || overrides === void 0 ? void 0 : overrides.disabledProposalTypes) !== null && _c !== void 0 ? _c : defaults.disabledProposalTypes, (_d = overrides === null || overrides === void 0 ? void 0 : overrides.maxProposalsPerDayPerCompany) !== null && _d !== void 0 ? _d : defaults.maxProposalsPerDayPerCompany, (_e = overrides === null || overrides === void 0 ? void 0 : overrides.maxProposalsPerDayPerUser) !== null && _e !== void 0 ? _e : defaults.maxProposalsPerDayPerUser, (_f = overrides === null || overrides === void 0 ? void 0 : overrides.requireReview) !== null && _f !== void 0 ? _f : defaults.requireReview, (_g = overrides === null || overrides === void 0 ? void 0 : overrides.allowAcceptWithoutExecution) !== null && _g !== void 0 ? _g : defaults.allowAcceptWithoutExecution, false, // allowBusinessExecution — ALWAYS FALSE, no override possible
        now, now);
    }
    /**
     * Check if a specific proposal type is allowed by this policy.
     * DENY takes precedence: if a type is in disabledProposalTypes, it's blocked.
     */
    isProposalTypeAllowed(type) {
        if (!this.enabled)
            return false;
        if (this.disabledProposalTypes.includes(type))
            return false;
        if (this.allowedProposalTypes.length > 0 && !this.allowedProposalTypes.includes(type))
            return false;
        return true;
    }
    /**
     * Check if daily limits are exceeded.
     */
    isWithinDailyLimits(companyCount, userCount) {
        return companyCount < this.maxProposalsPerDayPerCompany
            && userCount < this.maxProposalsPerDayPerUser;
    }
    /**
     * Merge a company policy with the global default.
     * Company overrides take precedence, but allowBusinessExecution is ALWAYS false.
     */
    mergeWith(globalPolicy) {
        return new AiProposalPolicy(this.id, this.companyId, this.enabled, this.allowedProposalTypes.length > 0
            ? this.allowedProposalTypes
            : globalPolicy.allowedProposalTypes, 
        // Merge disabled types: union of both
        [...new Set([...this.disabledProposalTypes, ...globalPolicy.disabledProposalTypes])], this.maxProposalsPerDayPerCompany || globalPolicy.maxProposalsPerDayPerCompany, this.maxProposalsPerDayPerUser || globalPolicy.maxProposalsPerDayPerUser, this.requireReview, this.allowAcceptWithoutExecution, false, // ALWAYS false
        this.createdAt, new Date());
    }
    /**
     * Update policy fields. allowBusinessExecution can NEVER be set to true.
     */
    update(changes) {
        var _a, _b, _c, _d, _e, _f, _g;
        return new AiProposalPolicy(this.id, this.companyId, (_a = changes.enabled) !== null && _a !== void 0 ? _a : this.enabled, (_b = changes.allowedProposalTypes) !== null && _b !== void 0 ? _b : this.allowedProposalTypes, (_c = changes.disabledProposalTypes) !== null && _c !== void 0 ? _c : this.disabledProposalTypes, (_d = changes.maxProposalsPerDayPerCompany) !== null && _d !== void 0 ? _d : this.maxProposalsPerDayPerCompany, (_e = changes.maxProposalsPerDayPerUser) !== null && _e !== void 0 ? _e : this.maxProposalsPerDayPerUser, (_f = changes.requireReview) !== null && _f !== void 0 ? _f : this.requireReview, (_g = changes.allowAcceptWithoutExecution) !== null && _g !== void 0 ? _g : this.allowAcceptWithoutExecution, false, // ALWAYS false, cannot be overridden
        this.createdAt, new Date());
    }
    toJSON() {
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
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return new AiProposalPolicy(data.id, data.companyId || undefined, (_a = data.enabled) !== null && _a !== void 0 ? _a : true, data.allowedProposalTypes || [], data.disabledProposalTypes || [], (_b = data.maxProposalsPerDayPerCompany) !== null && _b !== void 0 ? _b : 50, (_c = data.maxProposalsPerDayPerUser) !== null && _c !== void 0 ? _c : 20, (_d = data.requireReview) !== null && _d !== void 0 ? _d : true, (_e = data.allowAcceptWithoutExecution) !== null && _e !== void 0 ? _e : true, false, // ALWAYS false — never read from stored data
        ((_g = (_f = data.createdAt) === null || _f === void 0 ? void 0 : _f.toDate) === null || _g === void 0 ? void 0 : _g.call(_f)) || new Date(data.createdAt), ((_j = (_h = data.updatedAt) === null || _h === void 0 ? void 0 : _h.toDate) === null || _j === void 0 ? void 0 : _j.call(_h)) || new Date(data.updatedAt));
    }
}
exports.AiProposalPolicy = AiProposalPolicy;
//# sourceMappingURL=AiProposalPolicy.js.map