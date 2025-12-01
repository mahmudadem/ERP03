"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpersonationController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const StartImpersonationUseCase_1 = require("../../../application/impersonation/use-cases/StartImpersonationUseCase");
const StopImpersonationUseCase_1 = require("../../../application/impersonation/use-cases/StopImpersonationUseCase");
class ImpersonationController {
    static async startImpersonation(req, res, next) {
        try {
            const superAdminId = req.user.uid;
            const { companyId } = req.body;
            if (!companyId) {
                return res.status(400).json({ success: false, message: 'companyId is required' });
            }
            const useCase = new StartImpersonationUseCase_1.StartImpersonationUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.impersonationRepository);
            const impersonationToken = await useCase.execute(superAdminId, companyId);
            return res.json({
                success: true,
                data: {
                    impersonationToken,
                    companyId
                }
            });
        }
        catch (error) {
            return next(error);
        }
    }
    static async stopImpersonation(req, res, next) {
        try {
            const superAdminId = req.user.uid;
            const useCase = new StopImpersonationUseCase_1.StopImpersonationUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.impersonationRepository);
            await useCase.execute(superAdminId);
            return res.json({ success: true, message: 'Impersonation stopped' });
        }
        catch (error) {
            return next(error);
        }
    }
    static async getImpersonationStatus(req, res, next) {
        try {
            const superAdminId = req.user.uid;
            const session = await bindRepositories_1.diContainer.impersonationRepository.getActiveSessionBySuperAdmin(superAdminId);
            if (!session) {
                return res.json({ success: true, data: { active: false } });
            }
            return res.json({
                success: true,
                data: {
                    active: true,
                    sessionId: session.id,
                    companyId: session.companyId,
                    createdAt: session.createdAt
                }
            });
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.ImpersonationController = ImpersonationController;
//# sourceMappingURL=ImpersonationController.js.map