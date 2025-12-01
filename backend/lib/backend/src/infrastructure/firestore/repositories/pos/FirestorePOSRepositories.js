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
exports.FirestorePosOrderRepository = exports.FirestorePosShiftRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const POSMappers_1 = require("../../mappers/POSMappers");
const admin = __importStar(require("firebase-admin"));
class FirestorePosShiftRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'pos_shifts';
        this.toDomain = POSMappers_1.POSShiftMapper.toDomain;
        this.toPersistence = POSMappers_1.POSShiftMapper.toPersistence;
    }
    async openShift(shift) { return this.save(shift); }
    async closeShift(id, closedAt, balance) {
        await this.db.collection(this.collectionName).doc(id).update({
            closedAt: admin.firestore.Timestamp.fromDate(closedAt),
            closingBalance: balance
        });
    }
    async getShift(id) { return this.findById(id); }
    async getCompanyShifts(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestorePosShiftRepository = FirestorePosShiftRepository;
class FirestorePosOrderRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'pos_orders';
        this.toDomain = POSMappers_1.POSOrderMapper.toDomain;
        this.toPersistence = POSMappers_1.POSOrderMapper.toPersistence;
    }
    async createOrder(order) { return this.save(order); }
    async getOrder(id) { return this.findById(id); }
    async getCompanyOrders(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestorePosOrderRepository = FirestorePosOrderRepository;
//# sourceMappingURL=FirestorePOSRepositories.js.map