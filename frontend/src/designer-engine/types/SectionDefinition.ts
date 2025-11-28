/**
 * SectionDefinition.ts
 * Defines a visual grouping of fields within a form.
 */

export interface SectionDefinition {
  id: string;
  title?: string;
  description?: string;
  fieldIds: string[]; // Ordered list of Field IDs to render in this section
  collapsed?: boolean;
}
