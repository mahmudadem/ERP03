
export interface CompanyUser {
  userId: string;
  companyId: string;
  roleId: string;
  isOwner?: boolean;
  createdAt: Date;
  isDisabled?: boolean;
}
