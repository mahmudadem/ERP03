/**
 * AiToolIntentConfig - Multilanguage keyword mapping for AI tool detection
 *
 * SAFETY: Only tools with a REAL implementation class registered in DI
 * should have entries here. Unimplemented tools cause the orchestrator
 * to skip them, resulting in NO tool data — which causes the AI to
 * HALLUCINATE financial figures. This is a critical safety risk.
 *
 * RULES:
 * - Keywords should be specific enough to avoid false positives
 * - Common financial terms should map to the most specific tool
 * - "ميزان" (mizan) → trial balance, NOT balance sheet
 * - "ميزانية" (mizaniya) → balance sheet, NOT trial balance
 * - Substring matching is greedy — more specific keywords should be listed first
 * - The orchestrator checks ALL matching intents and may invoke multiple tools
 * - NEVER add entries for tools without a real implementation class
 */

export interface ToolIntent {
  toolName: string;
  keywords: string[];
}

/**
 * Intent mapping for IMPLEMENTED AI tools only.
 *
 * When adding a new implementation:
 * 1. Create the tool class in tools/ and register it in DI
 * 2. Add it to IMPLEMENTED_TOOL_NAMES in AiToolCatalogSeed.ts
 * 3. Add an intent entry HERE with EN/AR/TR keywords
 *
 * When removing an implementation:
 * 1. Remove it from DI and IMPLEMENTED_TOOL_NAMES
 * 2. Remove the intent entry HERE
 * 3. Keep the catalog seed entry (status can stay active)
 */
