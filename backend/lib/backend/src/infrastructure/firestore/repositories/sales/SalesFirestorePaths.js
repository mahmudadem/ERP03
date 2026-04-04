"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesCollection = exports.getSalesDataRef = exports.getSalesSettingsRef = exports.getSalesModuleRef = void 0;
const getSalesModuleRef = (db, companyId) => db.collection('companies').doc(companyId).collection('sales');
exports.getSalesModuleRef = getSalesModuleRef;
const getSalesSettingsRef = (db, companyId) => (0, exports.getSalesModuleRef)(db, companyId).doc('settings');
exports.getSalesSettingsRef = getSalesSettingsRef;
const getSalesDataRef = (db, companyId) => (0, exports.getSalesModuleRef)(db, companyId).doc('Data');
exports.getSalesDataRef = getSalesDataRef;
const getSalesCollection = (db, companyId, collectionName) => (0, exports.getSalesDataRef)(db, companyId).collection(collectionName);
exports.getSalesCollection = getSalesCollection;
//# sourceMappingURL=SalesFirestorePaths.js.map