import { Firestore } from 'firebase-admin/firestore';
import {
  PosControlButton,
  PosControlButtonLayout,
  PosProductShortcutLayout,
  PosProductShortcutNode,
} from '../../../../domain/pos/entities/PosLayout';
import { IPosLayoutRepository } from '../../../../repository/interfaces/pos/IPosLayoutRepository';

export class FirestorePosLayoutRepository implements IPosLayoutRepository {
  constructor(private readonly db: Firestore) {}

  private root(companyId: string) {
    return this.db.collection('companies').doc(companyId);
  }

  private productLayouts(companyId: string) {
    return this.root(companyId).collection('posProductShortcutLayouts');
  }

  private productNodes(companyId: string) {
    return this.root(companyId).collection('posProductShortcutNodes');
  }

  private controlLayouts(companyId: string) {
    return this.root(companyId).collection('posControlButtonLayouts');
  }

  private controlButtons(companyId: string) {
    return this.root(companyId).collection('posControlButtons');
  }

  async createProductLayout(layout: PosProductShortcutLayout): Promise<void> {
    await this.productLayouts(layout.companyId).doc(layout.id).set(stripUndefinedDeep(layout.toJSON()));
  }

  async updateProductLayout(layout: PosProductShortcutLayout): Promise<void> {
    await this.productLayouts(layout.companyId).doc(layout.id).set(stripUndefinedDeep(layout.toJSON()), { merge: true });
  }

  async deleteProductLayout(companyId: string, id: string): Promise<void> {
    await this.productLayouts(companyId).doc(id).delete();
  }

  async getProductLayout(companyId: string, id: string): Promise<PosProductShortcutLayout | null> {
    const doc = await this.productLayouts(companyId).doc(id).get();
    return doc.exists ? PosProductShortcutLayout.fromJSON(doc.data()) : null;
  }

  async listProductLayouts(companyId: string): Promise<PosProductShortcutLayout[]> {
    const snap = await this.productLayouts(companyId).get();
    return snap.docs.map((doc) => PosProductShortcutLayout.fromJSON(doc.data()));
  }

  async createProductNode(node: PosProductShortcutNode): Promise<void> {
    await this.productNodes(node.companyId).doc(node.id).set(stripUndefinedDeep(node.toJSON()));
  }

  async updateProductNode(node: PosProductShortcutNode): Promise<void> {
    await this.productNodes(node.companyId).doc(node.id).set(stripUndefinedDeep(node.toJSON()), { merge: true });
  }

  async deleteProductNode(companyId: string, id: string): Promise<void> {
    await this.productNodes(companyId).doc(id).delete();
  }

  async getProductNode(companyId: string, id: string): Promise<PosProductShortcutNode | null> {
    const doc = await this.productNodes(companyId).doc(id).get();
    return doc.exists ? PosProductShortcutNode.fromJSON(doc.data()) : null;
  }

  async listProductNodes(companyId: string, layoutId: string): Promise<PosProductShortcutNode[]> {
    const snap = await this.productNodes(companyId).where('layoutId', '==', layoutId).get();
    return snap.docs.map((doc) => PosProductShortcutNode.fromJSON(doc.data()));
  }

  async createControlLayout(layout: PosControlButtonLayout): Promise<void> {
    await this.controlLayouts(layout.companyId).doc(layout.id).set(stripUndefinedDeep(layout.toJSON()));
  }

  async updateControlLayout(layout: PosControlButtonLayout): Promise<void> {
    await this.controlLayouts(layout.companyId).doc(layout.id).set(stripUndefinedDeep(layout.toJSON()), { merge: true });
  }

  async deleteControlLayout(companyId: string, id: string): Promise<void> {
    await this.controlLayouts(companyId).doc(id).delete();
  }

  async getControlLayout(companyId: string, id: string): Promise<PosControlButtonLayout | null> {
    const doc = await this.controlLayouts(companyId).doc(id).get();
    return doc.exists ? PosControlButtonLayout.fromJSON(doc.data()) : null;
  }

  async listControlLayouts(companyId: string): Promise<PosControlButtonLayout[]> {
    const snap = await this.controlLayouts(companyId).get();
    return snap.docs.map((doc) => PosControlButtonLayout.fromJSON(doc.data()));
  }

  async createControlButton(button: PosControlButton): Promise<void> {
    await this.controlButtons(button.companyId).doc(button.id).set(stripUndefinedDeep(button.toJSON()));
  }

  async updateControlButton(button: PosControlButton): Promise<void> {
    await this.controlButtons(button.companyId).doc(button.id).set(stripUndefinedDeep(button.toJSON()), { merge: true });
  }

  async deleteControlButton(companyId: string, id: string): Promise<void> {
    await this.controlButtons(companyId).doc(id).delete();
  }

  async getControlButton(companyId: string, id: string): Promise<PosControlButton | null> {
    const doc = await this.controlButtons(companyId).doc(id).get();
    return doc.exists ? PosControlButton.fromJSON(doc.data()) : null;
  }

  async listControlButtons(companyId: string, layoutId: string): Promise<PosControlButton[]> {
    const snap = await this.controlButtons(companyId).where('layoutId', '==', layoutId).get();
    return snap.docs.map((doc) => PosControlButton.fromJSON(doc.data()));
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefinedDeep(item)])
    ) as T;
  }
  return value;
}
