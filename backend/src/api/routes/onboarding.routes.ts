/**
 * onboarding.routes.ts
 * 
 * Purpose: Routes for user onboarding flow.
 * Includes both public (signup) and authenticated (plan selection, status) endpoints.
 */

import { Router } from 'express';
import { OnboardingController } from '../controllers/onboarding/OnboardingController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// ===== PUBLIC ROUTES =====

// Signup - creates new Firebase Auth + User record
router.post('/signup', OnboardingController.signup);

// List available plans (for plan selection page)
router.get('/plans', OnboardingController.listPlans);

// List available bundles (for company wizard)
router.get('/bundles', OnboardingController.listBundles);


// ===== AUTHENTICATED ROUTES =====

// Get onboarding status - determines where to route user
router.get('/onboarding-status', authMiddleware, OnboardingController.getOnboardingStatus);

// Select plan - saves user's plan choice
router.post('/select-plan', authMiddleware, OnboardingController.selectPlan);

export default router;
