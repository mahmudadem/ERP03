
export class AuditLog {
  constructor(
    public id: string,
    public action: string,
    public entityType: string,
    public entityId: string,
    public userId: string,
    public timestamp: Date,
    public meta?: Record<string, any>
  ) {}
}
