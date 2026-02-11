export interface CompanyGroupDTO {
  id: string;
  name: string;
  reportingCurrency: string;
  members: { companyId: string; weight?: number }[];
}

export interface ConsolidatedTrialBalanceDTO {
  groupId: string;
  reportingCurrency: string;
  asOfDate: string;
  lines: {
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  totals: { debit: number; credit: number; balance: number };
}
