import { CancelStockTransferUseCase } from '../../../application/inventory/use-cases/StockTransferUseCases';
import { StockTransfer, StockTransferStatus } from '../../../domain/inventory/entities/StockTransfer';

/**
 * A DRAFT transfer posts no movements and no GL voucher, so cancelling it is a
 * safe hard-delete. A COMPLETED transfer has posted stock + possibly an uplift
 * voucher — deleting it here would orphan them, so it must be refused.
 */
describe('CancelStockTransferUseCase', () => {
  const COMPANY_ID = 'cmp-1';

  const makeTransfer = (status: StockTransferStatus) =>
    new StockTransfer({
      id: 'trf-1',
      companyId: COMPANY_ID,
      sourceWarehouseId: 'wh-A',
      destinationWarehouseId: 'wh-B',
      date: '2026-05-01',
      mode: 'FLAT',
      lines: [{ itemId: 'item-1', qty: 5, unitCostBaseAtTransfer: 0, unitCostCCYAtTransfer: 0 }],
      status,
      transferPairId: 'pair-1',
      createdBy: 'u-1',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    });

  const buildUseCase = (transfer: StockTransfer | null) => {
    const deleteTransfer = jest.fn(async () => undefined);
    const transferRepo = {
      getTransfer: jest.fn(async () => transfer),
      deleteTransfer,
    } as any;
    return { useCase: new CancelStockTransferUseCase(transferRepo), deleteTransfer };
  };

  it('hard-deletes a DRAFT transfer', async () => {
    const { useCase, deleteTransfer } = buildUseCase(makeTransfer('DRAFT'));
    await useCase.execute(COMPANY_ID, 'trf-1');
    expect(deleteTransfer).toHaveBeenCalledWith('trf-1');
  });

  it('refuses to cancel a COMPLETED transfer', async () => {
    const { useCase, deleteTransfer } = buildUseCase(makeTransfer('COMPLETED'));
    await expect(useCase.execute(COMPANY_ID, 'trf-1')).rejects.toThrow('Only DRAFT');
    expect(deleteTransfer).not.toHaveBeenCalled();
  });

  it('throws when the transfer does not exist', async () => {
    const { useCase, deleteTransfer } = buildUseCase(null);
    await expect(useCase.execute(COMPANY_ID, 'missing')).rejects.toThrow('not found');
    expect(deleteTransfer).not.toHaveBeenCalled();
  });

  it('throws when the transfer belongs to another company', async () => {
    const foreign = makeTransfer('DRAFT');
    (foreign as any).companyId = 'other-co';
    const { useCase, deleteTransfer } = buildUseCase(foreign);
    await expect(useCase.execute(COMPANY_ID, 'trf-1')).rejects.toThrow('not found');
    expect(deleteTransfer).not.toHaveBeenCalled();
  });
});
