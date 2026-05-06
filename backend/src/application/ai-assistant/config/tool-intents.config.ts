/**
 * AiToolIntentConfig - Comprehensive multilanguage keyword mapping for AI tool detection
 *
 * This file defines ALL intent keywords for ALL registered tools.
 * Each tool has keywords in English, Arabic, and Turkish.
 *
 * DESIGN PRINCIPLES:
 * - Keywords should be specific enough to avoid false positives
 * - Common financial terms should map to the most specific tool
 * - "ميزان" (mizan) → trial balance, NOT balance sheet
 * - "ميزانية" (mizaniya) → balance sheet, NOT trial balance
 * - Substring matching is greedy — more specific keywords should be listed first
 * - The orchestrator checks ALL matching intents and may invoke multiple tools
 *
 * MAINTAINABILITY:
 * - Add new tools by adding a new entry to TOOL_INTENTS
 * - Add new languages by extending each entry's keywords array
 * - Keep keywords grouped by language with comments
 */

export interface ToolIntent {
  toolName: string;
  keywords: string[];
}

/**
 * Complete intent mapping for all registered AI tools.
 * Only tools that have a real implementation should be here.
 * Unavailable or blocked tools should NOT have entries.
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

  // ─── INVENTORY ─────────────────────────────────────────────────────────────

  {
    toolName: 'inventory.getItemStockBalance',
    keywords: [
      // English
      'stock balance', 'inventory balance', 'item stock', 'quantity on hand',
      'how much stock', 'current stock',
      // Arabic
      'رصيد المخزون', 'رصيد المخزن', 'كمية المخزون',
      'كم المخزون', 'المخزون الحالي',
      // Turkish
      'stok bakiyesi', 'stok miktarı', 'mevcut stok',
    ],
  },
  {
    toolName: 'inventory.getLowStockItems',
    keywords: [
      // English
      'low stock', 'stock alert', 'reorder point', 'below minimum',
      'stock shortage', 'items running low',
      // Arabic
      'نقص المخزون', 'مخزون منخفض', 'تنبيه مخزون',
      'مخزون غير كافي',
      // Turkish
      'düşük stok', 'stok uyarısı', 'stok azalması',
    ],
  },
  {
    toolName: 'inventory.getOutOfStockItems',
    keywords: [
      // English
      'out of stock', 'zero stock', 'out of stock items', 'no stock',
      // Arabic
      'نفذ المخزون', 'مخزون فارغ', 'بدون مخزون',
      // Turkish
      'stok tükendi', 'sıfır stok', 'stoksuz',
    ],
  },
  {
    toolName: 'inventory.getInventoryValuationSummary',
    keywords: [
      // English
      'inventory valuation', 'stock value', 'inventory value',
      'value of inventory', 'total inventory value',
      // Arabic
      'تقييم المخزون', 'قيمة المخزون', 'قيمة المخزونات',
      // Turkish
      'stok değerleme', 'stok değeri', 'envanter değeri',
    ],
  },
  {
    toolName: 'inventory.searchItems',
    keywords: [
      // English
      'search items', 'find item', 'item lookup', 'product search',
      'search product', 'find product',
      // Arabic
      'بحث عن صنف', 'البحث عن منتج', 'بحث منتج',
      // Turkish
      'ürün arama', 'ürün bul', 'stok ara',
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
  {
    toolName: 'sales.getUnpaidInvoices',
    keywords: [
      // English
      'unpaid invoices', 'outstanding invoices', 'open invoices',
      'unpaid sales', 'invoices due',
      // Arabic
      'فواتير غير مدفوعة', 'فواتير مستحقة', 'فواتير مفتوحة',
      // Turkish
      'ödenecek faturalar', 'açık faturalar', 'tahsil edilmemiş',
    ],
  },
  {
    toolName: 'sales.getOverdueCustomerInvoices',
    keywords: [
      // English
      'overdue invoices', 'past due invoices', 'late invoices',
      'overdue customer', 'past due customer',
      // Arabic
      'فواتير متأخرة', 'فواتير متأخرة الدفع', 'عملاء متأخرين',
      // Turkish
      'gecikmiş faturalar', 'vadesi geçmiş faturalar',
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
  {
    toolName: 'purchase.getUnpaidSupplierInvoices',
    keywords: [
      // English
      'unpaid purchase invoices', 'unpaid supplier invoices',
      'outstanding payables', 'bills to pay',
      // Arabic
      'فواتير موردين غير مدفوعة', 'فواتير شراء مستحقة',
      'ذمم دائنة مستحقة',
      // Turkish
      'ödenecek satın alma faturaları', 'tedarikçi faturaları',
      'ödenmemiş faturalar',
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
  {
    toolName: 'reports.getCashPositionSummary',
    keywords: [
      // English
      'cash position', 'how much cash', 'available cash',
      'cash on hand', 'bank balance',
      // Arabic
      'وضع السيولة', 'كم النقد المتاح', 'الرصيد النقدي',
      // Turkish
      'nakit pozisyonu', 'mevcut nakit', 'nakit durumu',
    ],
  },
  {
    toolName: 'reports.getReceivablesPayablesOverview',
    keywords: [
      // English
      'receivables and payables', 'AR AP overview', 'receivables payables',
      'what we owe and what we are owed', 'money in money out',
      // Arabic
      'الذمم المدينة والدائنة', 'ملخص المديونية', 'ما لنا وما علينا',
      // Turkish
      'alacaklar ve borçlar', 'alacak borç özeti',
    ],
  },
  {
    toolName: 'reports.comparePeriodPerformance',
    keywords: [
      // English
      'compare period', 'compare periods', 'period comparison',
      'this month vs last month', 'this year vs last year',
      'year over year', 'YoY', 'MoM', 'period over period',
      // Arabic
      'مقارنة الفترات', 'هذا الشهر مقابل الشهر الماضي',
      'هذه السنة مقابل السنة الماضية',
      // Turkish
      'dönem karşılaştırması', 'bu ay geçen ay',
      'yıl üzerinden karşılaştırma',
    ],
  },
];

/**
 * Get all intent definitions.
 * Used by AiToolCallingOrchestrator to detect user intents.
 */
export function getToolIntents(): ToolIntent[] {
  return TOOL_INTENTS;
}