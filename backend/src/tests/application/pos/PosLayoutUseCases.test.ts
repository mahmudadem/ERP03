import {
  PosControlButton,
  PosControlButtonLayout,
  PosProductShortcutLayout,
  PosProductShortcutNode,
} from '../../../domain/pos/entities/PosLayout';
import { IPosLayoutRepository } from '../../../repository/interfaces/pos/IPosLayoutRepository';
import {
  CreatePosControlButtonUseCase,
  CreatePosProductShortcutNodeUseCase,
  ResolvePosRuntimeLayoutUseCase,
  UpdatePosProductShortcutNodeUseCase,
} from '../../../application/pos/use-cases/PosLayoutUseCases';
import { ExecutePosCommandUseCase } from '../../../application/pos/use-cases/PosCommandUseCases';
import { PosCommandRegistry } from '../../../application/pos/services/PosCommandRegistry';

const companyId = 'cmp_pos_layout';
const now = (offset = 0) => new Date(Date.UTC(2026, 0, 1, 0, 0, offset));

class InMemoryPosLayoutRepository implements IPosLayoutRepository {
  productLayouts = new Map<string, PosProductShortcutLayout>();
  productNodes = new Map<string, PosProductShortcutNode>();
  controlLayouts = new Map<string, PosControlButtonLayout>();
  controlButtons = new Map<string, PosControlButton>();

  async createProductLayout(layout: PosProductShortcutLayout) { this.productLayouts.set(layout.id, layout); }
  async updateProductLayout(layout: PosProductShortcutLayout) { this.productLayouts.set(layout.id, layout); }
  async deleteProductLayout(_companyId: string, id: string) { this.productLayouts.delete(id); }
  async getProductLayout(_companyId: string, id: string) { return this.productLayouts.get(id) || null; }
  async listProductLayouts(filterCompanyId: string) {
    return [...this.productLayouts.values()].filter((layout) => layout.companyId === filterCompanyId);
  }

  async createProductNode(node: PosProductShortcutNode) { this.productNodes.set(node.id, node); }
  async updateProductNode(node: PosProductShortcutNode) { this.productNodes.set(node.id, node); }
  async deleteProductNode(_companyId: string, id: string) { this.productNodes.delete(id); }
  async getProductNode(_companyId: string, id: string) { return this.productNodes.get(id) || null; }
  async listProductNodes(filterCompanyId: string, layoutId: string) {
    return [...this.productNodes.values()].filter((node) => node.companyId === filterCompanyId && node.layoutId === layoutId);
  }

  async createControlLayout(layout: PosControlButtonLayout) { this.controlLayouts.set(layout.id, layout); }
  async updateControlLayout(layout: PosControlButtonLayout) { this.controlLayouts.set(layout.id, layout); }
  async deleteControlLayout(_companyId: string, id: string) { this.controlLayouts.delete(id); }
  async getControlLayout(_companyId: string, id: string) { return this.controlLayouts.get(id) || null; }
  async listControlLayouts(filterCompanyId: string) {
    return [...this.controlLayouts.values()].filter((layout) => layout.companyId === filterCompanyId);
  }

  async createControlButton(button: PosControlButton) { this.controlButtons.set(button.id, button); }
  async updateControlButton(button: PosControlButton) { this.controlButtons.set(button.id, button); }
  async deleteControlButton(_companyId: string, id: string) { this.controlButtons.delete(id); }
  async getControlButton(_companyId: string, id: string) { return this.controlButtons.get(id) || null; }
  async listControlButtons(filterCompanyId: string, layoutId: string) {
    return [...this.controlButtons.values()].filter((button) => button.companyId === filterCompanyId && button.layoutId === layoutId);
  }
}

const productLayout = (id: string, scopeType: any, scopeId: string | null, isDefault = false, isActive = true, updatedOffset = 0) =>
  new PosProductShortcutLayout({
    id,
    companyId,
    name: id,
    scopeType,
    scopeId,
    isDefault,
    isActive,
    createdAt: now(updatedOffset),
    updatedAt: now(updatedOffset),
  });

const controlLayout = (id: string, scopeType: any, scopeId: string | null, isDefault = false, isActive = true, updatedOffset = 0) =>
  new PosControlButtonLayout({
    id,
    companyId,
    name: id,
    scopeType,
    scopeId,
    isDefault,
    isActive,
    createdAt: now(updatedOffset),
    updatedAt: now(updatedOffset),
  });

const shortcutNode = (props: any) =>
  new PosProductShortcutNode({
    companyId,
    parentId: null,
    itemId: props.nodeType === 'ITEM' ? 'item_1' : null,
    variantId: null,
    unitId: null,
    predefinedQty: null,
    sortOrder: 0,
    isActive: true,
    color: null,
    icon: null,
    imageUrl: null,
    createdAt: now(),
    updatedAt: now(),
    ...props,
  });

