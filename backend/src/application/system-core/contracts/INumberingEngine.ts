export interface NumberingRequest {
  companyId: string;
  docType: string;
  scope: string;
  branchId?: string;
  terminalId?: string;
  prefix?: string;
  counterWidth?: number;
  year?: number;
  format?: string;
  seedNextNumber?: number;
}

export interface INumberingEngine {
  next(request: NumberingRequest): Promise<string>;
}
