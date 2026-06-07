import { randomUUID } from 'crypto';

export type RecordChangeEntityType =
  | 'SALES_INVOICE'
  | 'SALES_ORDER'
  | 'DELIVERY_NOTE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE';
export type RecordChangeAction = 'CREATE' | 'UPDATE' | 'POST' | 'PERIOD_LOCK_OVERRIDE';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RecordChangeLogProps {
  id?: string;
  companyId: string;
  entityType: RecordChangeEntityType;
  entityId: string;
  entityNumber?: string;
  action: RecordChangeAction;
  changes: FieldChange[];
  userId: string;
  userEmail?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export class RecordChangeLog {
  readonly id: string;
  readonly companyId: string;
  readonly entityType: RecordChangeEntityType;
  readonly entityId: string;
  readonly entityNumber?: string;
  readonly action: RecordChangeAction;
  readonly changes: FieldChange[];
  readonly userId: string;
  readonly userEmail?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;

  constructor(props: RecordChangeLogProps) {
    // UPDATE actions still require at least one field-level change.
    // CREATE / POST / PERIOD_LOCK_OVERRIDE describe the action itself and may have no diff.
    if (props.action === 'UPDATE' && (!props.changes || props.changes.length === 0)) {
      throw new Error('RecordChangeLog (UPDATE) requires at least one change');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.entityNumber = props.entityNumber;
    this.action = props.action;
    this.changes = props.changes ?? [];
    this.userId = props.userId;
    this.userEmail = props.userEmail;
    this.timestamp = props.timestamp ?? new Date();
    this.metadata = props.metadata;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      entityType: this.entityType,
      entityId: this.entityId,
      entityNumber: this.entityNumber,
      action: this.action,
      changes: this.changes,
      userId: this.userId,
      userEmail: this.userEmail,
      timestamp: this.timestamp.toISOString(),
      metadata: this.metadata,
    };
  }

  static fromJSON(data: Record<string, unknown>): RecordChangeLog {
    return new RecordChangeLog({
      id: data.id as string,
      companyId: data.companyId as string,
      entityType: data.entityType as RecordChangeEntityType,
      entityId: data.entityId as string,
      entityNumber: data.entityNumber as string | undefined,
      action: data.action as RecordChangeAction,
      changes: (data.changes as FieldChange[]) ?? [],
      userId: data.userId as string,
      userEmail: data.userEmail as string | undefined,
      timestamp: data.timestamp ? new Date(data.timestamp as string) : undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
    });
  }
}
