"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateRecurringVouchersUseCase = exports.ResumeRecurringTemplateUseCase = exports.PauseRecurringTemplateUseCase = exports.UpdateRecurringTemplateUseCase = exports.CreateRecurringTemplateUseCase = void 0;
const uuid_1 = require("uuid");
const RecurringVoucherTemplate_1 = require("../../../domain/accounting/entities/RecurringVoucherTemplate");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
class CreateRecurringTemplateUseCase {
    constructor(templateRepo, voucherRepo, permissionChecker) {
        this.templateRepo = templateRepo;
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, input) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        const source = await this.voucherRepo.findById(companyId, input.sourceVoucherId);
        if (!source)
            throw new Error('Source voucher not found');
        const nextDate = input.startDate;
        const template = new RecurringVoucherTemplate_1.RecurringVoucherTemplate((0, uuid_1.v4)(), companyId, input.name, input.sourceVoucherId, input.frequency, input.dayOfMonth, input.startDate, input.endDate, input.maxOccurrences, 0, nextDate, 'ACTIVE', userId, new Date());
        return this.templateRepo.create(template);
    }
}
exports.CreateRecurringTemplateUseCase = CreateRecurringTemplateUseCase;
class UpdateRecurringTemplateUseCase {
    constructor(templateRepo, permissionChecker) {
        this.templateRepo = templateRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, id, partial) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        const existing = await this.templateRepo.findById(companyId, id);
        if (!existing)
            throw new Error('Template not found');
        const updated = new RecurringVoucherTemplate_1.RecurringVoucherTemplate(existing.id, existing.companyId, partial.name || existing.name, partial.sourceVoucherId || existing.sourceVoucherId, partial.frequency || existing.frequency, partial.dayOfMonth || existing.dayOfMonth, partial.startDate || existing.startDate, partial.endDate !== undefined ? partial.endDate : existing.endDate, partial.maxOccurrences !== undefined ? partial.maxOccurrences : existing.maxOccurrences, existing.occurrencesGenerated, partial.startDate ? partial.startDate : existing.nextGenerationDate, existing.status, existing.createdBy, existing.createdAt, new Date(), userId);
        return this.templateRepo.update(updated);
    }
}
exports.UpdateRecurringTemplateUseCase = UpdateRecurringTemplateUseCase;
class PauseRecurringTemplateUseCase {
    constructor(templateRepo, permissionChecker) {
        this.templateRepo = templateRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, id) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        const tmpl = await this.templateRepo.findById(companyId, id);
        if (!tmpl)
            throw new Error('Template not found');
        const paused = tmpl.pause(userId, new Date());
        return this.templateRepo.update(paused);
    }
}
exports.PauseRecurringTemplateUseCase = PauseRecurringTemplateUseCase;
class ResumeRecurringTemplateUseCase {
    constructor(templateRepo, permissionChecker) {
        this.templateRepo = templateRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, id) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        const tmpl = await this.templateRepo.findById(companyId, id);
        if (!tmpl)
            throw new Error('Template not found');
        const resumed = tmpl.resume(userId, new Date());
        return this.templateRepo.update(resumed);
    }
}
exports.ResumeRecurringTemplateUseCase = ResumeRecurringTemplateUseCase;
class GenerateRecurringVouchersUseCase {
    constructor(templateRepo, voucherRepo, permissionChecker) {
        this.templateRepo = templateRepo;
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, asOfDate) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        const templates = await this.templateRepo.listDue(companyId, asOfDate);
        const created = [];
        for (const tmpl of templates) {
            const src = await this.voucherRepo.findById(companyId, tmpl.sourceVoucherId);
            if (!src)
                continue;
            // clone voucher as draft with new date
            const newDate = tmpl.nextGenerationDate;
            const copy = new VoucherEntity_1.VoucherEntity((0, uuid_1.v4)(), companyId, '', // voucher number will be generated by create flow; leave empty
            src.type, newDate, `[Recurring] ${src.description || ''}`, src.currency, src.baseCurrency, src.exchangeRate, src.lines, src.totalDebit, src.totalCredit, src.status, Object.assign(Object.assign({}, src.metadata), { recurringTemplateId: tmpl.id }), userId, new Date());
            await this.voucherRepo.save(copy);
            created.push(copy);
            // advance template
            const nextDate = this.computeNextDate(tmpl.frequency, tmpl.dayOfMonth, tmpl.nextGenerationDate);
            const occurrences = tmpl.occurrencesGenerated + 1;
            const completed = (tmpl.maxOccurrences && occurrences >= tmpl.maxOccurrences) ||
                (tmpl.endDate && nextDate > tmpl.endDate);
            const updated = new RecurringVoucherTemplate_1.RecurringVoucherTemplate(tmpl.id, tmpl.companyId, tmpl.name, tmpl.sourceVoucherId, tmpl.frequency, tmpl.dayOfMonth, tmpl.startDate, tmpl.endDate, tmpl.maxOccurrences, occurrences, completed ? tmpl.nextGenerationDate : nextDate, completed ? 'COMPLETED' : tmpl.status, tmpl.createdBy, tmpl.createdAt, new Date(), userId);
            await this.templateRepo.update(updated);
        }
        return created;
    }
    computeNextDate(freq, day, currentDate) {
        const d = new Date(currentDate);
        const addMonths = freq === 'MONTHLY' ? 1 : freq === 'QUARTERLY' ? 3 : 12;
        d.setMonth(d.getMonth() + addMonths);
        // set to desired day, clamp to month length
        const target = new Date(d.getFullYear(), d.getMonth(), Math.min(day, 28));
        return target.toISOString().slice(0, 10);
    }
}
exports.GenerateRecurringVouchersUseCase = GenerateRecurringVouchersUseCase;
//# sourceMappingURL=RecurringVoucherUseCases.js.map