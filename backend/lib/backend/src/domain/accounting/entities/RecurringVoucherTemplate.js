"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringVoucherTemplate = void 0;
class RecurringVoucherTemplate {
    constructor(id, companyId, name, sourceVoucherId, frequency, dayOfMonth, startDate, endDate, maxOccurrences, occurrencesGenerated, nextGenerationDate, status, createdBy, createdAt, updatedAt, updatedBy) {
        this.id = id;
        this.companyId = companyId;
        this.name = name;
        this.sourceVoucherId = sourceVoucherId;
        this.frequency = frequency;
        this.dayOfMonth = dayOfMonth;
        this.startDate = startDate;
        this.endDate = endDate;
        this.maxOccurrences = maxOccurrences;
        this.occurrencesGenerated = occurrencesGenerated;
        this.nextGenerationDate = nextGenerationDate;
        this.status = status;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
        if (dayOfMonth < 1 || dayOfMonth > 31) {
            throw new Error('dayOfMonth must be between 1 and 31');
        }
    }
    pause(by, at) {
        return new RecurringVoucherTemplate(this.id, this.companyId, this.name, this.sourceVoucherId, this.frequency, this.dayOfMonth, this.startDate, this.endDate, this.maxOccurrences, this.occurrencesGenerated, this.nextGenerationDate, 'PAUSED', this.createdBy, this.createdAt, at, by);
    }
    resume(by, at) {
        return new RecurringVoucherTemplate(this.id, this.companyId, this.name, this.sourceVoucherId, this.frequency, this.dayOfMonth, this.startDate, this.endDate, this.maxOccurrences, this.occurrencesGenerated, this.nextGenerationDate, 'ACTIVE', this.createdBy, this.createdAt, at, by);
    }
}
exports.RecurringVoucherTemplate = RecurringVoucherTemplate;
//# sourceMappingURL=RecurringVoucherTemplate.js.map