/**
 * AiContextBuilder - Builds AI prompt context, conversation budgets, and proposals
 *
 * Handles:
 * - System prompt construction with tool context, skill context, model profile warnings
 * - Recent tool data context building from conversation history
 * - Conversation context budget resolution (minimal/balanced/deep)
 * - Proposal formatting for AI context
 * - Token estimation for context window overflow guard
 *
 * DESIGN PRINCIPLES:
 * - No Firestore-specific code in this layer
 * - All methods are pure or depend on injected services only
 * - Model profile warnings are appended to system prompt to inform the user
 */

import { AiChatMessage } from '../../../domain/ai-assistant/entities/AiChatMessage';
import { AiProviderConfig, AiConversationContextMode } from '../../../domain/ai-assistant/entities/AiProviderConfig';
import { AiModelProfile } from './AiModelCapabilityCatalog';
import { AiToolCallingOrchestrator } from './AiToolCallingOrchestrator';

export interface ConversationContextBudget {
  fetchMessageLimit: number;
  providerHistoryMessageLimit: number;
  providerHistoryMessageCharLimit: number;
  recentToolResultLimit: number;
  recentToolResultCharLimit: number;
  recentToolContextTotalCharLimit: number;
  includePreviousToolResults: boolean;
}

export interface RecentToolDataContextResult {
  content: string;
  wasTruncated: boolean;
}

export interface BuildSystemPromptParams {
  toolContextMessage?: string | null;
  proposalContextMessage?: string | null;
  skillContext?: string;
  modelProfile?: AiModelProfile;
  toolPlanningContextMessage?: string;
  recentToolDataContextMessage?: string;
  skipToolDescriptions?: boolean;
  tenantContextMessage?: string;
  /**
   * True when the runtime stripped all tools (text-only mode, routing-guard
   * block, or empty allowed-contracts list). The system prompt then injects
   * an explicit no-tools block telling the model it MUST NOT emit any
   * tool-call-shaped output (no <tool_code>, <tool_output>, <tool_result>,
   * no synthetic JSON tool responses, no `print(...)` of fake values).
   */
  noToolsAvailable?: boolean;
}

const CONVERSATION_CONTEXT_BUDGETS: Record<AiConversationContextMode, Omit<ConversationContextBudget, 'includePreviousToolResults'>> = {
  minimal: {
    fetchMessageLimit: 6,
    providerHistoryMessageLimit: 2,
    providerHistoryMessageCharLimit: 600,
    recentToolResultLimit: 1,
    recentToolResultCharLimit: 800,
    recentToolContextTotalCharLimit: 1200,
  },
  balanced: {
    fetchMessageLimit: 12,
    providerHistoryMessageLimit: 6,
    providerHistoryMessageCharLimit: 1000,
    recentToolResultLimit: 3,
    recentToolResultCharLimit: 1200,
    recentToolContextTotalCharLimit: 3600,
  },
  deep: {
    fetchMessageLimit: 24,
    providerHistoryMessageLimit: 12,
    providerHistoryMessageCharLimit: 2000,
    recentToolResultLimit: 8,
    recentToolResultCharLimit: 3000,
    recentToolContextTotalCharLimit: 12000,
  },
};

export class AiContextBuilder {
  constructor(
    private toolOrchestrator?: AiToolCallingOrchestrator,
  ) {}

