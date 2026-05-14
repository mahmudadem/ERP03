/**
 * MockProvider - Default AI provider for local development
 *
 * Returns contextual mock responses that echo the user's message.
 * This allows development and testing without any external API keys.
 *
 * v2 Extension:
 * - Supports tool contracts in requests (added to request type, but mock
 *   does not execute them).
 * - If tools are present in the request, includes runtime metadata
 *   indicating mock text-only behavior and tool availability.
 * - Never includes tool calls in responses (mock is text-only).
 * - Response content may be null if tool calls were expected but mock
 *   cannot produce them — the caller should handle this gracefully.
 *
 * Safety: MockProvider responses are clearly labeled as mock/placeholder
 * and cannot mutate any business records.
 */

import {
  IAiProvider,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderCapabilities,
  AiProviderRuntimeMeta,
} from './IAiProvider';

export class MockProvider implements IAiProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock AI Provider';

  private static readonly CAPABILITIES: AiProviderCapabilities = {
    supportsToolCalling: false,
    supportsStructuredOutput: false,
    maxToolCallsPerRequest: 0,
    allowsEmptyContentWithToolCalls: false,
  };

  private static readonly MOCK_SYSTEM_PREFIX =
    '[Mock AI Assistant — this is a simulated response for development. ' +
    'No real AI is being used.]\n\n';

  private static readonly SAFETY_SUFFIX =
    '\n\n---\n*Note: The AI Assistant is advisory-only and cannot create, ' +
    'modify, approve, or delete any business records.*';

  getCapabilities(): AiProviderCapabilities {
    return { ...MockProvider.CAPABILITIES };
  }

  async chat(request: AiProviderRequest): Promise<AiProviderResponse> {
    // Simulate a small processing delay for realism
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();

    const userContent = lastUserMessage?.content || 'Hello';

    // Generate a contextual mock response
    const mockResponse = this.generateMockResponse(userContent);

    // Build runtime metadata
    const runtimeMeta: AiProviderRuntimeMeta = {
      modelUsed: 'mock-assistant',
      capabilities: {
        supportsToolCalling: false,
        allowsEmptyContentWithToolCalls: false,
      },
    };

    // If tools were provided, note that mock cannot use them
    if (request.tools && request.tools.length > 0) {
      runtimeMeta.warnings = [
        `Mock provider does not support tool calling. ` +
        `${request.tools.length} tool(s) were provided but will not be invoked. ` +
        `Use a real provider (OpenAI, etc.) for tool calling support.`,
      ];
    }

    return {
      content: MockProvider.MOCK_SYSTEM_PREFIX + mockResponse + MockProvider.SAFETY_SUFFIX,
      model: 'mock-assistant',
      provider: 'mock',
      tokenCount: Math.ceil(userContent.length / 4) + Math.ceil(mockResponse.length / 4),
      // Mock provider never returns tool calls
      toolCalls: undefined,
      runtimeMeta,
      metadata: {
        isMock: true,
        simulatedAt: new Date().toISOString(),
        toolsProvided: request.tools?.length ?? 0,
        // NOTE: No tool call results — mock is text-only
      },
    };
  }

  async *chatStream(request: AiProviderRequest): AsyncGenerator<{ type: 'token'; content: string } | { type: 'done'; metadata: any }> {
    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();

    const userContent = lastUserMessage?.content || 'Hello';
    const mockResponse = this.generateMockResponse(userContent);
    const fullText = MockProvider.MOCK_SYSTEM_PREFIX + mockResponse + MockProvider.SAFETY_SUFFIX;

    // Simulate word-by-word streaming
    const words = fullText.split(' ');
    for (const word of words) {
      yield { type: 'token', content: word + ' ' };
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
    }

    yield {
      type: 'done',
      metadata: {
        model: 'mock-assistant',
        provider: 'mock',
        runtimeMeta: {
          modelUsed: 'mock-assistant',
          capabilities: {
            supportsToolCalling: false,
            allowsEmptyContentWithToolCalls: false,
          },
        },
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Mock provider is always available
  }

  /**
   * Generate a contextual mock response based on the user's message keywords.
   * This makes mock responses feel realistic for development testing.
   */
  private generateMockResponse(userInput: string): string {
    const input = userInput.toLowerCase();

    if (input.includes('invoice') || input.includes('sales')) {
      return `I can help you with invoices and sales questions. Here's a summary of what I can assist with:\n\n` +
        `• **Sales Invoices**: I can explain how to create, post, or review sales invoices.\n` +
        `• **Customer Balances**: I can help you understand outstanding balances and payment statuses.\n` +
        `• **Reporting**: I can summarize invoice data for review.\n\n` +
        `To take any actual action (creating, posting, modifying invoices), you'll need to use the standard Sales module workflows.`;
    }

    if (input.includes('account') || input.includes('chart') || input.includes('ledger')) {
      return `I can help with accounting questions. Here's what I can do:\n\n` +
        `• **Chart of Accounts**: Explain the account structure and hierarchy.\n` +
        `• **Journal Entries**: Guide you through creating proper journal entries.\n` +
        `• **Financial Reports**: Summarize trial balance, P&L, or balance sheet data.\n\n` +
        `I can only advise and explain — for actual postings, please use the Accounting module.`;
    }

    if (input.includes('inventory') || input.includes('stock') || input.includes('warehouse')) {
      return `I can help with inventory management questions:\n\n` +
        `• **Stock Levels**: Explain current stock status and movements.\n` +
        `• **Adjustments**: Guide you through stock adjustment procedures.\n` +
        `• **Transfers**: Explain how warehouse transfers work.\n\n` +
        `Actual stock operations need to be performed through the Inventory module.`;
    }

    if (input.includes('purchase') || input.includes('vendor') || input.includes('supplier')) {
      return `I can help with purchase-related questions:\n\n` +
        `• **Purchase Orders**: Explain the PO workflow.\n` +
        `• **Goods Receipts**: Clarify how GRNs connect to invoices.\n` +
        `• **Vendor Balances**: Help understand payables and payment status.\n\n` +
        `To create or modify purchase documents, use the Purchases module.`;
    }

    if (input.includes('report') || input.includes('summary') || input.includes('dashboard')) {
      return `I can help you understand your business reports:\n\n` +
        `• **Financial Reports**: Trial balance, P&L, balance sheet summaries.\n` +
        `• **Sales Reports**: Revenue breakdown and customer analysis.\n` +
        `• **Inventory Reports**: Stock levels and movement summaries.\n\n` +
        `For actual report generation, please use the Reports section in the relevant module.`;
    }

    // Default contextual response
    return `I received your message: "${userInput.substring(0, 100)}${userInput.length > 100 ? '...' : ''}"\n\n` +
      `I'm your AI Assistant running in mock mode. I can help you with:\n` +
      `• Explaining how ERP features work\n` +
      `• Summarizing data and reports\n` +
      `• Suggesting workflows and best practices\n` +
      `• Validating inputs before submission\n\n` +
      `I can only **advise and inform** — I cannot create, modify, approve, or delete any business records.\n\n` +
      `What would you like to know more about?`;
  }
}