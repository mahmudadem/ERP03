export interface UomConversionProps {
  id: string;
  companyId: string;
  itemId: string;
  fromUomId?: string;
  fromUom: string;
  toUomId?: string;
  toUom: string;
  factor: number;
  active: boolean;
}

export class UomConversion {
  readonly id: string;
  readonly companyId: string;
  readonly itemId: string;
  fromUomId?: string;
  fromUom: string;
  toUomId?: string;
  toUom: string;
  factor: number;
  active: boolean;

  constructor(props: UomConversionProps) {
    if (!props.id?.trim()) throw new Error('UomConversion id is required');
    if (!props.companyId?.trim()) throw new Error('UomConversion companyId is required');
    if (!props.itemId?.trim()) throw new Error('UomConversion itemId is required');
    if (!props.fromUom?.trim()) throw new Error('UomConversion fromUom is required');
    if (!props.toUom?.trim()) throw new Error('UomConversion toUom is required');
    if (props.factor <= 0 || Number.isNaN(props.factor)) {
      throw new Error('UomConversion factor must be greater than 0');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.itemId = props.itemId;
    this.fromUomId = props.fromUomId;
    this.fromUom = props.fromUom.trim();
    this.toUomId = props.toUomId;
    this.toUom = props.toUom.trim();
    this.factor = props.factor;
    this.active = props.active;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      itemId: this.itemId,
      fromUomId: this.fromUomId,
      fromUom: this.fromUom,
      toUomId: this.toUomId,
      toUom: this.toUom,
      factor: this.factor,
      active: this.active,
    };
  }

  static fromJSON(data: any): UomConversion {
    return new UomConversion({
      id: data.id,
      companyId: data.companyId,
      itemId: data.itemId,
      fromUomId: data.fromUomId,
      fromUom: data.fromUom,
      toUomId: data.toUomId,
      toUom: data.toUom,
      factor: data.factor,
      active: data.active ?? true,
    });
  }
}
