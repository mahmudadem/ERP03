/**
 * GetTopCustomersTool - AI Tool for read-only Top Customers report
 *
 * Returns the top customers by revenue for the user's company.
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
interface TopCustomersDTO {
  customers: Array<{
    customerId: string;
    customerName: string;
    invoiceCount: number;
    totalRevenue: number;
  }>;
  period: { from: string; to: string };
}

export class GetTopCustomersTool implements AiTool {
  readonly name = 'sales.getTopCustomers';
  readonly description = 'Get top customers by revenue for the company. Returns customer name, invoice count, and total revenue. Optionally accepts limit, fromDate, and toDate parameters. Read-only — cannot create, modify, or post anything.';
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
      const limit = (params?.limit as number) || 10;

      const invoices = await this.salesInvoiceRepo.list(context.companyId);

      // Filter by date range
      const filtered = invoices.filter((inv: any) => {
        const date = inv.invoiceDate || (inv as any).date;
        if (!date) return true;
        const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
        return dateStr >= fromDate && dateStr <= toDate;
      });

      // Aggregate by customer
      const customerMap = new Map<string, { customerName: string; invoiceCount: number; totalRevenue: number }>();

      for (const inv of filtered) {
        const revenue = (inv as any).grandTotalBase || (inv as any).grandTotalDoc || 0;
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

      // Sort by revenue and limit
      const customers = Array.from(customerMap.entries())
        .map(([customerId, data]) => ({
          customerId,
          customerName: data.customerName,
          invoiceCount: data.invoiceCount,
          totalRevenue: round2(data.totalRevenue),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);

      const summary: TopCustomersDTO = {
        customers,
        period: { from: fromDate, to: toDate },
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve top customers: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}