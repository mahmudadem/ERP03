"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePaymentHistoryRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const PaymentHistory_1 = require("../../../../domain/shared/entities/PaymentHistory");
const SharedFirestorePaths_1 = require("./SharedFirestorePaths");
const toTimestamp = (value) => {
    if (!value)
        return null;
    return firestore_1.Timestamp.fromDate(value);
};
const toDate = (value) => {
    if (!value)
        return undefined;
    if (value instanceof Date)
        return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate();
    }
    return new Date(String(value));
};
class FirestorePaymentHistoryRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SharedFirestorePaths_1.getSharedCollection)(this.db, companyId, 'payment_history');
    }
    async create(payment, transaction) {
        const ref = this.collection(payment.companyId).doc(payment.id);
        const data = this.toPersistence(payment);
        if (transaction) {
            transaction.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async getById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return this.toDomain(doc.data());
    }
    async getBySource(companyId, sourceType, sourceId) {
        const snap = await this.collection(companyId)
            .where('sourceType', '==', sourceType)
            .where('sourceId', '==', sourceId)
            .orderBy('paymentDate', 'desc')
            .get();
        return snap.docs.map((doc) => this.toDomain(doc.data()));
    }
    toPersistence(payment) {
        var _a, _b, _c;
        return {
            id: payment.id,
            companyId: payment.companyId,
            sourceType: payment.sourceType,
            sourceId: payment.sourceId,
            sourceNumber: payment.sourceNumber,
            amountBase: payment.amountBase,
            currency: payment.currency,
            exchangeRate: payment.exchangeRate,
            amountDoc: payment.amountDoc,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            reference: (_a = payment.reference) !== null && _a !== void 0 ? _a : null,
            notes: (_b = payment.notes) !== null && _b !== void 0 ? _b : null,
            voucherId: (_c = payment.voucherId) !== null && _c !== void 0 ? _c : null,
            createdBy: payment.createdBy,
            createdAt: toTimestamp(payment.createdAt),
        };
    }
    toDomain(data) {
        return PaymentHistory_1.PaymentHistory.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt) }));
    }
}
exports.FirestorePaymentHistoryRepository = FirestorePaymentHistoryRepository;
//# sourceMappingURL=FirestorePaymentHistoryRepository.js.map