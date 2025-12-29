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
exports.FirestoreAccountLookupService = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * FirestoreAccountLookupService
 *
 * Efficient bulk account loading from Firestore.
 * Uses batched reads to avoid N+1 queries.
 */
class FirestoreAccountLookupService {
    constructor(db) {
        this.db = db;
    }
    async getAccountsByIds(companyId, accountIds) {
        const accountMap = new Map();
        if (accountIds.length === 0) {
            return accountMap;
        }
        try {
            // Firestore 'in' query limited to 10 items, batch if needed
            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < accountIds.length; i += batchSize) {
                batches.push(accountIds.slice(i, i + batchSize));
            }
            const accountsRef = this.db
                .collection('companies')
                .doc(companyId)
                .collection('accounts');
            // Execute all batches in parallel
            const allSnapshots = await Promise.all(batches.map(batch => accountsRef.where(admin.firestore.FieldPath.documentId(), 'in', batch).get()));
            // Merge results
            for (const snapshot of allSnapshots) {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    accountMap.set(doc.id, {
                        id: doc.id,
                        code: data.code || doc.id,
                        name: data.name || 'Unknown',
                        type: data.type || 'other',
                        ownerUnitIds: data.ownerUnitIds,
                        ownerScope: data.ownerScope
                    });
                });
            }
            return accountMap;
        }
        catch (error) {
            console.error(`Failed to load accounts for company ${companyId}:`, error);
            // Return empty map on error (policy will fail safely)
            return accountMap;
        }
    }
}
exports.FirestoreAccountLookupService = FirestoreAccountLookupService;
//# sourceMappingURL=FirestoreAccountLookupService.js.map