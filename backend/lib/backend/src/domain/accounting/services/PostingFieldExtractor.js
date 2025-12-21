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
            // Common posting fields in lines
            const postingFieldKeys = ['accountId', 'debitFx', 'creditFx', 'debitBase', 'creditBase',
                'lineCurrency', 'exchangeRate', 'description'];
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