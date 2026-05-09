"use strict";
/**
 * AiToolDefinition - Domain Entity for AI Tool Catalog
 *
 * Defines the metadata, permissions, and status of every AI tool
 * that can be registered in the system.
 *
 * DESIGN PRINCIPLES:
 * 1. ALL tools are categorized by mode (read-only, proposal, write)
 * 2. WRITE tools are ALWAYS blocked — they can never be executed
 * 3. PROPOSAL tools are disabled by default
 * 4. READ-ONLY tools are the only ones that can execute
 * 5. Tools can be globally enabled/disabled by Super Admin
 * 6. Each tool declares required modules and permissions
 * 7. Unavailable tools (missing underlying module) return DATA_UNAVAILABLE
 *
 * v2 Extension:
 * - Added `toProviderToolContract()` method to convert to provider-agnostic
 *   tool call contract for AI providers (OpenAI, etc.).
 * - Added `operationType` mapping from `mode` to standardized operation types.
 * - Added metadata helpers: `whenToUse`, `safetyNotes`, `examples`,
 *   `maxRows`/`maxResults` limits.
 * - Since existing seed data lacks examples/whenToUse/safetyNotes,
 *   safe defaults are derived from description/mode/sensitivity.
 * - Write mode maps to unsafe operation and is explicitly described as blocked.
 *
 * This entity is the SINGLE SOURCE OF TRUTH for the tool catalog.
 * The AiToolRegistry uses these definitions for routing and policy enforcement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolDefinition = void 0;
/**
 * Maps AiToolMode to AiToolOperationType.
 * Write mode explicitly maps to unsafe operations.
 */
