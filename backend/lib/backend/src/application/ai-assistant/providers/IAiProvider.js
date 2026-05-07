"use strict";
/**
 * IAiProvider - Provider Abstraction Interface
 *
 * Clean Architecture boundary: No provider-specific code in controllers or use cases.
 * All AI provider communication goes through this interface.
 *
 * The provider layer is designed to support future strategies:
 * - Mock provider for development
 * - OpenAI-compatible external providers
 * - Local providers (Ollama, etc.)
 * - System-level provider keys
 * - BYOK (Bring Your Own Key) per company
 * - Local endpoint mode
 *
 * v2 Extension:
 * - Provider-agnostic tool call contracts allow the system to expose
 *   tool definitions to providers and receive structured tool call
 *   requests in responses.
 * - Tools are optional; providers that don't support function/tool calling
 *   simply ignore them and respond with text only.
 * - Tool calls in responses are optional; not all provider responses
 *   will include tool calls.
 *
 * AI Safety Rule:
 * The provider MUST NOT directly mutate business records.
 * AI responses are advisory-only: they may answer, explain,
 * validate, summarize, or suggest drafts — but any real
 * business action must go through existing backend use cases
 * with explicit user approval.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IAiProvider.js.map