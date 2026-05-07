"use strict";
/**
 * ExecuteAiToolUseCase - Safely executes an AI tool with permission and context checks
 *
 * This use case is the gateway for all AI tool executions:
 * 1. Resolves the tool from the registry
 * 2. Fetches the user's permissions for the company
 * 3. Builds the ToolExecutionContext
 * 4. Delegates to AiToolRegistry.executeTool() which checks permissions
 * 5. Returns the result to the caller (typically SendChatMessageUseCase)
 *
 * SAFETY:
 * - Tools are READ-ONLY — they cannot create, update, delete, post, approve, or reverse
 * - Permission checks are enforced BEFORE tool execution
 * - Company context is enforced — tools only see data for the authenticated company
 * - Invalid tool names return an error, not an exception
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteAiToolUseCase = void 0;
class ExecuteAiToolUseCase {
    constructor(toolRegistry, permissionChecker) {
        this.toolRegistry = toolRegistry;
        this.permissionChecker = permissionChecker;
    }
    async execute(input) {
        const { companyId, userId, toolName, params } = input;
        // Get user permissions for the company
        const permissions = await this.permissionChecker.hasPermission(userId, companyId, '*')
            .then(hasWildcard => {
            if (hasWildcard)
                return ['*'];
            // Fetch actual permissions — we need this for tool permission checking
            return this.getUserPermissions(userId, companyId);
        });
        // Build execution context
        const context = {
            companyId,
            userId,
            permissions,
        };
        // Execute via registry (which handles permission checks)
        return this.toolRegistry.executeTool(toolName, context, params);
    }
    /**
     * Get all permissions for a user in a company.
     * This delegates to the permission checker's underlying use case.
     */
    async getUserPermissions(userId, companyId) {
        // Use the proper public method instead of bypassing encapsulation
        return this.permissionChecker.getAllPermissions(userId, companyId);
    }
}
exports.ExecuteAiToolUseCase = ExecuteAiToolUseCase;
//# sourceMappingURL=ExecuteAiToolUseCase.js.map