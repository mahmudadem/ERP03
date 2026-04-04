"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchasesCollection = exports.getPurchasesDataRef = exports.getPurchasesSettingsRef = exports.getPurchasesModuleRef = void 0;
const getPurchasesModuleRef = (db, companyId) => db.collection('companies').doc(companyId).collection('purchases');
exports.getPurchasesModuleRef = getPurchasesModuleRef;
const getPurchasesSettingsRef = (db, companyId) => (0, exports.getPurchasesModuleRef)(db, companyId).doc('settings');
exports.getPurchasesSettingsRef = getPurchasesSettingsRef;
const getPurchasesDataRef = (db, companyId) => (0, exports.getPurchasesModuleRef)(db, companyId).doc('Data');
exports.getPurchasesDataRef = getPurchasesDataRef;
const getPurchasesCollection = (db, companyId, collectionName) => (0, exports.getPurchasesDataRef)(db, companyId).collection(collectionName);
exports.getPurchasesCollection = getPurchasesCollection;
//# sourceMappingURL=PurchaseFirestorePaths.js.map