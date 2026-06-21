export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'PENDING';

export type ApprovalSubjectType =
  | 'accounting_voucher'
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'purchase_order'
  | 'inventory_adjustment'
  | 'pos_manager_override'
  | 'price_override'
  | 'discount_override'
  | 'tax_override'
  | 'below_cost_sale';

export interface ApprovalSubject {
  type: ApprovalSubjectType;
  id: string;
  payload: unknown;
}

export interface ApprovalContext {
  companyId: string;
  actorUserId?: string;
  voucherType?: string;
  [key: string]: unknown;
}

export interface ApprovalGateResult {
  name: string;
  required: boolean;
  metadata?: Record<string, unknown>;
}

export interface ApprovalEngineResult {
  decision: ApprovalDecision;
  requiredApprovers: string[];
  gates: ApprovalGateResult[];
}

export interface IApprovalEngine {
  evaluate(subject: ApprovalSubject, context: ApprovalContext): Promise<ApprovalEngineResult>;
}

