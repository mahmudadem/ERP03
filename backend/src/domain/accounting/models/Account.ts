export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: string;
  parentId?: string;
  isActive: boolean;
  isProtected: boolean;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}
