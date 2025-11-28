// Shared Domain Entities / DTOs

export interface ICompany {
  id: string;
  name: string;
  taxId: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
  companyId: string;
}

// Voucher Placeholder
export interface IVoucher {
  id: string;
  code: string;
  amount: number;
  type: 'DISCOUNT' | 'GIFT';
  validUntil: Date;
}

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}