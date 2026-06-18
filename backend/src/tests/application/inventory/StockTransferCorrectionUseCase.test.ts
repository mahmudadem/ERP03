import {
  UndoStockTransferUseCase,
  UpdateStockTransferUseCase,
} from '../../../application/inventory/use-cases/StockTransferUseCases';
import { StockTransfer, StockTransferStatus } from '../../../domain/inventory/entities/StockTransfer';

describe('Stock transfer correction use cases', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';

  const makeTransfer = (overrides: Partial<ConstructorParameters<typeof StockTransfer>[0]> = {}) =>
    new StockTransfer({
      id: 'trf-1',
      companyId: COMPANY_ID,
      sourceWarehouseId: 'wh-A',
      destinationWarehouseId: 'wh-B',
      date: '2026-05-01',
      mode: 'VALUED',
      lines: [{ itemId: 'item-1', qty: 5, unitCostBaseAtTransfer: 12, unitCostCCYAtTransfer: 12 }],
      status: 'DRAFT' as StockTransferStatus,
      transferPairId: 'pair-1',
      createdBy: USER_ID,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      ...overrides,
    });

  describe('UpdateStockTransferUseCase', () => {
    it('updates a DRAFT transfer with validated transfer data', async () => {
      const existing = makeTransfer();
      const candidate = makeTransfer({
        id: 'candidate-1',
        sourceWarehouseId: 'wh-C',
        destinationWarehouseId: 'wh-D',
        date: '2026-05-02',
        notes: 'new notes',
        mode: 'FLAT',
        lines: [{ itemId: 'item-2', qty: 2, unitCostBaseAtTransfer: 0, unitCostCCYAtTransfer: 0 }],
      });
      const updated = makeTransfer({ ...candidate.toJSON(), id: existing.id } as any);
      const transferRepo = {
        getTransfer: jest.fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(updated),
        updateTransfer: jest.fn(async () => undefined),
      };
      const createUseCase = { buildDraft: jest.fn(async () => candidate) };

      const result = await new UpdateStockTransferUseCase(transferRepo as any, createUseCase as any).execute({
        companyId: COMPANY_ID,
        transferId: existing.id,
        sourceWarehouseId: 'wh-C',
        destinationWarehouseId: 'wh-D',
        date: '2026-05-02',
        mode: 'FLAT',
        lines: [{ itemId: 'item-2', qty: 2 }],
        createdBy: USER_ID,
      });

      expect(createUseCase.buildDraft).toHaveBeenCalled();
      expect(transferRepo.updateTransfer).toHaveBeenCalledWith(existing.id, expect.objectContaining({
        sourceWarehouseId: 'wh-C',
        destinationWarehouseId: 'wh-D',
        mode: 'FLAT',
      }));
      expect(result.id).toBe(existing.id);
    });

    it('refuses to edit a COMPLETED transfer', async () => {
      const transferRepo = {
        getTransfer: jest.fn(async () => makeTransfer({ status: 'COMPLETED' })),
      };
      const createUseCase = { buildDraft: jest.fn() };

      await expect(new UpdateStockTransferUseCase(transferRepo as any, createUseCase as any).execute({
        companyId: COMPANY_ID,
        transferId: 'trf-1',
        sourceWarehouseId: 'wh-C',
        destinationWarehouseId: 'wh-D',
        date: '2026-05-02',
        mode: 'FLAT',
        lines: [{ itemId: 'item-2', qty: 2 }],
        createdBy: USER_ID,
      })).rejects.toThrow('Only DRAFT');
      expect(createUseCase.buildDraft).not.toHaveBeenCalled();
    });
  });

  describe('UndoStockTransferUseCase', () => {
    it('creates and completes a linked reverse transfer for a COMPLETED transfer', async () => {
      const original = makeTransfer({ status: 'COMPLETED' });
      const reverseDraft = makeTransfer({
        id: 'trf-rev',
        sourceWarehouseId: original.destinationWarehouseId,
        destinationWarehouseId: original.sourceWarehouseId,
        status: 'DRAFT',
      });
      const reverseCompleted = makeTransfer({
        ...reverseDraft.toJSON(),
        status: 'COMPLETED',
      } as any);
      const transferRepo = {
        getTransfer: jest.fn()
          .mockResolvedValueOnce(original)
          .mockResolvedValueOnce(reverseCompleted),
        updateTransfer: jest.fn(async () => undefined),
      };
      const createUseCase = { execute: jest.fn(async () => reverseDraft) };
      const completeUseCase = { execute: jest.fn(async () => reverseCompleted) };

      const result = await new UndoStockTransferUseCase(
        transferRepo as any,
        createUseCase as any,
        completeUseCase as any
      ).execute(COMPANY_ID, original.id, USER_ID, '2026-05-03');

      expect(createUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
        sourceWarehouseId: original.destinationWarehouseId,
        destinationWarehouseId: original.sourceWarehouseId,
        date: '2026-05-03',
      }));
      expect(transferRepo.updateTransfer).toHaveBeenCalledWith(reverseDraft.id, { reversesTransferId: original.id });
      expect(completeUseCase.execute).toHaveBeenCalledWith(COMPANY_ID, reverseDraft.id, USER_ID);
      expect(transferRepo.updateTransfer).toHaveBeenCalledWith(original.id, { reversedByTransferId: reverseCompleted.id });
      expect(result.id).toBe(reverseCompleted.id);
    });

    it('refuses to undo a DRAFT transfer', async () => {
      const transferRepo = { getTransfer: jest.fn(async () => makeTransfer({ status: 'DRAFT' })) };
      const useCase = new UndoStockTransferUseCase(transferRepo as any, {} as any, {} as any);
      await expect(useCase.execute(COMPANY_ID, 'trf-1', USER_ID)).rejects.toThrow('Only COMPLETED');
    });

    it('refuses to undo a transfer twice', async () => {
      const transferRepo = {
        getTransfer: jest.fn(async () => makeTransfer({ status: 'COMPLETED', reversedByTransferId: 'trf-rev' })),
      };
      const useCase = new UndoStockTransferUseCase(transferRepo as any, {} as any, {} as any);
      await expect(useCase.execute(COMPANY_ID, 'trf-1', USER_ID)).rejects.toThrow('already been undone');
    });

    it('refuses to undo a reversal transfer', async () => {
      const transferRepo = {
        getTransfer: jest.fn(async () => makeTransfer({ status: 'COMPLETED', reversesTransferId: 'trf-original' })),
      };
      const useCase = new UndoStockTransferUseCase(transferRepo as any, {} as any, {} as any);
      await expect(useCase.execute(COMPANY_ID, 'trf-1', USER_ID)).rejects.toThrow('Reversal');
    });
  });
});
