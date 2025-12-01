"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCompaniesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class UserCompaniesController {
    static async listUserCompanies(req, res, next) {
        try {
            const userId = req.user.uid;
            const companies = await bindRepositories_1.diContainer.companyRepository.getUserCompanies(userId);
            const data = await Promise.all(companies.map(async (c) => {
                var _a;
                const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, c.id);
                return {
                    id: c.id,
                    name: c.name,
                    baseCurrency: c.baseCurrency,
                    model: (_a = c.modules) === null || _a === void 0 ? void 0 : _a[0],
                    roleId: (membership === null || membership === void 0 ? void 0 : membership.roleId) || 'MEMBER',
                    isOwner: (membership === null || membership === void 0 ? void 0 : membership.isOwner) || false,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                };
            }));
            return res.json({ success: true, data });
        }
        catch (err) {
            return next(err);
        }
    }
    static async switchCompany(req, res, next) {
        try {
            const userId = req.user.uid;
            const { companyId } = req.body;
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
            if (!membership)
                throw new Error('Not a member of this company');
            await bindRepositories_1.diContainer.userRepository.updateActiveCompany(userId, companyId);
            return res.json({ success: true, activeCompanyId: companyId });
        }
        catch (err) {
            return next(err);
        }
    }
    static async getActiveCompany(req, res, next) {
        try {
            const userId = req.user.uid;
            const activeCompanyId = await bindRepositories_1.diContainer.userRepository.getUserActiveCompany(userId);
            if (!activeCompanyId) {
                return res.json({ success: true, data: { activeCompanyId: null } });
            }
            const company = await bindRepositories_1.diContainer.companyRepository.findById(activeCompanyId);
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, activeCompanyId);
            return res.json({
                success: true,
                data: {
                    activeCompanyId,
                    company,
                    roleId: (membership === null || membership === void 0 ? void 0 : membership.roleId) || null,
                    isOwner: (membership === null || membership === void 0 ? void 0 : membership.isOwner) || false,
                },
            });
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.UserCompaniesController = UserCompaniesController;
//# sourceMappingURL=UserCompaniesController.js.map