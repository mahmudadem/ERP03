"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompleteCompanyCreationUseCase = void 0;
const Company_1 = require("../../../domain/core/entities/Company");
const crypto_1 = require("crypto");
class CompleteCompanyCreationUseCase {
    constructor(sessionRepo, templateRepo, companyRepo, userRepo, rbacCompanyUserRepo, rbacCompanyRoleRepo, rolePermissionResolver, voucherTypeRepo, companySettingsRepo, systemMetadataRepo, currencyRepo, moduleActivationService) {
        this.sessionRepo = sessionRepo;
        this.templateRepo = templateRepo;
        this.companyRepo = companyRepo;
        this.userRepo = userRepo;
        this.rbacCompanyUserRepo = rbacCompanyUserRepo;
        this.rbacCompanyRoleRepo = rbacCompanyRoleRepo;
        this.rolePermissionResolver = rolePermissionResolver;
        this.voucherTypeRepo = voucherTypeRepo;
        this.companySettingsRepo = companySettingsRepo;
        this.systemMetadataRepo = systemMetadataRepo;
        this.currencyRepo = currencyRepo;
        this.moduleActivationService = moduleActivationService;
    }
    filter(steps, model) {
        return steps
            .filter((step) => !step.modelKey || step.modelKey === model)
            .sort((a, b) => a.order - b.order);
    }
    validateAllRequired(steps, data) {
        for (const step of steps) {
            for (const field of step.fields) {
                if (field.required && (data[field.id] === undefined || data[field.id] === null || data[field.id] === '')) {
                    throw new Error(`Missing required field: ${field.id}`);
                }
            }
        }
    }
    generateId(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    safeDate(input) {
        const d = input ? new Date(input) : new Date();
        return isNaN(d.getTime()) ? new Date() : d;
    }
    async execute(input) {
        const session = await this.sessionRepo.getById(input.sessionId);
        if (!session)
            throw new Error('Session not found');
        if (session.userId !== input.userId)
            throw new Error('Forbidden');
        const actor = await this.userRepo.getUserById(session.userId);
        if (!actor)
            throw new Error('Unauthorized');
        if (actor.isAdmin()) {
            throw new Error('SUPER_ADMIN cannot run the user wizard');
        }
        const template = await this.templateRepo.getById(session.templateId);
        if (!template)
            throw new Error('Template not found for session');
        const steps = this.filter(template.steps, session.model);
        this.validateAllRequired(steps, session.data);
        // Normalize common aliases to what creation expects
        const baseCurrency = session.data.currency || session.data.baseCurrency;
        const now = new Date();
        const fiscalYearStart = this.safeDate(session.data.fiscalYearStart);
        const fiscalYearEnd = new Date(fiscalYearStart);
        fiscalYearEnd.setFullYear(fiscalYearEnd.getFullYear() + 1);
        const company = new Company_1.Company(this.generateId('cmp'), session.data.companyName, session.userId, now, now, baseCurrency, fiscalYearStart, fiscalYearEnd, [session.model], [], session.data.taxId || '', undefined, session.data.address || undefined);
        try {
            await this.companyRepo.save(company);
            // Initialize settings (Global Tier 1)
            await this.companySettingsRepo.updateSettings(company.id, {
                timezone: session.data.timezone || 'UTC',
                dateFormat: session.data.dateFormat || 'MM/DD/YYYY',
                language: session.data.language || 'en',
                baseCurrency: baseCurrency || '',
                uiMode: 'windows'
            });
            // SEED SHARED SETTINGS: Currencies (Shared Tier 2)
            try {
                const globalCurrencies = await this.systemMetadataRepo.getMetadata('currencies');
                if (globalCurrencies && Array.isArray(globalCurrencies)) {
                    // Seed all available currencies (but don't enable any yet)
                    await this.currencyRepo.seedCurrencies(company.id, globalCurrencies);
                    console.log(`[CompleteCompanyCreationUseCase] Seeded global currencies to company ${company.id}`);
                }
            }
            catch (seedErr) {
                console.error('Failed to seed company currencies', seedErr);
            }
        }
        catch (err) {
            throw new Error(`Failed to create company: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
        await this.rbacCompanyUserRepo.assignRole({
            userId: session.userId,
            companyId: company.id,
            roleId: 'OWNER',
            isOwner: true,
            createdAt: now
        });
        // 4. Activate Modules with Dependency Tracing
        const modules = session.data.modules || [];
        for (const moduleCode of modules) {
            try {
                await this.moduleActivationService.activateModule(company.id, moduleCode, session.userId);
            }
            catch (modErr) {
                console.error(`Failed to activate module ${moduleCode}`, modErr);
            }
        }
        // 5. Update Role Module Bundles
        if (modules.length > 0) {
            const ownerRole = await this.rbacCompanyRoleRepo.getById(company.id, 'OWNER');
            const adminRole = await this.rbacCompanyRoleRepo.getById(company.id, 'ADMIN');
            if (ownerRole) {
                await this.rbacCompanyRoleRepo.update(company.id, ownerRole.id, {
                    moduleBundles: Array.from(new Set([...(ownerRole.moduleBundles || []), ...modules])),
                    resolvedPermissions: ownerRole.resolvedPermissions,
                });
            }
            if (adminRole) {
                await this.rbacCompanyRoleRepo.update(company.id, adminRole.id, {
                    moduleBundles: Array.from(new Set([...(adminRole.moduleBundles || []), ...modules])),
                    resolvedPermissions: adminRole.resolvedPermissions,
                });
            }
            // Resolve permissions for both roles
            await this.rolePermissionResolver.resolveRoleById(company.id, 'OWNER');
            await this.rolePermissionResolver.resolveRoleById(company.id, 'ADMIN');
        }
        await this.userRepo.updateActiveCompany(session.userId, company.id);
        await this.sessionRepo.delete(session.id);
        // Copy System Voucher Templates
        try {
            const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
            for (const template of systemTemplates) {
                // Clone template for new company
                const newTemplate = Object.assign(Object.assign({}, template), { id: (0, crypto_1.randomUUID)(), companyId: company.id });
                await this.voucherTypeRepo.createVoucherType(newTemplate);
            }
        }
        catch (err) {
            console.error('Failed to copy system voucher templates', err);
            // Non-blocking error, proceed
        }
        return { companyId: company.id, activeCompanyId: company.id };
    }
}
exports.CompleteCompanyCreationUseCase = CompleteCompanyCreationUseCase;
//# sourceMappingURL=CompleteCompanyCreationUseCase.js.map