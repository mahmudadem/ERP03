"use strict";
/**
 * ai-proposal-policies.routes.ts
 *
 * Super Admin routes for managing AI proposal policies.
 * These are platform-level endpoints that control the proposal sandbox system.
 *
 * Endpoints:
 * - GET /platform/ai-proposal-policies — Get global policy
 * - PATCH /platform/ai-proposal-policies/:policyId — Update policy
 * - GET /platform/ai-proposals/summary — Get proposal usage summary
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
// Apply auth and super admin guard
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
// Proposal policy management
router.get('/ai-proposal-policies', async (req, res, next) => {
    try {
        const { diContainer } = require('../../infrastructure/di/bindRepositories');
        const policy = await diContainer.aiProposalPolicyRepository.getGlobalPolicy();
        res.json({
            success: true,
            data: policy.toJSON(),
        });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/ai-proposal-policies/:policyId', async (req, res, next) => {
    try {
        const { diContainer } = require('../../infrastructure/di/bindRepositories');
        const { policyId } = req.params;
        const updates = req.body;
        // SAFETY: never allow allowBusinessExecution to be set to true
        if (updates.allowBusinessExecution === true) {
            return res.status(400).json({
                success: false,
                error: 'allowBusinessExecution must ALWAYS be false. Proposals must never execute real business actions.',
            });
        }
        // Get existing policy
        let policy;
        if (policyId === 'global') {
            policy = await diContainer.aiProposalPolicyRepository.getGlobalPolicy();
        }
        else {
            // Company policy
            const allPolicies = await diContainer.aiProposalPolicyRepository.listCompanyPolicies();
            policy = allPolicies.find((p) => p.id === policyId);
            if (!policy) {
                return res.status(404).json({ success: false, error: 'Policy not found' });
            }
        }
        // Apply updates
        const updatedPolicy = policy.update(updates);
        // Save
        if (policyId === 'global') {
            await diContainer.aiProposalPolicyRepository.saveGlobalPolicy(updatedPolicy);
        }
        else {
            await diContainer.aiProposalPolicyRepository.saveCompanyPolicy(updatedPolicy);
        }
        res.json({
            success: true,
            data: updatedPolicy.toJSON(),
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/ai-proposals/summary', async (req, res, next) => {
    try {
        const { diContainer } = require('../../infrastructure/di/bindRepositories');
        const policy = await diContainer.aiProposalPolicyRepository.getGlobalPolicy();
        const companyPolicies = await diContainer.aiProposalPolicyRepository.listCompanyPolicies();
        // Build summary
        const summary = {
            globalPolicy: policy.toJSON(),
            companyPolicyCount: companyPolicies.length,
            enabledGlobally: policy.enabled,
            allowBusinessExecution: false,
            registeredProposalTypes: diContainer.aiProposalGeneratorRegistry.getRegisteredTypes(),
            disabledTypes: policy.disabledProposalTypes,
        };
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=ai-proposal-policies.routes.js.map