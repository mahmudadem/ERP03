"use strict";
/**
 * AiTool - Domain Interface for AI Assistant Tools
 *
 * AI tools give the assistant read-only access to business data.
 * They are the ONLY way the AI can access real ERP data.
 *
 * DESIGN PRINCIPLES:
 * 1. ALL tools are READ-ONLY — they must never create, update, delete,
 *    approve, post, or reverse anything. This is enforced by:
 *    - The tool interface only has an `execute` method that returns data
 *    - The ExecuteAiToolUseCase checks permissions and company context
 *    - Tools cannot call mutating use cases
 *
 * 2. Tools are permission-gated — each tool requires a specific permission.
 *    If the user doesn't have the permission, the tool returns an error.
 *
 * 3. Tools are company-scoped — they only see data for the user's company.
 *
 * 4. Tool results are sanitized DTOs — raw domain entities are never
 *    returned to the AI. Only summary/DTO data is exposed.
 *
 * 5. Tools are registered in AiToolRegistry — the AI decides which
 *    tool to call based on the user's question.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=AiTool.js.map