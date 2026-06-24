export type PosLayoutScopeType = 'COMPANY' | 'BRANCH' | 'REGISTER' | 'USER';
export type PosProductShortcutNodeType = 'GROUP' | 'ITEM';
export type PosControlButtonZone = 'TOP_BAR' | 'RIGHT_PANEL' | 'CART_FOOTER' | 'BOTTOM_BAR' | 'MORE_MENU';
export type PosCommandCode =
  | 'CUSTOMER_LOOKUP'
  | 'PRINT_RECEIPT'
  | 'REPRINT_LAST_RECEIPT'
  | 'HOLD_SALE'
  | 'RECALL_SALE'
  | 'CLEAR_CART'
  | 'VOID_LINE'
  | 'VOID_TICKET'
  | 'APPLY_DISCOUNT'
  | 'PRICE_CHECK'
  | 'CASH_PAYMENT'
  | 'CARD_PAYMENT'
  | 'SPLIT_PAYMENT'
  | 'OPEN_CASH_DRAWER'
  | 'RETURN_REFUND'
  | 'END_SHIFT';

const VALID_SCOPE_TYPES: PosLayoutScopeType[] = ['COMPANY', 'BRANCH', 'REGISTER', 'USER'];
const VALID_NODE_TYPES: PosProductShortcutNodeType[] = ['GROUP', 'ITEM'];
const VALID_ZONES: PosControlButtonZone[] = ['TOP_BAR', 'RIGHT_PANEL', 'CART_FOOTER', 'BOTTOM_BAR', 'MORE_MENU'];
export const POS_COMMAND_CODES: PosCommandCode[] = [
  'CUSTOMER_LOOKUP',
  'PRINT_RECEIPT',
  'REPRINT_LAST_RECEIPT',
  'HOLD_SALE',
  'RECALL_SALE',
  'CLEAR_CART',
  'VOID_LINE',
  'VOID_TICKET',
  'APPLY_DISCOUNT',
  'PRICE_CHECK',
  'CASH_PAYMENT',
  'CARD_PAYMENT',
  'SPLIT_PAYMENT',
  'OPEN_CASH_DRAWER',
  'RETURN_REFUND',
  'END_SHIFT',
];

export interface PosLayoutBaseProps {
  id: string;
  companyId: string;
  name: string;
  scopeType: PosLayoutScopeType;
  scopeId?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class PosProductShortcutLayout {
  readonly id: string;
  readonly companyId: string;
  name: string;
  scopeType: PosLayoutScopeType;
  scopeId?: string | null;
  isDefault: boolean;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosLayoutBaseProps) {
    validateLayoutBase(props, 'PosProductShortcutLayout');
    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.scopeType = props.scopeType;
    this.scopeId = normalizeScopeId(props.scopeType, props.scopeId);
    this.isDefault = props.isDefault === true;
    this.isActive = props.isActive !== false;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return layoutToJSON(this);
  }

  static fromJSON(data: any): PosProductShortcutLayout {
    return new PosProductShortcutLayout(layoutFromJSON(data));
  }
}

export class PosControlButtonLayout {
  readonly id: string;
  readonly companyId: string;
  name: string;
  scopeType: PosLayoutScopeType;
  scopeId?: string | null;
  isDefault: boolean;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosLayoutBaseProps) {
    validateLayoutBase(props, 'PosControlButtonLayout');
    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.scopeType = props.scopeType;
    this.scopeId = normalizeScopeId(props.scopeType, props.scopeId);
    this.isDefault = props.isDefault === true;
    this.isActive = props.isActive !== false;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return layoutToJSON(this);
  }

  static fromJSON(data: any): PosControlButtonLayout {
    return new PosControlButtonLayout(layoutFromJSON(data));
  }
}

