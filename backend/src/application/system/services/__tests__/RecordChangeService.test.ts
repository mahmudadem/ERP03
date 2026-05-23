import { RecordChangeService } from '../RecordChangeService';
import { IRecordChangeLogRepository } from '../../../../repository/interfaces/system/IRecordChangeLogRepository';
import { RecordChangeLog } from '../../../../domain/system/entities/RecordChangeLog';

describe('RecordChangeService', () => {
  let repo: jest.Mocked<IRecordChangeLogRepository>;
  let service: RecordChangeService;

  beforeEach(() => {
    repo = { create: jest.fn() } as any;
    service = new RecordChangeService(repo);
  });

  it('records a single field change', async () => {
    await service.recordUpdate({
      companyId: 'comp-1',
      entityType: 'SALES_INVOICE',
      entityId: 'si-1',
      userId: 'user-1',
      before: { description: 'Old desc', total: 100 },
      after: { description: 'New desc', total: 100 },
    });
    expect(repo.create).toHaveBeenCalledTimes(1);
    const entry = (repo.create as jest.Mock).mock.calls[0][0] as RecordChangeLog;
    expect(entry.changes).toHaveLength(1);
    expect(entry.changes[0].field).toBe('description');
    expect(entry.changes[0].before).toBe('Old desc');
    expect(entry.changes[0].after).toBe('New desc');
  });

  it('records multiple field changes', async () => {
    await service.recordUpdate({
      companyId: 'comp-1',
      entityType: 'SALES_INVOICE',
      entityId: 'si-1',
      userId: 'user-1',
      before: { description: 'Old', total: 100, notes: 'Same' },
      after: { description: 'New', total: 200, notes: 'Same' },
    });
    expect(repo.create).toHaveBeenCalledTimes(1);
    const entry = (repo.create as jest.Mock).mock.calls[0][0] as RecordChangeLog;
    expect(entry.changes.length).toBeGreaterThanOrEqual(2);
    const fields = entry.changes.map((c) => c.field);
    expect(fields).toContain('description');
    expect(fields).toContain('total');
  });

  it('writes nothing when no fields changed', async () => {
    await service.recordUpdate({
      companyId: 'comp-1',
      entityType: 'SALES_INVOICE',
      entityId: 'si-1',
      userId: 'user-1',
      before: { description: 'Same', total: 100 },
      after: { description: 'Same', total: 100 },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('records non-primitive (lines) change as one stringified entry', async () => {
    const linesBefore = [{ itemId: 'item-1', qty: 5 }];
    const linesAfter = [{ itemId: 'item-1', qty: 10 }];
    await service.recordUpdate({
      companyId: 'comp-1',
      entityType: 'SALES_INVOICE',
      entityId: 'si-1',
      userId: 'user-1',
      before: { lines: linesBefore },
      after: { lines: linesAfter },
    });
    expect(repo.create).toHaveBeenCalledTimes(1);
    const entry = (repo.create as jest.Mock).mock.calls[0][0] as RecordChangeLog;
    const lineChange = entry.changes.find((c) => c.field === 'lines');
    expect(lineChange).toBeDefined();
    expect(typeof lineChange!.before).toBe('string');
    expect(typeof lineChange!.after).toBe('string');
    expect(lineChange!.before).toContain('item-1');
    expect(lineChange!.before).toContain('5');
    expect(lineChange!.after).toContain('10');
  });
});
