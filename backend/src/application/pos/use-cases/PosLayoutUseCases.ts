import { randomUUID } from 'crypto';
import {
  POS_COMMAND_CODES,
  PosCommandCode,
  PosControlButton,
  PosControlButtonLayout,
  PosControlButtonZone,
  PosLayoutScopeType,
  PosProductShortcutLayout,
  PosProductShortcutNode,
  PosProductShortcutNodeType,
} from '../../../domain/pos/entities/PosLayout';
import { IPosLayoutRepository } from '../../../repository/interfaces/pos/IPosLayoutRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ICommercialCore } from '../../system-core/contracts/ICommercialCore';

const MAX_SHORTCUT_DEPTH = 6;
const CONTROL_ZONES: PosControlButtonZone[] = ['TOP_BAR', 'RIGHT_PANEL', 'CART_FOOTER', 'BOTTOM_BAR', 'MORE_MENU'];

export interface UpsertPosLayoutInput {
  id?: string;
  companyId: string;
  name: string;
  scopeType: PosLayoutScopeType;
  scopeId?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpsertProductShortcutNodeInput {
  id?: string;
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
  sortOrder?: number;
  isActive?: boolean;
  color?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
}

export interface UpsertControlButtonInput {
  id?: string;
  companyId: string;
  layoutId: string;
  zone: PosControlButtonZone;
  commandCode: PosCommandCode;
  label: string;
  secondaryLabel?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  isActive?: boolean;
  requiredPermission?: string | null;
}

export interface PosProductShortcutTreeNode extends Record<string, any> {
  children: PosProductShortcutTreeNode[];
}

export interface PosRuntimeLayoutResponse {
  productShortcutLayout: Pick<ReturnType<PosProductShortcutLayout['toJSON']>, 'id' | 'name' | 'scopeType' | 'scopeId'> | null;
  productShortcutTree: PosProductShortcutTreeNode[];
  controlButtonLayout: Pick<ReturnType<PosControlButtonLayout['toJSON']>, 'id' | 'name' | 'scopeType' | 'scopeId'> | null;
  controlButtonsByZone: Record<PosControlButtonZone, Record<string, any>[]>;
}

export class ListPosProductShortcutLayoutsUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string) {
    return this.repo.listProductLayouts(companyId);
  }
}

export class CreatePosProductShortcutLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(input: UpsertPosLayoutInput): Promise<PosProductShortcutLayout> {
    const now = new Date();
    const layout = new PosProductShortcutLayout({
      id: input.id || `psl_${randomUUID()}`,
      companyId: input.companyId,
      name: input.name,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      isDefault: input.isDefault === true,
      isActive: input.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.createProductLayout(layout);
    return layout;
  }
}

export class UpdatePosProductShortcutLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(companyId: string, id: string, patch: Partial<UpsertPosLayoutInput>): Promise<PosProductShortcutLayout> {
    const existing = await this.repo.getProductLayout(companyId, id);
    if (!existing) throw new Error(`POS product shortcut layout not found: ${id}`);
    const layout = new PosProductShortcutLayout({
      id: existing.id,
      companyId,
      name: patch.name ?? existing.name,
      scopeType: patch.scopeType ?? existing.scopeType,
      scopeId: patch.scopeId !== undefined ? patch.scopeId : existing.scopeId,
      isDefault: patch.isDefault !== undefined ? patch.isDefault === true : existing.isDefault,
      isActive: patch.isActive !== undefined ? patch.isActive !== false : existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    await this.repo.updateProductLayout(layout);
    return layout;
  }
}

export class DeletePosProductShortcutLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, id: string) {
    return this.repo.deleteProductLayout(companyId, id);
  }
}

export class ListPosProductShortcutNodesUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, layoutId: string) {
    return this.repo.listProductNodes(companyId, layoutId);
  }
}

export class CreatePosProductShortcutNodeUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(input: UpsertProductShortcutNodeInput): Promise<PosProductShortcutNode> {
    await assertProductLayoutExists(this.repo, input.companyId, input.layoutId);
    const now = new Date();
    const node = new PosProductShortcutNode({
      id: input.id || `psn_${randomUUID()}`,
      companyId: input.companyId,
      layoutId: input.layoutId,
      parentId: input.parentId,
      nodeType: input.nodeType,
      label: input.label,
      secondaryLabel: input.secondaryLabel,
      itemId: input.itemId,
      variantId: input.variantId,
      unitId: input.unitId,
      predefinedQty: input.predefinedQty,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive !== false,
      color: input.color,
      icon: input.icon,
      imageUrl: input.imageUrl,
      createdAt: now,
      updatedAt: now,
    });
    await validateProductNodeGraph(this.repo, node);
    await this.repo.createProductNode(node);
    return node;
  }
}

export class UpdatePosProductShortcutNodeUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(companyId: string, id: string, patch: Partial<UpsertProductShortcutNodeInput>): Promise<PosProductShortcutNode> {
    const existing = await this.repo.getProductNode(companyId, id);
    if (!existing) throw new Error(`POS product shortcut node not found: ${id}`);
    const node = new PosProductShortcutNode({
      id: existing.id,
      companyId,
      layoutId: existing.layoutId,
      parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
      nodeType: patch.nodeType ?? existing.nodeType,
      label: patch.label ?? existing.label,
      secondaryLabel: patch.secondaryLabel !== undefined ? patch.secondaryLabel : existing.secondaryLabel,
      itemId: patch.itemId !== undefined ? patch.itemId : existing.itemId,
      variantId: patch.variantId !== undefined ? patch.variantId : existing.variantId,
      unitId: patch.unitId !== undefined ? patch.unitId : existing.unitId,
      predefinedQty: patch.predefinedQty !== undefined ? patch.predefinedQty : existing.predefinedQty,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      isActive: patch.isActive !== undefined ? patch.isActive !== false : existing.isActive,
      color: patch.color !== undefined ? patch.color : existing.color,
      icon: patch.icon !== undefined ? patch.icon : existing.icon,
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    await validateProductNodeGraph(this.repo, node);
    await this.repo.updateProductNode(node);
    return node;
  }
}

export class DeletePosProductShortcutNodeUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, id: string) {
    return this.repo.deleteProductNode(companyId, id);
  }
}

export class ListPosControlButtonLayoutsUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string) {
    return this.repo.listControlLayouts(companyId);
  }
}

export class CreatePosControlButtonLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(input: UpsertPosLayoutInput): Promise<PosControlButtonLayout> {
    const now = new Date();
    const layout = new PosControlButtonLayout({
      id: input.id || `pcl_${randomUUID()}`,
      companyId: input.companyId,
      name: input.name,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      isDefault: input.isDefault === true,
      isActive: input.isActive !== false,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.createControlLayout(layout);
    return layout;
  }
}

export class UpdatePosControlButtonLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(companyId: string, id: string, patch: Partial<UpsertPosLayoutInput>): Promise<PosControlButtonLayout> {
    const existing = await this.repo.getControlLayout(companyId, id);
    if (!existing) throw new Error(`POS control button layout not found: ${id}`);
    const layout = new PosControlButtonLayout({
      id: existing.id,
      companyId,
      name: patch.name ?? existing.name,
      scopeType: patch.scopeType ?? existing.scopeType,
      scopeId: patch.scopeId !== undefined ? patch.scopeId : existing.scopeId,
      isDefault: patch.isDefault !== undefined ? patch.isDefault === true : existing.isDefault,
      isActive: patch.isActive !== undefined ? patch.isActive !== false : existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    await this.repo.updateControlLayout(layout);
    return layout;
  }
}

export class DeletePosControlButtonLayoutUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, id: string) {
    return this.repo.deleteControlLayout(companyId, id);
  }
}

export class ListPosControlButtonsUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, layoutId: string) {
    return this.repo.listControlButtons(companyId, layoutId);
  }
}

