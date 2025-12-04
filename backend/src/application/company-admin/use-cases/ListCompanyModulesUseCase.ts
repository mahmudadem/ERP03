import { IModuleRepository } from '../../../repository/interfaces/system/IModuleRepository';
import { Module } from '../../../domain/system/Module';

export class ListCompanyModulesUseCase {
    constructor(private moduleRepository: IModuleRepository) { }

    async execute(companyId: string): Promise<Module[]> {
        // In a real scenario, we might filter modules based on the company's subscription bundle
        // For now, we return all available modules in the system
        return this.moduleRepository.findAll();
    }
}
