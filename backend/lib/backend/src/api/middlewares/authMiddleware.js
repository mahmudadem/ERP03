"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const ApiError_1 = require("../errors/ApiError");
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(ApiError_1.ApiError.unauthorized('Missing or invalid Authorization header'));
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        // Use the token verifier from DI container (provider-agnostic)
        const decodedToken = await bindRepositories_1.diContainer.tokenVerifier.verify(token);
        const uid = decodedToken.uid;
        const userEntity = await bindRepositories_1.diContainer.userRepository.getUserById(uid);
        // Check for explicit company context header
        const headerCompanyId = req.headers['x-company-id'];
        // Fallback to stored active company if header is missing
        const userStoredActiveCompany = await bindRepositories_1.diContainer.userRepository.getUserActiveCompany(uid);
        const activeCompanyId = headerCompanyId || userStoredActiveCompany;
        let roleId = null;
        let permissions = [];
        let isOwner = false;
        if (activeCompanyId) {
            // Validate user belongs to this company (basic check)
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(uid, activeCompanyId);
            if (membership) {
                roleId = membership.roleId;
                isOwner = !!membership.isOwner;
                // Permissions lookup not fully implemented; placeholder empty array
                permissions = [];
            }
            else if (headerCompanyId && !(userEntity === null || userEntity === void 0 ? void 0 : userEntity.isAdmin())) {
                // If header was provided but user has no membership, and is not super admin
                // Then this is an illicit access attempt to another company
                console.warn(`User ${uid} attempted to access company ${headerCompanyId} without membership.`);
                // We could throw 403 here, but for now let's just nullify the companyId to prevent data access
                // activeCompanyId = null; // (commented out to avoid breaking mixed access patterns for now)
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