
export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export class Notification {
  constructor(
    public id: string,
    public userId: string,
    public companyId: string,
    public type: NotificationType,
    public message: string,
    public createdAt: Date,
    public read: boolean
  ) {}

  public markAsRead(): void {
    this.read = true;
  }
}
