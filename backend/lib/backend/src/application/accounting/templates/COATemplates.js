"use strict";
/**
 * Standard Chart of Accounts Template
 * Multi-level hierarchical structure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimplifiedCOA = exports.StandardCOA = void 0;
exports.StandardCOA = [
    // ========== ASSETS ==========
    {
        code: "1",
        name: "Assets",
        type: "asset",
        parentCode: null,
        isProtected: true,
    },
    // Cash & Petty Cash
    {
        code: "101",
        name: "Cash & Petty Cash",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "10101",
        name: "Cash – Head Office",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "10102",
        name: "Cash – Retail Branch",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    // Bank Accounts
    {
        code: "102",
        name: "Bank Accounts",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "10201",
        name: "Bank - Operating",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "10202",
        name: "Bank - LC Payments",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    // Inventory
    {
        code: "103",
        name: "Inventory",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "10301",
        name: "Finished Goods",
        type: "asset",
        parentCode: "103",
        isProtected: true,
    },
    {
        code: "10302",
        name: "In-Transit Inventory",
        type: "asset",
        parentCode: "103",
        isProtected: false,
    },
    // Accounts Receivable
    {
        code: "104",
        name: "Accounts Receivable",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "10401",
        name: "Customers Receivable",
        type: "asset",
        parentCode: "104",
        isProtected: true,
    },
    // ========== LIABILITIES ==========
    {
        code: "2",
        name: "Liabilities",
        type: "liability",
        parentCode: null,
        isProtected: true,
    },
    // Accounts Payable
    {
        code: "201",
        name: "Accounts Payable",
        type: "liability",
        parentCode: "2",
        isProtected: true,
    },
    {
        code: "20101",
        name: "Local Suppliers",
        type: "liability",
        parentCode: "201",
        isProtected: false,
    },
    {
        code: "20102",
        name: "International Suppliers",
        type: "liability",
        parentCode: "201",
        isProtected: false,
    },
    // Taxes & Duties
    {
        code: "202",
        name: "Taxes & Duties",
        type: "liability",
        parentCode: "2",
        isProtected: true,
    },
    {
        code: "20201",
        name: "VAT Payable",
        type: "liability",
        parentCode: "202",
        isProtected: true,
    },
    {
        code: "20202",
        name: "Import Duties",
        type: "liability",
        parentCode: "202",
        isProtected: false,
    },
    // ========== EQUITY ==========
    {
        code: "3",
        name: "Equity",
        type: "equity",
        parentCode: null,
        isProtected: true,
    },
    // Owner Capital
    {
        code: "301",
        name: "Owner Capital",
        type: "equity",
        parentCode: "3",
        isProtected: true,
    },
    {
        code: "30101",
        name: "Paid-in Capital",
        type: "equity",
        parentCode: "301",
        isProtected: false,
    },
    {
        code: "30102",
        name: "Owner Drawings",
        type: "equity",
        parentCode: "301",
        isProtected: false,
    },
    // Retained Earnings
    {
        code: "302",
        name: "Retained Earnings",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    {
        code: "30201",
        name: "Accumulated Profit",
        type: "equity",
        parentCode: "302",
        isProtected: false,
    },
    // ========== REVENUE ==========
    {
        code: "4",
        name: "Revenue",
        type: "revenue",
        parentCode: null,
        isProtected: true,
    },
    // Wholesale Sales
    {
        code: "401",
        name: "Wholesale Sales",
        type: "revenue",
        parentCode: "4",
        isProtected: true,
    },
    {
        code: "40101",
        name: "Domestic Wholesale",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    {
        code: "40102",
        name: "Export Sales",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    // Retail Sales
    {
        code: "402",
        name: "Retail Sales",
        type: "revenue",
        parentCode: "4",
        isProtected: false,
    },
    {
        code: "40201",
        name: "Flagship Store",
        type: "revenue",
        parentCode: "402",
        isProtected: false,
    },
    // ========== EXPENSES ==========
    {
        code: "5",
        name: "Expenses",
        type: "expense",
        parentCode: null,
        isProtected: true,
    },
    // Cost of Goods Sold
    {
        code: "501",
        name: "Cost of Goods Sold",
        type: "expense",
        parentCode: "5",
        isProtected: true,
    },
    {
        code: "50101",
        name: "Purchases",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "50102",
        name: "Freight Inward",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    // Operating Expenses
    {
        code: "502",
        name: "Operating Expenses",
        type: "expense",
        parentCode: "5",
        isProtected: true,
    },
    {
        code: "50201",
        name: "Rent & Utilities",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50202",
        name: "Sales & Marketing",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
];
/**
 * Simplified Chart of Accounts Template
 * Basic structure for small businesses
 */
exports.SimplifiedCOA = [
    // Assets
    {
        code: "1",
        name: "Assets",
        type: "asset",
        parentCode: null,
        isProtected: true,
    },
    {
        code: "101",
        name: "Cash",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "102",
        name: "Bank",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "103",
        name: "Accounts Receivable",
        type: "asset",
        parentCode: "1",
        isProtected: true,
    },
    {
        code: "104",
        name: "Inventory",
        type: "asset",
        parentCode: "1",
        isProtected: false,
    },
    // Liabilities
    {
        code: "2",
        name: "Liabilities",
        type: "liability",
        parentCode: null,
        isProtected: true,
    },
    {
        code: "201",
        name: "Accounts Payable",
        type: "liability",
        parentCode: "2",
        isProtected: true,
    },
    {
        code: "202",
        name: "VAT Payable",
        type: "liability",
        parentCode: "2",
        isProtected: true,
    },
    // Equity
    {
        code: "3",
        name: "Equity",
        type: "equity",
        parentCode: null,
        isProtected: true,
    },
    {
        code: "301",
        name: "Owner's Capital",
        type: "equity",
        parentCode: "3",
        isProtected: true,
    },
    {
        code: "302",
        name: "Retained Earnings",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    // Revenue
    {
        code: "4",
        name: "Revenue",
        type: "revenue",
        parentCode: null,
        isProtected: true,
    },
    {
        code: "401",
        name: "Sales Revenue",
        type: "revenue",
        parentCode: "4",
        isProtected: true,
    },
    // Expenses
    {
        code: "5",
        name: "Expenses",
        type: "expense",
        parentCode: null,
        isProtected: true,
    },
    {
        code: "501",
        name: "Cost of Goods Sold",
        type: "expense",
        parentCode: "5",
        isProtected: true,
    },
    {
        code: "502",
        name: "Operating Expenses",
        type: "expense",
        parentCode: "5",
        isProtected: false,
    },
];
//# sourceMappingURL=COATemplates.js.map