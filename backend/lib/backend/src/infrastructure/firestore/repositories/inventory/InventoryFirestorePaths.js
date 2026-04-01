"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryCollection = exports.getInventoryDataRef = exports.getInventorySettingsRef = exports.getInventoryModuleRef = void 0;
const getInventoryModuleRef = (db, companyId) => db.collection('companies').doc(companyId).collection('inventory');
exports.getInventoryModuleRef = getInventoryModuleRef;
const getInventorySettingsRef = (db, companyId) => (0, exports.getInventoryModuleRef)(db, companyId).doc('Settings');
exports.getInventorySettingsRef = getInventorySettingsRef;
const getInventoryDataRef = (db, companyId) => (0, exports.getInventoryModuleRef)(db, companyId).doc('Data');
exports.getInventoryDataRef = getInventoryDataRef;
const getInventoryCollection = (db, companyId, collectionName) => (0, exports.getInventoryDataRef)(db, companyId).collection(collectionName);
exports.getInventoryCollection = getInventoryCollection;
//# sourceMappingURL=InventoryFirestorePaths.js.map