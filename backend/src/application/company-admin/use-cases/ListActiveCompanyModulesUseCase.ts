import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { IModuleRepository } from '../../../repository/interfaces/system/IModuleRepository';
import { Module } from '../../../domain/system/Module';

export class ListActiveCompanyModulesUseCase {
    constructor(
        private companyModuleSettingsRepository: ICompanyModuleSettingsRepository,
        private moduleRepository: IModuleRepository
    ) { }

    async execute(companyId: string): Promise<Module[]> {
        // 1. Get all enabled module IDs for the company
        const settings = await this.companyModuleSettingsRepository.findByCompanyId(companyId);
        const enabledModuleIds = settings
            .filter(s => s.isEnabled)
            .map(s => s.moduleId);

        if (enabledModuleIds.length === 0) {
            return [];
        }

        // 2. Get full module details for enabled modules
        // Optimally we would have a findByIds method, but findAll and filter works for small number of modules
        const allModules = await this.moduleRepository.findAll();
        return allModules.filter(m => enabledModuleIds.includes(m.id));
    }
}
