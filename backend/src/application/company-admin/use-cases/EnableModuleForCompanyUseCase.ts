/**
 * EnableModuleForCompanyUseCase
 *
 * Enables a module for a company (enabled state) - NOT entitlement.
 * This is the "company admin turned ON" action.
 *
 * Gates (in order):
 * 1. Module availability passes (code exists, lifecycleStatus=ready, runtimeStatus=available)
 * 2. Company is entitled (has bundle/trial/promotion entitlement for this module)
 * 3. CompanyModule enabled state is set to true
 *
 * Does NOT create entitlements - only enables already-entitled modules.
 */
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanyEntitlementRepository } from '../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../platform/ModuleAvailabilityService';
import { ApiError } from '../../../api/errors/ApiError';
import { CompanyModuleEntity } from '../../../domain/company/entities/CompanyModule';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IVoucherFormRepository } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { syncCompanyVoucherTemplatesFromSystem } from '../../system/services/CompanyVoucherTemplateSyncService';

export class EnableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private companyModuleRepository: ICompanyModuleRepository,
    private entitlementRepository: ICompanyEntitlementRepository,
    private voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    const moduleName = String(input.moduleName || '').trim().toLowerCase();

    if (!input.companyId || !moduleName) {
      throw ApiError.badRequest('Missing required fields');
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    const service = ModuleAvailabilityService.getInstance();
    const availability = await service.isAvailableForCompany(moduleName, input.companyId);

    if (!availability.available) {
      switch (availability.state) {
        case ModuleAvailabilityState.DB_ONLY:
          throw ApiError.badRequest('Module implementation not found. Contact SuperAdmin.');
        case ModuleAvailabilityState.CODE_ONLY:
          throw ApiError.badRequest('Module not registered in the system. Contact SuperAdmin.');
        case ModuleAvailabilityState.IMPLEMENTATION_FAILED:
          throw ApiError.badRequest(`Module implementation check failed: ${availability.reason}`);
        case ModuleAvailabilityState.NOT_READY:
          throw ApiError.badRequest(`Module is not ready for use: ${availability.reason}`);
        case ModuleAvailabilityState.SUSPENDED:
          throw ApiError.custom(423, `Module is suspended: ${availability.reason}`);
        default:
          throw ApiError.badRequest(`Cannot enable module: ${availability.reason}`);
      }
    }

    const isEntitled = await this.entitlementRepository.hasModule(input.companyId, moduleName);
    if (!isEntitled) {
      throw ApiError.forbidden('Company is not entitled to this module. Contact SuperAdmin to add subscription.');
    }

    let moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
    
    if (moduleState && moduleState.isEnabled) {
      await syncCompanyVoucherTemplatesFromSystem({
        companyId: input.companyId,
        modules: [moduleName],
        createdBy: 'SYSTEM',
        voucherTypeRepo: this.voucherTypeRepo,
        voucherFormRepo: this.voucherFormRepo,
      });

      return { moduleName, status: 'already_enabled' };
    }

    if (moduleState) {
      await this.companyModuleRepository.update(input.companyId, moduleName, {
        isEnabled: true,
        updatedAt: new Date(),
      });
    } else {
      await this.companyModuleRepository.create(
        CompanyModuleEntity.create(input.companyId, moduleName)
      );
    }

    await syncCompanyVoucherTemplatesFromSystem({
      companyId: input.companyId,
      modules: [moduleName],
      createdBy: 'SYSTEM',
      voucherTypeRepo: this.voucherTypeRepo,
      voucherFormRepo: this.voucherFormRepo,
    });

    return { moduleName, status: 'enabled' };
  }
}
