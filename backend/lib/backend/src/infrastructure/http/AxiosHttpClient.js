"use strict";
/**
 * AxiosHttpClient - HTTP client implementation using axios
 *
 * Handles all HTTP communication with external AI providers.
 * Maps axios errors to domain-specific error types with safe messages
 * (no API key leaks).
 *
 * Features:
 * - Configurable timeout per request (defaults to 30s)
 * - Safe error messages (strips API keys, tokens from URLs)
 * - Proper header management (Authorization, Content-Type)
 * - Network error classification (unreachable, auth, rate limit, server error)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiosHttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const ProviderErrors_1 = require("../../errors/ProviderErrors");
class AxiosHttpClient {
    async request(config) {
        var _a, _b;
        const axiosConfig = {
            url: config.url,
            method: config.method,
            headers: Object.assign({ 'Content-Type': 'application/json' }, config.headers),
            data: config.body,
            timeout: (_a = config.timeoutMs) !== null && _a !== void 0 ? _a : 30000,
            validateStatus: () => true, // Don't throw on any status — we handle errors ourselves
        };
        try {
            const response = await (0, axios_1.default)(axiosConfig);
            // Success status codes
            if (response.status >= 200 && response.status < 300) {
                return {
                    data: response.data,
                    status: response.status,
                    headers: response.headers,
                };
            }
            // Error status codes — classify and throw
            throw this.classifyHttpError(response.status, response.data, config.url);
        }
        catch (error) {
            if (error instanceof ProviderErrors_1.ProviderError) {
                throw error;
            }
            // Axios/network errors
            if (axios_1.default.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
                    throw new ProviderErrors_1.ProviderUnavailableError(`AI provider request timed out after ${(_b = config.timeoutMs) !== null && _b !== void 0 ? _b : 30000}ms. ` +
                        `Please check your network connection and provider endpoint.`);
                }
                if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ERR_NETWORK') {
                    throw new ProviderErrors_1.ProviderUnavailableError(`Could not reach AI provider at ${this.sanitizeUrl(config.url)}. ` +
                        `Please verify the endpoint URL and network connectivity.`);
                }
                // Response received but status already handled above — shouldn't normally reach here
                if (error.response) {
                    throw this.classifyHttpError(error.response.status, error.response.data, config.url);
                }
                throw new ProviderErrors_1.ProviderUnavailableError(`Network error communicating with AI provider. Please try again later.`);
            }
            // Unknown errors
            throw new ProviderErrors_1.ProviderUnavailableError(`Unexpected error communicating with AI provider. Please try again later.`);
        }
    }
    classifyHttpError(status, data, url) {
        let errorMessage;
        if (typeof data === 'object' && data !== null) {
            const d = data;
            if (typeof d.error === 'string') {
                errorMessage = d.error;
            }
            else if (typeof d.error === 'object' && d.error !== null && typeof d.error.message === 'string') {
                errorMessage = d.error.message;
            }
            else if (typeof d.message === 'string') {
                errorMessage = d.message;
            }
            else {
                errorMessage = `Provider returned status ${status}`;
            }
        }
        else {
            errorMessage = `Provider returned status ${status}`;
        }
        switch (status) {
            case 401:
                return new ProviderErrors_1.ProviderAuthError('Authentication failed. Please check your API key in AI Assistant settings.');
            case 403:
                return new ProviderErrors_1.ProviderAuthError('Access denied. Your API key does not have permission to use this model or endpoint.');
            case 429:
                return new ProviderErrors_1.ProviderRateLimitError('AI provider rate limit exceeded. Please wait a moment before trying again.');
            default:
                if (status >= 500) {
                    return new ProviderErrors_1.ProviderUnavailableError(`AI provider server error (${status}). Please try again later.`);
                }
                return new ProviderErrors_1.ProviderError(`AI provider error (${status}): ${errorMessage}`);
        }
    }
    /**
     * Sanitize URL for error messages — remove any path segments
     * that might reveal internal structure or contain tokens.
     */
    sanitizeUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}`;
        }
        catch (_a) {
            return '[invalid-url]';
        }
    }
}
exports.AxiosHttpClient = AxiosHttpClient;
//# sourceMappingURL=AxiosHttpClient.js.map