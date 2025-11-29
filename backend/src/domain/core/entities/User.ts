
export type UserRole = 'USER' | 'SUPER_ADMIN';

export class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public globalRole: UserRole,
    public createdAt: Date,
    public pictureUrl?: string
  ) {}

  public isAdmin(): boolean {
    return this.globalRole === 'SUPER_ADMIN';
  }
}