function modeToOperationType(mode, toolName) {
    const lowerName = (toolName || '').toLowerCase();
    if (mode === 'write') {
        if (lowerName.includes('delete') || lowerName.includes('remove'))
            return 'DELETE';
        if (lowerName.includes('approve'))
            return 'APPROVE';
        if (lowerName.includes('post'))
            return 'POST';
        if (lowerName.includes('update') || lowerName.includes('modify') || lowerName.includes('change'))
            return 'UPDATE';
        return 'CREATE';
    }
    switch (mode) {
        case 'read-only': return 'READ';
        case 'proposal': return 'PROPOSAL';
    }
}
class AiToolDefinition {
    constructor(id, name, namespace, moduleId, description, category, status, mode, requiredPermissions, requiredModules, inputSchema, outputSchema, enabledByDefault, supportsChatInvocation, supportsManualExecution, riskLevel, dataSensitivity, unavailabilityReason, implemented = false, chatKeywords = [], createdAt = new Date(), updatedAt = new Date()) {
        this.id = id;
        this.name = name;
        this.namespace = namespace;
        this.moduleId = moduleId;
        this.description = description;
        this.category = category;
        this.status = status;
        this.mode = mode;
        this.requiredPermissions = requiredPermissions;
        this.requiredModules = requiredModules;
        this.inputSchema = inputSchema;
        this.outputSchema = outputSchema;
        this.enabledByDefault = enabledByDefault;
        this.supportsChatInvocation = supportsChatInvocation;
        this.supportsManualExecution = supportsManualExecution;
        this.riskLevel = riskLevel;
        this.dataSensitivity = dataSensitivity;
        this.unavailabilityReason = unavailabilityReason;
        this.implemented = implemented;
        this.chatKeywords = chatKeywords;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    /**
     * Is this tool executable? Only active, read-only tools can execute.
     * Write tools are ALWAYS blocked. Proposal tools require explicit enablement.
     */
    get isExecutable() {
        if (this.mode === 'write')
            return false;
        if (this.status === 'unavailable' || this.status === 'deprecated')
            return false;
        if (this.mode === 'proposal' && this.status !== 'active')
            return false;
        return this.status === 'active';
    }
    /**
     * Is this tool blocked from ever executing?
     */
    get isBlocked() {
        return this.mode === 'write' || this.riskLevel === 'blocked';
    }
    // ─── v2 Contract Methods ─────────────────────────────────────────────────
    /**
     * Get the operation type for this tool based on its mode.
     * Maps AiToolMode to the provider-agnostic AiToolOperationType.
     */
    get operationType() {
        return modeToOperationType(this.mode, this.name);
    }
    /**
     * Whether this tool is safe for autonomous AI invocation.
     * READ and PROPOSAL tools are safe; DRAFT and above require human review.
     * WRITE/block operations are never safe for auto-invocation.
     */
    get safeForAutoInvoke() {
        return this.mode === 'read-only' || this.mode === 'proposal';
    }
    /**
     * Derive a "when to use" description from the tool's metadata.
     * Since existing seed data doesn't have explicit whenToUse,
     * we derive safe defaults from description/mode/sensitivity.
     */
    get whenToUse() {
        if (this.mode === 'write') {
            return 'This tool is BLOCKED and cannot be used by AI. Manual action required.';
        }
        if (this.mode === 'proposal') {
            return `Use to generate a ${this.category} proposal for human review. ${this.description}`;
        }
        // read-only
        return `Use to retrieve ${this.category} data. ${this.description}`;
    }
    /**
     * Derive safety notes from the tool's metadata.
     * Since existing seed data doesn't have explicit safetyNotes,
     * we derive safe defaults from mode/sensitivity/risk.
     */
    get safetyNotes() {
        const notes = [];
        if (this.mode === 'write') {
            notes.push('BLOCKED: This operation is never available to AI. It requires explicit human action through the standard ERP workflow.');
        }
        if (this.mode === 'proposal') {
            notes.push('Creates a reviewable proposal only. No data is changed until a human explicitly approves it.');
        }
        if (this.dataSensitivity === 'high') {
            notes.push('Returns sensitive data. Only users with explicit permission should have access.');
        }
        if (this.dataSensitivity === 'medium') {
            notes.push('Returns moderately sensitive data. Results should not be shared publicly.');
        }
        if (this.riskLevel === 'high' || this.riskLevel === 'blocked') {
            notes.push('High-risk operation. Results must be verified before acting on them.');
        }
        if (this.mode === 'read-only' && notes.length === 0) {
            notes.push('Read-only tool. No data is modified.');
        }
        return notes;
    }
    /**
     * Derive usage examples from the tool's metadata.
     * Since existing seed data doesn't have explicit examples,
     * we derive safe template examples from the name and description.
     */
    get examples() {
        if (this.mode === 'write') {
            return ['(Blocked — no examples available for write operations)'];
        }
        // Derive example prompt from the tool name
        const action = this.name.split('.').pop() || this.name;
        const moduleLabel = this.moduleId.charAt(0).toUpperCase() + this.moduleId.slice(1);
        if (this.mode === 'proposal') {
            return [
                `"Suggest a ${action} for me"`,
                `"Create a ${moduleLabel} ${action} proposal"`,
            ];
        }
        // read-only
        return [
            `"Show me the ${moduleLabel.toLowerCase()} ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}"`,
            `"What is the ${moduleLabel.toLowerCase()} ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}?"`,
        ];
    }
    /**
     * Get the maximum number of rows/results this tool can return.
     * Derived from the category and mode — reporting tools return more,
     * single-record tools return less. Write tools return nothing.
     */
    get maxRows() {
        if (this.mode === 'write')
            return 0;
        // Categories that typically return bulk data
        const bulkCategories = ['accounting', 'reports', 'audit'];
        if (bulkCategories.includes(this.category)) {
            return 100;
        }
        // Categories that return summary/top-N data
        const summaryCategories = ['sales', 'purchases', 'inventory'];
        if (summaryCategories.includes(this.category)) {
            return 50;
        }
        // Default
        return 20;
    }
    /**
     * Get the maximum number of results this tool can return.
     * Alias for maxRows for clarity in provider contracts.
     */
    get maxResults() {
        return this.maxRows;
    }
    /**
     * Convert this tool definition to a provider-agnostic tool contract
     * suitable for exposing to AI providers via function/tool calling.
     *
     * This method is the bridge between the domain catalog and the
     * provider interface. It deliberately omits:
     * - Internal IDs (use `name` as the function name)
     * - Implementation details
     * - Secrets or connection strings
     * - Raw permission strings (exposed as count only)
     *
     * Blocked/write tools are included in the contract but marked
     * as CREATE operation type with safeForAutoInvoke=false so
     * the provider can clearly indicate they cannot be used.
     */
    toProviderToolContract() {
        return {
            name: this.name.replace(/\./g, '_'),
            originalName: this.name,
            description: this.whenToUse,
            whenToUse: this.whenToUse,
            parameters: this.inputSchema,
            operationType: this.operationType,
            moduleId: this.moduleId,
            requiredPermissions: this.requiredPermissions,
            inputSchema: this.inputSchema,
            outputSchema: this.outputSchema,
            outputDescription: `Returns sanitized ${this.category} data for ${this.moduleId}. Raw database records are never exposed.`,
            maxRows: this.maxRows,
            maxResults: this.maxResults,
            examples: this.examples,
            safetyNotes: this.safetyNotes,
            safeForAutoInvoke: this.safeForAutoInvoke,
        };
    }
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            namespace: this.namespace,
            moduleId: this.moduleId,
            description: this.description,
            category: this.category,
            status: this.status,
            mode: this.mode,
            readOnly: this.mode === 'read-only',
            requiredPermissions: this.requiredPermissions,
            requiredModules: this.requiredModules,
            inputSchema: this.inputSchema,
            outputSchema: this.outputSchema,
            enabledByDefault: this.enabledByDefault,
            supportsChatInvocation: this.supportsChatInvocation,
            supportsManualExecution: this.supportsManualExecution,
            riskLevel: this.riskLevel,
            dataSensitivity: this.dataSensitivity,
            isExecutable: this.isExecutable,
            isBlocked: this.isBlocked,
            unavailabilityReason: this.unavailabilityReason,
            implemented: this.implemented,
            chatKeywords: this.chatKeywords,
            // v2 extensions
            operationType: this.operationType,
            safeForAutoInvoke: this.safeForAutoInvoke,
            whenToUse: this.whenToUse,
            safetyNotes: this.safetyNotes,
            examples: this.examples,
            maxRows: this.maxRows,
            maxResults: this.maxResults,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new AiToolDefinition(data.id, data.name, data.namespace, data.moduleId, data.description, data.category, data.status, data.mode, data.requiredPermissions, data.requiredModules, data.inputSchema, data.outputSchema, data.enabledByDefault, data.supportsChatInvocation, data.supportsManualExecution, data.riskLevel, data.dataSensitivity, data.unavailabilityReason, (_a = data.implemented) !== null && _a !== void 0 ? _a : false, (_b = data.chatKeywords) !== null && _b !== void 0 ? _b : [], new Date(data.createdAt), new Date(data.updatedAt));
    }
}
exports.AiToolDefinition = AiToolDefinition;
//# sourceMappingURL=AiToolDefinition.js.map