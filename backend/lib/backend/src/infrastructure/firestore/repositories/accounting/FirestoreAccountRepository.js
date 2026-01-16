"use strict";
/**
 * FirestoreAccountRepository
 *
 * Firestore implementation of IAccountRepository.
 * Implements: USED detection, system code generation, audit events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAccountRepository = void 0;
const Account_1 = require("../../../../domain/accounting/entities/Account");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const firestore_1 = require("firebase-admin/firestore");
class FirestoreAccountRepository {
    constructor(db) {
        this.collectionName = 'accounts';
        this.db = db;
    }
    toDomain(data) {
        return Account_1.Account.fromJSON(data);
    }
    toPersistence(entity) {
        return entity.toJSON();
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection(this.collectionName);
    }
    voucherLinesCol(companyId) {
        // VoucherLines are stored under vouchers in Firestore
        // We need to query all voucher lines across all vouchers
        return this.db.collectionGroup('lines');
    }
    countersDoc(companyId) {
        return this.db.collection('companies').doc(companyId).collection('counters').doc('accountSystemCode');
    }
    auditEventsCol(companyId, accountId) {
        return this.col(companyId).doc(accountId).collection('events');
    }
    // =========================================================================
    // QUERY METHODS
    // =========================================================================
    async getById(companyId, accountId, transaction) {
        try {
            let doc;
            if (transaction) {
                doc = await transaction.get(this.col(companyId).doc(accountId));
            }
            else {
                doc = await this.col(companyId).doc(accountId).get();
            }
            if (!doc.exists)
                return null;
            const account = this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id }));
            // Set runtime flags
            const hasChildren = await this.hasChildren(companyId, accountId);
            account.setHasChildren(hasChildren);
            return account;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting account by ID', error);
        }
    }
    async getByUserCode(companyId, userCode) {
        try {
            const normalized = (0, Account_1.normalizeUserCode)(userCode);
            const snap = await this.col(companyId).where('userCode', '==', normalized).limit(1).get();
            if (snap.empty) {
                // Fallback: check legacy 'code' field for migration
                const legacySnap = await this.col(companyId).where('code', '==', userCode).limit(1).get();
                if (legacySnap.empty)
                    return null;
                return this.toDomain(Object.assign(Object.assign({}, legacySnap.docs[0].data()), { id: legacySnap.docs[0].id }));
            }
            return this.toDomain(Object.assign(Object.assign({}, snap.docs[0].data()), { id: snap.docs[0].id }));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting account by user code', error);
        }
    }
    async getByCode(companyId, code) {
        return this.getByUserCode(companyId, code);
    }
    async list(companyId) {
        try {
            const snapshot = await this.col(companyId).get();
            const accounts = snapshot.docs.map(doc => this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
            // Build parent lookup for hasChildren
            const parentIds = new Set(accounts.map(a => a.parentId).filter(Boolean));
            accounts.forEach(a => a.setHasChildren(parentIds.has(a.id)));
            return accounts;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error listing accounts', error);
        }
    }
    async getAccounts(companyId) {
        return this.list(companyId);
    }
    // =========================================================================
    // MUTATION METHODS
    // =========================================================================
    async create(companyId, data) {
        var _a, _b, _c, _d;
        try {
            // Generate UUID if not provided
            const id = data.id || this.db.collection('tmp').doc().id;
            // Generate system code
            const systemCode = await this.generateNextSystemCode(companyId);
            // Normalize inputs
            const userCode = (0, Account_1.normalizeUserCode)(data.userCode || data.code || '');
            const classification = (0, Account_1.normalizeClassification)(data.classification || data.type || 'ASSET');
            const balanceNature = data.balanceNature || (0, Account_1.getDefaultBalanceNature)(classification);
            const now = new Date();
            const account = new Account_1.Account({
                id,
                systemCode,
                companyId,
                userCode,
                name: data.name,
                description: (_a = data.description) !== null && _a !== void 0 ? _a : null,
                accountRole: data.accountRole || 'POSTING',
                classification,
                balanceNature,
                balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
                parentId: (_b = data.parentId) !== null && _b !== void 0 ? _b : null,
                currencyPolicy: data.currencyPolicy || 'INHERIT',
                fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
                allowedCurrencyCodes: data.allowedCurrencyCodes || [],
                status: 'ACTIVE',
                isProtected: (_c = data.isProtected) !== null && _c !== void 0 ? _c : false,
                replacedByAccountId: null,
                createdAt: now,
                createdBy: data.createdBy,
                updatedAt: now,
                updatedBy: data.createdBy,
                requiresApproval: data.requiresApproval || false,
                requiresCustodyConfirmation: data.requiresCustodyConfirmation || false,
                custodianUserId: (_d = data.custodianUserId) !== null && _d !== void 0 ? _d : null
            });
            // Validate
            const errors = account.validate();
            if (errors.length > 0) {
                throw new Error(`Account validation failed: ${errors.join('; ')}`);
            }
            // Persist
            await this.col(companyId).doc(id).set(this.toPersistence(account));
            return account;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating account', error);
        }
    }
    async update(companyId, accountId, data) {
        try {
            const docRef = this.col(companyId).doc(accountId);
            const doc = await docRef.get();
            if (!doc.exists) {
                throw new Error('Account not found');
            }
            const existing = this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id }));
            const now = new Date();
            // Build update object
            const updateData = {
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedBy: data.updatedBy
            };
            // Simple mutable fields
            if (data.name !== undefined)
                updateData.name = data.name;
            if (data.description !== undefined)
                updateData.description = data.description;
            if (data.userCode !== undefined)
                updateData.userCode = (0, Account_1.normalizeUserCode)(data.userCode || data.code || '');
            if (data.status !== undefined)
                updateData.status = data.status;
            if (data.isActive !== undefined)
                updateData.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
            if (data.replacedByAccountId !== undefined) {
                updateData.replacedByAccountId = data.replacedByAccountId;
                // Auto-set inactive if replaced
                if (data.replacedByAccountId) {
                    updateData.status = 'INACTIVE';
                }
            }
            if (data.parentId !== undefined)
                updateData.parentId = data.parentId;
            if (data.isProtected !== undefined)
                updateData.isProtected = data.isProtected;
            // Conditionally mutable fields (may be blocked by use case if USED)
            if (data.accountRole !== undefined)
                updateData.accountRole = data.accountRole;
            if (data.classification !== undefined)
                updateData.classification = (0, Account_1.normalizeClassification)(data.classification || data.type || existing.classification);
            if (data.balanceNature !== undefined)
                updateData.balanceNature = data.balanceNature;
            if (data.balanceEnforcement !== undefined)
                updateData.balanceEnforcement = data.balanceEnforcement;
            if (data.currencyPolicy !== undefined)
                updateData.currencyPolicy = data.currencyPolicy;
            if (data.fixedCurrencyCode !== undefined)
                updateData.fixedCurrencyCode = data.fixedCurrencyCode || data.currency || null;
            if (data.allowedCurrencyCodes !== undefined)
                updateData.allowedCurrencyCodes = data.allowedCurrencyCodes;
            // Approval Policy
            if (data.requiresApproval !== undefined)
                updateData.requiresApproval = data.requiresApproval;
            if (data.requiresCustodyConfirmation !== undefined)
                updateData.requiresCustodyConfirmation = data.requiresCustodyConfirmation;
            if (data.custodianUserId !== undefined)
                updateData.custodianUserId = data.custodianUserId;
            await docRef.update(updateData);
            // Fetch updated document
            const updatedDoc = await docRef.get();
            return this.toDomain(Object.assign(Object.assign({}, updatedDoc.data()), { id: updatedDoc.id }));
        }
        catch (error) {
            console.error('Original update error:', error);
            throw new InfrastructureError_1.InfrastructureError('Error updating account', error);
        }
    }
    async delete(companyId, accountId) {
        try {
            await this.col(companyId).doc(accountId).delete();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deleting account', error);
        }
    }
    async deactivate(companyId, accountId) {
        try {
            await this.col(companyId).doc(accountId).update({
                status: 'INACTIVE',
                updatedAt: firestore_1.FieldValue.serverTimestamp()
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deactivating account', error);
        }
    }
    // =========================================================================
    // VALIDATION/CHECK METHODS
    // =========================================================================
    async isUsed(companyId, accountId) {
        try {
            // Check VoucherLines that reference this account
            // VoucherLines are stored in Firestore under: companies/{companyId}/vouchers/{voucherId}/lines/{lineId}
            // We use collectionGroup to query across all voucher's lines subcollections
            // First, try to query voucher_lines if using a flat structure
            const vouchersCol = this.db.collection('companies').doc(companyId).collection('vouchers');
            const vouchersSnap = await vouchersCol.limit(1).get();
            if (vouchersSnap.empty) {
                return false; // No vouchers, so definitely unused
            }
            // Check if any voucher line references this account
            // We need to query each voucher's lines subcollection
            const allVouchers = await vouchersCol.get();
            for (const voucherDoc of allVouchers.docs) {
                const linesSnap = await voucherDoc.ref.collection('lines').where('accountId', '==', accountId).limit(1).get();
                if (!linesSnap.empty) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.error('Error checking if account is used:', error);
            // On error, assume not used to allow operations to proceed
            return false;
        }
    }
    async hasChildren(companyId, accountId) {
        const count = await this.countChildren(companyId, accountId);
        return count > 0;
    }
    async countChildren(companyId, accountId) {
        try {
            const snapshot = await this.col(companyId).where('parentId', '==', accountId).count().get();
            return snapshot.data().count;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error counting account children', error);
        }
    }
    async existsByUserCode(companyId, userCode, excludeAccountId) {
        try {
            const normalized = (0, Account_1.normalizeUserCode)(userCode);
            const snap = await this.col(companyId).where('userCode', '==', normalized).get();
            if (snap.empty)
                return false;
            // If excluding an ID, check if any other account has this code
            if (excludeAccountId) {
                return snap.docs.some(doc => doc.id !== excludeAccountId);
            }
            return true;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error checking user code existence', error);
        }
    }
    async generateNextSystemCode(companyId) {
        try {
            const counterRef = this.countersDoc(companyId);
            // Use transaction to ensure atomic increment
            const newCode = await this.db.runTransaction(async (transaction) => {
                var _a;
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists) {
                    nextNumber = (((_a = counterDoc.data()) === null || _a === void 0 ? void 0 : _a.value) || 0) + 1;
                }
                transaction.set(counterRef, { value: nextNumber }, { merge: true });
                // Format: ACC-000001
                return `ACC-${String(nextNumber).padStart(6, '0')}`;
            });
            return newCode;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error generating system code', error);
        }
    }
    async countByCurrency(companyId, currencyCode) {
        try {
            const snapshot = await this.col(companyId)
                .where('fixedCurrencyCode', '==', currencyCode.toUpperCase())
                .count()
                .get();
            return snapshot.data().count;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error counting accounts by currency', error);
        }
    }
    // =========================================================================
    // AUDIT METHODS
    // =========================================================================
    async recordAuditEvent(companyId, accountId, event) {
        try {
            const eventId = this.db.collection('tmp').doc().id;
            await this.auditEventsCol(companyId, accountId).doc(eventId).set(Object.assign(Object.assign({}, event), { changedAt: firestore_1.Timestamp.fromDate(event.changedAt) }));
        }
        catch (error) {
            // Audit failures should not block operations
            console.error('Error recording audit event:', error);
        }
    }
}
exports.FirestoreAccountRepository = FirestoreAccountRepository;
//# sourceMappingURL=FirestoreAccountRepository.js.map