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
exports.FirestoreCompanyGroupRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const CompanyGroup_1 = require("../../../../domain/accounting/entities/CompanyGroup");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const toTimestamp = (d) => admin.firestore.Timestamp.fromDate(d);
class FirestoreCompanyGroupRepository {
    constructor(db) {
        this.db = db;
    }
    col() {
        return this.db.collection('companyGroups');
    }
    async create(group) {
        try {
            await this.col().doc(group.id).set(this.toPersistence(group));
            return group;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to create company group', error);
        }
    }
    async update(group) {
        try {
            await this.col().doc(group.id).set(this.toPersistence(group), { merge: true });
            return group;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to update company group', error);
        }
    }
    async list(companyId) {
        try {
            const snap = await this.col().where('memberIds', 'array-contains', companyId).get();
            return snap.docs.map((d) => this.toDomain(d.id, d.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to list company groups', error);
        }
    }
    async findById(id) {
        try {
            const doc = await this.col().doc(id).get();
            if (!doc.exists)
                return null;
            return this.toDomain(doc.id, doc.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to find company group', error);
        }
    }
    toPersistence(g) {
        return {
            name: g.name,
            reportingCurrency: g.reportingCurrency,
            members: g.members,
            memberIds: g.members.map((m) => m.companyId),
            createdAt: toTimestamp(g.createdAt),
            createdBy: g.createdBy
        };
    }
    toDomain(id, data) {
        var _a, _b;
        return new CompanyGroup_1.CompanyGroup(id, data.name, data.reportingCurrency, data.members || [], ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(), data.createdBy || '');
    }
}
exports.FirestoreCompanyGroupRepository = FirestoreCompanyGroupRepository;
//# sourceMappingURL=FirestoreCompanyGroupRepository.js.map