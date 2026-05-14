/**
 * GetPurchaseSummaryTool - AI Tool for read-only Purchase summaries
 *
 * Returns a sanitized summary of purchase invoices for the user's company.
 * READ-ONLY — cannot create, modify, or post anything.
 *
 * Company isolation is enforced through companyId scoping.
 * Permission-gated via purchases.invoices.view (or wildcard *).
 */

import { AiTool, AiToolResult, ToolExecutionContext } from '../../../domain/ai-assistant/tools/AiTool';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Sanitized summary DTO returned to the AI.
 */
interface PurchaseSummaryDTO {
  period: { from: string; to: string };
  totalSpend: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  byStatus: Record<string, number>;
  totalSuppliers: number;
  totalCount: number;
  displayedCount: number;
  truncated: boolean;
  truncationNote?: string;
  topSuppliers: Array<{
    vendorId: string;
    vendorName: string;
    invoiceCount: number;
    totalSpend: number;
  }>;
}

export class GetPurchaseSummaryTool implements AiTool {
  readonly name = 'purchase.getPurchaseSummary';
  readonly description = 'Get a purchase summary for the company. Returns total spend, invoice count, average invoice value, breakdown by status, and top suppliers. Optionally accepts fromDate and toDate. Read-only — cannot create, modify, or post anything.';
  readonly requiredPermission = 'purchases.invoices.view';
  readonly module = 'purchase';

  private purchaseInvoiceRepo: IPurchaseInvoiceRepository;
  private partyRepo: IPartyRepository;
  private permissionChecker: PermissionChecker;

  constructor(
    purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    partyRepo: IPartyRepository,
    permissionChecker: PermissionChecker,
  ) {
    this.purchaseInvoiceRepo = purchaseInvoiceRepo;
    this.partyRepo = partyRepo;
    this.permissionChecker = permissionChecker;
  }

  async execute(context: ToolExecutionContext, params?: Record<string, unknown>): Promise<AiToolResult> {
    try {
      await this.permissionChecker.assertOrThrow(context.userId, context.companyId, this.requiredPermission);

      const now = new Date();
      const fromDate = (params?.fromDate as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const toDate = (params?.toDate as string) || now.toISOString().split('T')[0];

      const invoices = await this.purchaseInvoiceRepo.list(context.companyId);

      // Filter by date range
      const filtered = invoices.filter((inv: any) => {
        const date = inv.invoiceDate || (inv as any).date;
        if (!date) return true;
        const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
        return dateStr >= fromDate && dateStr <= toDate;
      });

      // Aggregate metrics
      let totalSpend = 0;
      const byStatus: Record<string, number> = { DRAFT: 0, POSTED: 0, CANCELLED: 0 };
      const vendorMap = new Map<string, { vendorName: string; invoiceCount: number; totalSpend: number }>();

      for (const inv of filtered) {
        const spend = (inv as any).grandTotalBase || (inv as any).grandTotalDoc || 0;
        totalSpend += Number(spend) || 0;

        const status = String((inv as any).status || 'DRAFT').toUpperCase();
        if (status in byStatus) {
          byStatus[status]++;
        }

        const vendorId = (inv as any).vendorId || '';
        if (vendorId) {
          const existing = vendorMap.get(vendorId) || { vendorName: (inv as any).vendorName || 'Unknown', invoiceCount: 0, totalSpend: 0 };
          existing.invoiceCount++;
          existing.totalSpend += Number(spend) || 0;
          vendorMap.set(vendorId, existing);
        }
      }

      // Enrich vendor names from party repository
      try {
        const parties = await this.partyRepo.list(context.companyId, { role: 'VENDOR' });
        const partyMap = new Map(parties.map((p: any) => [p.id, p]));
        for (const [vendorId, data] of vendorMap.entries()) {
          const party = partyMap.get(vendorId);
          if (party) {
            data.vendorName = party.displayName || party.legalName || data.vendorName;
          }
        }
      } catch {
        // Vendor names from invoices are acceptable fallback
      }

      // Top 10 suppliers by spend
      const allSuppliers = Array.from(vendorMap.entries())
        .map(([vendorId, data]) => ({
          vendorId,
          vendorName: data.vendorName,
          invoiceCount: data.invoiceCount,
          totalSpend: round2(data.totalSpend),
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend);
      const totalSuppliers = allSuppliers.length;
      const topSuppliers = allSuppliers.slice(0, 10);
      const truncated = totalSuppliers > 10;

      const invoiceCount = filtered.length;
      const averageInvoiceValue = invoiceCount > 0 ? round2(totalSpend / invoiceCount) : 0;

      const summary: PurchaseSummaryDTO = {
        period: { from: fromDate, to: toDate },
        totalSpend: round2(totalSpend),
        invoiceCount,
        averageInvoiceValue,
        byStatus,
        totalSuppliers,
        totalCount: totalSuppliers,
        displayedCount: topSuppliers.length,
        truncated,
        truncationNote: truncated
          ? `Showing top 10 of ${totalSuppliers} suppliers by spend. Navigate to the Purchases report for the complete list.`
          : undefined,
        topSuppliers,
      };

      return {
        success: true,
        data: summary as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to retrieve purchase summary: ${(error as Error).message}`,
        errorCode: 'TOOL_EXECUTION_ERROR',
      };
    }
  }
}