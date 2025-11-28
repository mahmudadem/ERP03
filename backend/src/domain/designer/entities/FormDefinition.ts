
import { FieldDefinition } from './FieldDefinition';

export interface FormSection {
  title: string;
  fields: string[]; // Field IDs
}

export class FormDefinition {
  constructor(
    public id: string,
    public module: string,
    public type: string, // e.g. 'INVOICE_FORM'
    public fields: FieldDefinition[],
    public sections: FormSection[]
  ) {}
}
