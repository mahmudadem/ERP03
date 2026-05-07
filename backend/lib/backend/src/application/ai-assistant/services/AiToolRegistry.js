"use strict";
/**
 * AiToolRegistry - Central registry for AI Assistant tools
 *
 * All AI tools are registered here. The registry provides:
 * - Tool lookup by name
 * - Listing available tools (for AI context/system prompt)
 * - Module-scoped tool queries
 *
 * Tools are registered during DI setup and remain immutable at runtime.
 * Only READ-ONLY tools are allowed — see AiTool interface for rules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolRegistry = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class AiToolRegistry {
    constructor(tools = []) {
        this.tools = new Map();
        for (const tool of tools) {
            this.register(tool);
        }
    }
    /**
     * Register a tool. Throws if a tool with the same name is already registered.
     */
    register(tool) {
        if (this.tools.has(tool.name)) {
            throw new Error(`AI tool '${tool.name}' is already registered`);
        }
        this.tools.set(tool.name, tool);
    }
    /**
     * Get a tool by name. Returns undefined if not found.
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * Get all registered tools.
     */
    getAll() {
        return Array.from(this.tools.values());
    }
    /**
     * Get tools by module.
     */
    getByModule(module) {
        return this.getAll().filter(t => t.module === module);
    }
    /**
     * Get descriptions of all tools for AI context (system prompt).
     * Returns sanitized descriptions without exposing internal IDs or implementation details.
     */
    getToolDescriptions() {
        return this.getAll().map(t => ({
            name: t.name,
            description: t.description,
            module: t.module,
        }));
    }
    /**
     * Execute a tool by name with permission and context checks.
     * This is the ONLY way to execute a tool safely.
     */
    async executeTool(toolName, context, params) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return {
                success: false,
                data: null,
                error: `Unknown tool: '${toolName}'. Available tools: ${this.getAll().map(t => t.name).join(', ')}`,
                errorCode: 'UNKNOWN_TOOL',
            };
        }
        // Check permission
        const hasPermission = context.permissions.some(perm => {
            if (perm === '*')
                return true;
            if (perm === tool.requiredPermission)
                return true;
            // Parent permission check: 'accounting.reports' grants 'accounting.reports.trialBalance.view'
            if (tool.requiredPermission.startsWith(perm + '.'))
                return true;
            return false;
        });
        if (!hasPermission) {
            return {
                success: false,
                data: null,
                error: `Permission denied: '${tool.requiredPermission}' is required to use the '${tool.name}' tool.`,
                errorCode: 'PERMISSION_DENIED',
            };
        }
        try {
            return await tool.execute(context, params);
        }
        catch (error) {
            if (error instanceof ApiError_1.ApiError) {
                return {
                    success: false,
                    data: null,
                    error: error.message,
                    errorCode: error.code,
                };
            }
            return {
                success: false,
                data: null,
                error: `Tool execution failed: ${error.message}`,
                errorCode: 'TOOL_EXECUTION_ERROR',
            };
        }
    }
}
exports.AiToolRegistry = AiToolRegistry;
//# sourceMappingURL=AiToolRegistry.js.map