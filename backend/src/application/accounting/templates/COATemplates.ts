/**
 * Standard Chart of Accounts Template
 * Multi-level hierarchical structure
 */

export const StandardCOA = [
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
    code: "20100",
    name: "Accounts Payable – General",
    type: "liability",
    parentCode: "201",
    isProtected: false,
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
  // GRNI (Goods Received Not Invoiced)
  {
    code: "209",
    name: "GRNI – Goods Received Not Invoiced",
    type: "liability",
    parentCode: "2",
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
    equitySubgroup: "CONTRIBUTED_CAPITAL",
  },
  {
    code: "30101",
    name: "Paid-in Capital",
    type: "equity",
    parentCode: "301",
    isProtected: false,
    equitySubgroup: "CONTRIBUTED_CAPITAL",
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
    equitySubgroup: "RETAINED_EARNINGS",
  },
  {
    code: "30201",
    name: "Accumulated Profit",
    type: "equity",
    parentCode: "302",
    isProtected: false,
    equitySubgroup: "RETAINED_EARNINGS",
  },

  // ========== REVENUE ==========
  {
    code: "4",
    name: "Revenue",
    type: "revenue",
    parentCode: null,
    isProtected: true,
  },
  // Generic Sales Revenue (catch-all for users who don't need channel splits)
  {
    code: "400",
    name: "Sales Revenue",
    type: "revenue",
    parentCode: "4",
    isProtected: false,
    plSubgroup: "SALES",
  },
  // Wholesale Sales
  {
    code: "401",
    name: "Wholesale Sales",
    type: "revenue",
    parentCode: "4",
    isProtected: true,
    plSubgroup: "SALES",
  },
  {
    code: "40101",
    name: "Domestic Wholesale",
    type: "revenue",
    parentCode: "401",
    isProtected: false,
    plSubgroup: "SALES",
  },
  {
    code: "40102",
    name: "Export Sales",
    type: "revenue",
    parentCode: "401",
    isProtected: false,
    plSubgroup: "SALES",
  },
  // Retail Sales
  {
    code: "402",
    name: "Retail Sales",
    type: "revenue",
    parentCode: "4",
    isProtected: false,
    plSubgroup: "SALES",
  },
  {
    code: "40201",
    name: "Flagship Store",
    type: "revenue",
    parentCode: "402",
    isProtected: false,
    plSubgroup: "SALES",
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
    plSubgroup: "COST_OF_SALES",
  },
  {
    code: "50100",
    name: "Cost of Goods Sold – General",
    type: "expense",
    parentCode: "501",
    isProtected: false,
    plSubgroup: "COST_OF_SALES",
  },
  {
    code: "50101",
    name: "Purchases",
    type: "expense",
    parentCode: "501",
    isProtected: false,
    plSubgroup: "COST_OF_SALES",
  },
  {
    code: "50102",
    name: "Freight Inward",
    type: "expense",
    parentCode: "501",
    isProtected: false,
    plSubgroup: "COST_OF_SALES",
  },
  // Operating Expenses
  {
    code: "502",
    name: "Operating Expenses",
    type: "expense",
    parentCode: "5",
    isProtected: true,
    plSubgroup: "OPERATING_EXPENSES",
  },
  {
    code: "50201",
    name: "Rent & Utilities",
    type: "expense",
    parentCode: "502",
    isProtected: false,
    plSubgroup: "OPERATING_EXPENSES",
  },
  {
    code: "50202",
    name: "Sales & Marketing",
    type: "expense",
    parentCode: "502",
    isProtected: false,
    plSubgroup: "OPERATING_EXPENSES",
  },
];

/**
 * Simplified Chart of Accounts Template
 * Basic structure for small businesses
 */
export const SimplifiedCOA = [
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
  {
    code: "203",
    name: "GRNI – Goods Received Not Invoiced",
    type: "liability",
    parentCode: "2",
    isProtected: false,
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
    equitySubgroup: "CONTRIBUTED_CAPITAL",
  },
  {
    code: "302",
    name: "Retained Earnings",
    type: "equity",
    parentCode: "3",
    isProtected: false,
    equitySubgroup: "RETAINED_EARNINGS",
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
    plSubgroup: "SALES",
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
    plSubgroup: "COST_OF_SALES",
  },
  {
    code: "502",
    name: "Operating Expenses",
    type: "expense",
    parentCode: "5",
    isProtected: false,
    plSubgroup: "OPERATING_EXPENSES",
  },
];

