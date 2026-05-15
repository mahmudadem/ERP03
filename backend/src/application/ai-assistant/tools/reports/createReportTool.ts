import { AiTool, AiToolResult, ToolExecutionContext } from '../../../../domain/ai-assistant/tools/AiTool';
import { ReportDefinition } from '../../../../domain/reports/ReportDefinition';
import { ReportRunner } from '../../../reports/ReportRunner';

export function createReportToolClass(
  definition: ReportDefinition,
  toolName: string,
  toolDescription: string,
): new (runner: ReportRunner) => AiTool {
  return class implements AiTool {
    readonly name = toolName;
    readonly description = toolDescription;
    readonly requiredPermission = definition.permission;
    readonly module = definition.moduleId;

    constructor(private runner: ReportRunner) {}

    async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
      try {
        const result = await this.runner.run(definition, context.companyId, context.userId, params || {});
        return { success: true, data: result as unknown as Record<string, unknown> };
      } catch (error) {
        const message = (error as Error).message;
        const isMissingParam = message.includes('required') || message.includes('Ask the user');
        return {
          success: false,
          data: null,
          error: message,
          errorCode: isMissingParam ? 'MISSING_PARAMETER' : 'TOOL_EXECUTION_ERROR',
        };
      }
    }
  };
}