  /**
   * System prompt that enforces AI safety rules.
   * This is ALWAYS prepended to the conversation, ensuring the AI
   * understands its advisory-only role regardless of provider.
   *
   * Stage 2: Includes skill context and model profile warnings.
   */
  buildSystemPrompt(params: BuildSystemPromptParams): string {
    const {
      toolContextMessage,
      proposalContextMessage,
      skillContext,
      modelProfile,
      toolPlanningContextMessage,
      recentToolDataContextMessage,
      skipToolDescriptions,
      noToolsAvailable,
      tenantContextMessage,
    } = params;

    const todayISO = new Date().toISOString().split('T')[0];

    let prompt = `You are the AI Assistant for an ERP system. Your role is STRICTLY advisory.

CURRENT DATE: ${todayISO}
Use this date for any "today", "this month", "this week", "this year" references. When calling tools with date parameters, always derive dates from this value — never guess or use your training data cutoff.

RULES YOU MUST FOLLOW:
1. You may ONLY answer, explain, validate, summarize, or suggest drafts.
2. You may NOT create, update, delete, approve, post, or modify any business records.
3. Any real business action (creating invoices, posting vouchers, adjusting inventory, etc.) MUST go through the standard ERP module workflows with explicit user approval.
4. For accounting, voucher, payment, and inventory questions — always advise the user to use the proper module for actual transactions.
5. Never provide API endpoints or direct database operations.
6. If a user asks you to perform an action, explain HOW to do it in the ERP UI instead of doing it yourself.

CONVERSATION CONTEXT FIRST:
7. Treat every user message as part of one ongoing conversation, not a fresh isolated request.
8. Before answering or calling tools, review the current user message, recent conversation history, and previous tool results.
9. If the user's intent is ambiguous after reviewing context, ask a short clarification question before answering or using tools.
10. If existing conversation context or previously fetched tool data is sufficient, answer from it without asking the user again and without calling another tool.
11. If the intent is clear but more ERP data is needed, request the minimum necessary read-only tools, then answer from the combined context.
12. Ask the user for extra information only when that information is truly missing, contradictory, or ambiguous and cannot be safely inferred from context or fetched with an appropriate read-only tool.

CRITICAL: NEVER FABRICATE DATA
13. If no tool data is provided in this conversation, you MUST NOT invent, estimate, or fabricate any financial figures, account balances, invoice amounts, stock quantities, or other business data.
14. If you do not have real data from a tool result, say clearly: "I don't have that data available right now. Please check the [relevant module] screen in the ERP for the most accurate information."
15. NEVER present guessed or hallucinated numbers as if they came from the system. Zero data is better than wrong data.
16. If a tool returns empty, zero, or unexpected results, present the data exactly as returned and suggest the user verify in the ERP module.

You are helpful, professional, and knowledgeable about business processes including:
- Accounting (chart of accounts, journal entries, financial reports)
- Sales (invoices, orders, delivery notes, returns)
- Purchases (purchase orders, goods receipts, purchase invoices, returns)
- Inventory (stock levels, movements, adjustments, transfers)
- General business management advice

17. Always respond in the SAME LANGUAGE that the user writes in. If the user writes in Arabic, respond in Arabic. If in Turkish, respond in Turkish. If in English, respond in English. Match the user's language exactly.

Keep responses concise and actionable. Use markdown formatting when it helps readability.`;

    // Append tenant context (company, user, currency, locale)
    if (tenantContextMessage) {
      prompt += `\n\n${tenantContextMessage}`;
    }

    // Append model profile warnings
    if (modelProfile && modelProfile.textOnlyMode) {
      prompt += `\n\n⚠️ MODEL NOTICE: ${modelProfile.warningMessage || 'This model is running in text-only mode. Tool calling is disabled.'}`;
    } else if (modelProfile && modelProfile.warningLevel === 'info') {
      prompt += `\n\nℹ️ MODEL NOTICE: ${modelProfile.warningMessage}`;
    }

    // When no tools are available we explicitly forbid the model from cosplaying
    // tool calls. Small / uncertified models otherwise hallucinate
    // <tool_code>…</tool_code> and <tool_output>…</tool_output> blocks with
    // fabricated values, which look like real ERP data to the user.
    if (noToolsAvailable) {
      prompt += `

🚫 NO ERP TOOLS ARE AVAILABLE IN THIS TURN.
You do NOT have access to any ERP tools (no accounting.*, no sales.*, no inventory.*, no purchases.*). You cannot read, compute, or fetch any real business data.

ABSOLUTELY FORBIDDEN in your reply:
- Do NOT write <tool_code>, <tool_output>, <tool_result>, <tool_call>, or any XML / pseudo-XML block that looks like a tool call.
- Do NOT print fake JSON that looks like a tool response (no transactions arrays, no opening_balance / closing_balance / debit / credit, no account names with numbers).
- Do NOT invent account codes, balances, customer names, invoice numbers, stock quantities, dates, or any other business value.
- Do NOT say "the system returned" / "the tool returned" / "according to the database" — no tool ran.

REQUIRED behavior:
- Tell the user plainly: "I cannot access your ERP data right now." Then explain why in one short sentence (no certified model, model in text-only mode, or AI is paused).
- Recommend the relevant ERP module screen where the user can see the real value.
- If they ask "why" — refer them to AI Settings → Certification Manager.

If you violate any of these rules, your reply will be discarded and the user will be told the model misbehaved.`;
    }

    // Append skill context
    if (skillContext) {
      prompt += `\n\n${skillContext}`;
    }

    // Append recent tool-result memory before planning context so the model
    // can decide whether the current turn already has enough fetched data.
    if (recentToolDataContextMessage) {
      prompt += `\n\n${recentToolDataContextMessage}`;
    }

    // Append schema-aware tool planning context when tools are available.
    if (toolPlanningContextMessage) {
      prompt += `\n\n${toolPlanningContextMessage}`;
    }

    // Fallback: append simple descriptions when no schema-aware context exists.
    // Skip tool descriptions entirely in lightweight mode (simple chat).
    if (!skipToolDescriptions && this.toolOrchestrator && !toolPlanningContextMessage) {
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
   * Build compact context from tool results fetched in recent turns.
   */
  buildRecentToolDataContext(
    recentMessages: AiChatMessage[],
    contextBudget: ConversationContextBudget,
  ): RecentToolDataContextResult {
    if (!contextBudget.includePreviousToolResults) {
      return { content: '', wasTruncated: false };
    }

    const sections: string[] = [];
    let totalChars = 0;
    let wasTruncated = false;
    const messagesNewestFirst = [...recentMessages].reverse();

    scan:
    for (const message of messagesNewestFirst) {
      const metadata = message.metadata;
      const toolResults = Array.isArray(metadata?.toolResults)
        ? metadata.toolResults as Array<Record<string, unknown>>
        : [];

      for (const rawToolResult of [...toolResults].reverse()) {
        if (sections.length >= contextBudget.recentToolResultLimit) {
          wasTruncated = true;
          break scan;
        }

        const toolName = String(rawToolResult.toolName || 'unknown');
        const result = rawToolResult.result as Record<string, unknown> | undefined;
        const success = result?.success === true;
        const data = result?.data;

        if (!success || data === undefined || data === null) {
          continue;
        }

        const serialized = this.stringifyForPrompt(data, contextBudget.recentToolResultCharLimit);
        if (serialized.wasTruncated) {
          wasTruncated = true;
        }

        const section =
          `[PREVIOUS TOOL RESULT: ${toolName}]\n` +
          `${serialized.text}\n` +
          `[END PREVIOUS TOOL RESULT: ${toolName}]`;

        if (totalChars + section.length > contextBudget.recentToolContextTotalCharLimit) {
          wasTruncated = true;
          break scan;
        }

        sections.push(section);
        totalChars += section.length;
      }
    }

    if (sections.length === 0) {
      return { content: '', wasTruncated };
    }

    const content = `[RECENT ERP DATA FROM THIS CONVERSATION]\n` +
      `The data below was fetched EARLIER in this same conversation by a different assistant or tool. It is read-only ERP data for your internal reasoning.\n` +
      `Only the most recent relevant tool results are included to control token cost.\n\n` +
      `CONTEXT RULES:\n` +
      `1. Use this data to understand the user's intent, but DO NOT repeat the raw JSON or internal system tags like <tool_call> or <tool_response> in your response.\n` +
      `2. If this data already answers the user's question, provide a natural language summary. Do not fetch it again.\n` +
      `3. If you are currently in "Low Trust" or "Uncertified" mode (see MODEL NOTICE above), you cannot call new tools. Answer only from this history or explain that you lack access.\n` +
      `4. NEVER present this data as if you just fetched it right now. Treat it as historical context.\n` +
      `5. Match the user's requested format (e.g. table, bullet points) but use standard markdown, not internal tags.\n\n` +
      `${sections.reverse().join('\n\n')}\n` +
      `[END RECENT ERP DATA FROM THIS CONVERSATION]`;

    return { content, wasTruncated };
  }

  /**
   * Resolve the conversation context budget based on the provider config mode.
   */
  resolveConversationContextBudget(config: AiProviderConfig): ConversationContextBudget {
    const mode = config.conversationContextMode || 'balanced';
    const base = CONVERSATION_CONTEXT_BUDGETS[mode] || CONVERSATION_CONTEXT_BUDGETS.balanced;

    return {
      ...base,
      includePreviousToolResults: config.includePreviousToolResults !== false,
    };
  }

  /**
   * Format a created proposal into a system message for the AI context.
   * Instructs the AI to explain the proposal and emphasize no ERP data changed.
   */
  formatProposalForContext(
    proposal: Record<string, unknown>,
    missingInfo: string[],
  ): string {
    const proposalId = (proposal as any).id || 'unknown';
    const proposalType = (proposal as any).type || 'unknown';
    const proposalTitle = (proposal as any).title || 'Untitled Proposal';
    const proposalStatus = (proposal as any).status || 'draft';
    const riskLevel = (proposal as any).riskLevel || 'low';
    const warnings = (proposal as any).warnings || [];
    const proposedData = (proposal as any).proposedData || {};

    let msg = `[AI PROPOSAL CREATED]\n` +
      `A proposal has been created in the AI Sandbox based on the user's request.\n\n` +
      `Proposal ID: ${proposalId}\n` +
      `Type: ${proposalType}\n` +
      `Title: ${proposalTitle}\n` +
      `Status: ${proposalStatus}\n` +
      `Risk Level: ${riskLevel}\n`;

    if (missingInfo.length > 0) {
      msg += `\nMISSING INFORMATION:\n` +
        missingInfo.map((info: string) => `- ${info}`).join('\n') + '\n' +
        `Tell the user: "I need additional information to complete this proposal: ${missingInfo.join(', ')}"\n`;
    }

    if (warnings.length > 0) {
      msg += `\nWARNINGS:\n` +
        warnings.map((w: string) => `- ${w}`).join('\n') + '\n';
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

  /**
   * Rough token estimation: ~3.5 chars per token for mixed English/code content.
   * This is a safety guard, not a precise counter.
   */
  static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  private stringifyForPrompt(value: unknown, maxChars: number): { text: string; wasTruncated: boolean } {
    let text: string;
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }

    if (text.length <= maxChars) {
      return { text, wasTruncated: false };
    }

    return {
      text: `${text.slice(0, maxChars)}\n[truncated to control AI token cost]`,
      wasTruncated: true,
    };
  }

  /**
   * Truncate a string for prompt inclusion.
   * Public — used by SendChatMessageUseCase for trimming provider history messages.
   */
  truncateForPrompt(value: string, maxChars: number): { text: string; wasTruncated: boolean } {
    if (value.length <= maxChars) {
      return { text: value, wasTruncated: false };
    }

    return {
      text: `${value.slice(0, maxChars)}\n[truncated to control AI token cost]`,
      wasTruncated: true,
    };
  }
}