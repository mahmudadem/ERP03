/**
 * Frontend Error Codes (mirrors backend)
 */
export enum ErrorCode {
  // Authentication
  AUTH_INVALID_CREDENTIALS = 'AUTH_001',
  AUTH_TOKEN_EXPIRED = 'AUTH_002',
  AUTH_TOKEN_INVALID = 'AUTH_003',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_004',
  AUTH_USER_NOT_FOUND = 'AUTH_005',
  AUTH_USER_DISABLED = 'AUTH_006',
  
  // Validation
  VAL_REQUIRED_FIELD = 'VAL_001',
  VAL_INVALID_FORMAT = 'VAL_002',
  VAL_DUPLICATE_ENTRY = 'VAL_003',
  VAL_INVALID_RANGE = 'VAL_004',
  VAL_INVALID_TYPE = 'VAL_005',
  VAL_INVALID_LENGTH = 'VAL_006',
  
  // Voucher
  VOUCH_ALREADY_APPROVED = 'VOUCH_001',
  VOUCH_ALREADY_POSTED = 'VOUCH_002',
  VOUCH_NOT_FOUND = 'VOUCH_003',
  VOUCH_INVALID_STATUS = 'VOUCH_004',
  VOUCH_UNBALANCED = 'VOUCH_005',
  VOUCH_MISSING_LINES = 'VOUCH_006',
  VOUCH_LOCKED = 'VOUCH_007',
  
  // Accounting
  ACC_INSUFFICIENT_BALANCE = 'ACC_001',
  ACC_ACCOUNT_NOT_FOUND = 'ACC_002',
  ACC_ACCOUNT_INACTIVE = 'ACC_003',
  ACC_PERIOD_CLOSED = 'ACC_004',
  ACC_INVALID_ACCOUNT_TYPE = 'ACC_005',
  
  // Infrastructure
  INFRA_DATABASE_ERROR = 'INFRA_001',
  INFRA_NETWORK_ERROR = 'INFRA_002',
  INFRA_SERVICE_UNAVAILABLE = 'INFRA_003',
  INFRA_TIMEOUT = 'INFRA_004',
  INFRA_UNKNOWN_ERROR = 'INFRA_999',
}

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  field?: string;
  context?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
