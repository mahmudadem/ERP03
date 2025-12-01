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
exports.authMiddleware = void 0;
const admin = __importStar(require("firebase-admin"));
const ApiError_1 = require("../errors/ApiError");
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(ApiError_1.ApiError.unauthorized('Missing or invalid Authorization header'));
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        const userEntity = await bindRepositories_1.diContainer.userRepository.getUserById(uid);
        const activeCompanyId = await bindRepositories_1.diContainer.userRepository.getUserActiveCompany(uid);
        let roleId = null;
        let permissions = [];
        let isOwner = false;
        if (activeCompanyId) {
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(uid, activeCompanyId);
            if (membership) {
                roleId = membership.roleId;
                isOwner = !!membership.isOwner;
                // Permissions lookup not fully implemented; placeholder empty array
                permissions = [];
            }
        }
        req.user = {
            uid,
            email: decodedToken.email,
            companyId: activeCompanyId || null,
            roleId,
            permissions,
            isOwner,
            isSuperAdmin: (userEntity === null || userEntity === void 0 ? void 0 : userEntity.isAdmin()) || false,
        };
        next();
    }
    catch (error) {
        return next(ApiError_1.ApiError.unauthorized('Invalid authentication token'));
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=authMiddleware.js.map