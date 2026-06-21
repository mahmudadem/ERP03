import {
  DocumentIdentity,
  DocumentPersona,
  IDocumentCore,
  LegacyDocumentPersona,
} from '../contracts/IDocumentCore';

const legacyToCanonical: Record<LegacyDocumentPersona, DocumentPersona> = {
  direct: 'SALES_DIRECT_INVOICE',
  linked: 'SALES_LINKED_INVOICE',
  service: 'SERVICE',
};

export class LegacyDocumentCoreAdapter implements IDocumentCore {
  createIdentity(docType: string, persona: DocumentPersona | LegacyDocumentPersona): DocumentIdentity {
    const canonical = this.toCanonical(persona);
    return {
      docType,
      persona: canonical,
      legacyPersona: this.toLegacy(canonical),
    };
  }

  transition(identity: DocumentIdentity, state: string): DocumentIdentity {
    return { ...identity, state };
  }

  assertEditable(identity: DocumentIdentity): void {
    if (String(identity.state || '').toUpperCase() === 'POSTED') {
      throw new Error(`Document ${identity.docType} is not editable after posting`);
    }
  }

  private toCanonical(persona: DocumentPersona | LegacyDocumentPersona): DocumentPersona {
    if (persona === 'direct' || persona === 'linked' || persona === 'service') {
      return legacyToCanonical[persona];
    }
    return persona;
  }

  private toLegacy(persona: DocumentPersona): LegacyDocumentPersona | undefined {
    if (persona === 'SALES_DIRECT_INVOICE') return 'direct';
    if (persona === 'SALES_LINKED_INVOICE') return 'linked';
    if (persona === 'SERVICE') return 'service';
    return undefined;
  }
}

