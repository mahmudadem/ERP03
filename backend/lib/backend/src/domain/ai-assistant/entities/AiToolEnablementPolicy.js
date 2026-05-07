"use strict";
/**
 * AiToolEnablementPolicy - Domain Entity
 *
 * Controls WHICH tools are enabled for WHICH contexts.
 * Super Admin can override enablement at various levels:
 * - Globally enabled/disabled
 * - Per plan (starter, professional, enterprise)
 * - Per company (explicit override)
 * - Per module (only if module is active)
 * - Per provider/model (AI provider restrictions)
 * - Per role (role-based access)
 * - Rate limits per message, day, company, user
 *
 * DENY takes precedence over ALLOW at every level.
 * If a tool is globally disabled, no override can enable it.
 * If a tool is disabled for a specific company, that company cannot use it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolEnablementPolicy = void 0;
class AiToolEnablementPolicy {
    constructor(toolId, globallyEnabled = true, enabledForPlans = [], disabledForPlans = [], enabledForCompanies = [], disabledForCompanies = [], enabledForModules = [], disabledForModules = [], enabledForProviders = [], disabledForProviders = [], enabledForModels = [], disabledForModels = [], enabledForRoles = [], disabledForRoles = [], allowedPermissions = [], maxCallsPerMessage = 2, maxCallsPerDayPerCompany = 100, maxCallsPerDayPerUser = 50) {
        this.toolId = toolId;
        this.globallyEnabled = globallyEnabled;
        this.enabledForPlans = enabledForPlans;
        this.disabledForPlans = disabledForPlans;
        this.enabledForCompanies = enabledForCompanies;
        this.disabledForCompanies = disabledForCompanies;
        this.enabledForModules = enabledForModules;
        this.disabledForModules = disabledForModules;
        this.enabledForProviders = enabledForProviders;
        this.disabledForProviders = disabledForProviders;
        this.enabledForModels = enabledForModels;
        this.disabledForModels = disabledForModels;
        this.enabledForRoles = enabledForRoles;
        this.disabledForRoles = disabledForRoles;
        this.allowedPermissions = allowedPermissions;
        this.maxCallsPerMessage = maxCallsPerMessage;
        this.maxCallsPerDayPerCompany = maxCallsPerDayPerCompany;
        this.maxCallsPerDayPerUser = maxCallsPerDayPerUser;
    }
    /**
     * Check if a tool is enabled for a specific context.
     * DENY takes precedence over ALLOW at every level.
     */
    isEnabledForContext(context) {
        // 1. Global disable = hard block
        if (!this.globallyEnabled)
            return false;
        // 2. Plan deny takes precedence over plan allow
        if (context.plan) {
            if (this.disabledForPlans.includes(context.plan))
                return false;
            if (this.enabledForPlans.length > 0 && !this.enabledForPlans.includes(context.plan))
                return false;
        }
        // 3. Company deny takes precedence over company allow
        if (context.companyId) {
            if (this.disabledForCompanies.includes(context.companyId))
                return false;
            if (this.enabledForCompanies.length > 0 && !this.enabledForCompanies.includes(context.companyId))
                return false;
        }
        // 4. Module deny takes precedence over module allow
        if (context.modules && context.modules.length > 0) {
            if (this.disabledForModules.some(m => context.modules.includes(m)))
                return false;
            if (this.enabledForModules.length > 0 && !this.enabledForModules.some(m => context.modules.includes(m)))
                return false;
        }
        // 5. Provider deny
        if (context.provider) {
            if (this.disabledForProviders.includes(context.provider))
                return false;
            if (this.enabledForProviders.length > 0 && !this.enabledForProviders.includes(context.provider))
                return false;
        }
        // 6. Model deny
        if (context.model) {
            if (this.disabledForModels.includes(context.model))
                return false;
            if (this.enabledForModels.length > 0 && !this.enabledForModels.includes(context.model))
                return false;
        }
        // 7. Role deny
        if (context.roles && context.roles.length > 0) {
            if (this.disabledForRoles.some(r => context.roles.includes(r)))
                return false;
            if (this.enabledForRoles.length > 0 && !this.enabledForRoles.some(r => context.roles.includes(r)))
                return false;
        }
        return true;
    }
    toJSON() {
        return {
            toolId: this.toolId,
            globallyEnabled: this.globallyEnabled,
            enabledForPlans: this.enabledForPlans,
            disabledForPlans: this.disabledForPlans,
            enabledForCompanies: this.enabledForCompanies,
            disabledForCompanies: this.disabledForCompanies,
            enabledForModules: this.enabledForModules,
            disabledForModules: this.disabledForModules,
            enabledForProviders: this.enabledForProviders,
            disabledForProviders: this.disabledForProviders,
            enabledForModels: this.enabledForModels,
            disabledForModels: this.disabledForModels,
            enabledForRoles: this.enabledForRoles,
            disabledForRoles: this.disabledForRoles,
            allowedPermissions: this.allowedPermissions,
            maxCallsPerMessage: this.maxCallsPerMessage,
            maxCallsPerDayPerCompany: this.maxCallsPerDayPerCompany,
            maxCallsPerDayPerUser: this.maxCallsPerDayPerUser,
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        return new AiToolEnablementPolicy(data.toolId, (_a = data.globallyEnabled) !== null && _a !== void 0 ? _a : true, (_b = data.enabledForPlans) !== null && _b !== void 0 ? _b : [], (_c = data.disabledForPlans) !== null && _c !== void 0 ? _c : [], (_d = data.enabledForCompanies) !== null && _d !== void 0 ? _d : [], (_e = data.disabledForCompanies) !== null && _e !== void 0 ? _e : [], (_f = data.enabledForModules) !== null && _f !== void 0 ? _f : [], (_g = data.disabledForModules) !== null && _g !== void 0 ? _g : [], (_h = data.enabledForProviders) !== null && _h !== void 0 ? _h : [], (_j = data.disabledForProviders) !== null && _j !== void 0 ? _j : [], (_k = data.enabledForModels) !== null && _k !== void 0 ? _k : [], (_l = data.disabledForModels) !== null && _l !== void 0 ? _l : [], (_m = data.enabledForRoles) !== null && _m !== void 0 ? _m : [], (_o = data.disabledForRoles) !== null && _o !== void 0 ? _o : [], (_p = data.allowedPermissions) !== null && _p !== void 0 ? _p : [], (_q = data.maxCallsPerMessage) !== null && _q !== void 0 ? _q : 2, (_r = data.maxCallsPerDayPerCompany) !== null && _r !== void 0 ? _r : 100, (_s = data.maxCallsPerDayPerUser) !== null && _s !== void 0 ? _s : 50);
    }
}
exports.AiToolEnablementPolicy = AiToolEnablementPolicy;
//# sourceMappingURL=AiToolEnablementPolicy.js.map