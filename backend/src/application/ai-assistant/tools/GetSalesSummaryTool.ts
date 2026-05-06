/**
 * GetSalesSummaryTool - AI Tool for read-only Sales summaries
 *
 * Returns a sanitized summary of sales invoices for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via sales.invoices.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 */
interface SalesSummaryDTO {
  period: { from: string; to: string };
  totalRevenue: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  byStatus: Record<string, number>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    invoiceCount: number;
    totalRevenue: number;
  }>;
}

export class GetSalesSummaryTool implements AiTool {
  readonly name = 'sales.getSalesSummary';
  readonly description = 'Get a sales summary for the company. Returns total revenue, invoice count, average invoice value, breakdown by status, and top customers. Optionally accepts fromDate and toDate. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'sales.invoices.view';
  readonly module = 'sales';

  private salesInvoiceRepo: ISalesInvoiceRepository;
  private partyRepo: IPartyRepository;
  private permissionChecker: PermissionChecker;

  constructor(
    salesInvoiceRepo: ISalesInvoiceRepository,
    partyRepo: IPartyRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.salesInvoiceRepo = salesInvoiceRepo;
    this.partyRepo = partyRepo;
    this.permissionChecker = permissionChecker;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);

      const now = new Date();
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];

      const invoices = await this.salesInvoiceRepo.list(context.companyId);

      // Filter by date range
      const filtered = invoices.filter((inv: any) => {
        const date = inv.invoiceDate || (inv as any).date;
        if (!date) return true; // include if no date
        const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
        return dateStr >= fromDate && dateStr <= toDate;
      });

      // Aggregate metrics
      let totalRevenue = 0;
      const byStatus: Record<string, number> = { DRAFT: 0, POSTED: 0, CANCELLED: 0 };
      const customerMap = new Map<string, { customerName: string; invoiceCount: number; totalRevenue: number }>();

      for (const inv of filtered) {
        const revenue = (inv as any).grandTotalBase || (inv as any).grandTotalDoc || 0;
        totalRevenue += Number(revenue) || 0;

        const status = String((inv as any).status || 'DRAFT').toUpperCase();
        if (status in byStatus) {
          byStatus[status]++;
        }

        const customerId = (inv as any).customerId || '';
        if (customerId) {
          const existing = customerMap.get(customerId) || { customerName: (inv as any).customerName || 'Unknown', invoiceCount: 0, totalRevenue: 0 };
          existing.invoiceCount++;
          existing.totalRevenue += Number(revenue) || 0;
          customerMap.set(customerId, existing);
        }
      }

      // Enrich customer names from party repository
      try {
        const parties = await this.partyRepo.list(context.companyId, { role: 'CUSTOMER' });
        const partyMap = new Map(parties.map((p: any) => [p.id, p]));
        for (const [customerId, data] of customerMap.entries()) {
          const party = partyMap.get(customerId);
          if (party) {
            data.customerName = party.displayName || party.legalName || data.customerName;
          }
        }
      } catch {
        // Party names from invoices are acceptable fallback
      }

      // Top 10 customers by revenue
      const topCustomers = Array.from(customerMap.entries())
        .map(([customerId, data]) => ({
          customerId,
          customerName: data.customerName,
          invoiceCount: data.invoiceCount,
          totalRevenue: round2(data.totalRevenue),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      const invoiceCount = filtered.length;
      const averageInvoiceValue = invoiceCount > 0 ? round2(totalRevenue / invoiceCount) : 0;

      const summary: SalesSummaryDTO = {
        period: { from: fromDate, to: toDate },
        totalRevenue: round2(totalRevenue),
        invoiceCount,
        averageInvoiceValue,
        byStatus,
        topCustomers,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve sales summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}