"use strict";
/**
 * onboarding.routes.ts
 *
 * Purpose: Routes for user onboarding flow.
 * Includes both public (signup) and authenticated (plan selection, status) endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OnboardingController_1 = require("../controllers/onboarding/OnboardingController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// ===== PUBLIC ROUTES =====
// Signup - creates new Firebase Auth + User record
router.post('/signup', OnboardingController_1.OnboardingController.signup);
// List available plans (for plan selection page)
router.get('/plans', OnboardingController_1.OnboardingController.listPlans);
// List available bundles (for company wizard)
router.get('/bundles', OnboardingController_1.OnboardingController.listBundles);
// ===== AUTHENTICATED ROUTES =====
// Get onboarding status - determines where to route user
router.get('/onboarding-status', authMiddleware_1.authMiddleware, OnboardingController_1.OnboardingController.getOnboardingStatus);
// Select plan - saves user's plan choice
router.post('/select-plan', authMiddleware_1.authMiddleware, OnboardingController_1.OnboardingController.selectPlan);
exports.default = router;
//# sourceMappingURL=onboarding.routes.js.map