export class CreatePosControlButtonUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(input: UpsertControlButtonInput): Promise<PosControlButton> {
    await assertControlLayoutExists(this.repo, input.companyId, input.layoutId);
    const now = new Date();
    const button = new PosControlButton({
      id: input.id || `pcb_${randomUUID()}`,
      companyId: input.companyId,
      layoutId: input.layoutId,
      zone: input.zone,
      commandCode: input.commandCode,
      label: input.label,
      secondaryLabel: input.secondaryLabel,
      icon: input.icon,
      color: input.color,
      sortOrder: input.sortOrder ?? 0,
      isVisible: input.isVisible !== false,
      isActive: input.isActive !== false,
      requiredPermission: input.requiredPermission,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.createControlButton(button);
    return button;
  }
}

export class UpdatePosControlButtonUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  async execute(companyId: string, id: string, patch: Partial<UpsertControlButtonInput>): Promise<PosControlButton> {
    const existing = await this.repo.getControlButton(companyId, id);
    if (!existing) throw new Error(`POS control button not found: ${id}`);
    const button = new PosControlButton({
      id: existing.id,
      companyId,
      layoutId: existing.layoutId,
      zone: patch.zone ?? existing.zone,
      commandCode: patch.commandCode ?? existing.commandCode,
      label: patch.label ?? existing.label,
      secondaryLabel: patch.secondaryLabel !== undefined ? patch.secondaryLabel : existing.secondaryLabel,
      icon: patch.icon !== undefined ? patch.icon : existing.icon,
      color: patch.color !== undefined ? patch.color : existing.color,
      sortOrder: patch.sortOrder ?? existing.sortOrder,
      isVisible: patch.isVisible !== undefined ? patch.isVisible !== false : existing.isVisible,
      isActive: patch.isActive !== undefined ? patch.isActive !== false : existing.isActive,
      requiredPermission: patch.requiredPermission !== undefined ? patch.requiredPermission : existing.requiredPermission,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    await this.repo.updateControlButton(button);
    return button;
  }
}

export class DeletePosControlButtonUseCase {
  constructor(private readonly repo: IPosLayoutRepository) {}
  execute(companyId: string, id: string) {
    return this.repo.deleteControlButton(companyId, id);
  }
}

export class ResolvePosRuntimeLayoutUseCase {
  constructor(
    private readonly repo: IPosLayoutRepository,
    private readonly itemRepo?: IItemRepository,
    private readonly commercialCore?: ICommercialCore
  ) {}

