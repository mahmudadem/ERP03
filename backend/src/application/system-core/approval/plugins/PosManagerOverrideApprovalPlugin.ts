import {
  ApprovalContext,
  ApprovalEngineResult,
  ApprovalSubject,
  ApprovalSubjectType,
} from '../../contracts/IApprovalEngine';
import { ApprovalPlugin } from '../ApprovalSubjectRegistry';

/**
 * Subject types this plugin owns. These are the POS manager-override actions the
 * Approval Engine was designed to govern (see IApprovalEngine.ApprovalSubjectType).
 * VOID_LINE / RETURN / REPRINT map to the generic `pos_manager_override`; the
 * price/discount/tax overrides map to their dedicated subject types.
 */
const POS_OVERRIDE_SUBJECTS: ApprovalSubjectType[] = [
  'pos_manager_override',
  'price_override',
  'discount_override',
  'tax_override',
];

export interface PosManagerOverridePayload {
  /** When false the subject does not need approval and is auto-approved. Defaults to true. */
  requiresApproval?: boolean;
  /** The sensitive action being approved (VOID_LINE, PRICE_OVERRIDE, …). */
  action?: string;
  /** The cashier performing the action — must differ from the approver. */
  cashierUserId?: string;
  /** The manager approving the action — checked for identity and authority. */
  approverUserId?: string;
}

/**
 * Owns the *who approves and the outcome* half of POS manager overrides. The
 * Policy Engine still decides *whether* an override needs approval
 * (`CashierRolePolicy.managerOverrideActions`); this plugin then verifies the
 * approver is a real, authorised manager who is not the acting cashier, and
 * returns a real APPROVED / REJECTED / PENDING decision instead of trusting a
 * client-minted token.
 *
 *  - no approver yet            → PENDING (awaiting a manager)
 *  - approver === cashier       → REJECTED (no self-approval)
 *  - approver lacks authority   → REJECTED (authority enforced by the engine)
 *  - authorised, distinct mgr   → APPROVED
 */
export class PosManagerOverrideApprovalPlugin implements ApprovalPlugin {
  readonly name = 'pos_manager_override_approval';

  constructor(
    /** Resolves whether `userId` holds POS override-approval authority in `companyId`. */
    private readonly hasApproveAuthority: (companyId: string, userId: string) => Promise<boolean>
  ) {}

  supports(type: ApprovalSubjectType): boolean {
    return POS_OVERRIDE_SUBJECTS.includes(type);
  }

  async evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult> {
    const payload = (subject.payload || {}) as PosManagerOverridePayload;
    const requiresApproval = payload.requiresApproval !== false;
    const cashierUserId = String(payload.cashierUserId || context.actorUserId || '').trim();
    const approverUserId = String(payload.approverUserId || '').trim();

    const result = (
      decision: ApprovalEngineResult['decision'],
      required: boolean,
      reason: string
    ): ApprovalEngineResult => ({
      decision,
      requiredApprovers: required ? ['pos_override_manager'] : [],
      gates: [{
        name: this.name,
        required,
        metadata: { subjectType: subject.type, action: payload.action, reason },
      }],
    });

    if (!requiresApproval) {
      return result('APPROVED', false, 'not_required');
    }
    if (!approverUserId) {
      return result('PENDING', true, 'no_approver');
    }
    if (approverUserId === cashierUserId) {
      return result('REJECTED', true, 'self_approval');
    }
    const authorized = await this.hasApproveAuthority(context.companyId, approverUserId);
    if (!authorized) {
      return result('REJECTED', true, 'approver_not_authorized');
    }
    return result('APPROVED', false, 'approved_by_manager');
  }
}

/** Map a POS manager-override action to its Approval Engine subject type. */
export function subjectTypeForOverrideAction(action: string): ApprovalSubjectType {
  switch (action) {
    case 'PRICE_OVERRIDE':
      return 'price_override';
    case 'DISCOUNT_OVERRIDE':
      return 'discount_override';
    case 'TAX_OVERRIDE':
      return 'tax_override';
    default:
      // VOID_LINE, RETURN, REPRINT and any future action.
      return 'pos_manager_override';
  }
}
