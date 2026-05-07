"use strict";
/**
 * IHttpClient - HTTP client abstraction for external API calls
 *
 * Clean Architecture boundary: The application layer depends on this interface,
 * not on any specific HTTP library. This keeps transport details
 * in the infrastructure layer where they belong.
 *
 * Primary use: AI provider HTTP calls (OpenAI, Ollama, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IHttpClient.js.map