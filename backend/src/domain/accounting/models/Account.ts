export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | string;
  parentId?: string | null;
  isActive: boolean;
  isProtected: boolean;
  currency?: string | null;
  createdAt: string;
  updatedAt: string;
}
