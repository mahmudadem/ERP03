export type LegacyDocumentPersona = 'direct' | 'linked' | 'service';

export type DocumentPersona =
  | 'SALES_DIRECT_INVOICE'
  | 'SALES_LINKED_INVOICE'
  | 'POS_DIRECT_SALE'
  | 'SERVICE';

export interface DocumentIdentity {
  docType: string;
  persona: DocumentPersona | LegacyDocumentPersona;
  legacyPersona?: LegacyDocumentPersona;
  state?: string;
  metadata?: Record<string, unknown>;
}

export interface IDocumentCore {
  createIdentity(docType: string, persona: DocumentPersona | LegacyDocumentPersona): DocumentIdentity;
  transition(identity: DocumentIdentity, state: string): DocumentIdentity;
  assertEditable(identity: DocumentIdentity): void;
}