  async execute(input: { companyId: string; branchId?: string; registerId?: string; userId?: string }): Promise<PosRuntimeLayoutResponse> {
    const [productLayouts, controlLayouts] = await Promise.all([
      this.repo.listProductLayouts(input.companyId),
      this.repo.listControlLayouts(input.companyId),
    ]);
    const productLayout = selectLayout(productLayouts, input);
    const controlLayout = selectLayout(controlLayouts, input);
    const [productNodes, controlButtons] = await Promise.all([
      productLayout ? this.repo.listProductNodes(input.companyId, productLayout.id) : Promise.resolve([]),
      controlLayout ? this.repo.listControlButtons(input.companyId, controlLayout.id) : Promise.resolve([]),
    ]);

    return {
      productShortcutLayout: productLayout ? layoutSummary(productLayout) : null,
      productShortcutTree: await buildShortcutTree(productNodes, input.companyId, this.itemRepo, this.commercialCore),
      controlButtonLayout: controlLayout ? layoutSummary(controlLayout) : null,
      controlButtonsByZone: groupButtons(controlButtons),
    };
  }
}

export function getPosCommandCodes(): PosCommandCode[] {
  return [...POS_COMMAND_CODES];
}

function selectLayout<T extends PosProductShortcutLayout | PosControlButtonLayout>(
  layouts: T[],
  input: { branchId?: string; registerId?: string; userId?: string }
): T | null {
  const active = layouts.filter((layout) => layout.isActive);
  const candidates: Array<(layout: T) => boolean> = [
    (layout) => layout.scopeType === 'USER' && !!input.userId && layout.scopeId === input.userId,
    (layout) => layout.scopeType === 'REGISTER' && !!input.registerId && layout.scopeId === input.registerId,
    (layout) => layout.scopeType === 'BRANCH' && !!input.branchId && layout.scopeId === input.branchId,
    (layout) => layout.scopeType === 'COMPANY' && layout.isDefault,
    (layout) => layout.scopeType === 'COMPANY',
  ];
  for (const matches of candidates) {
    const match = active.filter(matches).sort(compareDefaultThenUpdated)[0];
    if (match) return match;
  }
  return null;
}

function compareDefaultThenUpdated<T extends PosProductShortcutLayout | PosControlButtonLayout>(a: T, b: T): number {
  if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function layoutSummary(layout: PosProductShortcutLayout | PosControlButtonLayout) {
  return {
    id: layout.id,
    name: layout.name,
    scopeType: layout.scopeType,
    scopeId: layout.scopeId || null,
  };
}

async function buildShortcutTree(
  nodes: PosProductShortcutNode[],
  companyId: string,
  itemRepo?: IItemRepository,
  commercialCore?: ICommercialCore
): Promise<PosProductShortcutTreeNode[]> {
  const active = nodes.filter((node) => node.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const byParent = new Map<string, PosProductShortcutNode[]>();
  const itemSummaries = await buildItemSummaries(active, companyId, itemRepo, commercialCore);
  for (const node of active) {
    const parentKey = node.parentId || 'ROOT';
    const list = byParent.get(parentKey) || [];
    list.push(node);
    byParent.set(parentKey, list);
  }
  const build = (parentId: string | null, depth: number): PosProductShortcutTreeNode[] => {
    if (depth > MAX_SHORTCUT_DEPTH) return [];
    return (byParent.get(parentId || 'ROOT') || []).map((node) => ({
      ...node.toJSON(),
      item: node.itemId ? itemSummaries.get(node.itemId) || null : null,
      children: node.nodeType === 'GROUP' ? build(node.id, depth + 1) : [],
    }));
  };
  return build(null, 1);
}

async function buildItemSummaries(
  nodes: PosProductShortcutNode[],
  companyId: string,
  itemRepo?: IItemRepository,
  commercialCore?: ICommercialCore
): Promise<Map<string, Record<string, any>>> {
  const result = new Map<string, Record<string, any>>();
  if (!itemRepo) return result;
  const itemIds = Array.from(new Set(nodes.map((node) => node.itemId).filter(Boolean))) as string[];
  await Promise.all(itemIds.map(async (itemId) => {
    const item = await itemRepo.getItem(itemId);
    if (!item || item.companyId !== companyId) return;
    const resolvedPrice = await commercialCore?.resolvePrice({
      companyId,
      itemId: item.id,
      channel: 'pos',
      uomId: item.salesUomId,
    });
    result.set(item.id, {
      id: item.id,
      code: item.code,
      barcode: item.barcode,
      name: item.name,
      type: item.type === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
      trackInventory: !!item.trackInventory,
      baseUom: item.baseUom,
      uom: item.salesUomId || item.baseUom,
      salesUomId: item.salesUomId,
      unitOfMeasure: item.salesUomId || item.baseUom,
      defaultSalesTaxCodeId: item.defaultSalesTaxCodeId,
      salePrice: resolvedPrice ?? item.salePrice,
    });
  }));
  return result;
}

function groupButtons(buttons: PosControlButton[]): Record<PosControlButtonZone, Record<string, any>[]> {
  const grouped = Object.fromEntries(CONTROL_ZONES.map((zone) => [zone, []])) as Record<PosControlButtonZone, Record<string, any>[]>;
  for (const button of buttons.filter((b) => b.isActive && b.isVisible).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))) {
    grouped[button.zone].push(button.toJSON());
  }
  return grouped;
}

async function assertProductLayoutExists(repo: IPosLayoutRepository, companyId: string, layoutId: string) {
  const layout = await repo.getProductLayout(companyId, layoutId);
  if (!layout) throw new Error(`POS product shortcut layout not found: ${layoutId}`);
}

async function assertControlLayoutExists(repo: IPosLayoutRepository, companyId: string, layoutId: string) {
  const layout = await repo.getControlLayout(companyId, layoutId);
  if (!layout) throw new Error(`POS control button layout not found: ${layoutId}`);
}

async function validateProductNodeGraph(repo: IPosLayoutRepository, node: PosProductShortcutNode) {
  const nodes = await repo.listProductNodes(node.companyId, node.layoutId);
  const map = new Map(nodes.map((n) => [n.id, n]));
  map.set(node.id, node);
  if (node.parentId) {
    const parent = map.get(node.parentId);
    if (!parent) throw new Error('POS shortcut parent must belong to the same layout');
    if (parent.nodeType !== 'GROUP') throw new Error('POS shortcut parent must be a GROUP node');
  }
  let depth = 1;
  let cursor = node.parentId ? map.get(node.parentId) : undefined;
  const seen = new Set<string>([node.id]);
  while (cursor) {
    if (seen.has(cursor.id)) throw new Error('POS shortcut tree cannot contain circular parent references');
    seen.add(cursor.id);
    depth += 1;
    if (depth > MAX_SHORTCUT_DEPTH) throw new Error(`POS shortcut tree cannot exceed ${MAX_SHORTCUT_DEPTH} levels`);
    cursor = cursor.parentId ? map.get(cursor.parentId) : undefined;
  }
}