describe('POS layout use cases', () => {
  it('resolves runtime layouts by user, register, branch, then company default priority', async () => {
    const repo = new InMemoryPosLayoutRepository();
    await repo.createProductLayout(productLayout('company_default', 'COMPANY', null, true, true, 1));
    await repo.createProductLayout(productLayout('branch_layout', 'BRANCH', 'branch_1', false, true, 2));
    await repo.createProductLayout(productLayout('register_layout', 'REGISTER', 'register_1', false, true, 3));
    await repo.createProductLayout(productLayout('user_layout', 'USER', 'user_1', false, true, 4));
    await repo.createControlLayout(controlLayout('company_controls', 'COMPANY', null, true));
    await repo.createControlLayout(controlLayout('register_controls', 'REGISTER', 'register_1', false));

    const useCase = new ResolvePosRuntimeLayoutUseCase(repo);
    const runtime = await useCase.execute({ companyId, branchId: 'branch_1', registerId: 'register_1', userId: 'user_1' });

    expect(runtime.productShortcutLayout?.id).toBe('user_layout');
    expect(runtime.controlButtonLayout?.id).toBe('register_controls');
  });

  it('filters inactive layouts, inactive nodes, hidden buttons, and children under inactive parents', async () => {
    const repo = new InMemoryPosLayoutRepository();
    await repo.createProductLayout(productLayout('inactive_company', 'COMPANY', null, true, false, 5));
    await repo.createProductLayout(productLayout('active_company', 'COMPANY', null, true, true, 1));
    await repo.createControlLayout(controlLayout('controls', 'COMPANY', null, true));
    await repo.createProductNode(shortcutNode({ id: 'inactive_group', layoutId: 'active_company', nodeType: 'GROUP', label: 'Hidden', isActive: false }));
    await repo.createProductNode(shortcutNode({ id: 'child_hidden_by_parent', layoutId: 'active_company', parentId: 'inactive_group', nodeType: 'ITEM', label: 'Hidden Item' }));
    await repo.createProductNode(shortcutNode({ id: 'visible_item', layoutId: 'active_company', nodeType: 'ITEM', label: 'Visible', itemId: 'item_visible' }));
    await repo.createControlButton(new PosControlButton({
      id: 'hidden_button',
      companyId,
      layoutId: 'controls',
      zone: 'TOP_BAR',
      commandCode: 'HOLD_SALE',
      label: 'Hidden',
      sortOrder: 0,
      isVisible: false,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    }));
    await repo.createControlButton(new PosControlButton({
      id: 'visible_button',
      companyId,
      layoutId: 'controls',
      zone: 'TOP_BAR',
      commandCode: 'RECALL_SALE',
      label: 'Visible',
      sortOrder: 1,
      isVisible: true,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    }));

    const runtime = await new ResolvePosRuntimeLayoutUseCase(repo).execute({ companyId });

    expect(runtime.productShortcutLayout?.id).toBe('active_company');
    expect(runtime.productShortcutTree.map((node) => node.id)).toEqual(['visible_item']);
    expect(runtime.controlButtonsByZone.TOP_BAR.map((button) => button.id)).toEqual(['visible_button']);
  });

  it('validates shortcut node structure and parent graph', async () => {
    const repo = new InMemoryPosLayoutRepository();
    await repo.createProductLayout(productLayout('layout_1', 'COMPANY', null, true));
    const creator = new CreatePosProductShortcutNodeUseCase(repo);
    const updater = new UpdatePosProductShortcutNodeUseCase(repo);

    await expect(creator.execute({ companyId, layoutId: 'layout_1', nodeType: 'ITEM', label: 'Missing item' }))
      .rejects.toThrow(/ITEM shortcut nodes must reference an item/);
    await expect(creator.execute({ companyId, layoutId: 'layout_1', nodeType: 'GROUP', label: 'Group', itemId: 'item_1' }))
      .rejects.toThrow(/GROUP shortcut nodes cannot reference an item/);

    await creator.execute({ id: 'group_1', companyId, layoutId: 'layout_1', nodeType: 'GROUP', label: 'Group' });
    await creator.execute({ id: 'item_1', companyId, layoutId: 'layout_1', parentId: 'group_1', nodeType: 'ITEM', label: 'Item', itemId: 'item_1' });
    await expect(updater.execute(companyId, 'group_1', { parentId: 'item_1' }))
      .rejects.toThrow(/parent must be a GROUP node|circular parent references/);
  });

  it('rejects unknown control command codes and checks sensitive command permissions', async () => {
    const repo = new InMemoryPosLayoutRepository();
    await repo.createControlLayout(controlLayout('controls', 'COMPANY', null, true));
    const controlCreator = new CreatePosControlButtonUseCase(repo);

    await expect(controlCreator.execute({
      companyId,
      layoutId: 'controls',
      zone: 'TOP_BAR',
      commandCode: 'DELETE_DATABASE' as any,
      label: 'Bad',
    })).rejects.toThrow(/Invalid POS command code/);

    const permissionChecker = {
      assertOrThrow: jest.fn().mockRejectedValue(new Error('permission denied')),
    };
    const commandUseCase = new ExecutePosCommandUseCase(new PosCommandRegistry(), permissionChecker as any);

    await expect(commandUseCase.execute({
      companyId,
      userId: 'cashier_1',
      commandCode: 'REPRINT_LAST_RECEIPT',
      context: { registerId: 'register_1', shiftId: 'shift_1', receiptId: 'receipt_1' },
    })).rejects.toThrow(/permission denied/);
    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith('cashier_1', companyId, 'pos.receipt.reprint');
  });
});
