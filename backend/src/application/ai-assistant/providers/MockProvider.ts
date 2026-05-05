/**
 * MockProvider - Default AI provider for local development
 *
 * Returns contextual mock responses that echo the user's message.
 * This allows development and testing without any external API keys.
 *
 * Safety: MockProvider responses are clearly labeled as mock/placeholder
 * and cannot mutate any business records.
 */

import { IAiProvider, AiProviderRequest, AiProviderResponse } from './IAiProvider';

export class MockProvider implements IAiProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock AI Provider';

  private static readonly MOCK_SYSTEM_PREFIX = 
    '[Mock AI Assistant — this is a simulated response for development. ' +
    'No real AI is being used.]\n\n';

  private static readonly SAFETY_SUFFIX = 
    '\n\n---\n*Note: The AI Assistant is advisory-only and cannot create, ' +
    'modify, approve, or delete any business records.*';

  async chat(request: AiProviderRequest): Promise<AiProviderResponse> {
    // Simulate a small processing delay for realism
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    const lastUserMessage = request.messages
      .filter(m => m.role === 'user')
      .pop();

    const userContent = lastUserMessage?.content || 'Hello';

    // Generate a contextual mock response
    const mockResponse = this.generateMockResponse(userContent);

    return {
      content: MockProvider.MOCK_SYSTEM_PREFIX + mockResponse + MockProvider.SAFETY_SUFFIX,
      model: 'mock-assistant',
      provider: 'mock',
      tokenCount: Math.ceil(userContent.length / 4) + Math.ceil(mockResponse.length / 4),
      metadata: {
        isMock: true,
        simulatedAt: new Date().toISOString(),
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