/**
 * Instructions System - Central Exports
 * 
 * Reusable system for contextual operational guidance across ERP pages.
 * 
 * Usage:
 * 1. Import the InstructionsButton component
 * 2. Import the page-specific instructions from content/
 * 3. Place the button in your page header
 * 
 * Example:
 * ```tsx
 * import { InstructionsButton } from '@/components/instructions';
 * import { accountingSettingsInstructions } from '@/components/instructions/content';
 * 
 * <InstructionsButton instructions={accountingSettingsInstructions} />
 * ```
 * 
 * To add instructions for a new page:
 * 1. Create a new file in content/ folder
 * 2. Export a PageInstructions object
 * 3. Add it to content/index.ts registry
 */

// Components
export { InstructionsModal } from './InstructionsModal';
export { InstructionsButton } from './InstructionsButton';

// Types
export type { PageInstructions, InstructionSection, InstructionsRegistry } from './types';

// Content
export { getInstructions, instructionsRegistry, accountingSettingsInstructions } from './content';
