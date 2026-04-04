"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedCollection = exports.getSharedDataRef = exports.getSharedModuleRef = void 0;
const getSharedModuleRef = (db, companyId) => db.collection('companies').doc(companyId).collection('shared');
exports.getSharedModuleRef = getSharedModuleRef;
const getSharedDataRef = (db, companyId) => (0, exports.getSharedModuleRef)(db, companyId).doc('Data');
exports.getSharedDataRef = getSharedDataRef;
const getSharedCollection = (db, companyId, collectionName) => (0, exports.getSharedDataRef)(db, companyId).collection(collectionName);
exports.getSharedCollection = getSharedCollection;
//# sourceMappingURL=SharedFirestorePaths.js.map