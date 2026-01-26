"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCompaniesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class UserCompaniesController {
    static async listUserCompanies(req, res, next) {
        var _a;
        try {
            const userId = req.user.uid;
            // Fetch memberships across all companies (owner or member)
            const memberships = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getMembershipsByUser(userId);
            // Also fetch companies where this user is the owner (in case membership doc is missing)
            const ownedCompanies = await bindRepositories_1.diContainer.companyRepository.getUserCompanies(userId);
            const resultsMap = new Map();
            // From memberships
            for (const m of memberships) {
                const c = await bindRepositories_1.diContainer.companyRepository.findById(m.companyId);
                if (!c)
                    continue;
                // Resolve Base Currency from Shared Currencies (Tier 2)
                let baseCurrency = c.baseCurrency;
                try {
                    const currencies = await bindRepositories_1.diContainer.companyCurrencyRepository.findEnabledByCompany(c.id);
                    const baseRec = currencies.find(curr => curr.isBase);
                    if (baseRec)
                        baseCurrency = baseRec.currencyCode;
                }
                catch (e) { }
                resultsMap.set(c.id, {
                    id: c.id,
                    name: c.name,
                    baseCurrency: baseCurrency,
                    model: (_a = c.modules) === null || _a === void 0 ? void 0 : _a[0],
                    roleId: m.roleId || 'MEMBER',
                    isOwner: !!m.isOwner,
                    logoUrl: c.logoUrl,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                });
            }
            // From ownership (if not already included)
            for (const c of ownedCompanies) {
                if (resultsMap.has(c.id))
                    continue;
                // Resolve Base Currency from Shared Currencies (Tier 2)
                let baseCurrency = c.baseCurrency;
                try {
                    const currencies = await bindRepositories_1.diContainer.companyCurrencyRepository.findEnabledByCompany(c.id);
                    const baseRec = currencies.find(curr => curr.isBase);
                    if (baseRec)
                        baseCurrency = baseRec.currencyCode;
                }
                catch (e) { }
                resultsMap.set(c.id, {
                    id: c.id,
                    name: c.name,
                    baseCurrency: baseCurrency,
                    roleId: 'OWNER',
                    isOwner: true,
                    logoUrl: c.logoUrl,
                    createdAt: c.createdAt,
                    updatedAt: c.updatedAt,
                });
            }
            const data = Array.from(resultsMap.values());
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
            let membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
            if (!membership) {
                // Fallback: Check if user is the stored Owner of the company
                const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
                if (company && company.ownerId === userId) {
                    // He's the owner but membership record is missing (likely partial failure during creation)
                    // Auto-repair: Create the OWNER membership
                    console.warn(`Auto-repairing missing OWNER membership for user ${userId} in company ${companyId}`);
                    await bindRepositories_1.diContainer.rbacCompanyUserRepository.assignRole({
                        companyId: companyId,
                        userId: userId,
                        roleId: 'OWNER',
                        isOwner: true,
                        createdAt: new Date()
                    });
                    // Re-fetch
                    membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
                }
            }
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
            // Resolve Base Currency from Shared Currencies (Tier 2)
            let baseCurrency = company === null || company === void 0 ? void 0 : company.baseCurrency; // Fallback
            try {
                const currencies = await bindRepositories_1.diContainer.companyCurrencyRepository.findEnabledByCompany(activeCompanyId);
                const baseRec = currencies.find(c => c.isBase);
                if (baseRec)
                    baseCurrency = baseRec.currencyCode;
            }
            catch (e) {
                console.warn('Failed to fetch base currency from collection:', e);
            }
            return res.json({
                success: true,
                data: {
                    activeCompanyId,
                    company: company ? {
                        id: company.id,
                        name: company.name,
                        baseCurrency: baseCurrency,
                        fiscalYearStart: company.fiscalYearStart,
                        logoUrl: company.logoUrl,
                        modules: company.modules,
                    } : null,
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