"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impersonationMiddleware = void 0;
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const ValidateImpersonationSessionUseCase_1 = require("../../application/impersonation/use-cases/ValidateImpersonationSessionUseCase");
async function impersonationMiddleware(req, res, next) {
    try {
        const impersonationToken = req.headers['x-impersonation-token'];
        if (!impersonationToken) {
            return next();
        }
        const useCase = new ValidateImpersonationSessionUseCase_1.ValidateImpersonationSessionUseCase(bindRepositories_1.diContainer.impersonationRepository);
        const session = await useCase.execute(impersonationToken);
        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired impersonation session'
            });
        }
        // Override request context
        req.impersonation = {
            active: true,
            sessionId: session.id,
            superAdminId: session.superAdminId,
            companyId: session.companyId,
            isOwner: true // Treat as owner
        };
        // Override company context
        req.companyId = session.companyId;
        next();
    }
    catch (error) {
        next(error);
    }
}
exports.impersonationMiddleware = impersonationMiddleware;
//# sourceMappingURL=impersonationMiddleware.js.map