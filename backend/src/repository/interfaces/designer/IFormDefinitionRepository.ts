
import { FormDefinition } from '../../../domain/designer/entities/FormDefinition';

/**
 * Interface for Dynamic Form Definitions.
 */
export interface IFormDefinitionRepository {
  createFormDefinition(def: FormDefinition): Promise<void>;
  updateFormDefinition(id: string, data: Partial<FormDefinition>): Promise<void>;
  getFormDefinition(id: string): Promise<FormDefinition | null>;
  getDefinitionsForModule(module: string): Promise<FormDefinition[]>;
}
