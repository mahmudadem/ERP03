/**
 * Domain Skills Configuration - Skill templates/playbooks for each business domain
 *
 * These are NOT executable code. They are structured metadata that defines
 * how the AI Assistant should behave when handling domain-specific questions.
 * Each domain skill provides:
 * - Trigger keywords for deterministic skill selection
 * - Domain-specific behavioral rules (system prompt additions)
 * - Applicable tool names for reference
 * - Safety rules specific to the domain
 *
 * SECURITY RULES:
 * - Domain skills never contain secrets or API keys
 * - Domain skills never bypass permission checks
 * - Domain skills never execute code or make direct DB queries
 * - Domain skills only reference tools by name — actual execution goes
 *   through the permission-gated AiToolRegistry
 * - Write operations are always marked as Proposal/Draft only
 */

import { AiSkill } from './base-orchestration.skill';

export type DomainSkillConfig = Record<string, AiSkill>;

export const DOMAIN_SKILLS: DomainSkillConfig = {
  // ─── ACCOUNTING ──────────────────────────────────────────────────────────

  'accounting-guidance': {
    id: 'accounting-guidance',
    name: 'Accounting Guidance',
    moduleId: 'accounting',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'accounting', 'journal', 'ledger', 'trial balance', 'accounts',
      'debit', 'credit', 'chart of accounts', 'COA', 'fiscal year',
      'period', 'posting', 'entry', 'voucher',
      'balance sheet', 'income statement', 'P&L', 'profit and loss',
      'cash flow', 'receivable', 'payable', 'ageing', 'aging',
      'bookkeeping', 'reconciliation', 'general ledger', 'GL',
      'accrual', 'deferral', 'depreciation', 'amortization',
      'retained earnings', 'closing entries', 'opening balance',
      'what is my', 'show me', 'how much', 'balance of',
      // Arabic
      'محاسبة', 'قيود', 'دفتر الأستاذ', 'ميزان المراجعة', 'حسابات',
      'مدين', 'دائن', 'دليل الحسابات', 'السنة المالية',
      'الميزانية العمومية', 'قائمة الدخل', 'التدفقات النقدية',
      'تسوية', 'إهلاك', 'أرصدة', 'إقفال',
      // Turkish
      'muhasebe', 'yevmiye', 'büyük defter', 'mizan', 'hesaplar',
      'borç', 'alacak', 'hesap planı', 'mali yıl',
      'bilanço', 'gelir tablosu', 'nakit akışı',
      'mutabakat', 'amortisman', 'kapanış',
    ],
    applicableTools: [
      'accounting.getTrialBalanceSummary',
      'accounting.getProfitAndLoss',
      'accounting.getBalanceSheet',
      'accounting.getCashFlowSummary',
      'accounting.getAgingReceivables',
      'accounting.getAgingPayables',
      'accounting.getGeneralLedgerSummary',
      'accounting.getChartOfAccountsSummary',
      'accounting.getAccountBalance',
      'accounting.getAccountStatementSummary',
      'accounting.getAccountingPeriodStatus',
    ],
    readonly: false,
    description: 'Behavioral guidance for accounting-related questions. Emphasizes accuracy, double-entry principles, and that the AI cannot post entries.',
    safetyRules: [
      'Never create journal entries — propose them for human review',
      'Never post to any period — suggest the user verify period status first',
      'Always verify account codes exist before referencing them',
      'Present financial data with proper debit/credit labeling',
      'If balances appear unusual, flag them for human verification',
    ],
    systemPrompt: `When handling accounting questions:
- Present financial data accurately with proper debits/credits labeling
- Always clarify the period/date range for any financial summary
- If a user asks to create a journal entry, propose it as a Draft for review
- Never suggest that you have posted, approved, or modified any accounting data
- If accounts appear unbalanced, flag this for the user to investigate
- Suggest using the Chart of Accounts tool for account lookups before referencing specific accounts`,
  },

  // ─── INVENTORY ────────────────────────────────────────────────────────────

  'inventory-guidance': {
    id: 'inventory-guidance',
    name: 'Inventory Guidance',
    moduleId: 'inventory',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'inventory', 'stock', 'warehouse', 'item', 'product', 'reorder',
      'quantity', 'stock level', 'low stock', 'out of stock',
      'items', 'goods', 'material', 'materials', 'SKU',
      'stock movement', 'stock transfer', 'stock adjustment',
      'available', 'on hand', 'in stock', 'backorder',
      'how many', 'how much stock', 'do we have',
      // Arabic
      'مخزون', 'مخازن', 'مستودع', 'صنف', 'منتج', 'كمية', 'طلب جديد',
      'حركة مخزون', 'تحويل مخزون', 'تسوية مخزون',
      'متوفر', 'راكد', 'نواقص',
      // Turkish
      'stok', 'depo', 'ürün', 'stok seviyesi', 'sipariş',
      'stok hareketi', 'stok transferi', 'stok düzeltme',
      'mevcut', 'tükendi', 'yetersiz',
    ],
    applicableTools: [
      'inventory.getItemStockBalance',
      'inventory.getLowStockItems',
      'inventory.getOutOfStockItems',
      'inventory.getInventoryValuationSummary',
      'inventory.searchItems',
    ],
    readonly: false,
    description: 'Behavioral guidance for inventory-related questions. Emphasizes that the AI cannot adjust stock levels.',
    safetyRules: [
      'Never adjust stock levels — propose adjustments for human review',
      'Never create purchase orders or transfers — suggest the workflow',
      'Stock quantities shown are point-in-time — always note this',
      'If stock appears negative, flag it as a data issue for investigation',
    ],
    systemPrompt: `When handling inventory questions:
- Present stock levels with units of measure clearly labeled
- If stock is low or zero, suggest reorder procedures as a Draft
- Never suggest that you have adjusted, transferred, or received stock
- Clearly note that inventory data is point-in-time and may not reflect real-time changes
- Suggest using the search tool to find specific items by name or code`,
  },

  // ─── SALES ────────────────────────────────────────────────────────────────

  'sales-guidance': {
    id: 'sales-guidance',
    name: 'Sales Guidance',
    moduleId: 'sales',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'sales', 'invoice', 'customer', 'revenue', 'order',
      'receivable', 'payment',
      'delivery note', 'sales order', 'sales return',
      'top customer', 'overdue', 'unpaid', 'collect',
      'selling', 'sold', 'buyer', 'client',
      'how much did', 'revenue from', 'who owes',
      // Arabic
      'مبيعات', 'فاتورة', 'عميل', 'إيرادات', 'طلب بيع',
      'إشعار تسليم', 'مرتجع مبيعات', 'متأخر', 'غير مدفوع',
      'مشتري', 'زبون', 'بائع',
      // Turkish
      'satış', 'fatura', 'müşteri', 'gelir', 'sipariş',
      'teslim notası', 'satış iade', 'gecikmiş', 'ödeme',
      'alıcı', 'cari',
    ],
    applicableTools: [
      'sales.getSalesSummary',
      'sales.getTopCustomers',
      'sales.getUnpaidInvoices',
      'sales.getOverdueCustomerInvoices',
    ],
    readonly: false,
    description: 'Behavioral guidance for sales-related questions. Emphasizes that the AI cannot create invoices or approve payments.',
    safetyRules: [
      'Never create invoices — propose them as Drafts for human review',
      'Never approve or post sales documents',
      'If overdue invoices are found, suggest collection workflows rather than taking action',
      'Revenue figures shown are summary data — never treat them as real-time',
    ],
    systemPrompt: `When handling sales questions:
- Present revenue and customer data clearly with time period context
- If a user asks to create a sales invoice, propose it as a Draft
- Never suggest that you have created, posted, or approved any sales document
- For overdue invoices, suggest collection follow-up procedures
- Clearly note that sales data is based on posted transactions and may not include today's activity`,
  },

  // ─── PURCHASES ─────────────────────────────────────────────────────────────

  'purchases-guidance': {
    id: 'purchases-guidance',
    name: 'Purchases Guidance',
    moduleId: 'purchases',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'purchase', 'vendor', 'supplier', 'payable', 'purchase order',
      'bill', 'spending',
      'goods receipt', 'purchase return', 'expense',
      'buying', 'bought', 'procurement',
      'how much did we spend', 'owed to', 'supplier balance',
      // Arabic
      'مشتريات', 'مورد', 'فواتير شراء', 'ذمم دائنة',
      'استلام بضاعة', 'مرتجع مشتريات', 'مصروف',
      'شراء', 'مشتري', 'توريد',
      // Turkish
      'satın alma', 'tedarikçi', 'satın alma faturası', 'borçlar',
      'irsaliye', 'satın alma iade', 'gider',
      'alım', 'tedarik',
    ],
    applicableTools: [
      'purchase.getPurchaseSummary',
      'purchase.getTopSuppliers',
      'purchase.getUnpaidSupplierInvoices',
    ],
    readonly: false,
    description: 'Behavioral guidance for purchase-related questions. Emphasizes that the AI cannot create purchase orders or approve payments.',
    safetyRules: [
      'Never create purchase orders — propose them as Drafts for human review',
      'Never approve or post purchase documents',
      'Payable figures shown are summary data — never treat them as real-time',
      'If data seems unusual, suggest the user verify in the Purchases module',
    ],
    systemPrompt: `When handling purchase questions:
- Present spending and supplier data clearly with time period context
- If a user asks to create a purchase order, propose it as a Draft
- Never suggest that you have created, posted, or approved any purchase document
- For unpaid supplier invoices, suggest the standard payment workflow
- Clearly note that purchase data is based on posted transactions`,
  },

  // ─── REPORTS / BI ───────────────────────────────────────────────────────────

  'reports-guidance': {
    id: 'reports-guidance',
    name: 'Reports & BI Guidance',
    moduleId: 'reports',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'report', 'overview', 'dashboard', 'comparison', 'analysis',
      'financial position', 'monthly', 'period', 'kpi',
      'financial', 'profit', 'loss', 'gain', 'revenue', 'expense', 'cost',
      'health', 'status', 'situation', 'doing', 'performance', 'summary',
      'how are we', 'how is the', 'business',
      'trend', 'metric', 'analytics', 'insights',
      'give me a report', 'show me the numbers',
      'what is the status', 'where do we stand',
      // Arabic
      'تقرير', 'نظرة عامة', 'لوحة القيادة', 'تحليل', 'مقارنة',
      'مالي', 'ربح', 'خسارة', 'إيرادات', 'مصاريف', 'وضع', 'حالة', 'أداء',
      'كيف حالنا', 'كيف أعمالنا',
      'اتجاه', 'مؤشر', 'رؤى',
      // Turkish
      'rapor', 'genel bakış', 'tablo', 'analiz', 'karşılaştırma',
      'mali', 'kâr', 'zarar', 'gelir', 'gider', 'durum', 'performans',
      'nasılımız', 'işler nasıl',
      'trend', 'metrik', 'çözümleme',
    ],
    applicableTools: [
      'reports.getFinancialOverview',
      'reports.getMonthlyPerformanceSummary',
      'reports.getCashPositionSummary',
      'reports.getReceivablesPayablesOverview',
      'reports.comparePeriodPerformance',
    ],
    readonly: false,
    description: 'Behavioral guidance for reporting and BI questions. Emphasizes data accuracy and suggests charting after data retrieval.',
    safetyRules: [
      'Never modify report parameters or saved reports — suggest changes for human review',
      'Present data as-is — do not extrapolate or forecast beyond available data',
      'If data appears incomplete, suggest the user verify report filters and date ranges',
      'Clearly label all figures with their time period and scope',
    ],
    systemPrompt: `When handling reporting and analytics questions:
- Present data clearly with proper labels, time periods, and scope
- After presenting data, suggest charting or visualization if appropriate
- Never fabricate data points or extrapolate beyond the provided figures
- If data appears incomplete or unusual, suggest verifying report parameters
- Clearly label all values with units and time periods
- If the user asks for a comparison, use period comparison tools when available
- Suggest navigating to the Reports module for interactive exploration`,
  },

  // ─── PLATFORM / GENERAL ────────────────────────────────────────────────────

  'platform-guidance': {
    id: 'platform-guidance',
    name: 'Platform & Navigation Guidance',
    moduleId: 'platform',
    activation: 'keyword',
    triggerKeywords: [
      // English
      'how do i', 'where is', 'navigate', 'settings', 'module', 'feature',
      'help', 'tutorial', 'guide',
      'how to', 'where can i find', 'can i', 'is it possible',
      'need help', 'stuck', 'don\'t know how',
      'setup', 'configure', 'enable', 'disable', 'permission',
      'role', 'user management', 'company settings',
      // Arabic
      'كيف', 'أين', 'إعدادات', 'مساعدة', 'دليل',
      'كيف يمكنني', 'هل يمكن', 'أحتاج مساعدة', 'إعداد',
      'صلاحية', 'دور', 'إدارة مستخدمين', 'إعدادات الشركة',
      // Turkish
      'nasıl', 'nerede', 'ayarlar', 'yardım', 'rehber',
      'nasıl yapabilirim', 'mümkün mü', 'yardıma ihtiyacım var',
      'kurulum', 'yetki', 'rol', 'kullanıcı yönetimi', 'şirket ayarları',
    ],
    applicableTools: [], // Navigation questions don't need data tools
    readonly: false,
    description: 'Behavioral guidance for platform navigation and how-to questions. Emphasizes explaining workflows rather than executing them.',
    safetyRules: [
      'Never expose internal system paths, API endpoints, or technical details',
      'Guide the user through UI steps rather than performing actions for them',
      'If a feature is not available in their plan, suggest contacting their administrator',
    ],
    systemPrompt: `When handling platform navigation or how-to questions:
- Explain the UI workflow step-by-step for the user to follow
- Reference the correct module and screen name for each step
- If the feature requires a specific permission, mention it
- Never expose internal system architecture, API paths, or database details
- If you don't know the exact UI path, suggest the user check the module navigation
- For complex workflows, break them into numbered steps`,
  },
};