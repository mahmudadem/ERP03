import { IAiUsageLogRepository } from '../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';

export interface GetUsageAnalyticsInput {
  companyId: string;
  limit?: number;
}

export interface UsageAnalyticsLogDTO {
  id: string;
  userId: string;
  providerType: string;
  model: string;
  status: 'success' | 'failure';
  totalTokens: number;
  latencyMs: number;
  errorCode?: string;
  createdAt: string;
}

export interface UsageAnalyticsOutput {
  summary: {
    todayRequests: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    totalTokens: number;
    providerBreakdown: Array<{ providerType: string; count: number }>;
  };
  recentLogs: UsageAnalyticsLogDTO[];
}

export class GetUsageAnalyticsUseCase {
  constructor(private usageLogRepository: IAiUsageLogRepository) {}

  async execute(input: GetUsageAnalyticsInput): Promise<UsageAnalyticsOutput> {
    const limit = Math.min(Math.max(input.limit || 50, 1), 200);

    const [todayRequests, logs] = await Promise.all([
      this.usageLogRepository.countTodayByCompany(input.companyId),
      this.usageLogRepository.getByCompany(input.companyId, limit, 0),
    ]);

    const successCount = logs.filter(l => l.status === 'success').length;
    const failureCount = logs.filter(l => l.status === 'failure').length;
    const totalTokens = logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);

    const latencyValues = logs
      .map(l => l.latencyMs)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

    const avgLatencyMs = latencyValues.length > 0
      ? Math.round(latencyValues.reduce((sum, v) => sum + v, 0) / latencyValues.length)
      : 0;

    const providerCounts = new Map<string, number>();
    for (const log of logs) {
      providerCounts.set(log.providerType, (providerCounts.get(log.providerType) || 0) + 1);
    }

    const providerBreakdown = Array.from(providerCounts.entries())
      .map(([providerType, count]) => ({ providerType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        todayRequests,
        successCount,
        failureCount,
        avgLatencyMs,
        totalTokens,
        providerBreakdown,
      },
      recentLogs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        providerType: log.providerType,
        model: log.model,
        status: log.status,
        totalTokens: log.totalTokens || 0,
        latencyMs: log.latencyMs || 0,
        errorCode: log.errorCode,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}
