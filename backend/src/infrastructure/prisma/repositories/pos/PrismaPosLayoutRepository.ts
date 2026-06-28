import { PrismaClient } from '@prisma/client';
import {
  PosControlButton,
  PosControlButtonLayout,
  PosProductShortcutLayout,
  PosProductShortcutNode,
} from '../../../../domain/pos/entities/PosLayout';
import { IPosLayoutRepository } from '../../../../repository/interfaces/pos/IPosLayoutRepository';

export class PrismaPosLayoutRepository implements IPosLayoutRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Product Shortcut Layouts ─────────────────────────────────────────────

  async createProductLayout(layout: PosProductShortcutLayout): Promise<void> {
    const data = layout.toJSON();
    await (this.prisma as any).posProductShortcutLayout.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        name: data.name,
        scopeType: data.scopeType,
        scopeId: data.scopeId ?? null,
        isDefault: data.isDefault,
        isActive: data.isActive,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async updateProductLayout(layout: PosProductShortcutLayout): Promise<void> {
    const data = layout.toJSON();
    await (this.prisma as any).posProductShortcutLayout.update({
      where: { id: layout.id },
      data: {
        name: data.name,
        scopeType: data.scopeType,
        scopeId: data.scopeId ?? null,
        isDefault: data.isDefault,
        isActive: data.isActive,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async deleteProductLayout(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).posProductShortcutLayout.deleteMany({
      where: { id, companyId },
    });
  }

  async getProductLayout(companyId: string, id: string): Promise<PosProductShortcutLayout | null> {
    const row = await (this.prisma as any).posProductShortcutLayout.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return PosProductShortcutLayout.fromJSON(rowToLayoutJSON(row));
  }

  async listProductLayouts(companyId: string): Promise<PosProductShortcutLayout[]> {
    const rows = await (this.prisma as any).posProductShortcutLayout.findMany({
      where: { companyId },
    });
    return rows.map((r: any) => PosProductShortcutLayout.fromJSON(rowToLayoutJSON(r)));
  }

  // ── Product Shortcut Nodes ────────────────────────────────────────────────

  async createProductNode(node: PosProductShortcutNode): Promise<void> {
    const data = node.toJSON();
    await (this.prisma as any).posProductShortcutNode.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        layoutId: data.layoutId,
        parentId: data.parentId ?? null,
        nodeType: data.nodeType,
        label: data.label,
        secondaryLabel: data.secondaryLabel ?? null,
        itemId: data.itemId ?? null,
        variantId: data.variantId ?? null,
        unitId: data.unitId ?? null,
        predefinedQty: data.predefinedQty ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive,
        color: data.color ?? null,
        icon: data.icon ?? null,
        imageUrl: data.imageUrl ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async updateProductNode(node: PosProductShortcutNode): Promise<void> {
    const data = node.toJSON();
    await (this.prisma as any).posProductShortcutNode.update({
      where: { id: node.id },
      data: {
        parentId: data.parentId ?? null,
        nodeType: data.nodeType,
        label: data.label,
        secondaryLabel: data.secondaryLabel ?? null,
        itemId: data.itemId ?? null,
        variantId: data.variantId ?? null,
        unitId: data.unitId ?? null,
        predefinedQty: data.predefinedQty ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive,
        color: data.color ?? null,
        icon: data.icon ?? null,
        imageUrl: data.imageUrl ?? null,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async deleteProductNode(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).posProductShortcutNode.deleteMany({
      where: { id, companyId },
    });
  }

  async getProductNode(companyId: string, id: string): Promise<PosProductShortcutNode | null> {
    const row = await (this.prisma as any).posProductShortcutNode.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return PosProductShortcutNode.fromJSON(rowToNodeJSON(row));
  }

  async listProductNodes(companyId: string, layoutId: string): Promise<PosProductShortcutNode[]> {
    const rows = await (this.prisma as any).posProductShortcutNode.findMany({
      where: { companyId, layoutId },
    });
    return rows.map((r: any) => PosProductShortcutNode.fromJSON(rowToNodeJSON(r)));
  }

  // ── Control Button Layouts ────────────────────────────────────────────────

  async createControlLayout(layout: PosControlButtonLayout): Promise<void> {
    const data = layout.toJSON();
    await (this.prisma as any).posControlButtonLayout.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        name: data.name,
        scopeType: data.scopeType,
        scopeId: data.scopeId ?? null,
        isDefault: data.isDefault,
        isActive: data.isActive,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async updateControlLayout(layout: PosControlButtonLayout): Promise<void> {
    const data = layout.toJSON();
    await (this.prisma as any).posControlButtonLayout.update({
      where: { id: layout.id },
      data: {
        name: data.name,
        scopeType: data.scopeType,
        scopeId: data.scopeId ?? null,
        isDefault: data.isDefault,
        isActive: data.isActive,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async deleteControlLayout(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).posControlButtonLayout.deleteMany({
      where: { id, companyId },
    });
  }

  async getControlLayout(companyId: string, id: string): Promise<PosControlButtonLayout | null> {
    const row = await (this.prisma as any).posControlButtonLayout.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return PosControlButtonLayout.fromJSON(rowToLayoutJSON(row));
  }

  async listControlLayouts(companyId: string): Promise<PosControlButtonLayout[]> {
    const rows = await (this.prisma as any).posControlButtonLayout.findMany({
      where: { companyId },
    });
    return rows.map((r: any) => PosControlButtonLayout.fromJSON(rowToLayoutJSON(r)));
  }

  // ── Control Buttons ───────────────────────────────────────────────────────

  async createControlButton(button: PosControlButton): Promise<void> {
    const data = button.toJSON();
    await (this.prisma as any).posControlButton.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        layoutId: data.layoutId,
        zone: data.zone,
        commandCode: data.commandCode,
        label: data.label,
        secondaryLabel: data.secondaryLabel ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        sortOrder: data.sortOrder ?? 0,
        isVisible: data.isVisible,
        isActive: data.isActive,
        requiredPermission: data.requiredPermission ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async updateControlButton(button: PosControlButton): Promise<void> {
    const data = button.toJSON();
    await (this.prisma as any).posControlButton.update({
      where: { id: button.id },
      data: {
        zone: data.zone,
        commandCode: data.commandCode,
        label: data.label,
        secondaryLabel: data.secondaryLabel ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        sortOrder: data.sortOrder ?? 0,
        isVisible: data.isVisible,
        isActive: data.isActive,
        requiredPermission: data.requiredPermission ?? null,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
    });
  }

  async deleteControlButton(companyId: string, id: string): Promise<void> {
    await (this.prisma as any).posControlButton.deleteMany({
      where: { id, companyId },
    });
  }

  async getControlButton(companyId: string, id: string): Promise<PosControlButton | null> {
    const row = await (this.prisma as any).posControlButton.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return PosControlButton.fromJSON(rowToButtonJSON(row));
  }

  async listControlButtons(companyId: string, layoutId: string): Promise<PosControlButton[]> {
    const rows = await (this.prisma as any).posControlButton.findMany({
      where: { companyId, layoutId },
    });
    return rows.map((r: any) => PosControlButton.fromJSON(rowToButtonJSON(r)));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rowToLayoutJSON(row: any) {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToNodeJSON(row: any) {
  return {
    id: row.id,
    companyId: row.companyId,
    layoutId: row.layoutId,
    parentId: row.parentId,
    nodeType: row.nodeType,
    label: row.label,
    secondaryLabel: row.secondaryLabel,
    itemId: row.itemId,
    variantId: row.variantId,
    unitId: row.unitId,
    predefinedQty: row.predefinedQty,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    color: row.color,
    icon: row.icon,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToButtonJSON(row: any) {
  return {
    id: row.id,
    companyId: row.companyId,
    layoutId: row.layoutId,
    zone: row.zone,
    commandCode: row.commandCode,
    label: row.label,
    secondaryLabel: row.secondaryLabel,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    isVisible: row.isVisible,
    isActive: row.isActive,
    requiredPermission: row.requiredPermission,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
