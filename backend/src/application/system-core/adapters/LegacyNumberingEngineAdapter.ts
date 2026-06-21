import { INumberingEngine, NumberingRequest } from '../contracts/INumberingEngine';

export type LegacyNumberingDelegate = (request: NumberingRequest) => Promise<string>;

export class LegacyNumberingEngineAdapter implements INumberingEngine {
  constructor(private readonly delegate?: LegacyNumberingDelegate) {}

  async next(request: NumberingRequest): Promise<string> {
    if (this.delegate) return this.delegate(request);
    throw new Error(`Numbering engine adapter has no legacy delegate for ${request.docType}/${request.scope}`);
  }
}

