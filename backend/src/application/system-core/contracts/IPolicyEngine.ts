export interface PolicyResolveRequest {
  scope: string;
  action: string;
  companyId?: string;
  context?: Record<string, unknown>;
}

export interface PolicyResolveResult {
  allowed: boolean;
  requiresApproval: boolean;
  resolvedBy: string[];
}

export interface IPolicyEngine {
  resolve(request: PolicyResolveRequest): Promise<PolicyResolveResult>;
}