export const TOOL_INTENTS: ToolIntent[] = [
  // ─── ACCOUNTING — Reports ─────────────────────────────────────────────────

  {
    toolName: 'accounting.getTrialBalanceSummary',
    keywords: [
      // English
      'trial balance', 'balance summary', 'accounting summary',
      'debit credit summary', 'closing balance', 'account balances',
      'financial summary', 'total debit', 'total credit',
      // Arabic
      'ميزان المراجعة', 'ميزان مراجعة', 'ملخص الميزان',
      'ميزان', 'أرصدة',
      // Turkish
      'deneme bilançosu', 'mizan', 'genel mizan',
      'borç alacak özeti', 'hesap özeti',
    ],
  },
  {
    toolName: 'accounting.getProfitAndLoss',
    keywords: [
      // English
      'profit and loss', 'profit & loss', 'p&l', 'income statement',
      'net profit', 'gross profit', 'revenue and expenses',
      'profitability', 'revenue', 'expenses summary',
      // Arabic
      'الأرباح والخسائر', 'ارباح وخسائر', 'قائمة الدخل',
      'صافي الربح', 'الإيرادات والمصروفات', 'إيرادات ومصروفات',
      // Turkish
      'kar zarar', 'gelir tablosu', 'net kar',
      'gelir ve gider', 'kârlılık',
    ],
  },
  {
    toolName: 'accounting.getBalanceSheet',
    keywords: [
      // English
      'balance sheet', 'statement of financial position',
      'assets and liabilities', 'assets liabilities equity',
      // Arabic
      'الميزانية العمومية', 'قائمة المركز المالي',
      'الأصول والخصوم', 'الاصول والخصوم', 'ميزانية عمومية',
      // Turkish
      'bilanço', 'finansal durum tablosu',
      'varlıklar ve borçlar', 'bilanço tablosu',
    ],
  },
  {
    toolName: 'accounting.getCashFlowSummary',
    keywords: [
      // English
      'cash flow', 'cashflow', 'cash position', 'cash movement',
      'operating cash', 'investing cash', 'financing cash',
      'cash summary', 'liquidity',
      // Arabic
      'التدفقات النقدية', 'تدفق نقدي', 'السيولة',
      'حركة النقد', 'التدفق النقدي',
      // Turkish
      'nakit akışı', 'nakit akış', 'nakit pozisyonu',
      'likidite', 'nakit özeti',
    ],
  },
  {
    toolName: 'accounting.getAgingReceivables',
    keywords: [
      // English
      'aging receivables', 'accounts receivable aging', 'AR aging',
      'receivables aging', 'customer aging', 'aged receivables',
      'receivables summary', 'outstanding receivables',
      // Arabic
      'أعمار الذمم المدينة', 'تق ageing الذمم المدينة', 'عملاء متأخرين',
      'تحصيلات متأخرة', 'ذمم مدينة',
      // Turkish
      'alacak yaşlandırma', 'alacak yaşlandırma raporu',
      'alacaklar özeti', 'gecikmiş alacaklar',
    ],
  },
  {
    toolName: 'accounting.getAgingPayables',
    keywords: [
      // English
      'aging payables', 'accounts payable aging', 'AP aging',
      'payables aging', 'supplier aging', 'vendor aging',
      'aged payables', 'outstanding payables',
      // Arabic
      'أعمار الذمم الدائنة', 'تق ageing الذمم الدائنة', 'موردين متأخرين',
      'دفعات متأخرة', 'ذمم دائنة',
      // Turkish
      'borç yaşlandırma', 'borç yaşlandırma raporu',
      'borçlar özeti', 'gecikmiş borçlar',
    ],
  },
  {
    toolName: 'accounting.getGeneralLedgerSummary',
    keywords: [
      // English
      'general ledger summary', 'GL summary', 'ledger summary',
      'all accounts summary', 'full ledger',
      // Arabic
      'ملخص دفتر الأستاذ العام', 'دفتر الأستاذ', 'الأستاذ العام',
      // Turkish
      'genel muhasebe özeti', 'büyük defter özeti', 'muhasebe özeti',
    ],
  },

  // ─── ACCOUNTING — Accounts / COA ──────────────────────────────────────────

  {
    toolName: 'accounting.getChartOfAccountsSummary',
    keywords: [
      // English
      'chart of accounts', 'COA', 'account list', 'accounts summary',
      'all accounts', 'account structure',
      // Arabic
      'دليل الحسابات', 'شجرة الحسابات', 'قائمة الحسابات',
      'ملخص الحسابات', 'هيكل الحسابات',
      // Turkish
      'hesap planı', 'hesap listesi', 'hesap özeti',
      'hesap ağacı', 'muhasebe hesapları',
    ],
  },
  {
    toolName: 'accounting.getAccountBalance',
    keywords: [
      // English
      'account balance', 'balance of account', 'what is the balance',
      'how much is in', 'account total',
      // Arabic
      'رصيد حساب', 'رصيد الحساب', 'كم الرصيد',
      // Turkish
      'hesap bakiyesi', 'hesap bakiye', 'bakiye',
    ],
  },
  {
    toolName: 'accounting.getAccountStatementSummary',
    keywords: [
      // English
      'account statement', 'statement summary', 'account activity',
      'account detail', 'ledger for account',
      // Arabic
      'كشف حساب', 'ملخص كشف حساب', 'حركة حساب',
      // Turkish
      'hesap ekstresi', 'hesap hareketleri', 'hesap detayı',
    ],
  },

  // ─── ACCOUNTING — Period ──────────────────────────────────────────────────

  {
    toolName: 'accounting.getAccountingPeriodStatus',
    keywords: [
      // English
      'fiscal year', 'accounting period', 'period status',
      'current period', 'fiscal period',
      // Arabic
      'السنة المالية', 'الفترة المحاسبية', 'الفترة الحالية',
      // Turkish
      'mali yıl', 'muhasebe dönemi', 'dönem durumu',
    ],
  },

  // ─── SALES ─────────────────────────────────────────────────────────────────

  {
    toolName: 'sales.getSalesSummary',
    keywords: [
      // English
      'sales summary', 'sales overview', 'total sales',
      'revenue summary', 'sales report',
      // Arabic
      'ملخص المبيعات', 'إجمالي المبيعات', 'تقرير المبيعات',
      'نظرة عامة على المبيعات',
      // Turkish
      'satış özeti', 'satış raporu', 'toplam satış',
      'satış genel bakış',
    ],
  },
  {
    toolName: 'sales.getTopCustomers',
    keywords: [
      // English
      'top customers', 'best customers', 'largest customers',
      'customers by revenue', 'customer ranking',
      // Arabic
      'أفضل الزبائن', 'أكبر العملاء', 'العملاء الأكثر شراءً',
      'ترتيب العملاء',
      // Turkish
      'en iyi müşteriler', 'en büyük müşteriler', 'müşteri sıralaması',
    ],
  },

  // ─── PURCHASES ─────────────────────────────────────────────────────────────

  {
    toolName: 'purchase.getPurchaseSummary',
    keywords: [
      // English
      'purchase summary', 'purchase overview', 'total purchases',
      'spending summary', 'purchase report',
      // Arabic
      'ملخص المشتريات', 'إجمالي المشتريات', 'تقرير المشتريات',
      'نظرة عامة على المشتريات',
      // Turkish
      'satın alma özeti', 'satın alma raporu', 'toplam alımlar',
    ],
  },
  {
    toolName: 'purchase.getTopSuppliers',
    keywords: [
      // English
      'top suppliers', 'top vendors', 'biggest suppliers',
      'suppliers by spend', 'vendor ranking',
      // Arabic
      'أفضل الموردين', 'أكبر الموردين', 'ترتيب الموردين',
      // Turkish
      'en iyi tedarikçiler', 'en büyük tedarikçiler', 'tedarikçi sıralaması',
    ],
  },

  // ─── REPORTS / BI ──────────────────────────────────────────────────────────

  {
    toolName: 'reports.getFinancialOverview',
    keywords: [
      // English
      'financial overview', 'financial position', 'company position',
      'financial health', 'financial snapshot', 'how is the company doing',
      'company overview', 'business overview',
      // Arabic
      'نظرة مالية عامة', 'المركز المالي', 'وضع الشركة',
      'صحة الشركة المالية', 'ملخص مالي شامل',
      // Turkish
      'finansal genel bakış', 'finansal durum', 'şirket durumu',
      'finansal sağlık', 'iş genel bakış',
    ],
  },
  {
    toolName: 'reports.getMonthlyPerformanceSummary',
    keywords: [
      // English
      'monthly comparison', 'monthly performance', 'month over month',
      'monthly trend', 'monthly P&L', 'compare months',
      'most profitable month', 'best month', 'monthly revenue',
      // Arabic
      'مقارنة شهرية', 'أداء شهري', 'شهر على شهر',
      'توجه شهري', 'أفضل شهر', 'أكثر شهر مربح',
      // Turkish
      'aylık karşılaştırma', 'aylık performans', 'aylık trend',
      'en kârlı ay', 'aylık gelir',
    ],
  },
];

/**
 * Get all intent definitions for IMPLEMENTED tools only.
 * Used by AiToolCallingOrchestrator to detect user intents.
 *
 * IMPORTANT: This list MUST only contain tools that have a real
 * implementation class registered in the DI container. Adding
 * entries for unimplemented tools causes the AI to hallucinate
 * financial data when no tool executes — a critical safety risk.
 */
export function getToolIntents(): ToolIntent[] {
  return TOOL_INTENTS;
}