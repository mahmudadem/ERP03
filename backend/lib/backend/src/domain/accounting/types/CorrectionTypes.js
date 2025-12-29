"use strict";
/**
 * Voucher Correction Types
 *
 * Defines the correction flow for posted vouchers without editing originals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrectionMode = void 0;
/**
 * Correction mode determines the type of correction operation
 */
var CorrectionMode;
(function (CorrectionMode) {
    /**
     * Creates only a reversal voucher (negates original impact)
     */
    CorrectionMode["REVERSE_ONLY"] = "REVERSE_ONLY";
    /**
     * Creates a reversal voucher AND a replacement voucher
     */
    CorrectionMode["REVERSE_AND_REPLACE"] = "REVERSE_AND_REPLACE";
})(CorrectionMode = exports.CorrectionMode || (exports.CorrectionMode = {}));
//# sourceMappingURL=CorrectionTypes.js.map