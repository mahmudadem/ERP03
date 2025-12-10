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