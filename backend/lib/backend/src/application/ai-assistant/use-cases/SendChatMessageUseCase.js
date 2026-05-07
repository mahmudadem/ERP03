"use strict";
/**
 * SendChatMessageUseCase - AI Assistant Chat Business Logic
 *
 * AI Safety Rules (enforced here):
 * - The AI assistant is advisory-only.
 * - It may NOT create, update, delete, approve, post, or modify any business records.
 * - It may only answer, explain, validate, summarize, or suggest drafts.
 * - Any real business action must go through existing backend use cases
 *   with explicit user approval.
 *
 * Tool Integration:
 * - When a user message matches a known tool intent, the orchestrator
 *   executes the read-only tool and injects the result as context.
 * - The AI provider is instructed to use ONLY the provided tool data,
 *   not to invent numbers, and to state clearly if data is unavailable.
 * - Tool selection is deterministic (keyword matching), not free-form AI selection.
 *
 * STAGE 2 EXTENSIONS:
 * - Each request generates an aiRunId with expiration and max tool calls
 * - Base skill always in system prompt; domain skills selected from message
 * - Model profile warnings from AiModelCapabilityCatalog
 * - Deterministic tools still run first as safe fallback
 * - If model profile supports tool calling, allowed tool contracts are exposed
 * - If provider returns structured toolCalls, they go through RuntimeGuard,
 *   approved READ tools execute, then a second provider call for final response
 * - Direct writes remain blocked; write calls become rejected metadata
 * - Assistant metadata includes: aiRunId, conversationId, runtimeStatus,
 *   selectedSkills, allowedToolIds, modelProfile, runtimeWarnings,
 *   toolCallsRequested, toolResults, proposal
 *
 * Rate Limiting:
 * - Each company has a maxRequestsPerDay limit (default: 100)
 * - Checked via AiRateLimiterService before processing any request
 * - Returns 429 if limit exceeded
 *
 * Usage Logging:
 * - Every request is logged after completion (success or failure)
 * - Usage logs are for analytics/auditing ONLY — not for rate limiting
 * - Rate limiting uses config-based counters in AiProviderConfig
 *
 * Audit Logging (Stage 2):
 * - AI_RUN_STARTED, AI_TOOL_CALL_APPROVED, AI_TOOL_CALL_REJECTED,
 *   AI_RUN_COMPLETED, AI_RUN_FAILED events logged via AiAuditService
 * - Audit failures never block chat
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendChatMessageUseCase = void 0;
const AiChatMessage_1 = require("../../../domain/ai-assistant/entities/AiChatMessage");
const AiUsageLog_1 = require("../../../domain/ai-assistant/entities/AiUsageLog");
const AiProviderConfig_1 = require("../../../domain/ai-assistant/entities/AiProviderConfig");
const ProviderFactory_1 = require("../providers/ProviderFactory");
const AiRateLimiterService_1 = require("../services/AiRateLimiterService");
const AiModelCapabilityCatalog_1 = require("../services/AiModelCapabilityCatalog");
const ProviderErrors_1 = require("../../../errors/ProviderErrors");
const ApiError_1 = require("../../../api/errors/ApiError");
class SendChatMessageUseCase {
    constructor(chatRepository, settingsRepository, encryptionService, httpClient, usageLogRepository, toolOrchestrator, proposalGeneratorRegistry, createAiProposalUseCase, runtimeGuard, auditService, skillRegistry) {
        this.chatRepository = chatRepository;
        this.settingsRepository = settingsRepository;
        this.encryptionService = encryptionService;
        this.httpClient = httpClient;
        this.usageLogRepository = usageLogRepository;
        this.toolOrchestrator = toolOrchestrator;
        this.proposalGeneratorRegistry = proposalGeneratorRegistry;
        this.createAiProposalUseCase = createAiProposalUseCase;
        this.runtimeGuard = runtimeGuard;
        this.auditService = auditService;
        this.skillRegistry = skillRegistry;
        this.rateLimiter = new AiRateLimiterService_1.AiRateLimiterService(settingsRepository);
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const { companyId, userId, message, conversationId } = input;
        const startTime = Date.now();
        // ── Stage 2: Initialize runtime context ──────────────────────────────
        const aiRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        let runContext;
        const runtimeWarnings = [];
        const toolCallsRequested = [];
        const toolResultSummaries = [];
        // 1. Validate input
        if (!message || message.trim().length === 0) {
            throw ApiError_1.ApiError.badRequest('Message content is required');
        }
        if (message.length > 10000) {
            throw ApiError_1.ApiError.badRequest('Message content must not exceed 10,000 characters');
        }
        // 2. Check and increment rate limit (per company per day)
        await this.rateLimiter.checkAndIncrement(companyId);
        // 3. Get or create provider config for this company
        let config = await this.settingsRepository.getConfig(companyId);
        if (!config) {
            config = AiProviderConfig_1.AiProviderConfig.defaultForCompany(companyId);
        }
        else {
            config = this.decryptConfig(config);
        }
        // 4. Check if AI is enabled for this company
        if (!config.isEnabled) {
            throw ApiError_1.ApiError.forbidden('AI Assistant is not enabled for this company. Please enable it in settings.');
        }
        // 5. Determine conversation ID (new or existing)
        const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        // 6. Build model capability profile
        const modelProfile = AiModelCapabilityCatalog_1.AiModelCapabilityCatalog.getProfile(config.provider, config.model);
        if (modelProfile.textOnlyMode) {
            runtimeWarnings.push(modelProfile.warningMessage || `Model '${config.model}' is running in text-only mode. Tool calling is disabled.`);
        }
        if (modelProfile.warningLevel === 'danger') {
            runtimeWarnings.push(`Model '${config.model}' on provider '${config.provider}' is not recognized. Responses may be unreliable.`);
        }
        // 7. Select domain skills from message
        let selectedSkills = ['base-orchestration'];
        if (this.skillRegistry) {
            const domainSkills = this.skillRegistry.selectDomainSkills(message);
            selectedSkills = ['base-orchestration', ...domainSkills.map(s => s.id)];
        }
        // 8. Build allowed tool contracts for this user/run (Stage 2)
        let allowedContracts = [];
        let nameMapping = new Map();
        let allowedToolIds = [];
        if (this.toolOrchestrator && typeof this.toolOrchestrator.buildAllowedToolContracts === 'function') {
            try {
                const contractsResult = await this.toolOrchestrator.buildAllowedToolContracts(userId, companyId);
                allowedContracts = contractsResult.contracts;
                nameMapping = contractsResult.nameMapping;
                allowedToolIds = contractsResult.allowedToolIds;
            }
            catch (error) {
                // Contract building failure should NOT block chat
                console.warn(`[AI Assistant] Failed to build allowed tool contracts: ${error.message}`);
            }
        }
        // 9. Create AiRunContext for this request (Stage 2)
        if (this.runtimeGuard) {
            runContext = this.runtimeGuard.createRun({
                companyId,
                userId,
                conversationId: convId,
                allowedToolIds,
                providerModel: `${config.provider}/${config.model || 'unknown'}`,
                maxToolCalls: 5,
                ttlMs: 5 * 60 * 1000, // 5 minutes
            });
        }
        // 10. Audit: AI_RUN_STARTED
        this.auditLogSafe('AI_RUN_STARTED', {
            companyId,
            userId,
            conversationId: convId,
            aiRunId: (_a = runContext === null || runContext === void 0 ? void 0 : runContext.aiRunId) !== null && _a !== void 0 ? _a : aiRunId,
            providerModel: `${config.provider}/${config.model || 'unknown'}`,
            selectedSkills,
            allowedToolIds,
        });
        // 11. Get recent conversation history for context (last 10 messages)
        const recentMessages = await this.chatRepository.getConversationMessages(companyId, userId, convId, 10);
        // ── PHASE A: Deterministic tool calling (existing fallback) ─────────
        let toolContextMessage = null;
        let toolResultsForMetadata = [];
        if (this.toolOrchestrator) {
            try {
                const toolResults = await this.toolOrchestrator.detectAndExecute(message, companyId, userId);
                if (toolResults && toolResults.length > 0) {
                    // Prefer one sufficient deterministic tool by default
                    // If multiple match, use the first sufficient one
                    const sufficientToolResults = toolResults.slice(0, 1);
                    toolResultsForMetadata = sufficientToolResults;
                    toolContextMessage = this.toolOrchestrator.formatToolResultsForContext(sufficientToolResults);
                    console.log(`[AI Assistant] Deterministic tool context injected: ${sufficientToolResults.length} tool(s), context length=${toolContextMessage.length}`);
                }
                // When no tool data was retrieved (null or empty), inject a NO_DATA warning
                // to prevent the AI from hallucinating financial figures.
                if (!toolContextMessage) {
                    toolContextMessage = '[NO TOOL DATA AVAILABLE]\nNo ERP data was retrieved for this query. You MUST NOT fabricate, estimate, or invent any financial figures, account balances, invoice amounts, stock quantities, or other business data. If you don\'t have real data, tell the user clearly: "I don\'t have that data available right now. Please check the relevant ERP module for accurate information." NEVER present guessed numbers as if they came from the system.';
                }
            }
            catch (error) {
                console.warn(`[AI Assistant] Deterministic tool execution failed for company ${companyId}, user ${userId}: ${error.message}`);
            }
        }
        // ── PHASE B: Proposal intent detection (existing sandbox) ──────────
        let proposalContextMessage = null;
        let proposalResultForMetadata = null;
        if (this.proposalGeneratorRegistry && this.createAiProposalUseCase) {
            try {
                const proposalType = this.proposalGeneratorRegistry.detectProposalIntent(message);
                if (proposalType) {
                    console.log(`[AI Assistant] Proposal intent detected: ${proposalType}`);
                    const generatorOutput = await this.proposalGeneratorRegistry.generate(proposalType, {
                        companyId,
                        userId,
                        userMessage: message,
                        toolResultData: toolResultsForMetadata.length > 0
                            ? toolResultsForMetadata[0].result.data
                            : undefined,
                    });
                    const createResult = await this.createAiProposalUseCase.execute({
                        companyId,
                        userId,
                        type: generatorOutput.type,
                        title: generatorOutput.title,
                        summary: generatorOutput.summary,
                        rationale: generatorOutput.rationale,
                        inputContextSummary: generatorOutput.inputContextSummary,
                        proposedData: generatorOutput.proposedData,
                        warnings: generatorOutput.warnings,
                        riskLevel: generatorOutput.riskLevel,
                        moduleId: generatorOutput.moduleId,
                        requiredPermissions: generatorOutput.requiredPermissions,
                        missingInfo: generatorOutput.missingInfo,
                        confidence: generatorOutput.confidence,
                    });
                    proposalResultForMetadata = createResult.proposal;
                    proposalContextMessage = this.formatProposalForContext(createResult.proposal, generatorOutput.missingInfo);
                    console.log(`[AI Assistant] Sandbox proposal created: id=${createResult.proposal.id}, type=${proposalType}`);
                }
            }
            catch (error) {
                console.warn(`[AI Assistant] Proposal creation failed for company ${companyId}, user ${userId}: ${error.message}`);
            }
        }
        // ── PHASE C: Build skill context for system prompt ──────────────────
        let skillContext = '';
        if (this.skillRegistry) {
            skillContext = this.skillRegistry.buildSkillContext(message);
        }
        // ── PHASE D: Build provider request ─────────────────────────────────
        const provider = ProviderFactory_1.ProviderFactory.getProvider(config, this.httpClient);
        const providerCapabilities = provider.getCapabilities();
        // Decide whether to expose tool contracts: only if model supports it
        // AND we don't already have deterministic tool data (avoid redundancy)
        const shouldExposeTools = modelProfile.supportsToolCalling
            && providerCapabilities.supportsToolCalling
            && !modelProfile.textOnlyMode
            && allowedContracts.length > 0
            && toolResultsForMetadata.length === 0; // Don't request model tool calls if we already have data
        if (modelProfile.supportsToolCalling && !providerCapabilities.supportsToolCalling) {
            runtimeWarnings.push(`Provider '${provider.providerName}' does not support structured tool calling. Using text-only or deterministic mode.`);
        }
        const providerMessages = [
            {
                role: 'system',
                content: this.buildSystemPrompt(toolContextMessage, proposalContextMessage, skillContext, modelProfile),
            },
            ...recentMessages
                .slice(-8)
                .map(m => ({
                role: m.role,
                content: m.content,
            })),
            {
                role: 'user',
                content: message.trim(),
            },
        ];
        const providerRequest = Object.assign({ messages: providerMessages, maxTokens: config.maxTokensPerRequest, temperature: 0.7 }, (shouldExposeTools ? { tools: allowedContracts } : {}));
        // ── PHASE E: First provider call ─────────────────────────────────────
        let result;
        let usageLogStatus = 'success';
        let usageLogErrorCode;
        let tokenCount;
        try {
            const response = await provider.chat(providerRequest);
            // Extract token usage from metadata if available
            const usage = (_b = response.metadata) === null || _b === void 0 ? void 0 : _b.usage;
            tokenCount = response.tokenCount;
            // ── PHASE F: Handle structured tool calls from provider (Stage 2) ──
            let structuredToolResults = [];
            let structuredToolResultsForMetadata = [];
            let toolCallContextForSecondCall = null;
            let finalResponse = response;
            if (response.toolCalls && response.toolCalls.length > 0 && shouldExposeTools && this.toolOrchestrator && runContext) {
                console.log(`[AI Assistant] Provider returned ${response.toolCalls.length} structured tool call(s)`);
                // Track requested tool calls
                for (const tc of response.toolCalls) {
                    toolCallsRequested.push(tc.name);
                }
                // Execute structured tool calls through the runtime guard
                structuredToolResults = await this.toolOrchestrator.executeStructuredToolCalls(runContext.aiRunId, response.toolCalls, nameMapping, companyId, userId);
                structuredToolResultsForMetadata = structuredToolResults
                    .filter((r) => !!r.result)
                    .map(r => ({
                    toolName: r.toolName,
                    toolCallId: r.toolCallId,
                    result: r.result,
                }));
                // Audit each tool call result
                for (const strResult of structuredToolResults) {
                    const auditEventType = strResult.approved ? 'AI_TOOL_CALL_APPROVED' : 'AI_TOOL_CALL_REJECTED';
                    this.auditLogSafe(auditEventType, {
                        companyId,
                        userId,
                        conversationId: convId,
                        aiRunId: runContext.aiRunId,
                        providerModel: `${config.provider}/${config.model || 'unknown'}`,
                        resolvedOriginalName: strResult.toolName,
                        operationType: 'READ',
                        rejectionReason: strResult.rejectionReason,
                        rejectionCode: strResult.rejectionCode,
                        toolCallKeys: Object.keys((_d = (_c = response.toolCalls.find(tc => tc.id === strResult.toolCallId)) === null || _c === void 0 ? void 0 : _c.arguments) !== null && _d !== void 0 ? _d : {}),
                    });
                    toolResultSummaries.push({
                        toolName: strResult.toolName,
                        approved: strResult.approved,
                        rejectionReason: strResult.rejectionReason,
                    });
                }
                // Format tool results for a second provider call
                toolCallContextForSecondCall = this.toolOrchestrator.formatStructuredResultsForProviderContext(structuredToolResults);
                // Make a second call with tool results in context
                // Only if at least one tool call was approved
                const approvedResults = structuredToolResults.filter(r => r.approved);
                if (approvedResults.length > 0) {
                    console.log(`[AI Assistant] Making second provider call with ${approvedResults.length} approved tool result(s)`);
                    const secondCallMessages = [
                        ...providerMessages,
                        // Assistant's tool call message (as assistant role)
                        {
                            role: 'assistant',
                            content: response.content || '[Tool calls requested]',
                        },
                        // Tool results as a system context message
                        {
                            role: 'system',
                            content: toolCallContextForSecondCall,
                        },
                    ];
                    try {
                        const secondResponse = await provider.chat({
                            messages: secondCallMessages,
                            maxTokens: config.maxTokensPerRequest,
                            temperature: 0.7,
                        });
                        // Use the second response as the final response
                        finalResponse = secondResponse;
                        // Add second call token usage
                        if ((_e = secondResponse.metadata) === null || _e === void 0 ? void 0 : _e.usage) {
                            const secondUsage = secondResponse.metadata.usage;
                            if (usage && secondUsage) {
                                usage.promptTokens = (usage.promptTokens || 0) + (secondUsage.promptTokens || 0);
                                usage.completionTokens = (usage.completionTokens || 0) + (secondUsage.completionTokens || 0);
                                usage.totalTokens = (usage.totalTokens || 0) + (secondUsage.totalTokens || 0);
                            }
                        }
                    }
                    catch (secondCallError) {
                        // Second call failed — use first response content with tool context
                        console.warn(`[AI Assistant] Second provider call failed: ${secondCallError.message}`);
                        // Keep original response, but add tool context to the content
                        if (toolCallContextForSecondCall) {
                            const originalContent = response.content || '';
                            const toolSummary = structuredToolResults
                                .filter(r => { var _a; return r.approved && ((_a = r.result) === null || _a === void 0 ? void 0 : _a.success); })
                                .map(r => `${r.toolName}: data retrieved`)
                                .join(', ');
                            finalResponse = Object.assign(Object.assign({}, response), { content: originalContent
                                    ? `${originalContent}\n\n[Data retrieved: ${toolSummary}]`
                                    : `I retrieved the requested data. ${toolSummary}. However, I was unable to generate a full analysis. Please ask again if you need more detail.` });
                        }
                    }
                }
            }
            // ── PHASE G: Save messages ─────────────────────────────────────────
            const userMessage = AiChatMessage_1.AiChatMessage.create({
                companyId,
                userId,
                conversationId: convId,
                role: 'user',
                content: message.trim(),
                provider: config.provider,
                model: config.model,
            });
            const savedUserMessage = await this.chatRepository.create(userMessage);
            // Ensure assistant content is never null — safe string even for tool-call-only first responses
            const assistantContent = finalResponse.content || '[Processing complete. Please see the data above.]';
            const assistantMessage = AiChatMessage_1.AiChatMessage.create({
                companyId,
                userId,
                conversationId: convId,
                role: 'assistant',
                content: assistantContent,
                provider: finalResponse.provider,
                model: finalResponse.model,
                metadata: Object.assign(Object.assign(Object.assign(Object.assign({}, (finalResponse.metadata || {})), { 
                    // Stage 2 runtime metadata
                    aiRunId: (_f = runContext === null || runContext === void 0 ? void 0 : runContext.aiRunId) !== null && _f !== void 0 ? _f : aiRunId, conversationId: convId, runtimeStatus: 'completed', selectedSkills,
                    allowedToolIds, modelProfile: {
                        provider: modelProfile.provider,
                        modelName: modelProfile.modelName,
                        status: modelProfile.status,
                        supportsToolCalling: modelProfile.supportsToolCalling,
                        textOnlyMode: modelProfile.textOnlyMode,
                        warningLevel: modelProfile.warningLevel,
                        warningMessage: modelProfile.warningMessage,
                    }, runtimeWarnings,
                    toolCallsRequested, toolResults: [...toolResultsForMetadata, ...structuredToolResultsForMetadata] }), (toolResultSummaries.length > 0 ? { toolCallResults: toolResultSummaries } : {})), (proposalResultForMetadata ? { proposal: proposalResultForMetadata } : {})),
            });
            assistantMessage.tokenCount = finalResponse.tokenCount;
            const savedAssistantMessage = await this.chatRepository.create(assistantMessage);
            result = {
                userMessage: savedUserMessage,
                assistantMessage: savedAssistantMessage,
                provider: finalResponse.provider,
                model: finalResponse.model,
                runtimeMeta: Object.assign({ aiRunId: (_g = runContext === null || runContext === void 0 ? void 0 : runContext.aiRunId) !== null && _g !== void 0 ? _g : aiRunId, conversationId: convId, runtimeStatus: 'completed', selectedSkills,
                    allowedToolIds, modelProfile: {
                        provider: modelProfile.provider,
                        modelName: modelProfile.modelName,
                        status: modelProfile.status,
                        supportsToolCalling: modelProfile.supportsToolCalling,
                        textOnlyMode: modelProfile.textOnlyMode,
                        warningLevel: modelProfile.warningLevel,
                        warningMessage: modelProfile.warningMessage,
                    }, runtimeWarnings,
                    toolCallsRequested, toolResults: toolResultSummaries.length > 0 ? toolResultSummaries : [] }, (proposalResultForMetadata ? { proposal: proposalResultForMetadata } : {})),
            };
            // Audit: AI_RUN_COMPLETED
            this.auditLogSafe('AI_RUN_COMPLETED', {
                companyId,
                userId,
                conversationId: convId,
                aiRunId: (_h = runContext === null || runContext === void 0 ? void 0 : runContext.aiRunId) !== null && _h !== void 0 ? _h : aiRunId,
                providerModel: `${config.provider}/${config.model || 'unknown'}`,
                selectedSkills,
                allowedToolIds,
                runtimeStatus: 'completed',
                toolCallsRequested,
                durationMs: Date.now() - startTime,
                tokenUsage: usage ? {
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                } : undefined,
            });
            // Log successful usage
            if (this.usageLogRepository) {
                const latencyMs = Date.now() - startTime;
                const usageLog = AiUsageLog_1.AiUsageLog.create({
                    companyId,
                    userId,
                    providerType: config.provider,
                    model: config.model || finalResponse.model,
                    messageCount: providerMessages.length,
                    promptTokens: usage === null || usage === void 0 ? void 0 : usage.promptTokens,
                    completionTokens: usage === null || usage === void 0 ? void 0 : usage.completionTokens,
                    totalTokens: (_j = usage === null || usage === void 0 ? void 0 : usage.totalTokens) !== null && _j !== void 0 ? _j : tokenCount,
                    status: 'success',
                    latencyMs,
                });
                await this.usageLogRepository.create(usageLog).catch(err => {
                    console.warn('[AI Assistant] Failed to log usage:', err.message);
                });
            }
            return result;
        }
        catch (error) {
            // Audit: AI_RUN_FAILED
            this.auditLogSafe('AI_RUN_FAILED', {
                companyId,
                userId,
                conversationId: convId,
                aiRunId: (_k = runContext === null || runContext === void 0 ? void 0 : runContext.aiRunId) !== null && _k !== void 0 ? _k : aiRunId,
                providerModel: `${config.provider}/${config.model || 'unknown'}`,
                runtimeStatus: 'failed',
                errorMessage: (_l = error.message) === null || _l === void 0 ? void 0 : _l.substring(0, 500),
                durationMs: Date.now() - startTime,
                tokenUsage: undefined,
            });
            // Log failed usage
            usageLogStatus = 'failure';
            if (error instanceof ProviderErrors_1.ProviderError) {
                const providerErr = error;
                if (providerErr.statusCode === 401) {
                    usageLogErrorCode = 'AI_PROVIDER_AUTH_ERROR';
                }
                else if (providerErr.statusCode === 429) {
                    usageLogErrorCode = 'AI_PROVIDER_RATE_LIMIT';
                }
                else if (providerErr.statusCode === 503) {
                    usageLogErrorCode = 'AI_PROVIDER_UNAVAILABLE';
                }
                else {
                    usageLogErrorCode = 'AI_PROVIDER_ERROR';
                }
            }
            else if (error instanceof ApiError_1.ApiError) {
                usageLogErrorCode = error.code || 'API_ERROR';
            }
            else {
                usageLogErrorCode = 'UNKNOWN_ERROR';
            }
            if (this.usageLogRepository) {
                const latencyMs = Date.now() - startTime;
                const usageLog = AiUsageLog_1.AiUsageLog.create({
                    companyId,
                    userId,
                    providerType: config.provider,
                    model: config.model || 'unknown',
                    messageCount: providerMessages.length,
                    status: 'failure',
                    errorCode: usageLogErrorCode,
                    latencyMs,
                });
                await this.usageLogRepository.create(usageLog).catch(err => {
                    console.warn('[AI Assistant] Failed to log usage for failure:', err.message);
                });
            }
            throw error;
        }
    }
    /**
     * Decrypt the apiKey in an AiProviderConfig after loading from storage.
     * Returns the config with plaintext apiKey for provider usage.
     */
    decryptConfig(config) {
        if (!config.apiKey) {
            return config;
        }
        // Check if this looks like encrypted data (contains colons from iv:ciphertext:authTag)
        // or is a passthrough plaintext (starts with 'plain:')
        if (config.apiKey.startsWith('plain:')) {
            // Development passthrough — remove prefix and use as plaintext
            const plainKey = config.apiKey.substring(6);
            return AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: plainKey, updatedAt: config.updatedAt.toISOString() }));
        }
        try {
            const decrypted = this.encryptionService.decrypt(config.apiKey);
            return AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: decrypted, updatedAt: config.updatedAt.toISOString() }));
        }
        catch (error) {
            console.warn(`[AI Assistant] Failed to decrypt API key for company ${config.companyId}. ` +
                `The key may be stored in plaintext (pre-encryption). Error: ${error.message}`);
            // Return config as-is — ProviderFactory will fall back to mock if the key is invalid
            return config;
        }
    }
    /**
     * System prompt that enforces AI safety rules.
     * This is ALWAYS prepended to the conversation, ensuring the AI
     * understands its advisory-only role regardless of provider.
     *
     * Stage 2: Includes skill context and model profile warnings.
     *
     * When tool data is available, it's appended to the system prompt
     * with strict instructions on how to use (and NOT use) the data.
     *
     * When a proposal was created, it's appended with instructions
     * to explain the proposal and emphasize no ERP data was changed.
     */
    buildSystemPrompt(toolContextMessage, proposalContextMessage, skillContext, modelProfile) {
        let prompt = `You are the AI Assistant for an ERP system. Your role is STRICTLY advisory.

RULES YOU MUST FOLLOW:
1. You may ONLY answer, explain, validate, summarize, or suggest drafts.
2. You may NOT create, update, delete, approve, post, or modify any business records.
3. Any real business action (creating invoices, posting vouchers, adjusting inventory, etc.) MUST go through the standard ERP module workflows with explicit user approval.
4. For accounting, voucher, payment, and inventory questions — always advise the user to use the proper module for actual transactions.
5. Never provide API endpoints or direct database operations.
6. If a user asks you to perform an action, explain HOW to do it in the ERP UI instead of doing it yourself.

CRITICAL: NEVER FABRICATE DATA
7. If no tool data is provided in this conversation, you MUST NOT invent, estimate, or fabricate any financial figures, account balances, invoice amounts, stock quantities, or other business data.
8. If you do not have real data from a tool result, say clearly: "I don't have that data available right now. Please check the [relevant module] screen in the ERP for the most accurate information."
9. NEVER present guessed or hallucinated numbers as if they came from the system. Zero data is better than wrong data.
10. If a tool returns empty, zero, or unexpected results, present the data exactly as returned and suggest the user verify in the ERP module.

You are helpful, professional, and knowledgeable about business processes including:
- Accounting (chart of accounts, journal entries, financial reports)
- Sales (invoices, orders, delivery notes, returns)
- Purchases (purchase orders, goods receipts, purchase invoices, returns)
- Inventory (stock levels, movements, adjustments, transfers)
- General business management advice

Keep responses concise and actionable. Use markdown formatting when it helps readability.`;
        // Append model profile warnings
        if (modelProfile && modelProfile.textOnlyMode) {
            prompt += `\n\n⚠️ MODEL NOTICE: ${modelProfile.warningMessage || 'This model is running in text-only mode. Tool calling is disabled.'}`;
        }
        else if (modelProfile && modelProfile.warningLevel === 'info') {
            prompt += `\n\nℹ️ MODEL NOTICE: ${modelProfile.warningMessage}`;
        }
        // Append skill context
        if (skillContext) {
            prompt += `\n\n${skillContext}`;
        }
        // Append tool descriptions if orchestrator is available
        if (this.toolOrchestrator) {
            const toolDescriptions = this.toolOrchestrator.getToolDescriptionsForPrompt();
            if (toolDescriptions) {
                prompt += `\n\n${toolDescriptions}`;
            }
        }
        // Append tool result context if data was retrieved
        if (toolContextMessage) {
            prompt += `\n\n${toolContextMessage}`;
        }
        // Append proposal context if a proposal was created
        if (proposalContextMessage) {
            prompt += `\n\n${proposalContextMessage}`;
        }
        return prompt;
    }
    /**
     * Audit an event safely — never throws, never blocks the chat flow.
     */
    auditLogSafe(eventType, meta) {
        if (this.auditService) {
            this.auditService.log(eventType, meta).catch(err => {
                console.warn(`[AI Assistant] Audit log failed for '${eventType}': ${err.message}`);
            });
        }
    }
    /**
     * Format a created proposal into a system message for the AI context.
     * Instructs the AI to explain the proposal and emphasize no ERP data changed.
     */
    formatProposalForContext(proposal, missingInfo) {
        const proposalId = proposal.id || 'unknown';
        const proposalType = proposal.type || 'unknown';
        const proposalTitle = proposal.title || 'Untitled Proposal';
        const proposalStatus = proposal.status || 'draft';
        const riskLevel = proposal.riskLevel || 'low';
        const warnings = proposal.warnings || [];
        const proposedData = proposal.proposedData || {};
        let msg = `[AI PROPOSAL CREATED]\n` +
            `A proposal has been created in the AI Sandbox based on the user's request.\n\n` +
            `Proposal ID: ${proposalId}\n` +
            `Type: ${proposalType}\n` +
            `Title: ${proposalTitle}\n` +
            `Status: ${proposalStatus}\n` +
            `Risk Level: ${riskLevel}\n`;
        if (missingInfo.length > 0) {
            msg += `\nMISSING INFORMATION:\n` +
                missingInfo.map((info) => `- ${info}`).join('\n') + '\n' +
                `Tell the user: "I need additional information to complete this proposal: ${missingInfo.join(', ')}"\n`;
        }
        if (warnings.length > 0) {
            msg += `\nWARNINGS:\n` +
                warnings.map((w) => `- ${w}`).join('\n') + '\n';
        }
        msg += `\nPROPOSED DATA:\n${JSON.stringify(proposedData, null, 2)}\n\n` +
            `CRITICAL RULES FOR YOUR RESPONSE:\n` +
            `1. You MUST say: "I created a reviewable proposal in the AI Sandbox. No ERP data was changed."\n` +
            `2. Explain what the proposal suggests and why.\n` +
            `3. NEVER claim that a real voucher, invoice, journal entry, or any ERP record was created.\n` +
            `4. If there is missing information, tell the user what they need to provide.\n` +
            `5. The user can review this proposal in the AI Proposals section.\n` +
            `6. Accepting a proposal does NOT execute any business action — it only marks it as reviewed.\n` +
            `\n[END AI PROPOSAL]`;
        return msg;
    }
}
exports.SendChatMessageUseCase = SendChatMessageUseCase;
//# sourceMappingURL=SendChatMessageUseCase.js.map