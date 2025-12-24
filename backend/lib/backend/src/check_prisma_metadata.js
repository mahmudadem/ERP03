"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// This file is just to verify that VoucherCreateInput accepts 'metadata'
const check = {
    id: 'test-id',
    companyId: 'test-company',
    type: 'JOURNAL',
    date: new Date(),
    currency: 'USD',
    baseCurrency: 'USD',
    status: 'DRAFT',
    createdBy: 'user',
    // This is the field in question
    metadata: { key: 'value' }
};
//# sourceMappingURL=check_prisma_metadata.js.map