import { IPostingPolicy } from '../IPostingPolicy';
import { PostingPolicyContext, PolicyResult } from '../PostingPolicyTypes';
import { IAccountLookupService } from '../../services/IAccountLookupService';

/**
 * CostCenterRequiredPolicy
 * 
 * Enforces analytical discipline by requiring cost center assignment
 * on specific posting lines.
 * 
 * This is an ANALYTICAL/GOVERNANCE policy, NOT an accounting correctness policy.
 * It validates PRESENCE only, not amounts or balances.
 * 
 * When enabled:
 * - Checks each posting line
 * - If line's account matches configured rules (accountIds or accountTypes)
 * - costCenterId must be present (non-null, non-empty)
 * 
 * Config format:
 * - requiredFor.accountIds: ["acc-1", "acc-2"]
 * - requiredFor.accountTypes: ["expense"]
 * 
 * Disabled by default (simple-by-default principle).
 */
export class CostCenterRequiredPolicy implements IPostingPolicy {
  readonly id = 'cost-center-required';
  readonly name = 'Cost Center Required';

  constructor(
    private readonly requiredFor: {
      accountIds?: string[];
      accountTypes?: string[];
    },
    private readonly accountLookup: IAccountLookupService
  ) {}

  async validate(ctx: PostingPolicyContext): Promise<PolicyResult> {
    // No rules configured → policy passes
    if (!this.requiredFor.accountIds?.length && !this.requiredFor.accountTypes?.length) {
      return { ok: true };
    }

    // Extract all account IDs from posting lines
    const accountIds = ctx.lines.map(line => line.accountId);

    // Bulk load account metadata (avoid N+1 queries)
    const accountMap = await this.accountLookup.getAccountsByIds(ctx.companyId, accountIds);

    // Check each line for cost center requirement
    for (let i = 0; i < ctx.lines.length; i++) {
      const line = ctx.lines[i];
      const account = accountMap.get(line.accountId);

      if (!account) {
        // Account not found - skip (let core validation handle missing accounts)
        continue;
      }

      // Check if line matches rules
      const matchesAccountId = this.requiredFor.accountIds?.includes(line.accountId);
      const matchesAccountType = this.requiredFor.accountTypes?.includes(account.type);

      if (matchesAccountId || matchesAccountType) {
        // Cost center is required for this line
        if (!line.costCenterId || line.costCenterId.trim() === '') {
          return {
            ok: false,
            error: {
              code: 'COST_CENTER_REQUIRED',
              message: `Cost center is required for account "${account.name}" (${account.code || account.id})`,
              fieldHints: [`lines[${i}].costCenterId`]
            }
          };
        }
      }
    }

    return { ok: true };
  }
}
