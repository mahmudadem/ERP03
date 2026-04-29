"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEnabledCompanyCapabilityCodes = exports.resolveCompanyCapabilityAccess = void 0;
function normalize(value) {
    return String(value || '').trim().toLowerCase();
}
function normalizeList(values) {
    return (values || []).map(normalize).filter(Boolean);
}
function buildRegistryIndexes(capabilities) {
    const byCode = new Map();
    const byId = new Map();
    for (const capability of capabilities) {
        byCode.set(normalize(capability.code), capability);
        byId.set(normalize(capability.id), capability);
    }
    return { byCode, byId };
}
function resolveCapabilityForState(state, byCode, byId) {
    const key = normalize(state.capabilityId);
    return byCode.get(key) || byId.get(key);
}
function isCapabilityEntitled(capability, entitledCapabilities) {
    return entitledCapabilities.has(normalize(capability.code)) ||
        entitledCapabilities.has(normalize(capability.id));
}
function getCapabilityBlockedReason(capability, entitledCapabilities, accessibleModules) {
    if (capability.enablementPolicy !== 'company_admin_optional') {
        return 'Capability is not company-admin optional';
    }
    if (capability.lifecycleStatus !== 'ready') {
        return `Capability is not ready for use: ${capability.lifecycleStatus}`;
    }
    if (capability.runtimeStatus !== 'available') {
        return 'Capability is suspended';
    }
    if (capability.implementationStatus !== 'passed') {
        return 'Capability implementation check not passed';
    }
    if (!isCapabilityEntitled(capability, entitledCapabilities)) {
        return 'Company is not entitled to this capability';
    }
    if (!accessibleModules.has(normalize(capability.moduleId))) {
        return `Parent module ${capability.moduleId} must be enabled and available first`;
    }
    return undefined;
}
async function resolveCompanyCapabilityAccess(input) {
    const [capabilities, companyCapabilities, entitledCapabilityCodes] = await Promise.all([
        input.capabilityRepository.getAll(),
        input.capabilityRepository.getByCompanyId(input.companyId),
        input.entitlementRepository.getEffectiveCapabilities(input.companyId),
    ]);
    const accessibleModuleSet = new Set(normalizeList(input.accessibleModules));
    const entitledCapabilitySet = new Set(normalizeList(entitledCapabilityCodes));
    const { byCode, byId } = buildRegistryIndexes(capabilities);
    const enabledCapabilityCodes = new Set();
    for (const state of companyCapabilities) {
        if (!state.isEnabled)
            continue;
        const capability = resolveCapabilityForState(state, byCode, byId);
        if (capability) {
            enabledCapabilityCodes.add(normalize(capability.code));
        }
    }
    return capabilities
        .map((capability) => {
        const code = normalize(capability.code);
        const blockedReason = getCapabilityBlockedReason(capability, entitledCapabilitySet, accessibleModuleSet);
        const enabled = enabledCapabilityCodes.has(code);
        return {
            code,
            moduleId: normalize(capability.moduleId),
            name: capability.name,
            description: capability.description,
            enablementPolicy: capability.enablementPolicy,
            enabled,
            available: !blockedReason,
            blockedReason,
        };
    })
        .filter((item) => item.available || (item.enabled && item.enablementPolicy === 'company_admin_optional'));
}
exports.resolveCompanyCapabilityAccess = resolveCompanyCapabilityAccess;
async function resolveEnabledCompanyCapabilityCodes(input) {
    const capabilities = await resolveCompanyCapabilityAccess(input);
    return capabilities
        .filter((capability) => capability.enabled && capability.available)
        .map((capability) => capability.code);
}
exports.resolveEnabledCompanyCapabilityCodes = resolveEnabledCompanyCapabilityCodes;
//# sourceMappingURL=CompanyCapabilityAccessResolver.js.map