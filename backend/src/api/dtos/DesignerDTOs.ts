
/**
 * DesignerDTOs.ts
 */
import { FormDefinition } from '../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../domain/designer/entities/VoucherTypeDefinition';

export interface FormDefinitionDTO {
  id: string;
  name: string;
  module: string;
  type: string;
  fieldCount: number;
}

export interface VoucherTypeDTO {
  id: string;
  name: string;
  code: string;
  module: string;
}

export class DesignerDTOMapper {
  static toFormDefinitionDTO(form: FormDefinition): FormDefinitionDTO {
    return {
      id: form.id,
      name: form.name,
      module: form.module,
      type: form.type,
      fieldCount: form.fields.length,
    };
  }

  static toVoucherTypeDTO(def: VoucherTypeDefinition): VoucherTypeDTO {
    return {
      id: def.id,
      name: def.name,
      code: def.code,
      module: def.module,
    };
  }
}