export interface PosProductShortcutNodeProps {
  id: string;
  companyId: string;
  layoutId: string;
  parentId?: string | null;
  nodeType: PosProductShortcutNodeType;
  label: string;
  secondaryLabel?: string | null;
  itemId?: string | null;
  variantId?: string | null;
  unitId?: string | null;
  predefinedQty?: number | null;
  sortOrder: number;
  isActive: boolean;
  color?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PosProductShortcutNode {
  readonly id: string;
  readonly companyId: string;
  readonly layoutId: string;
  parentId?: string | null;
  nodeType: PosProductShortcutNodeType;
  label: string;
  secondaryLabel?: string | null;
  itemId?: string | null;
  variantId?: string | null;
  unitId?: string | null;
  predefinedQty?: number | null;
  sortOrder: number;
  isActive: boolean;
  color?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosProductShortcutNodeProps) {
    if (!props.id?.trim()) throw new Error('PosProductShortcutNode id is required');
    if (!props.companyId?.trim()) throw new Error('PosProductShortcutNode companyId is required');
    if (!props.layoutId?.trim()) throw new Error('PosProductShortcutNode layoutId is required');
    if (!VALID_NODE_TYPES.includes(props.nodeType)) throw new Error(`Invalid POS shortcut node type: ${props.nodeType}`);
    if (!props.label?.trim()) throw new Error('PosProductShortcutNode label is required');
    const itemId = clean(props.itemId);
    if (props.nodeType === 'GROUP' && itemId) throw new Error('GROUP shortcut nodes cannot reference an item');
    if (props.nodeType === 'ITEM' && !itemId) throw new Error('ITEM shortcut nodes must reference an item');
    this.id = props.id;
    this.companyId = props.companyId;
    this.layoutId = props.layoutId;
    this.parentId = clean(props.parentId);
    this.nodeType = props.nodeType;
    this.label = props.label.trim();
    this.secondaryLabel = clean(props.secondaryLabel);
    this.itemId = itemId;
    this.variantId = clean(props.variantId);
    this.unitId = clean(props.unitId);
    this.predefinedQty = props.predefinedQty === null || props.predefinedQty === undefined ? undefined : Math.max(0, Number(props.predefinedQty));
    this.sortOrder = Number.isFinite(props.sortOrder) ? Number(props.sortOrder) : 0;
    this.isActive = props.isActive !== false;
    this.color = clean(props.color);
    this.icon = clean(props.icon);
    this.imageUrl = clean(props.imageUrl);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      layoutId: this.layoutId,
      parentId: this.parentId,
      nodeType: this.nodeType,
      label: this.label,
      secondaryLabel: this.secondaryLabel,
      itemId: this.itemId,
      variantId: this.variantId,
      unitId: this.unitId,
      predefinedQty: this.predefinedQty,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      color: this.color,
      icon: this.icon,
      imageUrl: this.imageUrl,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosProductShortcutNode {
    return new PosProductShortcutNode({
      id: data.id,
      companyId: data.companyId,
      layoutId: data.layoutId,
      parentId: data.parentId,
      nodeType: data.nodeType,
      label: data.label,
      secondaryLabel: data.secondaryLabel,
      itemId: data.itemId,
      variantId: data.variantId,
      unitId: data.unitId,
      predefinedQty: data.predefinedQty,
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== false,
      color: data.color,
      icon: data.icon,
      imageUrl: data.imageUrl,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}

export interface PosControlButtonProps {
  id: string;
  companyId: string;
  layoutId: string;
  zone: PosControlButtonZone;
  commandCode: PosCommandCode;
  label: string;
  secondaryLabel?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  requiredPermission?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class PosControlButton {
  readonly id: string;
  readonly companyId: string;
  readonly layoutId: string;
  zone: PosControlButtonZone;
  commandCode: PosCommandCode;
  label: string;
  secondaryLabel?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder: number;
  isVisible: boolean;
  isActive: boolean;
  requiredPermission?: string | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosControlButtonProps) {
    if (!props.id?.trim()) throw new Error('PosControlButton id is required');
    if (!props.companyId?.trim()) throw new Error('PosControlButton companyId is required');
    if (!props.layoutId?.trim()) throw new Error('PosControlButton layoutId is required');
    if (!VALID_ZONES.includes(props.zone)) throw new Error(`Invalid POS control button zone: ${props.zone}`);
    if (!POS_COMMAND_CODES.includes(props.commandCode)) throw new Error(`Invalid POS command code: ${props.commandCode}`);
    if (!props.label?.trim()) throw new Error('PosControlButton label is required');
    this.id = props.id;
    this.companyId = props.companyId;
    this.layoutId = props.layoutId;
    this.zone = props.zone;
    this.commandCode = props.commandCode;
    this.label = props.label.trim();
    this.secondaryLabel = clean(props.secondaryLabel);
    this.icon = clean(props.icon);
    this.color = clean(props.color);
    this.sortOrder = Number.isFinite(props.sortOrder) ? Number(props.sortOrder) : 0;
    this.isVisible = props.isVisible !== false;
    this.isActive = props.isActive !== false;
    this.requiredPermission = clean(props.requiredPermission);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      layoutId: this.layoutId,
      zone: this.zone,
      commandCode: this.commandCode,
      label: this.label,
      secondaryLabel: this.secondaryLabel,
      icon: this.icon,
      color: this.color,
      sortOrder: this.sortOrder,
      isVisible: this.isVisible,
      isActive: this.isActive,
      requiredPermission: this.requiredPermission,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosControlButton {
    return new PosControlButton({
      id: data.id,
      companyId: data.companyId,
      layoutId: data.layoutId,
      zone: data.zone,
      commandCode: data.commandCode,
      label: data.label,
      secondaryLabel: data.secondaryLabel,
      icon: data.icon,
      color: data.color,
      sortOrder: Number(data.sortOrder) || 0,
      isVisible: data.isVisible !== false,
      isActive: data.isActive !== false,
      requiredPermission: data.requiredPermission,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}

function validateLayoutBase(props: PosLayoutBaseProps, name: string) {
  if (!props.id?.trim()) throw new Error(`${name} id is required`);
  if (!props.companyId?.trim()) throw new Error(`${name} companyId is required`);
  if (!props.name?.trim()) throw new Error(`${name} name is required`);
  if (!VALID_SCOPE_TYPES.includes(props.scopeType)) throw new Error(`Invalid POS layout scope type: ${props.scopeType}`);
  normalizeScopeId(props.scopeType, props.scopeId);
}

function normalizeScopeId(scopeType: PosLayoutScopeType, scopeId?: string | null): string | null | undefined {
  const value = clean(scopeId);
  if (scopeType === 'COMPANY') return value || null;
  if (!value) throw new Error(`${scopeType} scoped POS layout requires scopeId`);
  return value;
}

function clean(value?: string | null): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function layoutToJSON(layout: PosProductShortcutLayout | PosControlButtonLayout): Record<string, any> {
  return {
    id: layout.id,
    companyId: layout.companyId,
    name: layout.name,
    scopeType: layout.scopeType,
    scopeId: layout.scopeId || null,
    isDefault: layout.isDefault,
    isActive: layout.isActive,
    createdAt: layout.createdAt.toISOString(),
    updatedAt: layout.updatedAt.toISOString(),
  };
}

function layoutFromJSON(data: any): PosLayoutBaseProps {
  return {
    id: data.id,
    companyId: data.companyId,
    name: data.name,
    scopeType: data.scopeType,
    scopeId: data.scopeId,
    isDefault: data.isDefault === true,
    isActive: data.isActive !== false,
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
  };
}
