export interface NumberingRequest {
  companyId: string;
  docType: string;
  scope: string;
  branchId?: string;
  terminalId?: string;
}

export interface INumberingEngine {
  next(request: NumberingRequest): Promise<string>;
}

