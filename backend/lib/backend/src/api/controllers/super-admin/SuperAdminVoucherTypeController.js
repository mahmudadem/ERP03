"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminVoucherTypeController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const VoucherTypeDefinition_1 = require("../../../domain/designer/entities/VoucherTypeDefinition");
const crypto_1 = require("crypto");
class SuperAdminVoucherTypeController {
    static async listSystemTemplates(req, res, next) {
        try {
            const templates = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
            res.status(200).json({
                success: true,
                data: templates
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createSystemTemplate(req, res, next) {
        try {
            const payload = req.body;
            // Enforce SYSTEM scope
            const template = new VoucherTypeDefinition_1.VoucherTypeDefinition((0, crypto_1.randomUUID)(), 'SYSTEM', payload.name, payload.code, payload.module, payload.headerFields || [], payload.tableColumns || [], payload.layout || {}, payload.workflow);
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.createVoucherType(template);
            res.status(201).json({
                success: true,
                data: template
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSystemTemplate(req, res, next) {
        try {
            const id = req.params.id;
            const payload = req.body;
            // Ensure we are updating a SYSTEM template
            const existing = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getVoucherType('SYSTEM', id);
            if (!existing)
                throw ApiError_1.ApiError.notFound('System template not found');
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.updateVoucherType('SYSTEM', id, payload);
            res.status(200).json({
                success: true,
                message: 'Template updated'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteSystemTemplate(req, res, next) {
        try {
            const id = req.params.id;
            // Ensure we are deleting a SYSTEM template
            const existing = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getVoucherType('SYSTEM', id);
            if (!existing)
                throw ApiError_1.ApiError.notFound('System template not found');
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.deleteVoucherType('SYSTEM', id);
            res.status(200).json({
                success: true,
                message: 'Template deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SuperAdminVoucherTypeController = SuperAdminVoucherTypeController;
//# sourceMappingURL=SuperAdminVoucherTypeController.js.map