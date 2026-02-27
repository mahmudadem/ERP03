"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingFieldExtractor = void 0;
/**
 * PostingFieldExtractor
 *
 * Security layer that filters voucher data to include ONLY posting fields.
 * Prevents PostingStrategies from accidentally reading non-posting metadata.
 */
class PostingFieldExtractor {
    /**
     * Extracts only posting fields from header data
     * @param header Raw header data from user input
     * @param definition Voucher type definition with field classifications
     * @returns Filtered object containing only posting fields
     * @throws Error if required posting fields are missing
     */
    static extractPostingFields(header, definition) {
        const postingFields = {};
        // Collect all posting field IDs
        const postingFieldIds = new Set();
        const requiredFields = new Map();
        for (const field of definition.headerFields) {
            if (field.isPosting && field.postingRole) {
                postingFieldIds.add(field.id);
                if (field.required) {
                    requiredFields.set(field.id, field.postingRole);
                }
            }
        }
        // Compatibility fallback:
        // Some cloned/custom forms may not carry posting-role metadata yet.
        // In that case, do not strip the payload because strategies still need semantic keys
        // like depositToAccountId / payFromAccountId.
        if (postingFieldIds.size === 0) {
            return Object.assign({}, header);
        }
        // V10: Validate all required posting fields are present
        for (const [fieldId, role] of requiredFields.entries()) {
            if (!(fieldId in header) || header[fieldId] === null || header[fieldId] === undefined) {
                throw new Error(`Required posting field '${fieldId}' (${role}) not provided`);
            }
        }
        // Filter: copy only posting fields to result
        for (const [key, value] of Object.entries(header)) {
            if (postingFieldIds.has(key)) {
                postingFields[key] = value;
            }
        }
        // ALWAYS pass through structural fields needed by all strategies
        // These are not "posting fields" in the designer sense, but are required for line generation
        const structuralFields = [
            'lines',
            'currency',
            'exchangeRate',
            'baseCurrency',
            'date',
            'type',
            'metadata',
            // Semantic header anchors used by payment/receipt strategies
            'depositToAccountId',
            'payFromAccountId',
            // Generic header account aliases used as fallback in strategies
            'accountId',
            'account'
        ];
        for (const sf of structuralFields) {
            if (sf in header && !(sf in postingFields)) {
                postingFields[sf] = header[sf];
            }
        }
        return postingFields;
    }
    /**
     * Extracts posting fields from line items
     * @param lines Array of line items
     * @param definition Voucher type definition
     * @returns Filtered array with only posting fields per line
     */
    static extractPostingFieldsFromLines(lines, definition) {
        // For line items, field definitions come from table structure
        // This is a simplified version - extend based on your line field definitions
        return lines.map(line => {
            const filtered = {};
            // V2 Posting Fields (canonical for all line-based vouchers)
            const postingFieldKeys = ['accountId', 'side', 'amount', 'baseAmount',
                'currency', 'lineCurrency', 'exchangeRate', 'description', 'notes',
                'costCenterId', 'costCenter'];
            for (const key of postingFieldKeys) {
                if (key in line) {
                    filtered[key] = line[key];
                }
            }
            return filtered;
        });
    }
}
exports.PostingFieldExtractor = PostingFieldExtractor;
//# sourceMappingURL=PostingFieldExtractor.js.map