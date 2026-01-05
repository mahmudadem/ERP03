/**
 * Instructions System - Type Definitions
 * 
 * Reusable system for contextual operational guidance across ERP pages.
 * Each page can define its own instruction content using these types.
 */

export interface InstructionSection {
  /** Section title */
  title: string;
  /** Plain language content explaining this topic */
  content: string;
  /** Optional warning callout for critical information */
  warning?: string;
  /** Optional tip callout for helpful hints */
  tip?: string;
}

export interface PageInstructions {
  /** Page identifier for lookup */
  pageId: string;
  /** Display title for the instructions modal */
  title: string;
  /** Brief overview of what this page does */
  overview: string;
  /** Organized sections of instruction content */
  sections: InstructionSection[];
  /** Footer warnings or disclaimers */
  footerWarnings?: string[];
}

/**
 * Registry of all page instructions
 * Pages register their content here for centralized access
 */
export type InstructionsRegistry = Record<string, PageInstructions>;
