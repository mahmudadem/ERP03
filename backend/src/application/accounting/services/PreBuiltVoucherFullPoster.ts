import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { PostingGateway } from './PostingGateway';

export interface PreBuiltVoucherFullPostInput {
  voucher: VoucherEntity;
  ledgerRepo: ILedgerRepository;
  voucherRepo: IVoucherRepository;
  voucherValidationService: VoucherValidationService;
  userId: string;
  exemptionReason: string;
  transaction?: unknown;
}

/**
 * Full-mode persistence for a pre-assembled system voucher. Source modules pass
 * this function as the bridge's `postFull` callback; the bridge decides whether
 * it is invoked.
 */
export async function postPreBuiltVoucherFullMode(input: PreBuiltVoucherFullPostInput): Promise<void> {
  const gateway = new PostingGateway(input.ledgerRepo, input.voucherValidationService);
  await gateway.record(
    input.voucher,
    {
      userId: input.userId,
      enforcePolicies: false,
      exemptionReason: input.exemptionReason,
    },
    input.transaction
  );
  await input.voucherRepo.save(input.voucher, input.transaction);
}
