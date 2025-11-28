
export type AttendanceMethod = 'WEB' | 'MOBILE' | 'BIOMETRIC';

export class AttendanceRecord {
  constructor(
    public id: string,
    public employeeId: string,
    public companyId: string,
    public loginAt: Date,
    public method: AttendanceMethod,
    public logoutAt?: Date,
    public location?: string
  ) {}

  public getDurationHours(): number {
    if (!this.logoutAt) return 0;
    return (this.logoutAt.getTime() - this.loginAt.getTime()) / (1000 * 60 * 60);
  }
}
