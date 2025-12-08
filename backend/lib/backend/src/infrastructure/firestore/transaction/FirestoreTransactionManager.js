"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreTransactionManager = void 0;
class FirestoreTransactionManager {
    constructor(db) {
        this.db = db;
    }
    async runTransaction(operation) {
        return this.db.runTransaction(operation);
    }
}
exports.FirestoreTransactionManager = FirestoreTransactionManager;
//# sourceMappingURL=FirestoreTransactionManager.js.map