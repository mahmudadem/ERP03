export class ImpersonationSession {
  constructor(
    public id: string,
    public superAdminId: string,
    public companyId: string,
    public active: boolean,
    public createdAt: Date,
    public endedAt?: Date
  ) {}
}
