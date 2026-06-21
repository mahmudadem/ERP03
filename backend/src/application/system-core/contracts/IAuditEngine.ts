export interface AuditRecordInput {
  companyId: string;
  entity: {
    type: string;
    id: string;
    number?: string;
  };
  action: 'CREATE' | 'UPDATE' | 'POST' | 'PERIOD_LOCK_OVERRIDE';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  actor: {
    userId: string;
    userEmail?: string;
  };
  reason?: string;
  approval?: Record<string, unknown>;
}

export interface IAuditEngine {
  record(input: AuditRecordInput): Promise<void>;
}

