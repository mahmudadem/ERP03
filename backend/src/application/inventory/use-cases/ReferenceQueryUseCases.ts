import { ReferenceType, StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';

export class GetMovementForReferenceUseCase {
  constructor(private readonly movementRepo: IStockMovementRepository) {}

  async execute(
    companyId: string,
    referenceType: ReferenceType,
    referenceId: string,
    referenceLineId?: string
  ): Promise<StockMovement | null> {
    if (!referenceId?.trim()) throw new Error('referenceId is required');

    return this.movementRepo.getMovementByReference(
      companyId,
      referenceType,
      referenceId,
      referenceLineId
    );
  }
}

