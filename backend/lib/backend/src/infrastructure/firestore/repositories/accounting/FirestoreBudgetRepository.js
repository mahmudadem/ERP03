"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreBudgetRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const Budget_1 = require("../../../../domain/accounting/entities/Budget");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const toTimestamp = (d) => admin.firestore.Timestamp.fromDate(d);
class FirestoreBudgetRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection('accounting')
            .doc('Data')
            .collection('budgets');
    }
    async create(budget) {
        try {
            await this.col(budget.companyId).doc(budget.id).set(this.toPersistence(budget));
            return budget;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create budget', error);
        }
    }
    async update(budget) {
        try {
            await this.col(budget.companyId).doc(budget.id).set(this.toPersistence(budget), { merge: true });
            return budget;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update budget', error);
        }
    }
    async setStatus(companyId, id, status) {
        try {
            await this.col(companyId).doc(id).set({ status }, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to set budget status', error);
        }
    }
    async findById(companyId, id) {
        try {
            const doc = await this.col(companyId).doc(id).get();
            if (!doc.exists)
                return null;
            return this.toDomain(doc.id, doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to load budget', error);
        }
    }
    async list(companyId, fiscalYearId) {
        try {
            let q = this.col(companyId);
            if (fiscalYearId)
                q = q.where('fiscalYearId', '==', fiscalYearId);
            const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
            return snap.docs.map((d) => this.toDomain(d.id, d.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list budgets', error);
        }
    }
    toPersistence(b) {
        return {
            companyId: b.companyId,
            fiscalYearId: b.fiscalYearId,
            name: b.name,
            version: b.version,
            status: b.status,
            lines: b.lines,
            createdAt: toTimestamp(b.createdAt),
            createdBy: b.createdBy,
            updatedAt: b.updatedAt ? toTimestamp(b.updatedAt) : null,
            updatedBy: b.updatedBy || null
        };
    }
    toDomain(id, data) {
        var _a, _b, _c, _d;
        return new Budget_1.Budget(id, data.companyId, data.fiscalYearId, data.name, data.version, data.status, data.lines || [], ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), data.createdBy || '', ((_d = (_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || undefined, data.updatedBy || undefined);
    }
}
exports.FirestoreBudgetRepository = FirestoreBudgetRepository;
//# sourceMappingURL=FirestoreBudgetRepository.js.map