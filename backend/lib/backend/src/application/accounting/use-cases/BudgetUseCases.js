"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetBudgetVsActualUseCase = exports.ApproveBudgetUseCase = exports.UpdateBudgetUseCase = exports.CreateBudgetUseCase = void 0;
const uuid_1 = require("uuid");
const Budget_1 = require("../../../domain/accounting/entities/Budget");
class CreateBudgetUseCase {
    constructor(repo, fiscalYears, permissionChecker) {
        this.repo = repo;
        this.fiscalYears = fiscalYears;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, input) {
        var _a;
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const fy = await this.fiscalYears.findById(companyId, input.fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const now = new Date();
        const budget = new Budget_1.Budget((0, uuid_1.v4)(), companyId, input.fiscalYearId, input.name, (_a = input.version) !== null && _a !== void 0 ? _a : 1, 'DRAFT', input.lines, now, userId, now, userId);
        return this.repo.create(budget);
    }
}
exports.CreateBudgetUseCase = CreateBudgetUseCase;
class UpdateBudgetUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, budgetId, payload) {
        var _a;
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const existing = await this.repo.findById(companyId, budgetId);
        if (!existing)
            throw new Error('Budget not found');
        if (existing.status !== 'DRAFT')
            throw new Error('Only DRAFT budgets can be updated');
        const lines = payload.lines || existing.lines;
        const budget = new Budget_1.Budget(existing.id, companyId, payload.fiscalYearId || existing.fiscalYearId, payload.name || existing.name, (_a = payload.version) !== null && _a !== void 0 ? _a : existing.version, existing.status, lines, existing.createdAt, existing.createdBy, new Date(), userId);
        return this.repo.update(budget);
    }
}
exports.UpdateBudgetUseCase = UpdateBudgetUseCase;
class ApproveBudgetUseCase {
    constructor(repo, permissionChecker) {
        this.repo = repo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, budgetId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
        const budget = await this.repo.findById(companyId, budgetId);
        if (!budget)
            throw new Error('Budget not found');
        await this.repo.setStatus(companyId, budgetId, 'APPROVED');
    }
}
exports.ApproveBudgetUseCase = ApproveBudgetUseCase;
class GetBudgetVsActualUseCase {
    constructor(budgets, fiscalYears, ledger, permissionChecker) {
        this.budgets = budgets;
        this.fiscalYears = fiscalYears;
        this.ledger = ledger;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, budgetId, costCenterId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const budget = await this.budgets.findById(companyId, budgetId);
        if (!budget)
            throw new Error('Budget not found');
        const fy = await this.fiscalYears.findById(companyId, budget.fiscalYearId);
        if (!fy)
            throw new Error('Fiscal year not found');
        const start = fy.startDate;
        const end = fy.endDate;
        // Get actual ledger entries for range
        const ledgerEntries = await this.ledger.getGeneralLedger(companyId, { fromDate: start, toDate: end });
        const actualMap = new Map();
        ledgerEntries.forEach((e) => {
            if (costCenterId && e.costCenterId !== costCenterId)
                return;
            const key = `${e.accountId}${e.costCenterId || ''}`;
            const signed = (e.side || 'Debit') === 'Debit' ? e.amount : -e.amount;
            actualMap.set(key, (actualMap.get(key) || 0) + signed);
        });
        return budget.lines
            .filter((l) => !costCenterId || l.costCenterId === costCenterId)
            .map((line) => {
            const key = `${line.accountId}${line.costCenterId || ''}`;
            const actual = actualMap.get(key) || 0;
            const variance = actual - line.annualTotal;
            const variancePct = line.annualTotal === 0 ? 0 : (variance / line.annualTotal) * 100;
            return {
                accountId: line.accountId,
                costCenterId: line.costCenterId,
                budget: line.annualTotal,
                actual,
                variance,
                variancePct
            };
        });
    }
}
exports.GetBudgetVsActualUseCase = GetBudgetVsActualUseCase;
//# sourceMappingURL=BudgetUseCases.js.map