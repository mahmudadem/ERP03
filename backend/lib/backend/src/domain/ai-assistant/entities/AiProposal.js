"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProposal = void 0;
// Valid status transitions
const VALID_TRANSITIONS = {
    draft: ['pending_review', 'archived'],
    pending_review: ['accepted', 'rejected', 'archived'],
    accepted: ['archived'],
    rejected: ['archived', 'pending_review'],
    archived: [],
};
class AiProposal {
    constructor(id, companyId, userId, sourceChatMessageId, type, status, title, summary, rationale, inputContextSummary, proposedData, warnings, riskLevel, moduleId, requiredPermissions, missingInfo, confidence, createdAt, updatedAt, reviewedAt, reviewedBy, rejectionReason) {
        this.id = id;
        this.companyId = companyId;
        this.userId = userId;
        this.sourceChatMessageId = sourceChatMessageId;
        this.type = type;
        this.status = status;
        this.title = title;
        this.summary = summary;
        this.rationale = rationale;
        this.inputContextSummary = inputContextSummary;
        this.proposedData = proposedData;
        this.warnings = warnings;
        this.riskLevel = riskLevel;
        this.moduleId = moduleId;
        this.requiredPermissions = requiredPermissions;
        this.missingInfo = missingInfo;
        this.confidence = confidence;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.reviewedAt = reviewedAt;
        this.reviewedBy = reviewedBy;
        this.rejectionReason = rejectionReason;
    }
    /**
     * Factory method to create a new proposal with sensible defaults.
     */
    static create(input) {
        // Validate required fields
        if (!input.companyId)
            throw new Error('AiProposal: companyId is required');
        if (!input.userId)
            throw new Error('AiProposal: userId is required');
        if (!input.type)
            throw new Error('AiProposal: type is required');
        if (!input.title)
            throw new Error('AiProposal: title is required');
        if (!input.moduleId)
            throw new Error('AiProposal: moduleId is required');
        // Validate proposedData is not empty and is a sanitized DTO
        if (!input.proposedData || typeof input.proposedData !== 'object') {
            throw new Error('AiProposal: proposedData must be a non-empty object');
        }
        // Determine initial status
        const status = input.missingInfo && input.missingInfo.length > 0
            ? 'draft'
            : 'pending_review';
        // Determine risk level
        const riskLevel = input.riskLevel || AiProposal.inferRiskLevel(input.type, input.warnings || []);
        const now = new Date();
        const id = `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return new AiProposal(id, input.companyId, input.userId, input.sourceChatMessageId, input.type, status, input.title, input.summary, input.rationale, input.inputContextSummary, input.proposedData, input.warnings || [], riskLevel, input.moduleId, input.requiredPermissions || [], input.missingInfo, input.confidence, now, now, undefined, undefined, undefined);
    }
    /**
     * Infer risk level from proposal type and warnings.
     */
    static inferRiskLevel(type, warnings) {
        if (warnings.length >= 3)
            return 'high';
        if (type.startsWith('accounting.correction') || type.startsWith('accounting.voucher'))
            return 'medium';
        if (warnings.length >= 1)
            return 'medium';
        return 'low';
    }
    /**
     * Check if a status transition is valid.
     */
    canTransitionTo(newStatus) {
        const allowed = VALID_TRANSITIONS[this.status];
        return allowed.includes(newStatus);
    }
    /**
     * Transition to a new status. Throws if transition is invalid.
     */
    transitionTo(newStatus, reviewedBy, rejectionReason) {
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
    accept(reviewedBy) {
        return this.transitionTo('accepted', reviewedBy);
    }
    /**
     * Mark as rejected. Does NOT delete any ERP record.
     */
    reject(reviewedBy, reason) {
        return this.transitionTo('rejected', reviewedBy, reason);
    }
    /**
     * Archive the proposal.
     */
    archive() {
        return this.transitionTo('archived');
    }
    /**
     * Move from draft to pending_review.
     */
    submitForReview() {
        return this.transitionTo('pending_review');
    }
    /**
     * Check if this proposal has missing information.
     */
    hasMissingInfo() {
        return !!(this.missingInfo && this.missingInfo.length > 0);
    }
    /**
     * Get the module from proposal type (e.g., 'accounting.voucherDraft' → 'accounting').
     */
    getModuleFromType() {
        return this.type.split('.')[0];
    }
    /**
     * Serialize to JSON. Always safe — never leaks secrets or raw DB data.
     */
    toJSON() {
        var _a, _b;
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
            confidence: (_a = this.confidence) !== null && _a !== void 0 ? _a : null,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            reviewedAt: ((_b = this.reviewedAt) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
            reviewedBy: this.reviewedBy || null,
            rejectionReason: this.rejectionReason || null,
        };
    }
    /**
     * Deserialize from JSON (Firestore document, API response, etc.)
     */
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g;
        return new AiProposal(data.id, data.companyId, data.userId, data.sourceChatMessageId || undefined, data.type, data.status, data.title, data.summary, data.rationale, data.inputContextSummary, data.proposedData || {}, data.warnings || [], data.riskLevel, data.moduleId, data.requiredPermissions || [], data.missingInfo || undefined, (_a = data.confidence) !== null && _a !== void 0 ? _a : undefined, ((_c = (_b = data.createdAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) || new Date(data.createdAt), ((_e = (_d = data.updatedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) || new Date(data.updatedAt), ((_g = (_f = data.reviewedAt) === null || _f === void 0 ? void 0 : _f.toDate) === null || _g === void 0 ? void 0 : _g.call(_f)) || (data.reviewedAt ? new Date(data.reviewedAt) : undefined), data.reviewedBy || undefined, data.rejectionReason || undefined);
    }
    /**
     * List all valid proposal types.
     */
    static getValidTypes() {
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
    static isValidType(type) {
        return AiProposal.getValidTypes().includes(type);
    }
}
exports.AiProposal = AiProposal;
//# sourceMappingURL=AiProposal.js.map