"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecurringVoucherController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const RecurringVoucherUseCases_1 = require("../../../application/accounting/use-cases/RecurringVoucherUseCases");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class RecurringVoucherController {
    static async list(req, res, next) {
        var _a;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const data = await bindRepositories_1.diContainer.recurringVoucherTemplateRepository.list(companyId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const uc = new RecurringVoucherUseCases_1.CreateRecurringTemplateUseCase(bindRepositories_1.diContainer.recurringVoucherTemplateRepository, bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const data = await uc.execute(companyId, userId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const uc = new RecurringVoucherUseCases_1.UpdateRecurringTemplateUseCase(bindRepositories_1.diContainer.recurringVoucherTemplateRepository, permissionChecker);
            const data = await uc.execute(companyId, userId, id, req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async pause(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const uc = new RecurringVoucherUseCases_1.PauseRecurringTemplateUseCase(bindRepositories_1.diContainer.recurringVoucherTemplateRepository, permissionChecker);
            const data = await uc.execute(companyId, userId, id);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async resume(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const uc = new RecurringVoucherUseCases_1.ResumeRecurringTemplateUseCase(bindRepositories_1.diContainer.recurringVoucherTemplateRepository, permissionChecker);
            const data = await uc.execute(companyId, userId, id);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async generate(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { asOfDate } = req.body;
            const uc = new RecurringVoucherUseCases_1.GenerateRecurringVouchersUseCase(bindRepositories_1.diContainer.recurringVoucherTemplateRepository, bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const data = await uc.execute(companyId, userId, asOfDate || new Date().toISOString().slice(0, 10));
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.RecurringVoucherController = RecurringVoucherController;
//# sourceMappingURL=RecurringVoucherController.js.map