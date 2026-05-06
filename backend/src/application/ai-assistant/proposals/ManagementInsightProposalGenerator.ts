/**
 * ManagementInsightProposalGenerator
 *
 * Generates management insight proposals from financial data.
 * This is a report/analysis proposal, not a transaction proposal.
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
} from './AiProposalGenerator';

export class ManagementInsightProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'reports.managementInsightProposal' as const;
  readonly moduleId = 'reports';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const toolData = input.toolResultData || {};
    const warnings: string[] = [];

    // Extract insights from tool result data
    const insights = this.generateInsights(toolData);

    warnings.push('This is an AI-generated insight. Verify with actual reports before making decisions.');

    return {
      type: this.proposalType,
      title: insights.length > 0
        ? `Management Insight — ${insights.length} finding(s)`
        : 'Management Insight Proposal',
      summary: insights.length > 0
        ? `Analysis reveals ${insights.length} key finding(s) from available financial data.`
        : 'Insight proposal based on available data.',
      rationale: 'This proposal highlights patterns, anomalies, or opportunities identified from your financial data. It is advisory-only and should be verified against detailed reports.',
      inputContextSummary: input.userMessage.substring(0, 200),
      proposedData: {
        insights,
        generatedAt: new Date().toISOString(),
        note: 'This is an AI-generated insight proposal. No business action has been taken.',
      },
      warnings,
      riskLevel: 'low',
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo: [],
      confidence: 0.5,
    };
  }

  private generateInsights(toolData: Record<string, unknown>): Array<{ category: string; finding: string; severity: string }> {
    const insights: Array<{ category: string; finding: string; severity: string }> = [];

    // Check for common financial patterns in tool data
    const data = toolData as any;

    if (data.totalRevenue !== undefined && data.totalExpenses !== undefined) {
      const margin = data.totalRevenue - data.totalExpenses;
      if (margin < 0) {
        insights.push({
          category: 'profitability',
          finding: `Net loss detected: Revenue ${data.totalRevenue} vs Expenses ${data.totalExpenses}`,
          severity: 'high',
        });
      } else if (data.totalRevenue > 0) {
        const marginPct = (margin / data.totalRevenue * 100).toFixed(1);
        insights.push({
          category: 'profitability',
          finding: `Profit margin: ${marginPct}% (Revenue ${data.totalRevenue})`,
          severity: 'info',
        });
      }
    }

    if (data.agingReceivables) {
      const aging = data.agingReceivables as any;
      if (aging.over90Days > 0) {
        insights.push({
          category: 'receivables',
          finding: `${aging.over90Days} in receivables overdue by 90+ days — collection attention needed`,
          severity: 'high',
        });
      }
    }

    if (data.agingPayables) {
      const aging = data.agingPayables as any;
      if (aging.over90Days > 0) {
        insights.push({
          category: 'payables',
          finding: `${aging.over90Days} in payables overdue by 90+ days — payment urgency`,
          severity: 'high',
        });
      }
    }

    if (data.cashBalance !== undefined) {
      if (data.cashBalance < 0) {
        insights.push({
          category: 'cash_flow',
          finding: `Negative cash balance: ${data.cashBalance}. Immediate attention required.`,
          severity: 'critical',
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        category: 'general',
        finding: 'No critical issues detected in available data. Regular monitoring recommended.',
        severity: 'info',
      });
    }

    return insights;
  }
}
