"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSystemVoucherTypes = void 0;
const VoucherTypeDefinition_1 = require("../domain/designer/entities/VoucherTypeDefinition");
const PostingRole_1 = require("../domain/designer/entities/PostingRole");
const crypto_1 = require("crypto");
const SYSTEM_COMPANY_ID = 'SYSTEM';
const templates = [
    {
        name: "Payment Voucher",
        code: "PAYMENT",
        module: "ACCOUNTING",
        headerFields: [
            {
                id: "date",
                label: "Date",
                type: "DATE",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.DATE
            },
            {
                id: "payFromAccountId",
                label: "Pay From",
                type: "ACCOUNT_SELECT",
                required: true,
                config: { filterType: "ASSET" },
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.ACCOUNT
            },
            {
                id: "currency",
                label: "Currency",
                type: "CURRENCY_SELECT",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.CURRENCY
            },
            {
                id: "exchangeRate",
                label: "Exchange Rate",
                type: "NUMBER",
                defaultValue: 1,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE
            },
            {
                id: "totalAmount",
                label: "Total Amount",
                type: "NUMBER",
                required: false,
                readOnly: true,
                calculated: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "description",
                label: "Description",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        lineFields: [
            {
                id: "payToAccountId",
                label: "Pay To Account",
                type: "ACCOUNT_SELECT",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.ACCOUNT
            },
            {
                id: "amount",
                label: "Amount",
                type: "NUMBER",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "notes",
                label: "Notes",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        tableColumns: [
            { fieldId: "payToAccountId", width: "200px" },
            { fieldId: "amount", width: "100px" },
            { fieldId: "notes", width: "200px" }
        ],
        layout: {
            sections: [
                { id: "header", title: "Payment Header", fieldIds: ["date", "payFromAccountId", "currency", "exchangeRate", "totalAmount", "description"] },
                { id: "allocations", title: "Payment Allocations", fieldIds: ["lineItems"] }
            ]
        },
        workflow: { approvalRequired: true }
    },
    {
        name: "Receipt Voucher",
        code: "RECEIPT",
        module: "ACCOUNTING",
        headerFields: [
            {
                id: "date",
                label: "Date",
                type: "DATE",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.DATE
            },
            {
                id: "depositToAccountId",
                label: "Deposit To",
                type: "ACCOUNT_SELECT",
                required: true,
                config: { filterType: "ASSET" },
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.ACCOUNT
            },
            {
                id: "currency",
                label: "Currency",
                type: "CURRENCY_SELECT",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.CURRENCY
            },
            {
                id: "exchangeRate",
                label: "Exchange Rate",
                type: "NUMBER",
                defaultValue: 1,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE
            },
            {
                id: "totalAmount",
                label: "Total Amount",
                type: "NUMBER",
                required: false,
                readOnly: true,
                calculated: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "description",
                label: "Description",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        lineFields: [
            {
                id: "receiveFromAccountId",
                label: "Receive From Account",
                type: "ACCOUNT_SELECT",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.ACCOUNT
            },
            {
                id: "amount",
                label: "Amount",
                type: "NUMBER",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "notes",
                label: "Notes",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        tableColumns: [
            { fieldId: "receiveFromAccountId", width: "200px" },
            { fieldId: "amount", width: "100px" },
            { fieldId: "notes", width: "200px" }
        ],
        layout: {
            sections: [
                { id: "header", title: "Receipt Header", fieldIds: ["date", "depositToAccountId", "currency", "exchangeRate", "totalAmount", "description"] },
                { id: "sources", title: "Receipt Sources", fieldIds: ["lineItems"] }
            ]
        },
        workflow: { approvalRequired: true }
    },
    {
        name: "Currency Exchange",
        code: "FX",
        module: "ACCOUNTING",
        headerFields: [
            { id: "buyAccountId", label: "Buy Account", type: "ACCOUNT_SELECT", required: true },
            { id: "sellAccountId", label: "Sell Account", type: "ACCOUNT_SELECT", required: true },
            { id: "buyAmount", label: "Buy Amount", type: "NUMBER", required: true },
            { id: "sellAmount", label: "Sell Amount", type: "NUMBER", required: true },
            { id: "buyCurrency", label: "Buy Currency", type: "CURRENCY_SELECT", required: true },
            { id: "sellCurrency", label: "Sell Currency", type: "CURRENCY_SELECT", required: true },
            { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", required: true },
            { id: "description", label: "Description", type: "TEXT" }
        ],
        tableColumns: [],
        layout: {
            sections: [
                { id: "main", title: "Exchange Details", fieldIds: ["buyAccountId", "sellAccountId", "buyAmount", "sellAmount", "buyCurrency", "sellCurrency", "exchangeRate", "description"] }
            ]
        },
        workflow: { approvalRequired: true }
    },
    {
        name: "Bank Transfer",
        code: "TRANSFER",
        module: "ACCOUNTING",
        headerFields: [
            { id: "fromAccountId", label: "From Account", type: "ACCOUNT_SELECT", required: true },
            { id: "toAccountId", label: "To Account", type: "ACCOUNT_SELECT", required: true },
            { id: "amount", label: "Amount", type: "NUMBER", required: true },
            { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true },
            { id: "description", label: "Description", type: "TEXT" }
        ],
        tableColumns: [],
        layout: {
            sections: [
                { id: "main", title: "Transfer Details", fieldIds: ["fromAccountId", "toAccountId", "amount", "currency", "description"] }
            ]
        },
        workflow: { approvalRequired: true }
    },
    {
        name: "Journal Entry",
        code: "JOURNAL",
        module: "ACCOUNTING",
        headerFields: [
            {
                id: "date",
                label: "Date",
                type: "DATE",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.DATE
            },
            {
                id: "reference",
                label: "Reference",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            },
            {
                id: "description",
                label: "Description",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        lineFields: [
            {
                id: "accountId",
                label: "Account",
                type: "ACCOUNT_SELECT",
                required: true,
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.ACCOUNT
            },
            {
                id: "debit",
                label: "Debit",
                type: "NUMBER",
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "credit",
                label: "Credit",
                type: "NUMBER",
                isPosting: true,
                postingRole: PostingRole_1.PostingRole.AMOUNT
            },
            {
                id: "description",
                label: "Description",
                type: "TEXT",
                isPosting: false,
                postingRole: null
            }
        ],
        tableColumns: [
            { fieldId: "accountId", width: "200px" },
            { fieldId: "debit", width: "100px" },
            { fieldId: "credit", width: "100px" },
            { fieldId: "description", width: "200px" }
        ],
        layout: {
            sections: [
                { id: "header", title: "Journal Header", fieldIds: ["date", "reference", "description"] },
                { id: "lines", title: "Journal Lines", fieldIds: ["lineItems"] }
            ]
        },
        workflow: { approvalRequired: true }
    }
];
const seedSystemVoucherTypes = async (repo) => {
    console.log('Seeding System Voucher Types...');
    const existingTemplates = await repo.getSystemTemplates();
    const existingCodes = new Set(existingTemplates.map(t => t.code));
    for (const t of templates) {
        if (!existingCodes.has(t.code)) {
            const id = (0, crypto_1.randomUUID)();
            const def = new VoucherTypeDefinition_1.VoucherTypeDefinition(id, SYSTEM_COMPANY_ID, t.name, t.code, t.module, t.headerFields, t.tableColumns, t.layout, 2, // schemaVersion
            undefined, // requiredPostingRoles
            t.workflow // workflow
            );
            await repo.createVoucherType(def);
            console.log(`Created template: ${t.name}`);
        }
        else {
            console.log(`Template ${t.name} already exists.`);
        }
    }
    console.log('System Voucher Types Seeding Complete.');
};
exports.seedSystemVoucherTypes = seedSystemVoucherTypes;
//# sourceMappingURL=seedSystemVoucherTypes.js.map