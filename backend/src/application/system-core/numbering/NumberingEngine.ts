import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { INumberingEngine, NumberingRequest } from '../contracts/INumberingEngine';

const safeKeyPart = (value: string | undefined, fallback: string): string => {
  const raw = (value || fallback).trim();
  return raw.replace(/[^A-Za-z0-9_-]+/g, '_') || fallback;
};

const buildScopedPrefix = (request: NumberingRequest): string => {
  const docType = safeKeyPart(request.docType, 'DOC');
  const scope = safeKeyPart(request.scope, 'company');
  const scopeId = request.scope === 'terminal'
    ? safeKeyPart(request.terminalId, 'terminal')
    : request.scope === 'branch'
      ? safeKeyPart(request.branchId, 'branch')
      : 'company';
  return `SYSNUM__${docType}__${scope}__${scopeId}`;
};

const buildFormat = (displayPrefix: string, width: number, year?: number): string => (
  year
    ? `${displayPrefix}-{YYYY}-{COUNTER:${width}}`
    : `${displayPrefix}-{COUNTER:${width}}`
);

export class NumberingEngine implements INumberingEngine {
  constructor(private readonly sequenceRepository: IVoucherSequenceRepository) {}

  async next(request: NumberingRequest): Promise<string> {
    const displayPrefix = request.prefix?.trim() || request.docType;
    const counterWidth = request.counterWidth && request.counterWidth > 0 ? request.counterWidth : 4;
    const storagePrefix = buildScopedPrefix(request);
    const format = request.format || buildFormat(displayPrefix, counterWidth, request.year);

    const current = await this.sequenceRepository.getCurrentSequence(request.companyId, storagePrefix, request.year);
    if (!current && request.seedNextNumber && request.seedNextNumber > 1) {
      await this.sequenceRepository.setNextNumber(
        request.companyId,
        storagePrefix,
        request.seedNextNumber,
        request.year,
        format,
      );
    }

    return this.sequenceRepository.getNextNumber(request.companyId, storagePrefix, request.year, format);
  }
}
