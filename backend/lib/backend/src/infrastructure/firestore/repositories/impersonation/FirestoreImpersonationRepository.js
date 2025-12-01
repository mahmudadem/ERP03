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
exports.FirestoreImpersonationRepository = void 0;
const ImpersonationSession_1 = require("../../../../domain/impersonation/ImpersonationSession");
const ImpersonationMapper_1 = require("../../mappers/ImpersonationMapper");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const admin = __importStar(require("firebase-admin"));
class FirestoreImpersonationRepository {
    constructor(db) {
        this.collectionName = 'impersonation_sessions';
        this.db = db;
    }
    async startSession(superAdminId, companyId) {
        try {
            const sessionId = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const session = new ImpersonationSession_1.ImpersonationSession(sessionId, superAdminId, companyId, true, new Date());
            const data = ImpersonationMapper_1.ImpersonationMapper.toPersistence(session);
            await this.db.collection(this.collectionName).doc(sessionId).set(data);
            return session;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error starting impersonation session', error);
        }
    }
    async getSession(sessionId) {
        try {
            const doc = await this.db.collection(this.collectionName).doc(sessionId).get();
            if (!doc.exists)
                return null;
            const data = doc.data();
            return ImpersonationMapper_1.ImpersonationMapper.toDomain(Object.assign(Object.assign({}, data), { id: doc.id }));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting impersonation session', error);
        }
    }
    async endSession(sessionId) {
        try {
            await this.db.collection(this.collectionName).doc(sessionId).update({
                active: false,
                endedAt: admin.firestore.Timestamp.now()
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error ending impersonation session', error);
        }
    }
    async getActiveSessionBySuperAdmin(superAdminId) {
        try {
            const snapshot = await this.db
                .collection(this.collectionName)
                .where('superAdminId', '==', superAdminId)
                .where('active', '==', true)
                .limit(1)
                .get();
            if (snapshot.empty)
                return null;
            const doc = snapshot.docs[0];
            const data = doc.data();
            return ImpersonationMapper_1.ImpersonationMapper.toDomain(Object.assign(Object.assign({}, data), { id: doc.id }));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting active impersonation session', error);
        }
    }
}
exports.FirestoreImpersonationRepository = FirestoreImpersonationRepository;
//# sourceMappingURL=FirestoreImpersonationRepository.js.map