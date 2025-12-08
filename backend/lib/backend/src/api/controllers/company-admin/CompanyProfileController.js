"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyProfileController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const UpdateCompanyProfileUseCase_1 = require("../../../application/company-admin/use-cases/UpdateCompanyProfileUseCase");
const CoreDTOs_1 = require("../../dtos/CoreDTOs");
/**
 * CompanyProfileController
 * Handles company profile management operations
 */
class CompanyProfileController {
    /**
     * GET /company-admin/profile
     * Get company profile
     */
    static async getProfile(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            // Load company
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            if (!company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }
            // Return company profile
            return res.status(200).json({
                success: true,
                data: CoreDTOs_1.CoreDTOMapper.toCompanyDTO(company)
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /company-admin/profile/update
     * Update company profile
     */
    static async updateProfile(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            const updates = req.body;
            // Execute use case
            const useCase = new UpdateCompanyProfileUseCase_1.UpdateCompanyProfileUseCase(bindRepositories_1.diContainer.companyRepository);
            const updatedCompany = await useCase.execute({
                companyId,
                updates
            });
            // Return updated profile
            return res.status(200).json({
                success: true,
                data: CoreDTOs_1.CoreDTOMapper.toCompanyDTO(updatedCompany)
            });
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.CompanyProfileController = CompanyProfileController;
//# sourceMappingURL=CompanyProfileController.js.map