/**
 * MockProvider - Default AI provider for local development
 *
 * Returns contextual mock responses that echo the user's message.
 * This allows development and testing without any external API keys.
 *
 * v2 Extension:
 * - Implements "Honest Switchboard" logic for demoing and testing.
 * - Matches keywords to real internal tools.
 * - Clearly identifies as a demo tool.
 */

import {
  IAiProvider,
  AiProviderRequest,
  AiProviderResponse,
  AiProviderCapabilities,
  AiProviderRuntimeMeta,
  AiStreamEvent,
} from './IAiProvider';
import { getExecutableDefinitions } from '../catalog/AiToolCatalogSeed';

export class MockProvider implements IAiProvider {
  readonly providerId = 'mock';
  readonly providerName = 'Mock AI Provider';

  private static readonly CAPABILITIES: AiProviderCapabilities = {
    supportsToolCalling: true,
    supportsStructuredOutput: false,
    maxToolCallsPerRequest: 5,
    allowsEmptyContentWithToolCalls: true,
  };

  getCapabilities(): AiProviderCapabilities {
    return { ...MockProvider.CAPABILITIES };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async chat(request: AiProviderRequest): Promise<AiProviderResponse> {
    // Standard chat not used in the widget, but implemented for completeness
    return {
      content: '[DEMO MODE] This is a mock response.',
      model: 'mock-assistant',
      provider: 'mock',
      tokenCount: 10,
      runtimeMeta: {
        modelUsed: 'mock-assistant',
        capabilities: { supportsToolCalling: false, allowsEmptyContentWithToolCalls: false },
      },
    };
  }

  async *chatStream(request: AiProviderRequest): AsyncGenerator<AiStreamEvent> {
    const messages = request.messages;
    const lastMessage = messages[messages.length - 1];
    const userPrompt = (lastMessage.content || '').toLowerCase();

    // 1. Build dynamic "Switchboard" mappings from catalog (Keywords -> Tools)
    const toolMappings = getExecutableDefinitions()
      .filter(def => def.chatKeywords && def.chatKeywords.length > 0)
      .map(def => ({
        keywords: def.chatKeywords.map(k => k.toLowerCase()),
        toolName: def.name,
        label: def.name.split('.').pop()!.replace(/([A-Z])/g, ' $1').trim(),
      }));

    // 2. Find matches
    const matches = toolMappings.filter(m => m.keywords.some(k => userPrompt.includes(k)));

    // 3. Handle Logic Cases
    const prefix = '[DEMO MODE — Direct Data Access] ';

    // Case A: Multiple matches - Ask for clarification
    if (matches.length > 1) {
      const options = matches.map(m => m.label).join(' or ');
      yield { type: 'token', content: `${prefix}I found multiple topics in your request. Which one would you like to see: **${options}**?` };
      yield { 
        type: 'done', 
        metadata: { provider: 'mock', model: 'mock-assistant' } 
      };
      return;
    }

    // Case B: Single match - Trigger real tool
    if (matches.length === 1) {
      const match = matches[0];
      yield { type: 'token', content: `${prefix}Understood. I am pulling your live **${match.label}** now...` };
      
      // Simulate a small delay for "Realism"
      await new Promise(resolve => setTimeout(resolve, 800));

      yield {
        type: 'tool_call',
        toolCallId: `mock-call-${Date.now()}`,
        toolName: match.toolName,
        toolArgs: {}
      };
      
      yield { 
        type: 'done', 
        metadata: { provider: 'mock', model: 'mock-assistant' } 
      };
      return;
    }

    // Case C: No matches - Help the user find the keywords
    yield { type: 'token', content: prefix };
    
    if (userPrompt.includes('hello') || userPrompt.includes('hi')) {
      yield { type: 'token', content: 'Hello! I am the ERP03 Demo Assistant. I don\'t have a full AI brain, but I can pull live reports for you. Try asking for your **"Trial Balance"** or **"Sales Summary"**.' };
    } else {
      yield { type: 'token', content: 'I see you are asking about "' + lastMessage.content + '". Since I am in **Demo Mode**, I only respond to specific keywords. Try asking for: **"Trial Balance"**, **"Sales Summary"**, or **"Inventory"** to see how I can pull your real data!' };
    }

    yield { 
      type: 'done', 
      metadata: { 
        provider: 'mock', 
        model: 'mock-assistant' 
      } 
    };
  }
}