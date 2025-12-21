"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingRole = void 0;
/**
 * PostingRole Enumeration
 *
 * Defines the semantic meaning of posting fields.
 * Only fields with these roles affect the General Ledger.
 */
var PostingRole;
(function (PostingRole) {
    /**
     * GL Account identifier
     * Used for: Debit/Credit account selection
     */
    PostingRole["ACCOUNT"] = "ACCOUNT";
    /**
     * Transaction amount
     * Used for: Debit/Credit values, payment amounts
     */
    PostingRole["AMOUNT"] = "AMOUNT";
    /**
     * Transaction date
     * Used for: Posting period determination
     */
    PostingRole["DATE"] = "DATE";
    /**
     * Currency code
     * Used for: Multi-currency support
     */
    PostingRole["CURRENCY"] = "CURRENCY";
    /**
     * Foreign exchange rate
     * Used for: Currency conversion
     */
    PostingRole["EXCHANGE_RATE"] = "EXCHANGE_RATE";
    /**
     * Item quantity
     * Used for: Inventory/unit tracking
     */
    PostingRole["QUANTITY"] = "QUANTITY";
    /**
     * Tax amount or rate
     * Used for: Tax calculation
     */
    PostingRole["TAX"] = "TAX";
})(PostingRole = exports.PostingRole || (exports.PostingRole = {}));
//# sourceMappingURL=PostingRole.js.map