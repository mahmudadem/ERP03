"use strict";
/**
 * Additional Industry-Specific COA Templates
 * Manufacturing, Services, and Retail
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetailCOA = exports.ServicesCOA = exports.ManufacturingCOA = void 0;
/**
 * Manufacturing Chart of Accounts Template
 * For manufacturing and production businesses
 */
exports.ManufacturingCOA = [
    // ========== ASSETS ==========
    {
        code: "1",
        name: "Assets",
        type: "asset",
        parentCode: null,
        isProtected: true, // Has children
    },
    // Current Assets
    {
        code: "101",
        name: "Cash & Bank",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10101",
        name: "Cash on Hand",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "10102",
        name: "Bank - Operating Account",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    // Inventory
    {
        code: "102",
        name: "Inventory",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10201",
        name: "Raw Materials",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "10202",
        name: "Work in Progress",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "10203",
        name: "Finished Goods",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    // Accounts Receivable
    {
        code: "103",
        name: "Accounts Receivable",
        type: "asset",
        parentCode: "1",
        isProtected: false,
    },
    // Fixed Assets
    {
        code: "104",
        name: "Fixed Assets",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10401",
        name: "Machinery & Equipment",
        type: "asset",
        parentCode: "104",
        isProtected: false,
    },
    {
        code: "10402",
        name: "Accumulated Depreciation",
        type: "asset",
        parentCode: "104",
        isProtected: false,
    },
    // ========== LIABILITIES ==========
    {
        code: "2",
        name: "Liabilities",
        type: "liability",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "201",
        name: "Accounts Payable",
        type: "liability",
        parentCode: "2",
        isProtected: false,
    },
    {
        code: "202",
        name: "Accrued Expenses",
        type: "liability",
        parentCode: "2",
        isProtected: true, // Has children
    },
    {
        code: "20201",
        name: "Wages Payable",
        type: "liability",
        parentCode: "202",
        isProtected: false,
    },
    {
        code: "20202",
        name: "VAT Payable",
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
        isProtected: true, // Has children
    },
    {
        code: "301",
        name: "Owner's Capital",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    {
        code: "302",
        name: "Retained Earnings",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    // ========== REVENUE ==========
    {
        code: "4",
        name: "Revenue",
        type: "revenue",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "401",
        name: "Product Sales",
        type: "revenue",
        parentCode: "4",
        isProtected: false,
    },
    {
        code: "402",
        name: "Contract Manufacturing",
        type: "revenue",
        parentCode: "4",
        isProtected: false,
    },
    // ========== EXPENSES ==========
    {
        code: "5",
        name: "Expenses",
        type: "expense",
        parentCode: null,
        isProtected: true, // Has children
    },
    // Direct Costs
    {
        code: "501",
        name: "Cost of Goods Manufactured",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50101",
        name: "Direct Materials",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "50102",
        name: "Direct Labor",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    // Factory Overhead
    {
        code: "502",
        name: "Factory Overhead",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50201",
        name: "Indirect Materials",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50202",
        name: "Factory Utilities",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50203",
        name: "Maintenance & Repairs",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    // Operating Expenses
    {
        code: "503",
        name: "Operating Expenses",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50301",
        name: "Administrative Salaries",
        type: "expense",
        parentCode: "503",
        isProtected: false,
    },
    {
        code: "50302",
        name: "Sales & Marketing",
        type: "expense",
        parentCode: "503",
        isProtected: false,
    },
];
/**
 * Services/Professional Chart of Accounts Template
 * For consulting, agencies, professional services
 */
exports.ServicesCOA = [
    // ========== ASSETS ==========
    {
        code: "1",
        name: "Assets",
        type: "asset",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "101",
        name: "Cash & Bank",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10101",
        name: "Cash",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "10102",
        name: "Business Bank Account",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "102",
        name: "Accounts Receivable",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10201",
        name: "Client Receivables",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "10202",
        name: "Unbilled Services",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "103",
        name: "Fixed Assets",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10301",
        name: "Office Equipment",
        type: "asset",
        parentCode: "103",
        isProtected: false,
    },
    {
        code: "10302",
        name: "Computer Equipment",
        type: "asset",
        parentCode: "103",
        isProtected: false,
    },
    // ========== LIABILITIES ==========
    {
        code: "2",
        name: "Liabilities",
        type: "liability",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "201",
        name: "Accounts Payable",
        type: "liability",
        parentCode: "2",
        isProtected: false,
    },
    {
        code: "202",
        name: "Accrued Expenses",
        type: "liability",
        parentCode: "2",
        isProtected: true, // Has children
    },
    {
        code: "20201",
        name: "Salaries Payable",
        type: "liability",
        parentCode: "202",
        isProtected: false,
    },
    {
        code: "20202",
        name: "Client Deposits",
        type: "liability",
        parentCode: "202",
        isProtected: false,
    },
    {
        code: "203",
        name: "Tax Liabilities",
        type: "liability",
        parentCode: "2",
        isProtected: true, // Has children
    },
    {
        code: "20301",
        name: "VAT Payable",
        type: "liability",
        parentCode: "203",
        isProtected: false,
    },
    {
        code: "20302",
        name: "Income Tax Payable",
        type: "liability",
        parentCode: "203",
        isProtected: false,
    },
    // ========== EQUITY ==========
    {
        code: "3",
        name: "Equity",
        type: "equity",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "301",
        name: "Owner's Capital",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    {
        code: "302",
        name: "Retained Earnings",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    // ========== REVENUE ==========
    {
        code: "4",
        name: "Revenue",
        type: "revenue",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "401",
        name: "Service Revenue",
        type: "revenue",
        parentCode: "4",
        isProtected: true, // Has children
    },
    {
        code: "40101",
        name: "Consulting Fees",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    {
        code: "40102",
        name: "Project Fees",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    {
        code: "40103",
        name: "Retainer Income",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    // ========== EXPENSES ==========
    {
        code: "5",
        name: "Expenses",
        type: "expense",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "501",
        name: "Personnel Costs",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50101",
        name: "Salaries & Wages",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "50102",
        name: "Contractor Fees",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "50103",
        name: "Employee Benefits",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "502",
        name: "Operating Expenses",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50201",
        name: "Office Rent",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50202",
        name: "Software Subscriptions",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50203",
        name: "Professional Development",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "503",
        name: "Marketing & Business Development",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50301",
        name: "Advertising",
        type: "expense",
        parentCode: "503",
        isProtected: false,
    },
    {
        code: "50302",
        name: "Client Entertainment",
        type: "expense",
        parentCode: "503",
        isProtected: false,
    },
];
/**
 * Retail-Specific Chart of Accounts Template
 * For retail stores and e-commerce
 */
exports.RetailCOA = [
    // ========== ASSETS ==========
    {
        code: "1",
        name: "Assets",
        type: "asset",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "101",
        name: "Cash & Bank",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10101",
        name: "Cash in Register",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "10102",
        name: "Cash - Safe",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "10103",
        name: "Bank Account",
        type: "asset",
        parentCode: "101",
        isProtected: false,
    },
    {
        code: "102",
        name: "Accounts Receivable",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10201",
        name: "Trade Receivables",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "10202",
        name: "Credit Card Receivables",
        type: "asset",
        parentCode: "102",
        isProtected: false,
    },
    {
        code: "103",
        name: "Inventory",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10301",
        name: "Merchandise Inventory",
        type: "asset",
        parentCode: "103",
        isProtected: false,
    },
    {
        code: "10302",
        name: "Inventory in Transit",
        type: "asset",
        parentCode: "103",
        isProtected: false,
    },
    {
        code: "104",
        name: "Fixed Assets",
        type: "asset",
        parentCode: "1",
        isProtected: true, // Has children
    },
    {
        code: "10401",
        name: "Store Fixtures & Equipment",
        type: "asset",
        parentCode: "104",
        isProtected: false,
    },
    {
        code: "10402",
        name: "POS System",
        type: "asset",
        parentCode: "104",
        isProtected: false,
    },
    // ========== LIABILITIES ==========
    {
        code: "2",
        name: "Liabilities",
        type: "liability",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "201",
        name: "Accounts Payable",
        type: "liability",
        parentCode: "2",
        isProtected: true, // Has children
    },
    {
        code: "20101",
        name: "Trade Payables",
        type: "liability",
        parentCode: "201",
        isProtected: false,
    },
    {
        code: "20102",
        name: "Credit Card Payables",
        type: "liability",
        parentCode: "201",
        isProtected: false,
    },
    {
        code: "202",
        name: "Sales Tax Payable",
        type: "liability",
        parentCode: "2",
        isProtected: false,
    },
    {
        code: "203",
        name: "Customer Deposits",
        type: "liability",
        parentCode: "2",
        isProtected: false,
    },
    // ========== EQUITY ==========
    {
        code: "3",
        name: "Equity",
        type: "equity",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "301",
        name: "Owner's Capital",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    {
        code: "302",
        name: "Retained Earnings",
        type: "equity",
        parentCode: "3",
        isProtected: false,
    },
    // ========== REVENUE ==========
    {
        code: "4",
        name: "Revenue",
        type: "revenue",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "401",
        name: "Sales Revenue",
        type: "revenue",
        parentCode: "4",
        isProtected: true, // Has children
    },
    {
        code: "40101",
        name: "In-Store Sales",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    {
        code: "40102",
        name: "Online Sales",
        type: "revenue",
        parentCode: "401",
        isProtected: false,
    },
    {
        code: "402",
        name: "Sales Returns & Allowances",
        type: "revenue",
        parentCode: "4",
        isProtected: false,
    },
    // ========== COST OF SALES ==========
    {
        code: "5",
        name: "Cost of Sales",
        type: "expense",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "501",
        name: "Cost of Goods Sold",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
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
        name: "Freight & Shipping",
        type: "expense",
        parentCode: "501",
        isProtected: false,
    },
    {
        code: "502",
        name: "Inventory Adjustments",
        type: "expense",
        parentCode: "5",
        isProtected: true, // Has children
    },
    {
        code: "50201",
        name: "Shrinkage & Loss",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    {
        code: "50202",
        name: "Damaged Goods",
        type: "expense",
        parentCode: "502",
        isProtected: false,
    },
    // ========== OPERATING EXPENSES ==========
    {
        code: "6",
        name: "Operating Expenses",
        type: "expense",
        parentCode: null,
        isProtected: true, // Has children
    },
    {
        code: "601",
        name: "Store Expenses",
        type: "expense",
        parentCode: "6",
        isProtected: true, // Has children
    },
    {
        code: "60101",
        name: "Rent",
        type: "expense",
        parentCode: "601",
        isProtected: false,
    },
    {
        code: "60102",
        name: "Utilities",
        type: "expense",
        parentCode: "601",
        isProtected: false,
    },
    {
        code: "60103",
        name: "Store Supplies",
        type: "expense",
        parentCode: "601",
        isProtected: false,
    },
    {
        code: "602",
        name: "Personnel Expenses",
        type: "expense",
        parentCode: "6",
        isProtected: true, // Has children
    },
    {
        code: "60201",
        name: "Salaries & Wages",
        type: "expense",
        parentCode: "602",
        isProtected: false,
    },
    {
        code: "60202",
        name: "Sales Commissions",
        type: "expense",
        parentCode: "602",
        isProtected: false,
    },
    {
        code: "603",
        name: "Marketing & Advertising",
        type: "expense",
        parentCode: "6",
        isProtected: true, // Has children
    },
    {
        code: "60301",
        name: "Print Advertising",
        type: "expense",
        parentCode: "603",
        isProtected: false,
    },
    {
        code: "60302",
        name: "Digital Marketing",
        type: "expense",
        parentCode: "603",
        isProtected: false,
    },
    {
        code: "60303",
        name: "Promotions & Discounts",
        type: "expense",
        parentCode: "603",
        isProtected: false,
    },
];
//# sourceMappingURL=IndustryCOATemplates.js.map