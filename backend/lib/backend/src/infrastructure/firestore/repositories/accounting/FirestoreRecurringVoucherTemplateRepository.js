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
exports.FirestoreRecurringVoucherTemplateRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const RecurringVoucherTemplate_1 = require("../../../../domain/accounting/entities/RecurringVoucherTemplate");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const toTimestamp = (d) => admin.firestore.Timestamp.fromDate(d);
class FirestoreRecurringVoucherTemplateRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('recurringTemplates');
    }
    async create(template) {
        try {
            await this.col(template.companyId).doc(template.id).set(this.toPersistence(template));
            return template;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create recurring template', error);
        }
    }
    async update(template) {
        try {
            await this.col(template.companyId).doc(template.id).set(this.toPersistence(template), { merge: true });
            return template;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update recurring template', error);
        }
    }
    async list(companyId) {
        try {
            const snap = await this.col(companyId).orderBy('createdAt', 'desc').get();
            return snap.docs.map((d) => this.toDomain(d.id, d.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list recurring templates', error);
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
            throw new InfrastructureError_1.InfrastructureError('Failed to find recurring template', error);
        }
    }
    async listDue(companyId, asOfDate) {
        try {
            const snap = await this.col(companyId)
                .where('status', '==', 'ACTIVE')
                .where('nextGenerationDate', '<=', asOfDate)
                .get();
            return snap.docs.map((d) => this.toDomain(d.id, d.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list due recurring templates', error);
        }
    }
    toPersistence(t) {
        return {
            companyId: t.companyId,
            name: t.name,
            sourceVoucherId: t.sourceVoucherId,
            frequency: t.frequency,
            dayOfMonth: t.dayOfMonth,
            startDate: t.startDate,
            endDate: t.endDate || null,
            maxOccurrences: t.maxOccurrences || null,
            occurrencesGenerated: t.occurrencesGenerated,
            nextGenerationDate: t.nextGenerationDate,
            status: t.status,
            createdBy: t.createdBy,
            createdAt: toTimestamp(t.createdAt),
            updatedAt: t.updatedAt ? toTimestamp(t.updatedAt) : null,
            updatedBy: t.updatedBy || null
        };
    }
    toDomain(id, data) {
        var _a, _b, _c, _d;
        return new RecurringVoucherTemplate_1.RecurringVoucherTemplate(id, data.companyId, data.name, data.sourceVoucherId, data.frequency, data.dayOfMonth, data.startDate, data.endDate || undefined, data.maxOccurrences || undefined, data.occurrencesGenerated || 0, data.nextGenerationDate, data.status, data.createdBy || '', ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), ((_d = (_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || undefined, data.updatedBy || undefined);
    }
}
exports.FirestoreRecurringVoucherTemplateRepository = FirestoreRecurringVoucherTemplateRepository;
//# sourceMappingURL=FirestoreRecurringVoucherTemplateRepository.js.map