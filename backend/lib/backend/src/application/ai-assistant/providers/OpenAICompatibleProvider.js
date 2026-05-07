"use strict";
/**
 * OpenAICompatibleProvider - Provider for OpenAI-compatible APIs
 *
 * This provider supports any OpenAI-compatible endpoint:
 * - OpenAI (api.openai.com)
 * - Azure OpenAI
 * - Local LLM servers (Ollama, LM Studio, etc.)
 *
 * It uses the OpenAI Chat Completions API format (POST /v1/chat/completions)
 * and the Models API for availability checks (GET /v1/models).
 *
 * v2 Extension:
 * - Maps provider-agnostic tool contracts (AiProviderToolContract) to
 *   OpenAI's `tools` parameter format for function/tool calling.
 * - Parses OpenAI `message.tool_calls` responses into provider-agnostic
 *   `AiProviderToolCallRequest` objects.
 * - Handles the case where content is null/empty when tool calls are present.
 * - Never exposes API keys, endpoints, or secrets in responses or metadata.
 *
 * HTTP client is injected via IHttpClient interface for testability.
 *
 * Security:
 * - API keys are NEVER included in error messages, logs, or response metadata
 * - Authorization header is omitted for local providers (Ollama uses 'local-no-key' sentinel)
 * - Error messages are sanitized to prevent information leakage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICompatibleProvider = void 0;
const ProviderErrors_1 = require("../../../errors/ProviderErrors");
class OpenAICompatibleProvider {
    constructor(config, httpClient) {
        var _a, _b;
        this.providerId = 'openai_compatible';
        this.providerName = 'OpenAI-Compatible Provider';
        // Validate required fields
        if (!config.apiEndpoint || typeof config.apiEndpoint !== 'string') {
            throw new Error('API endpoint is required for OpenAI-compatible provider');
        }
        if (!config.model || typeof config.model !== 'string') {
            throw new Error('Model name is required for OpenAI-compatible provider');
        }
        // Validate URL format
        try {
            new URL(config.apiEndpoint);
        }
        catch (_c) {
            throw new Error(`Invalid API endpoint URL`);
        }
        // API key is required for non-local providers
        // 'local-no-key' is a sentinel for local providers like Ollama
        if (!config.apiKey) {
            throw new Error('API key is required for OpenAI-compatible provider');
        }
        this.config = Object.assign({ maxTokens: (_a = config.maxTokens) !== null && _a !== void 0 ? _a : 4096, timeoutMs: (_b = config.timeoutMs) !== null && _b !== void 0 ? _b : 30000 }, config);
        this.httpClient = httpClient;
    }
    getCapabilities() {
        return Object.assign({}, OpenAICompatibleProvider.SUPPORTED_CAPABILITIES);
    }
    async chat(request) {
        var _a, _b, _c, _d;
        const url = this.buildUrl('/chat/completions');
        const isLocalProvider = this.config.apiKey === 'local-no-key';
        const headers = {};
        if (!isLocalProvider) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }
        const requestBody = {
            model: this.config.model,
            messages: request.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            max_tokens: (_a = request.maxTokens) !== null && _a !== void 0 ? _a : this.config.maxTokens,
            temperature: (_b = request.temperature) !== null && _b !== void 0 ? _b : 0.7,
            stream: false,
        };
        // Map provider-agnostic tool contracts to OpenAI tools format
        if (request.tools && request.tools.length > 0) {
            requestBody.tools = this.mapToolsToOpenAIFormat(request.tools);
        }
        let response;
        try {
            const httpResponse = await this.httpClient.request({
                url,
                method: 'POST',
                headers,
                body: requestBody,
                timeoutMs: this.config.timeoutMs,
            });
            response = httpResponse.data;
        }
        catch (error) {
            // Re-throw ProviderErrors as-is (already classified by IHttpClient)
            if (error instanceof ProviderErrors_1.ProviderError) {
                throw error;
            }
            // Wrap unexpected errors — NEVER include API keys or endpoint URLs
            throw new ProviderErrors_1.ProviderError(`Unexpected error from AI provider. Please try again later.`);
        }
        // Validate response structure
        if (!response.choices || response.choices.length === 0) {
            throw new ProviderErrors_1.ProviderError(`AI provider returned an empty response. Please try again or check your model configuration.`);
        }
        const choice = response.choices[0];
        const message = choice.message;
        // Parse tool calls from OpenAI response format
        const toolCalls = this.parseToolCallsFromResponse(message === null || message === void 0 ? void 0 : message.tool_calls);
        // Content may be null/empty when tool calls are present — allow this safely
        const content = (_c = message === null || message === void 0 ? void 0 : message.content) !== null && _c !== void 0 ? _c : null;
        // If both content and tool calls are absent, this is invalid
        if (content === null && (!toolCalls || toolCalls.length === 0)) {
            throw new ProviderErrors_1.ProviderError(`AI provider returned an invalid response format. Model: ${this.config.model}.`);
        }
        // Build runtime metadata (no secrets or API keys)
        const runtimeMeta = {
            modelUsed: response.model || this.config.model,
            capabilities: {
                supportsToolCalling: true,
                allowsEmptyContentWithToolCalls: true,
            },
        };
        if (toolCalls && toolCalls.length > 0) {
            runtimeMeta.warnings = [];
        }
        if (choice.finish_reason === 'length') {
            runtimeMeta.truncated = true;
        }
        return {
            content,
            model: response.model || this.config.model,
            provider: 'openai_compatible',
            tokenCount: (_d = response.usage) === null || _d === void 0 ? void 0 : _d.total_tokens,
            toolCalls,
            runtimeMeta,
            metadata: {
                providerId: 'openai_compatible',
                model: response.model || this.config.model,
                finishReason: choice.finish_reason,
                usage: response.usage ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                } : undefined,
                // NOTE: apiKey, apiEndpoint NEVER included in metadata
            },
        };
    }
    async isAvailable() {
        const url = this.buildUrl('/models');
        const isLocalProvider = this.config.apiKey === 'local-no-key';
        const headers = {};
        if (!isLocalProvider) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        try {
            const response = await this.httpClient.request({
                url,
                method: 'GET',
                headers,
                timeoutMs: 5000, // Short timeout for health checks
            });
            // If we got a successful response, the provider is available
            return response.status >= 200 && response.status < 300;
        }
        catch (_a) {
            // If the models endpoint fails, the provider might still be available
            // (some providers don't implement it). Fall back to config check.
            return !!(this.config.apiKey && this.config.apiEndpoint && this.config.model);
        }
    }
    /** Update configuration (e.g., when company changes their BYOK settings) */
    updateConfig(config) {
        this.config = Object.assign(Object.assign({}, this.config), config);
    }
    /**
     * Map provider-agnostic tool contracts to OpenAI function/tool calling format.
     *
     * OpenAI format:
     * {
     *   type: 'function',
     *   function: {
     *     name: string,
     *     description: string,
     *     parameters: { ... JSON Schema ... }
     *   }
     * }
     *
     * Note: We include moduleId in the description prefix so the model
     * can make better routing decisions, but we never include
     * requiredPermissions or internal implementation details.
     */
    mapToolsToOpenAIFormat(tools) {
        return tools.map(tool => {
            // Prefix description with operation type context for better model routing
            const enrichedDescription = this.buildToolDescription(tool);
            return {
                type: 'function',
                function: {
                    name: tool.name,
                    description: enrichedDescription,
                    parameters: tool.parameters,
                },
            };
        });
    }
    /**
     * Build an enriched tool description that includes safety context
     * without exposing internal implementation details.
     */
    buildToolDescription(tool) {
        const parts = [];
        // Module context
        parts.push(`[${tool.moduleId}]`);
        // Operation type context — helps the model understand what this tool does
        if (tool.operationType === 'READ') {
            parts.push('Read-only data retrieval.');
        }
        else if (tool.operationType === 'PROPOSAL') {
            parts.push('Creates a reviewable proposal. No data is changed.');
        }
        else if (tool.operationType === 'DRAFT') {
            parts.push('Creates a draft for human review. No data is changed.');
        }
        else {
            // CREATE/UPDATE/DELETE/POST/APPROVE — these should never be exposed
            // to AI in production, but if they are, clearly mark them as blocked.
            parts.push('BLOCKED: This operation requires human approval and cannot be performed by AI.');
        }
        parts.push(tool.description);
        // Required permissions hint (without exposing internal permission strings)
        if (tool.requiredPermissions.length > 0) {
            parts.push(`Requires ${tool.requiredPermissions.length} permission(s).`);
        }
        return parts.join(' ');
    }
    /**
     * Parse OpenAI tool calls from the response into provider-agnostic format.
     *
     * OpenAI returns tool_calls as:
     * [
     *   {
     *     id: 'call_abc123',
     *     type: 'function',
     *     function: {
     *       name: 'function_name',
     *       arguments: '{"arg1": "value1"}' // JSON string
     *     }
     *   }
     * ]
     *
     * We parse the arguments JSON string into a proper object.
     * If parsing fails, we skip the tool call and log a warning.
     */
    parseToolCallsFromResponse(toolCalls) {
        if (!toolCalls || toolCalls.length === 0) {
            return undefined;
        }
        const parsed = [];
        for (const tc of toolCalls) {
            try {
                const args = JSON.parse(tc.function.arguments);
                parsed.push({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: args,
                });
            }
            catch (_a) {
                // If arguments can't be parsed, include with empty object
                // rather than dropping the tool call entirely
                console.warn(`[AI Assistant] Failed to parse tool call arguments for '${tc.function.name}'. Arguments omitted from logs for safety.`);
                parsed.push({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: {},
                });
            }
        }
        return parsed.length > 0 ? parsed : undefined;
    }
    /**
     * Build the full URL from the base endpoint and path.
     * Ensures no double slashes.
     */
    buildUrl(path) {
        const base = this.config.apiEndpoint.replace(/\/+$/, '');
        return `${base}${path}`;
    }
}
exports.OpenAICompatibleProvider = OpenAICompatibleProvider;
OpenAICompatibleProvider.SUPPORTED_CAPABILITIES = {
    supportsToolCalling: true,
    supportsStructuredOutput: true,
    maxToolCallsPerRequest: 0,
    allowsEmptyContentWithToolCalls: true,
};
//# sourceMappingURL=OpenAICompatibleProvider.js.map