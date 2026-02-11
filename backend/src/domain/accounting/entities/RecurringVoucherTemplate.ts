export type RecurrenceFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type RecurringStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export class RecurringVoucherTemplate {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly name: string,
    public readonly sourceVoucherId: string,
    public readonly frequency: RecurrenceFrequency,
    public readonly dayOfMonth: number,
    public readonly startDate: string,
    public readonly endDate: string | undefined,
    public readonly maxOccurrences: number | undefined,
    public readonly occurrencesGenerated: number,
    public readonly nextGenerationDate: string,
    public readonly status: RecurringStatus,
    public readonly createdBy: string,
    public readonly createdAt: Date,
    public readonly updatedAt?: Date,
    public readonly updatedBy?: string
  ) {
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error('dayOfMonth must be between 1 and 31');
    }
  }

  pause(by: string, at: Date) {
    return new RecurringVoucherTemplate(
      this.id,
      this.companyId,
      this.name,
      this.sourceVoucherId,
      this.frequency,
      this.dayOfMonth,
      this.startDate,
      this.endDate,
      this.maxOccurrences,
      this.occurrencesGenerated,
      this.nextGenerationDate,
      'PAUSED',
      this.createdBy,
      this.createdAt,
      at,
      by
    );
  }

  resume(by: string, at: Date) {
    return new RecurringVoucherTemplate(
      this.id,
      this.companyId,
      this.name,
      this.sourceVoucherId,
      this.frequency,
      this.dayOfMonth,
      this.startDate,
      this.endDate,
      this.maxOccurrences,
      this.occurrencesGenerated,
      this.nextGenerationDate,
      'ACTIVE',
      this.createdBy,
      this.createdAt,
      at,
      by
    );
  }
}
