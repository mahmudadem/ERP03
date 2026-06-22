import {
  PosControlButton,
  PosControlButtonLayout,
  PosProductShortcutLayout,
  PosProductShortcutNode,
} from '../../../domain/pos/entities/PosLayout';

export interface IPosLayoutRepository {
  createProductLayout(layout: PosProductShortcutLayout): Promise<void>;
  updateProductLayout(layout: PosProductShortcutLayout): Promise<void>;
  deleteProductLayout(companyId: string, id: string): Promise<void>;
  getProductLayout(companyId: string, id: string): Promise<PosProductShortcutLayout | null>;
  listProductLayouts(companyId: string): Promise<PosProductShortcutLayout[]>;

  createProductNode(node: PosProductShortcutNode): Promise<void>;
  updateProductNode(node: PosProductShortcutNode): Promise<void>;
  deleteProductNode(companyId: string, id: string): Promise<void>;
  getProductNode(companyId: string, id: string): Promise<PosProductShortcutNode | null>;
  listProductNodes(companyId: string, layoutId: string): Promise<PosProductShortcutNode[]>;

  createControlLayout(layout: PosControlButtonLayout): Promise<void>;
  updateControlLayout(layout: PosControlButtonLayout): Promise<void>;
  deleteControlLayout(companyId: string, id: string): Promise<void>;
  getControlLayout(companyId: string, id: string): Promise<PosControlButtonLayout | null>;
  listControlLayouts(companyId: string): Promise<PosControlButtonLayout[]>;

  createControlButton(button: PosControlButton): Promise<void>;
  updateControlButton(button: PosControlButton): Promise<void>;
  deleteControlButton(companyId: string, id: string): Promise<void>;
  getControlButton(companyId: string, id: string): Promise<PosControlButton | null>;
  listControlButtons(companyId: string, layoutId: string): Promise<PosControlButton[]>;
}
