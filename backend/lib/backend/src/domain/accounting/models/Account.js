"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCurrencyPolicy = exports.validateBalanceNature = exports.getDefaultBalanceNature = exports.normalizeClassification = exports.validateUserCodeFormat = exports.normalizeUserCode = exports.Account = void 0;
/**
 * Account model re-export
 * Provides backward compatibility exports for legacy code
 */
var Account_1 = require("../entities/Account");
Object.defineProperty(exports, "Account", { enumerable: true, get: function () { return Account_1.Account; } });
Object.defineProperty(exports, "normalizeUserCode", { enumerable: true, get: function () { return Account_1.normalizeUserCode; } });
Object.defineProperty(exports, "validateUserCodeFormat", { enumerable: true, get: function () { return Account_1.validateUserCodeFormat; } });
Object.defineProperty(exports, "normalizeClassification", { enumerable: true, get: function () { return Account_1.normalizeClassification; } });
Object.defineProperty(exports, "getDefaultBalanceNature", { enumerable: true, get: function () { return Account_1.getDefaultBalanceNature; } });
Object.defineProperty(exports, "validateBalanceNature", { enumerable: true, get: function () { return Account_1.validateBalanceNature; } });
Object.defineProperty(exports, "validateCurrencyPolicy", { enumerable: true, get: function () { return Account_1.validateCurrencyPolicy; } });
//# sourceMappingURL=Account.js.map