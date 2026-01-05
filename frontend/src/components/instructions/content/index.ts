/**
 * Instructions Content Registry
 * 
 * Central export point for all page instruction content.
 * To add instructions for a new page:
 * 1. Create a new file in this folder (e.g., voucher-list.ts)
 * 2. Export a PageInstructions object
 * 3. Import and add it to the registry below
 */

import { PageInstructions, InstructionsRegistry } from '../types';
import { accountingSettingsInstructions } from './accounting-settings';

// Registry of all available page instructions
export const instructionsRegistry: InstructionsRegistry = {
  'accounting-settings': accountingSettingsInstructions,
  // Add more pages here as they are implemented:
  // 'voucher-list': voucherListInstructions,
  // 'account-management': accountManagementInstructions,
};

// Helper function to get instructions by page ID
export function getInstructions(pageId: string): PageInstructions | undefined {
  return instructionsRegistry[pageId];
}

// Re-export for convenience
export { accountingSettingsInstructions };
