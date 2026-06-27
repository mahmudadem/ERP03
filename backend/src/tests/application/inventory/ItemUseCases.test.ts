import { CreateItemUseCase, UpdateItemUseCase } from '../../../application/inventory/use-cases/ItemUseCases';
import { IItemRepository } from '../../../repository/interfaces/inventory';
import { Item } from '../../../domain/inventory/entities/Item';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

describe('ItemUseCases Barcode Uniqueness', () => {
  let mockItemRepo: jest.Mocked<IItemRepository>;
  let createUseCase: CreateItemUseCase;
  let updateUseCase: UpdateItemUseCase;

  beforeEach(() => {
    mockItemRepo = {
      getItemByCode: jest.fn(),
      getItemByBarcode: jest.fn(),
      createItem: jest.fn(),
      getItem: jest.fn(),
      hasMovements: jest.fn(),
      updateItem: jest.fn(),
    } as any;
    createUseCase = new CreateItemUseCase(mockItemRepo);
    updateUseCase = new UpdateItemUseCase(mockItemRepo);
  });

  describe('CreateItemUseCase', () => {
    it('should throw VAL_DUPLICATE_ENTRY if barcodes array contains duplicates internally', async () => {
      const input: any = {
        companyId: 'c1',
        code: 'ITM1',
        name: 'Item 1',
        type: 'PRODUCT',
        baseUom: 'pcs',
        costCurrency: 'USD',
        trackInventory: true,
        createdBy: 'user1',
        barcodes: ['123', ' 123 '], // Duplicates when trimmed
      };

      await expect(createUseCase.execute(input)).rejects.toThrow(
        new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, 'Duplicate barcode in payload: 123', { field: 'barcodes', value: '123' })
      );
      expect(mockItemRepo.getItemByBarcode).not.toHaveBeenCalled();
    });

    it('should throw VAL_DUPLICATE_ENTRY if primary barcode duplicates an entry in barcodes array', async () => {
      const input: any = {
        companyId: 'c1',
        code: 'ITM1',
        name: 'Item 1',
        type: 'PRODUCT',
        baseUom: 'pcs',
        costCurrency: 'USD',
        trackInventory: true,
        createdBy: 'user1',
        barcode: '123',
        barcodes: ['456', '123'], // Primary barcode is also in the array
      };

      await expect(createUseCase.execute(input)).rejects.toThrow(
        new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, 'Duplicate barcode in payload: 123', { field: 'barcodes', value: '123' })
      );
    });

    it('should query DB and throw if barcode already exists', async () => {
      mockItemRepo.getItemByBarcode.mockResolvedValue({ id: 'existing-item' } as Item);

      const input: any = {
        companyId: 'c1',
        code: 'ITM1',
        name: 'Item 1',
        type: 'PRODUCT',
        baseUom: 'pcs',
        costCurrency: 'USD',
        trackInventory: true,
        createdBy: 'user1',
        barcode: '123',
      };

      await expect(createUseCase.execute(input)).rejects.toThrow(
        new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, 'Barcode already in use: 123', { field: 'barcodes', value: '123' })
      );
    });
  });

  describe('UpdateItemUseCase', () => {
    it('should throw if internal duplicates are found during update', async () => {
      mockItemRepo.getItem.mockResolvedValue({ id: 'item1', companyId: 'c1', type: 'PRODUCT' } as Item);
      
      const input: any = {
        barcodes: ['999', '999'],
      };

      await expect(updateUseCase.execute('item1', input)).rejects.toThrow(
        new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, 'Duplicate barcode in payload: 999', { field: 'barcodes', value: '999' })
      );
    });

    it('should query DB and throw if barcode belongs to another item', async () => {
      mockItemRepo.getItem.mockResolvedValue({ id: 'item1', companyId: 'c1', type: 'PRODUCT' } as Item);
      mockItemRepo.getItemByBarcode.mockResolvedValue({ id: 'item2', companyId: 'c1' } as Item);

      const input: any = {
        barcode: '999',
      };

      await expect(updateUseCase.execute('item1', input)).rejects.toThrow(
        new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, 'Barcode already in use: 999', { field: 'barcodes', value: '999' })
      );
    });

    it('should not throw if the barcode belongs to the item being updated', async () => {
      mockItemRepo.getItem.mockResolvedValue({ id: 'item1', companyId: 'c1', type: 'PRODUCT' } as Item);
      // DB says this barcode belongs to 'item1'
      mockItemRepo.getItemByBarcode.mockResolvedValue({ id: 'item1', companyId: 'c1' } as Item);
      mockItemRepo.hasMovements.mockResolvedValue(false);

      const input: any = {
        barcode: '999',
      };

      await updateUseCase.execute('item1', input);
      // If it doesn't throw, test passes
      expect(mockItemRepo.getItemByBarcode).toHaveBeenCalledWith('c1', '999');
    });
  });
});
