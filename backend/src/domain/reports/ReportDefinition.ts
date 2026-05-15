export interface ReportDefinition {
  id: string;
  title: string;
  moduleId: string;
  permission: string;
  requiredParams: string[];
  optionalParams: string[];
  defaults: Record<string, unknown>;
  aiClarificationRules: string[];
  paramSchema: Record<string, unknown>;
  maxRows: number;
  dateBasis: 'period' | 'asOfDate';
}

export interface ReportOutputContext {
  reportId: string;
  reportTitle: string;
  generatedAt: string;
  period?: { fromDate: string; toDate: string };
  asOfDate?: string;
  dateBasis: 'period' | 'asOfDate';
  filters: Record<string, unknown>;
  defaultsApplied: string[];
  warnings: string[];
  truncated: boolean;
  truncationNote?: string;
}

export interface ReportMoneyContext {
  baseCurrency: string;
  reportCurrency: string;
  converted: boolean;
  conversionPolicy?: 'transactionRate' | 'periodAverage' | 'closingRate' | 'notConverted';
}

export interface ReportResult {
  reportContext: ReportOutputContext;
  moneyContext: ReportMoneyContext;
  data: Record<string, unknown>;
}