/**
 * Comprehensive Chart of Accounts Template
 * Full enterprise-grade structure for established businesses
 * 100+ accounts covering all major business functions
 */
export const ComprehensiveCOA = [
  // ========== 1. ASSETS ==========
  { code: "1", name: "Assets", type: "asset", parentCode: null, isProtected: true },

  // 101 – Cash & Petty Cash
  { code: "101", name: "Cash & Petty Cash", type: "asset", parentCode: "1", isProtected: true },
  { code: "10101", name: "Cash – Head Office", type: "asset", parentCode: "101", isProtected: false },
  { code: "10102", name: "Cash – Branch", type: "asset", parentCode: "101", isProtected: false },
  { code: "10103", name: "Petty Cash", type: "asset", parentCode: "101", isProtected: false },

  // 102 – Bank Accounts
  { code: "102", name: "Bank Accounts", type: "asset", parentCode: "1", isProtected: true },
  { code: "10201", name: "Bank – Operating", type: "asset", parentCode: "102", isProtected: false },
  { code: "10202", name: "Bank – Payroll", type: "asset", parentCode: "102", isProtected: false },
  { code: "10203", name: "Bank – Savings / Reserve", type: "asset", parentCode: "102", isProtected: false },
  { code: "10204", name: "Bank – LC Payments", type: "asset", parentCode: "102", isProtected: false },
  { code: "10205", name: "Bank – Foreign Currency", type: "asset", parentCode: "102", isProtected: false },

  // 103 – Inventory
  { code: "103", name: "Inventory", type: "asset", parentCode: "1", isProtected: true },
  { code: "10301", name: "Raw Materials", type: "asset", parentCode: "103", isProtected: false },
  { code: "10302", name: "Work in Progress", type: "asset", parentCode: "103", isProtected: false },
  { code: "10303", name: "Finished Goods", type: "asset", parentCode: "103", isProtected: false },
  { code: "10304", name: "Merchandise Inventory", type: "asset", parentCode: "103", isProtected: false },
  { code: "10305", name: "In-Transit Inventory", type: "asset", parentCode: "103", isProtected: false },
  { code: "10306", name: "Packaging & Supplies", type: "asset", parentCode: "103", isProtected: false },

  // 104 – Accounts Receivable
  { code: "104", name: "Accounts Receivable", type: "asset", parentCode: "1", isProtected: true },
  { code: "10401", name: "Customers Receivable", type: "asset", parentCode: "104", isProtected: false },
  { code: "10402", name: "Employee Advances", type: "asset", parentCode: "104", isProtected: false },
  { code: "10403", name: "Allowance for Doubtful Accounts", type: "asset", parentCode: "104", isProtected: false },

  // 105 – Prepayments & Deposits
  { code: "105", name: "Prepayments & Deposits", type: "asset", parentCode: "1", isProtected: true },
  { code: "10501", name: "Prepaid Rent", type: "asset", parentCode: "105", isProtected: false },
  { code: "10502", name: "Prepaid Insurance", type: "asset", parentCode: "105", isProtected: false },
  { code: "10503", name: "Security Deposits", type: "asset", parentCode: "105", isProtected: false },
  { code: "10504", name: "Advance Tax Payments", type: "asset", parentCode: "105", isProtected: false },

  // 106 – Fixed Assets
  { code: "106", name: "Fixed Assets", type: "asset", parentCode: "1", isProtected: true },
  { code: "10601", name: "Land", type: "asset", parentCode: "106", isProtected: false },
  { code: "10602", name: "Buildings", type: "asset", parentCode: "106", isProtected: false },
  { code: "10603", name: "Machinery & Equipment", type: "asset", parentCode: "106", isProtected: false },
  { code: "10604", name: "Vehicles", type: "asset", parentCode: "106", isProtected: false },
  { code: "10605", name: "Furniture & Fixtures", type: "asset", parentCode: "106", isProtected: false },
  { code: "10606", name: "Computer Equipment", type: "asset", parentCode: "106", isProtected: false },
  { code: "10607", name: "Leasehold Improvements", type: "asset", parentCode: "106", isProtected: false },

  // 107 – Accumulated Depreciation
  { code: "107", name: "Accumulated Depreciation", type: "asset", parentCode: "1", isProtected: true },
  { code: "10701", name: "Accum. Depr. – Buildings", type: "asset", parentCode: "107", isProtected: false },
  { code: "10702", name: "Accum. Depr. – Machinery", type: "asset", parentCode: "107", isProtected: false },
  { code: "10703", name: "Accum. Depr. – Vehicles", type: "asset", parentCode: "107", isProtected: false },
  { code: "10704", name: "Accum. Depr. – Furniture", type: "asset", parentCode: "107", isProtected: false },
  { code: "10705", name: "Accum. Depr. – Computer Equip.", type: "asset", parentCode: "107", isProtected: false },

  // 108 – Intangible Assets
  { code: "108", name: "Intangible Assets", type: "asset", parentCode: "1", isProtected: true },
  { code: "10801", name: "Goodwill", type: "asset", parentCode: "108", isProtected: false },
  { code: "10802", name: "Software Licenses", type: "asset", parentCode: "108", isProtected: false },
  { code: "10803", name: "Patents & Trademarks", type: "asset", parentCode: "108", isProtected: false },

  // ========== 2. LIABILITIES ==========
  { code: "2", name: "Liabilities", type: "liability", parentCode: null, isProtected: true },

  // 201 – Accounts Payable
  { code: "201", name: "Accounts Payable", type: "liability", parentCode: "2", isProtected: true },
  { code: "20100", name: "Accounts Payable – General", type: "liability", parentCode: "201", isProtected: false },
  { code: "20101", name: "Local Suppliers", type: "liability", parentCode: "201", isProtected: false },
  { code: "20102", name: "International Suppliers", type: "liability", parentCode: "201", isProtected: false },

  // 202 – Taxes & Duties
  { code: "202", name: "Taxes & Duties", type: "liability", parentCode: "2", isProtected: true },
  { code: "20201", name: "VAT / Sales Tax Payable", type: "liability", parentCode: "202", isProtected: false },
  { code: "20202", name: "Import Duties Payable", type: "liability", parentCode: "202", isProtected: false },
  { code: "20203", name: "Corporate Income Tax Payable", type: "liability", parentCode: "202", isProtected: false },
  { code: "20204", name: "Withholding Tax Payable", type: "liability", parentCode: "202", isProtected: false },

  // 203 – Payroll Liabilities
  { code: "203", name: "Payroll Liabilities", type: "liability", parentCode: "2", isProtected: true },
  { code: "20301", name: "Salaries & Wages Payable", type: "liability", parentCode: "203", isProtected: false },
  { code: "20302", name: "Social Insurance Payable", type: "liability", parentCode: "203", isProtected: false },
  { code: "20303", name: "Employee Benefits Payable", type: "liability", parentCode: "203", isProtected: false },

  // 204 – Accrued Liabilities
  { code: "204", name: "Accrued Liabilities", type: "liability", parentCode: "2", isProtected: true },
  { code: "20401", name: "Accrued Expenses", type: "liability", parentCode: "204", isProtected: false },
  { code: "20402", name: "Accrued Interest", type: "liability", parentCode: "204", isProtected: false },
  { code: "20403", name: "Customer Deposits / Advances", type: "liability", parentCode: "204", isProtected: false },

  // 205 – Short-Term Borrowings
  { code: "205", name: "Short-Term Borrowings", type: "liability", parentCode: "2", isProtected: true },
  { code: "20501", name: "Bank Overdraft", type: "liability", parentCode: "205", isProtected: false },
  { code: "20502", name: "Short-Term Loans", type: "liability", parentCode: "205", isProtected: false },
  { code: "20503", name: "Credit Card Payable", type: "liability", parentCode: "205", isProtected: false },

  // 206 – Long-Term Liabilities
  { code: "206", name: "Long-Term Liabilities", type: "liability", parentCode: "2", isProtected: true },
  { code: "20601", name: "Long-Term Bank Loans", type: "liability", parentCode: "206", isProtected: false },
  { code: "20602", name: "Mortgage Payable", type: "liability", parentCode: "206", isProtected: false },
  { code: "20603", name: "Lease Obligations", type: "liability", parentCode: "206", isProtected: false },

  // 209 – GRNI
  { code: "209", name: "GRNI – Goods Received Not Invoiced", type: "liability", parentCode: "2", isProtected: false },

  // ========== 3. EQUITY ==========
  { code: "3", name: "Equity", type: "equity", parentCode: null, isProtected: true },

  // 301 – Contributed Capital
  { code: "301", name: "Contributed Capital", type: "equity", parentCode: "3", isProtected: true, equitySubgroup: "CONTRIBUTED_CAPITAL" },
  { code: "30101", name: "Paid-in Capital", type: "equity", parentCode: "301", isProtected: false, equitySubgroup: "CONTRIBUTED_CAPITAL" },
  { code: "30102", name: "Share Premium", type: "equity", parentCode: "301", isProtected: false, equitySubgroup: "CONTRIBUTED_CAPITAL" },
  { code: "30103", name: "Owner Drawings", type: "equity", parentCode: "301", isProtected: false },

  // 302 – Retained Earnings
  { code: "302", name: "Retained Earnings", type: "equity", parentCode: "3", isProtected: true, equitySubgroup: "RETAINED_EARNINGS" },
  { code: "30201", name: "Accumulated Profit / Loss", type: "equity", parentCode: "302", isProtected: false, equitySubgroup: "RETAINED_EARNINGS" },
  { code: "30202", name: "Dividends Declared", type: "equity", parentCode: "302", isProtected: false },

  // 303 – Reserves
  { code: "303", name: "Reserves", type: "equity", parentCode: "3", isProtected: true },
  { code: "30301", name: "Legal Reserve", type: "equity", parentCode: "303", isProtected: false },
  { code: "30302", name: "General Reserve", type: "equity", parentCode: "303", isProtected: false },
  { code: "30303", name: "Foreign Currency Translation Reserve", type: "equity", parentCode: "303", isProtected: false },

  // ========== 4. REVENUE ==========
  { code: "4", name: "Revenue", type: "revenue", parentCode: null, isProtected: true },

  // 400 – Sales Revenue (generic catch-all)
  { code: "400", name: "Sales Revenue", type: "revenue", parentCode: "4", isProtected: false, plSubgroup: "SALES" },

  // 401 – Wholesale Sales
  { code: "401", name: "Wholesale Sales", type: "revenue", parentCode: "4", isProtected: true, plSubgroup: "SALES" },
  { code: "40101", name: "Domestic Wholesale", type: "revenue", parentCode: "401", isProtected: false, plSubgroup: "SALES" },
  { code: "40102", name: "Export Sales", type: "revenue", parentCode: "401", isProtected: false, plSubgroup: "SALES" },

  // 402 – Retail Sales
  { code: "402", name: "Retail Sales", type: "revenue", parentCode: "4", isProtected: true, plSubgroup: "SALES" },
  { code: "40201", name: "In-Store Sales", type: "revenue", parentCode: "402", isProtected: false, plSubgroup: "SALES" },
  { code: "40202", name: "Online Sales", type: "revenue", parentCode: "402", isProtected: false, plSubgroup: "SALES" },

  // 403 – Service Revenue
  { code: "403", name: "Service Revenue", type: "revenue", parentCode: "4", isProtected: true, plSubgroup: "SALES" },
  { code: "40301", name: "Consulting Fees", type: "revenue", parentCode: "403", isProtected: false, plSubgroup: "SALES" },
  { code: "40302", name: "Project Revenue", type: "revenue", parentCode: "403", isProtected: false, plSubgroup: "SALES" },
  { code: "40303", name: "Maintenance & Support", type: "revenue", parentCode: "403", isProtected: false, plSubgroup: "SALES" },

  // 404 – Other Income
  { code: "404", name: "Other Income", type: "revenue", parentCode: "4", isProtected: true, plSubgroup: "OTHER_REVENUE" },
  { code: "40401", name: "Interest Income", type: "revenue", parentCode: "404", isProtected: false, plSubgroup: "OTHER_REVENUE" },
  { code: "40402", name: "Rental Income", type: "revenue", parentCode: "404", isProtected: false, plSubgroup: "OTHER_REVENUE" },
  { code: "40403", name: "Foreign Exchange Gains", type: "revenue", parentCode: "404", isProtected: false, plSubgroup: "OTHER_REVENUE" },
  { code: "40404", name: "Gain on Asset Disposal", type: "revenue", parentCode: "404", isProtected: false, plSubgroup: "OTHER_REVENUE" },

  // 405 – Sales Adjustments
  { code: "405", name: "Sales Adjustments", type: "revenue", parentCode: "4", isProtected: true, plSubgroup: "SALES" },
  { code: "40501", name: "Sales Returns & Allowances", type: "revenue", parentCode: "405", isProtected: false, plSubgroup: "SALES" },
  { code: "40502", name: "Sales Discounts", type: "revenue", parentCode: "405", isProtected: false, plSubgroup: "SALES" },

  // ========== 5. COST OF SALES ==========
  { code: "5", name: "Cost of Sales", type: "expense", parentCode: null, isProtected: true },

  // 501 – Cost of Goods Sold
  { code: "501", name: "Cost of Goods Sold", type: "expense", parentCode: "5", isProtected: true, plSubgroup: "COST_OF_SALES" },
  { code: "50100", name: "Cost of Goods Sold – General", type: "expense", parentCode: "501", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50101", name: "Purchases", type: "expense", parentCode: "501", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50102", name: "Freight Inward", type: "expense", parentCode: "501", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50103", name: "Purchase Returns & Allowances", type: "expense", parentCode: "501", isProtected: false, plSubgroup: "COST_OF_SALES" },

  // 502 – Direct Costs
  { code: "502", name: "Direct Costs", type: "expense", parentCode: "5", isProtected: true, plSubgroup: "COST_OF_SALES" },
  { code: "50201", name: "Direct Materials", type: "expense", parentCode: "502", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50202", name: "Direct Labor", type: "expense", parentCode: "502", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50203", name: "Subcontractor Costs", type: "expense", parentCode: "502", isProtected: false, plSubgroup: "COST_OF_SALES" },

  // 503 – Inventory Adjustments
  { code: "503", name: "Inventory Adjustments", type: "expense", parentCode: "5", isProtected: true, plSubgroup: "COST_OF_SALES" },
  { code: "50301", name: "Shrinkage & Loss", type: "expense", parentCode: "503", isProtected: false, plSubgroup: "COST_OF_SALES" },
  { code: "50302", name: "Damaged / Obsolete Goods", type: "expense", parentCode: "503", isProtected: false, plSubgroup: "COST_OF_SALES" },

  // ========== 6. OPERATING EXPENSES ==========
  { code: "6", name: "Operating Expenses", type: "expense", parentCode: null, isProtected: true },

  // 601 – Personnel
  { code: "601", name: "Personnel Expenses", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60101", name: "Salaries & Wages", type: "expense", parentCode: "601", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60102", name: "Employee Benefits", type: "expense", parentCode: "601", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60103", name: "Social Insurance", type: "expense", parentCode: "601", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60104", name: "Training & Development", type: "expense", parentCode: "601", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60105", name: "Sales Commissions", type: "expense", parentCode: "601", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 602 – Occupancy
  { code: "602", name: "Occupancy Expenses", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60201", name: "Rent", type: "expense", parentCode: "602", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60202", name: "Utilities", type: "expense", parentCode: "602", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60203", name: "Building Maintenance", type: "expense", parentCode: "602", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60204", name: "Security", type: "expense", parentCode: "602", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 603 – General & Administrative
  { code: "603", name: "General & Administrative", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60301", name: "Office Supplies", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60302", name: "Telecommunications", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60303", name: "Software Subscriptions", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60304", name: "Legal & Professional Fees", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60305", name: "Audit & Accounting Fees", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60306", name: "Insurance", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60307", name: "Licenses & Permits", type: "expense", parentCode: "603", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 604 – Sales & Marketing
  { code: "604", name: "Sales & Marketing", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60401", name: "Advertising", type: "expense", parentCode: "604", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60402", name: "Digital Marketing", type: "expense", parentCode: "604", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60403", name: "Trade Shows & Events", type: "expense", parentCode: "604", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60404", name: "Client Entertainment", type: "expense", parentCode: "604", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 605 – Travel & Transport
  { code: "605", name: "Travel & Transport", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60501", name: "Business Travel", type: "expense", parentCode: "605", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60502", name: "Vehicle Expenses", type: "expense", parentCode: "605", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60503", name: "Courier & Delivery", type: "expense", parentCode: "605", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 606 – Depreciation & Amortization
  { code: "606", name: "Depreciation & Amortization", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60601", name: "Depreciation Expense", type: "expense", parentCode: "606", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },
  { code: "60602", name: "Amortization Expense", type: "expense", parentCode: "606", isProtected: false, plSubgroup: "OPERATING_EXPENSES" },

  // 607 – Finance Costs
  { code: "607", name: "Finance Costs", type: "expense", parentCode: "6", isProtected: true, plSubgroup: "OTHER_EXPENSES" },
  { code: "60701", name: "Bank Charges & Fees", type: "expense", parentCode: "607", isProtected: false, plSubgroup: "OTHER_EXPENSES" },
  { code: "60702", name: "Interest Expense", type: "expense", parentCode: "607", isProtected: false, plSubgroup: "OTHER_EXPENSES" },
  { code: "60703", name: "Foreign Exchange Losses", type: "expense", parentCode: "607", isProtected: false, plSubgroup: "OTHER_EXPENSES" },
  { code: "60704", name: "Loss on Asset Disposal", type: "expense", parentCode: "607", isProtected: false, plSubgroup: "OTHER_EXPENSES" },
];
