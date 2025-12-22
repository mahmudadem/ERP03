"use strict";
/**
 * Centralized Error Codes for the ERP System
 *
 * Format: CATEGORY_###
 * - AUTH: Authentication & Authorization
 * - VAL: Validation
 * - VOUCH: Voucher-specific business logic
 * - ACC: Accounting business logic
 * - INFRA: Infrastructure/System errors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorSeverity = exports.ErrorCode = void 0;
var ErrorCode;
(function (ErrorCode) {
    // ========== AUTHENTICATION & AUTHORIZATION ==========
    ErrorCode["AUTH_INVALID_CREDENTIALS"] = "AUTH_001";
    ErrorCode["AUTH_TOKEN_EXPIRED"] = "AUTH_002";
    ErrorCode["AUTH_TOKEN_INVALID"] = "AUTH_003";
    ErrorCode["AUTH_INSUFFICIENT_PERMISSIONS"] = "AUTH_004";
    ErrorCode["AUTH_USER_NOT_FOUND"] = "AUTH_005";
    ErrorCode["AUTH_USER_DISABLED"] = "AUTH_006";
    // ========== VALIDATION ==========
    ErrorCode["VAL_REQUIRED_FIELD"] = "VAL_001";
    ErrorCode["VAL_INVALID_FORMAT"] = "VAL_002";
    ErrorCode["VAL_DUPLICATE_ENTRY"] = "VAL_003";
    ErrorCode["VAL_INVALID_RANGE"] = "VAL_004";
    ErrorCode["VAL_INVALID_TYPE"] = "VAL_005";
    ErrorCode["VAL_INVALID_LENGTH"] = "VAL_006";
    // ========== VOUCHER BUSINESS LOGIC ==========
    ErrorCode["VOUCH_ALREADY_APPROVED"] = "VOUCH_001";
    ErrorCode["VOUCH_ALREADY_POSTED"] = "VOUCH_002";
    ErrorCode["VOUCH_NOT_FOUND"] = "VOUCH_003";
    ErrorCode["VOUCH_INVALID_STATUS"] = "VOUCH_004";
    ErrorCode["VOUCH_UNBALANCED"] = "VOUCH_005";
    ErrorCode["VOUCH_MISSING_LINES"] = "VOUCH_006";
    ErrorCode["VOUCH_LOCKED"] = "VOUCH_007";
    // ========== ACCOUNTING BUSINESS LOGIC ==========
    ErrorCode["ACC_INSUFFICIENT_BALANCE"] = "ACC_001";
    ErrorCode["ACC_ACCOUNT_NOT_FOUND"] = "ACC_002";
    ErrorCode["ACC_ACCOUNT_INACTIVE"] = "ACC_003";
    ErrorCode["ACC_PERIOD_CLOSED"] = "ACC_004";
    ErrorCode["ACC_INVALID_ACCOUNT_TYPE"] = "ACC_005";
    // ========== INFRASTRUCTURE ==========
    ErrorCode["INFRA_DATABASE_ERROR"] = "INFRA_001";
    ErrorCode["INFRA_NETWORK_ERROR"] = "INFRA_002";
    ErrorCode["INFRA_SERVICE_UNAVAILABLE"] = "INFRA_003";
    ErrorCode["INFRA_TIMEOUT"] = "INFRA_004";
    ErrorCode["INFRA_UNKNOWN_ERROR"] = "INFRA_999";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
/**
 * Severity levels for errors
 */
var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "info";
    ErrorSeverity["WARNING"] = "warning";
    ErrorSeverity["ERROR"] = "error";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity = exports.ErrorSeverity || (exports.ErrorSeverity = {}));
//# sourceMappingURL=ErrorCodes.js.map