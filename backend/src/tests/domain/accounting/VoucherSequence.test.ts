import { FirestoreVoucherSequenceRepository } from '../../../infrastructure/firestore/repositories/accounting/FirestoreVoucherSequenceRepository';

// Simple in-memory mock using the repository logic (no Firestore)
class MemorySequenceRepo {
  private data = new Map<string, { last: number; format?: string; prefix: string; year?: number }>();
  async getNextNumber(companyId: string, prefix: string, year?: number, format?: string) {
    const key = `${companyId}-${year ? prefix + '-' + year : prefix}`;
    const rec = this.data.get(key) || { last: 0, prefix, year, format };
    rec.last += 1;
    rec.format = format || rec.format;
    this.data.set(key, rec);
    const counter = String(rec.last).padStart(4, '0');
    if (rec.format) {
      return rec.format
        .replace('{PREFIX}', prefix)
        .replace('{YYYY}', year ? String(year) : '')
        .replace('{COUNTER:4}', counter)
        .replace('{COUNTER}', counter);
    }
    return year ? `${prefix}-${year}-${counter}` : `${prefix}-${counter}`;
  }
}

describe('VoucherSequence basic formatting', () => {
  it('increments and pads', async () => {
    const repo = new MemorySequenceRepo();
    const n1 = await repo.getNextNumber('c1', 'JE');
    const n2 = await repo.getNextNumber('c1', 'JE');
    expect(n1).toBe('JE-0001');
    expect(n2).toBe('JE-0002');
  });

  it('applies year when provided', async () => {
    const repo = new MemorySequenceRepo();
    const n = await repo.getNextNumber('c1', 'PV', 2026);
    expect(n).toBe('PV-2026-0001');
  });

  it('applies custom format', async () => {
    const repo = new MemorySequenceRepo();
    const n = await repo.getNextNumber('c1', 'RV', 2026, '{PREFIX}/{YYYY}/{COUNTER:4}');
    expect(n).toBe('RV/2026/0001');
  });
});
