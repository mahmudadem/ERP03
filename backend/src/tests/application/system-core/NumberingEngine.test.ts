import { NumberingEngine } from '../../../application/system-core/numbering/NumberingEngine';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';
import { VoucherSequence } from '../../../domain/accounting/entities/VoucherSequence';

class InMemorySequenceRepository implements IVoucherSequenceRepository {
  private readonly store = new Map<string, VoucherSequence>();

  async getNextNumber(companyId: string, prefix: string, year?: number, format?: string): Promise<string> {
    const key = this.key(companyId, prefix, year);
    const current = this.store.get(key);
    const next = (current?.lastNumber || 0) + 1;
    this.store.set(key, {
      id: key,
      companyId,
      prefix,
      year,
      lastNumber: next,
      format: format || current?.format || '',
      updatedAt: new Date(),
    });
    return this.format(prefix, next, year, format || current?.format);
  }

  async getCurrentSequence(companyId: string, prefix: string, year?: number): Promise<VoucherSequence | null> {
    return this.store.get(this.key(companyId, prefix, year)) || null;
  }

  async setNextNumber(companyId: string, prefix: string, nextNumber: number, year?: number, format?: string): Promise<void> {
    const key = this.key(companyId, prefix, year);
    this.store.set(key, {
      id: key,
      companyId,
      prefix,
      year,
      lastNumber: Math.max(0, nextNumber - 1),
      format: format || '',
      updatedAt: new Date(),
    });
  }

  async listSequences(companyId: string): Promise<VoucherSequence[]> {
    return Array.from(this.store.values()).filter((seq) => seq.companyId === companyId);
  }

  private key(companyId: string, prefix: string, year?: number): string {
    return `${companyId}/${prefix}/${year || 'all'}`;
  }

  private format(prefix: string, next: number, year?: number, format?: string): string {
    if (!format) return year ? `${prefix}-${year}-${String(next).padStart(4, '0')}` : `${prefix}-${String(next).padStart(4, '0')}`;
    return format
      .replace('{PREFIX}', prefix)
      .replace('{YYYY}', year ? String(year) : '')
      .replace(/\{COUNTER:(\d+)\}/g, (_match, width) => String(next).padStart(Number(width) || 4, '0'))
      .replace('{COUNTER}', String(next).padStart(4, '0'));
  }
}

describe('NumberingEngine', () => {
  it('allocates independent counters per company, branch, and terminal scope', async () => {
    const engine = new NumberingEngine(new InMemorySequenceRepository());

    await expect(engine.next({ companyId: 'c1', docType: 'SI', scope: 'company', prefix: 'SI', counterWidth: 5 })).resolves.toBe('SI-00001');
    await expect(engine.next({ companyId: 'c1', docType: 'SI', scope: 'branch', branchId: 'b1', prefix: 'SI', counterWidth: 5 })).resolves.toBe('SI-00001');
    await expect(engine.next({ companyId: 'c1', docType: 'SI', scope: 'branch', branchId: 'b2', prefix: 'SI', counterWidth: 5 })).resolves.toBe('SI-00001');
    await expect(engine.next({ companyId: 'c1', docType: 'POS_RECEIPT', scope: 'terminal', terminalId: 't1', prefix: 'R', counterWidth: 6 })).resolves.toBe('R-000001');
    await expect(engine.next({ companyId: 'c1', docType: 'POS_RECEIPT', scope: 'terminal', terminalId: 't1', prefix: 'R', counterWidth: 6 })).resolves.toBe('R-000002');
  });

  it('seeds from legacy next sequence without resetting existing unified sequence state', async () => {
    const engine = new NumberingEngine(new InMemorySequenceRepository());

    await expect(engine.next({ companyId: 'c1', docType: 'POS_RECEIPT', scope: 'terminal', terminalId: 'reg1', prefix: 'R', counterWidth: 6, seedNextNumber: 17 })).resolves.toBe('R-000017');
    await expect(engine.next({ companyId: 'c1', docType: 'POS_RECEIPT', scope: 'terminal', terminalId: 'reg1', prefix: 'R', counterWidth: 6, seedNextNumber: 99 })).resolves.toBe('R-000018');
  });
});
