"use strict";
/**
 * AiToolCallingOrchestrator - Tool context, hinting, and guarded execution
 *
 * This orchestrator builds safe tool context for the model and executes only
 * model-requested tool calls after Runtime Guard approval.
 *
 * DESIGN PRINCIPLES:
 * - Tool selection is AI-led. Keywords are hints, not execution triggers.
 * - Only registered, permission-checked, read-only tools can be invoked.
 * - Tool results are NEVER raw DB documents — always sanitized DTOs.
 * - The AI provider receives tool data as context and is instructed to:
 *   - Use ONLY the provided tool result
 *   - NOT invent balances or data
 *   - State clearly if data is unavailable
 *   - NOT suggest any financial action was performed
 *
 * KEYWORD HINTING:
 * - Uses simple keyword matching (English, Arabic, Turkish)
 * - Keywords are defined in AiToolCatalogSeed.ts (chatKeywords field on each tool)
 * - Matches are sent to the model as candidate hints to check first
 * - Keyword matches never execute tools directly
 *
 * STAGE 2 EXTENSIONS:
 * - buildAllowedToolContracts(): Builds provider tool contracts for a user/run
 *   from registered tools + catalog definitions, filtering by permissions.
 * - executeStructuredToolCalls(): Executes model-requested tool calls through
 *   AiRuntimeGuard and AiToolRegistry.
 * - Provider-safe name mapping (dots -> underscores and back).
 * - toolCallId preservation in ToolCallingResult for traceability.
 *
 * SECURITY:
 * - All tool executions go through ExecuteAiToolUseCase
 * - Permission checks are enforced BEFORE tool execution
 * - Company context is enforced (tools only see authenticated company data)
 * - Unregistered tool names are never invoked
 * - The orchestrator NEVER executes arbitrary code or SQL
 * - Model-requested tool calls are validated by AiRuntimeGuard before execution
 * - Only READ operation types are directly executed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolCallingOrchestrator = void 0;
const AiToolCatalogSeed_1 = require("../catalog/AiToolCatalogSeed");
const AiToolCatalogSeed_2 = require("../catalog/AiToolCatalogSeed");
const AiModelRoutingGuard_1 = require("./AiModelRoutingGuard");
class AiToolCallingOrchestrator {
    constructor(toolRegistry, permissionChecker, runtimeGuard) {
        this.toolRegistry = toolRegistry;
        this.permissionChecker = permissionChecker;
        this.runtimeGuard = runtimeGuard;
    }
    /**
     * Inspect a user message and determine if any tools should be invoked.
     * Returns tool results to inject into the AI context, or null if no tools match.
     *
     * @deprecated Chat should use AI-led structured/text-plan tool calls. This
     * deterministic path is retained only for compatibility with old tests/admin
     * diagnostics and should not be called from SendChatMessageUseCase.
     *
     * @param message - The user's message
     * @param companyId - The authenticated company ID
     * @param userId - The authenticated user ID
     * @returns Array of ToolCallingResult (possibly empty), or null if no intents detected
     */
    async detectAndExecute(message, companyId, userId, params) {
        const matchedIntents = this.detectIntents(message);
        console.log(`[AI Assistant] Tool orchestration: message="${message.substring(0, 80)}", matchedIntents=${matchedIntents.length > 0 ? matchedIntents.map(i => i.toolName).join(',') : 'none'}`);
        if (matchedIntents.length === 0) {
            return null; // No tool needed — normal chat continues
        }
        // Get user permissions for context
        const permissions = await this.getUserPermissions(userId, companyId);
        console.log(`[AI Assistant] Tool orchestration: userId=${userId}, companyId=${companyId}, permissions=${permissions.length > 5 ? permissions.length + ' permissions' : permissions.join(',')}`);
        const context = { companyId, userId, permissions };
        const results = [];
        for (const intent of matchedIntents) {
            console.log(`[AI Assistant] Executing tool: ${intent.toolName}`);
            const result = await this.toolRegistry.executeTool(intent.toolName, context, params);
            console.log(`[AI Assistant] Tool ${intent.toolName} result: success=${result.success}, errorCode=${result.errorCode || 'none'}`);
            results.push({
                toolName: intent.toolName,
                result,
            });
        }
        return results;
    }
    /**
     * Detect which tool intents match the user's message.
     * Uses simple case-insensitive keyword matching from the intent config.
     * Returns an array of matching intents (may be empty or have multiple matches).
     * Only returns intents for tools that are actually registered in the registry.
     */
    detectIntents(message) {
        return this.getKeywordHints(message).map(hint => ({
            toolName: hint.toolName,
            keywords: hint.matchedKeywords,
        }));
    }
    /**
     * Build keyword hints for the model to check first.
     *
     * These hints are not execution decisions. They are high-recall routing
     * context that helps the model understand likely tool families while still
     * leaving final intent/parameter planning to the model.
     */
    getKeywordHints(message, allowedToolIds, maxHints = 8) {
        const lowerMessage = message.toLowerCase();
        const allowed = allowedToolIds && allowedToolIds.length > 0
            ? new Set(allowedToolIds)
            : undefined;
        const hints = [];
        for (const toolDef of AiToolCatalogSeed_1.AI_TOOL_CATALOG) {
            if (allowed && !allowed.has(toolDef.name))
                continue;
            // Only check tools that have chat keywords defined
            if (!toolDef.chatKeywords || toolDef.chatKeywords.length === 0)
                continue;
            const matchedKeywords = toolDef.chatKeywords.filter(keyword => lowerMessage.includes(keyword.toLowerCase()));
            if (matchedKeywords.length > 0) {
                // Also verify the tool is actually registered
                if (this.toolRegistry.get(toolDef.name)) {
                    hints.push({
                        toolName: toolDef.name,
                        providerToolName: toolDef.name.replace(/\./g, '_'),
                        matchedKeywords,
                        score: matchedKeywords.length,
                        description: toolDef.description,
                    });
                }
            }
        }
        return hints
            .sort((a, b) => b.score - a.score || a.toolName.localeCompare(b.toolName))
            .slice(0, maxHints);
    }
    /**
     * Build the model-facing planning context from allowed tool contracts.
     *
     * The model receives:
     * - keyword hints to check first
     * - all allowed executable tool cards
     * - input/output schemas
     * - strict instructions that backend validation is final
     *
     * This lets the AI do the reasoning while the backend keeps the safety gate.
     */
    buildToolPlanningContext(userMessage, contracts, options) {
        var _a, _b;
        if (!contracts || contracts.length === 0)
            return '';
        const contractNames = new Set(contracts.map(c => c.originalName));
        const hints = (_a = options === null || options === void 0 ? void 0 : options.keywordHints) !== null && _a !== void 0 ? _a : this.getKeywordHints(userMessage, Array.from(contractNames));
        const toolCards = contracts.map(contract => {
            var _a, _b, _c;
            const def = (0, AiToolCatalogSeed_2.getCatalogDefinition)(contract.originalName);
            return {
                tool: contract.originalName,
                providerTool: contract.name,
                module: contract.moduleId,
                description: (_a = def === null || def === void 0 ? void 0 : def.description) !== null && _a !== void 0 ? _a : contract.description,
                whenToUse: contract.whenToUse,
                inputSchema: contract.inputSchema,
                outputSchema: (_b = contract.outputSchema) !== null && _b !== void 0 ? _b : {},
                keywords: ((_c = def === null || def === void 0 ? void 0 : def.chatKeywords) !== null && _c !== void 0 ? _c : []).slice(0, 24),
                examples: contract.examples.slice(0, 3),
                safetyNotes: contract.safetyNotes.slice(0, 3),
            };
        });
        const planningRules = [
            'Keyword hints are suggestions to check first, not final decisions.',
            'Treat each request as part of the ongoing conversation. Use the current message, recent conversation context, available tool descriptions, schemas, and prior tool results to decide the plan.',
            'If prior conversation context or prior tool results already satisfy the current request, answer from that context instead of requesting another tool.',
            'If a required value can be obtained from another available read-only lookup/report tool, call that helper first.',
            'If the user intent or required extra information is missing, contradictory, or ambiguous, ask the user a short clarification instead of guessing.',
            'Never invent ERP numbers. Only use values returned by tool results.',
            'Never include companyId, userId, role, permission, tenant, or module claims in tool arguments.',
            `Use at most ${(_b = options === null || options === void 0 ? void 0 : options.maxToolCalls) !== null && _b !== void 0 ? _b : 5} tool calls for this answer.`,
        ];
        const textPlanRules = (options === null || options === void 0 ? void 0 : options.textPlanMode)
            ? [
                'This provider/model may not support native function calling. If you need ERP data, respond ONLY with this exact block and no extra prose:',
                '[ERP_TOOL_PLAN]',
                '{"calls":[{"tool":"providerToolName_or_originalToolName","arguments":{},"reason":"short reason"}]}',
                '[/ERP_TOOL_PLAN]',
                'If no tool is needed, answer normally without an ERP_TOOL_PLAN block.',
            ]
            : [
                'Native tool calling is available. Prefer provider function calls when ERP data is needed.',
                'If the provider cannot emit native calls but you still need ERP data, you may use the ERP_TOOL_PLAN block format.',
            ];
        return `[ERP TOOL PLANNING CONTEXT]\n` +
            `The backend will validate every requested tool call before execution. The model only proposes a plan.\n\n` +
            `USER MESSAGE:\n${userMessage}\n\n` +
            `KEYWORD HINTS TO CHECK FIRST:\n${JSON.stringify(hints, null, 2)}\n\n` +
            `AVAILABLE ALLOWED TOOL CARDS:\n${JSON.stringify(toolCards, null, 2)}\n\n` +
            `PLANNING RULES:\n${planningRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}\n\n` +
            `TOOL CALL FORMAT RULES:\n${textPlanRules.map(rule => `- ${rule}`).join('\n')}\n` +
            `[END ERP TOOL PLANNING CONTEXT]`;
    }
    /**
     * Format tool results into a system message that instructs the AI
     * on how to use the data. This message is injected into the conversation
     * before sending to the provider.
     *
     * IMPORTANT: This message enforces that the AI:
     * - Uses ONLY the provided tool data
     * - Does NOT invent numbers or balances
     * - States clearly if data is unavailable
     * - Does NOT suggest any financial action was performed
     */
    formatToolResultsForContext(results) {
        if (!results || results.length === 0)
            return '';
        const sections = [];
        for (const { toolName, result } of results) {
            if (result.success && result.data) {
                sections.push(`[TOOL RESULT: ${toolName}]\n` +
                    `The following data was retrieved from the ERP system for the user's company.\n` +
                    `CRITICAL RULES FOR USING THIS DATA:\n` +
                    `1. Use ONLY the numbers and data provided below. Do NOT invent, estimate, or fabricate any balances or amounts.\n` +
                    `2. If any data appears missing, incomplete, or zero when it shouldn't be, say "The data is currently unavailable" rather than making up numbers.\n` +
                    `3. This is READ-ONLY data. No financial action has been performed. Do NOT suggest that any posting, approval, voucher creation, or modification was done.\n` +
                    `4. Explain the data clearly and help the user understand what they see.\n` +
                    `5. Do NOT invent missing accounts, vouchers, customers, suppliers, items, or employees.\n` +
                    `6. If the data appears truncated or incomplete, mention the limitation rather than guessing.\n` +
                    `\nData:\n${JSON.stringify(result.data, null, 2)}\n` +
                    `\n[END TOOL RESULT: ${toolName}]`);
            }
            else {
                // Tool failed or permission denied
                const errorDetail = result.error || 'Unknown error';
                const errorCode = result.errorCode || 'UNKNOWN';
                sections.push(`[TOOL RESULT: ${toolName}]\n` +
                    `The requested data could not be retrieved.\n` +
                    `Reason: ${errorDetail} (Code: ${errorCode})\n` +
                    `Tell the user: "I was unable to retrieve the requested data. ${errorCode === 'PERMISSION_DENIED' ? 'You may not have the required permission to view this information. Please contact your administrator.' : 'Please try again later or contact support if the issue persists.'}"\n` +
                    `\n[END TOOL RESULT: ${toolName}]`);
            }
        }
        return sections.join('\n\n');
    }
    /**
     * Get descriptions of all registered tools for inclusion in the system prompt.
     * This tells the AI what tools are available in case the user's question
     * relates to one of these areas (but the AI does NOT invoke tools directly).
     */
    getToolDescriptionsForPrompt() {
        const tools = this.toolRegistry.getToolDescriptions();
        if (tools.length === 0)
            return '';
        const lines = tools.map(t => `- "${t.name}" (${t.module}): ${t.description}`);
        return `You have access to the following read-only ERP data tools. ` +
            `Use tool calls or ERP_TOOL_PLAN only when real ERP data is needed. ` +
            `Do not assume that keyword matches are final intent.\n\n` +
            `Available tools:\n${lines.join('\n')}\n\n` +
            `IMPORTANT: The backend validates all requested tools before execution. ` +
            `If tool data is provided in this conversation, use it exactly and never invent missing values.`;
    }
    /**
     * Get user permissions for the given company.
     */
    async getUserPermissions(userId, companyId) {
        const hasWildcard = await this.permissionChecker.hasPermission(userId, companyId, '*');
        if (hasWildcard)
            return ['*'];
        // Use the proper public method instead of bypassing encapsulation
        return this.permissionChecker.getAllPermissions(userId, companyId);
    }
    // ─── STAGE 2: Structured Tool Calling Methods ────────────────────────────
    /**
     * Build the list of allowed provider tool contracts for a user/run.
     *
     * Filters registered, executable, chat-invokable tools by the user's
     * permissions. Returns only READ operation types (writes are blocked).
     *
     * Uses getCatalogDefinition from AiToolCatalogSeed as the source of
     * tool metadata, then cross-references with the runtime registry to
     * ensure the tool is actually available.
     *
     * @returns An object with:
     *   - contracts: Array of AiProviderToolContract for the provider
     *   - nameMapping: Map from provider-safe name -> original registered name
     *   - allowedToolIds: Array of original tool names that are allowed
     */
    async buildAllowedToolContracts(userId, companyId, options) {
        const permissions = await this.getUserPermissions(userId, companyId);
        const nameMapping = new Map();
        const contracts = [];
        const allowedToolIds = [];
        // Get all executable catalog definitions
        const executableDefs = (0, AiToolCatalogSeed_2.getExecutableDefinitions)();
        for (const def of executableDefs) {
            // Must also be registered in the runtime tool registry
            const registeredTool = this.toolRegistry.get(def.name);
            if (!registeredTool)
                continue;
            // Must support chat invocation
            if (!def.supportsChatInvocation)
                continue;
            // Must be READ operation type for direct execution
            if (def.operationType !== 'READ')
                continue;
            // Must not be blocked
            if (def.isBlocked)
                continue;
            if ((options === null || options === void 0 ? void 0 : options.providerConfig) && options.routingGuard) {
                const routingDecision = await options.routingGuard.validateSensitiveWorkflow({
                    tenantId: companyId,
                    config: options.providerConfig,
                    category: (0, AiModelRoutingGuard_1.certificationCategoryForModule)(def.moduleId),
                    moduleId: def.moduleId,
                });
                if (!routingDecision.allowed)
                    continue;
            }
            // User must have the required permission
            const requiredPermission = def.requiredPermissions[0];
            const hasPermission = !requiredPermission || permissions.some(perm => {
                if (perm === '*')
                    return true;
                if (perm === requiredPermission)
                    return true;
                if (requiredPermission.startsWith(perm + '.'))
                    return true;
                return false;
            });
            if (!hasPermission)
                continue;
            // Build the provider contract
            const contract = def.toProviderToolContract();
            contracts.push(contract);
            // Map provider-safe name (dots -> underscores) back to original name
            const providerSafeName = contract.name; // already has dots replaced with underscores
            nameMapping.set(providerSafeName, def.name);
            allowedToolIds.push(def.name);
        }
        return { contracts, nameMapping, allowedToolIds };
    }
    /**
     * Execute structured model tool calls through AiRuntimeGuard and AiToolRegistry.
     *
     * This method is called when the AI provider returns structured toolCalls
     * in its response. Each call is validated by the RuntimeGuard before execution.
     * Only READ operations are executed; write/draft/proposal calls are rejected.
     *
     * @param aiRunId - The AI run context ID for guard validation
     * @param toolCalls - Structured tool call requests from the provider
     * @param nameMapping - Map from provider-safe name -> original registered name
     * @param companyId - Authenticated company ID (trumps any model-supplied value)
     * @param userId - Authenticated user ID (trumps any model-supplied value)
     * @returns Array of StructuredToolCallResult for each tool call
     */
    async executeStructuredToolCalls(aiRunId, toolCalls, nameMapping, companyId, userId) {
        var _a;
        const results = [];
        for (const toolCall of toolCalls) {
            // If runtimeGuard is available, validate the call
            if (this.runtimeGuard) {
                const decision = await this.runtimeGuard.validateToolCall(aiRunId, toolCall, nameMapping);
                if (!decision.approved) {
                    results.push({
                        toolName: decision.resolvedOriginalName,
                        toolCallId: toolCall.id,
                        approved: false,
                        result: null,
                        rejectionReason: decision.rejectionReason,
                        rejectionCode: decision.rejectionCode,
                    });
                    continue;
                }
                // Approved — execute the tool using the authenticated identity
                const originalName = decision.resolvedOriginalName;
                const toolResult = await this.executeApprovedToolCall(originalName, companyId, userId, toolCall.arguments);
                results.push({
                    toolName: originalName,
                    toolCallId: toolCall.id,
                    approved: true,
                    result: toolResult,
                });
            }
            else {
                // No runtime guard — fall back to direct execution (existing behavior)
                // Resolve name from provider-safe format
                const originalName = (_a = nameMapping.get(toolCall.name)) !== null && _a !== void 0 ? _a : toolCall.name;
                const toolResult = await this.executeApprovedToolCall(originalName, companyId, userId, toolCall.arguments);
                results.push({
                    toolName: originalName,
                    toolCallId: toolCall.id,
                    approved: true,
                    result: toolResult,
                });
            }
        }
        return results;
    }
    /**
     * Execute an approved tool call using the AiToolRegistry.
     * Uses authenticated backend identity, never model-supplied values.
     */
    async executeApprovedToolCall(toolName, companyId, userId, args) {
        // Strip model-supplied identity fields — we always use backend identity
        const safeArgs = Object.assign({}, args);
        delete safeArgs.companyId;
        delete safeArgs.userId;
        const permissions = await this.getUserPermissions(userId, companyId);
        const context = { companyId, userId, permissions };
        return this.toolRegistry.executeTool(toolName, context, safeArgs);
    }
    /**
     * Format structured tool call results for inclusion in a second provider call.
     *
     * This wraps the tool results as tool response messages that the provider
     * can understand, including both successful and rejected tool calls.
     */
    formatStructuredResultsForProviderContext(results) {
        var _a;
        if (!results || results.length === 0)
            return '';
        const sections = [];
        for (const result of results) {
            if (result.approved && ((_a = result.result) === null || _a === void 0 ? void 0 : _a.success) && result.result.data) {
                sections.push(`[TOOL RESULT: ${result.toolName}]\n` +
                    `The following data was retrieved from the ERP system.\n` +
                    `CRITICAL RULES FOR USING THIS DATA:\n` +
                    `1. Use ONLY the numbers and data provided below. Do NOT invent, estimate, or fabricate any values.\n` +
                    `2. If data appears missing or incomplete, say "The data is currently unavailable" rather than making up values.\n` +
                    `3. This is READ-ONLY data. No financial action has been performed.\n` +
                    `4. Explain the data clearly.\n\n` +
                    `Data:\n${JSON.stringify(result.result.data, null, 2)}\n` +
                    `\n[END TOOL RESULT: ${result.toolName}]`);
            }
            else if (result.approved && result.result && !result.result.success) {
                // Tool was approved but execution failed
                sections.push(`[TOOL RESULT: ${result.toolName}]\n` +
                    `The requested data could not be retrieved.\n` +
                    `Reason: ${result.result.error || 'Unknown error'} (Code: ${result.result.errorCode || 'UNKNOWN'})\n` +
                    `Tell the user: "I was unable to retrieve the requested data. Please try again later."\n` +
                    `\n[END TOOL RESULT: ${result.toolName}]`);
            }
            else if (!result.approved) {
                // Tool call was rejected by runtime guard
                sections.push(`[TOOL CALL REJECTED: ${result.toolName}]\n` +
                    `The AI model requested to call '${result.toolName}' but it was blocked for safety.\n` +
                    `Reason: ${result.rejectionReason || 'Not allowed'}\n` +
                    `Tell the user: "I cannot perform that action automatically. ${result.rejectionCode === 'PERMISSION_DENIED' ? 'You may not have the required permission.' : 'This type of operation requires manual review.'}"\n` +
                    `\n[END TOOL CALL REJECTED: ${result.toolName}]`);
            }
        }
        return sections.join('\n\n');
    }
}
exports.AiToolCallingOrchestrator = AiToolCallingOrchestrator;
//# sourceMappingURL=AiToolCallingOrchestrator.js.map