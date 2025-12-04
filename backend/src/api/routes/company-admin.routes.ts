/**
 * company-admin.routes.ts
 * Routes for company administration
 * 
 * Authorization is handled at the router mount level in tenant.router.ts
 * via ownerOrPermissionGuard('system.company.manage')
 */

import { Router } from 'express';
import { CompanyProfileController } from '../controllers/company-admin/CompanyProfileController';
import { CompanyUsersController } from '../controllers/company-admin/CompanyUsersController';
import { CompanyRolesController } from '../controllers/company-admin/CompanyRolesController';
import { CompanyModulesController } from '../controllers/company-admin/CompanyModulesController';
import { CompanyBundleController } from '../controllers/company-admin/CompanyBundleController';
import { CompanyFeaturesController } from '../controllers/company-admin/CompanyFeaturesController';

const router = Router();

// ============================================================================
// PROFILE ROUTES
// ============================================================================
router.get('/profile', CompanyProfileController.getProfile);
router.post('/profile/update', CompanyProfileController.updateProfile);

// ============================================================================
// USER ROUTES
// ============================================================================
router.get('/users', CompanyUsersController.listUsers);
router.post('/users/invite', CompanyUsersController.inviteUser);
router.post('/users/:userId/update-role', CompanyUsersController.updateUserRole);
router.post('/users/:userId/disable', CompanyUsersController.disableUser);
router.post('/users/:userId/enable', CompanyUsersController.enableUser);

// ============================================================================
// ROLE ROUTES
// ============================================================================
router.get('/roles', CompanyRolesController.listRoles);
router.get('/roles/:roleId', CompanyRolesController.getRole);
router.post('/roles/create', CompanyRolesController.createRole);
router.post('/roles/:roleId/update', CompanyRolesController.updateRole);
router.delete('/roles/:roleId', CompanyRolesController.deleteRole);

// ============================================================================
// MODULE ROUTES
// ============================================================================
router.get('/modules', CompanyModulesController.listModules);
router.get('/modules/active', CompanyModulesController.listActiveModules);
router.post('/modules/enable', CompanyModulesController.enableModule);
router.post('/modules/disable', CompanyModulesController.disableModule);

// ============================================================================
// BUNDLE ROUTES
// ============================================================================
router.get('/bundle', CompanyBundleController.getCurrentBundle);
router.get('/bundle/available', CompanyBundleController.listAvailableBundles);
router.post('/bundle/upgrade', CompanyBundleController.upgradeBundle);

// ============================================================================
// FEATURE ROUTES
// ============================================================================
router.get('/features', CompanyFeaturesController.listFeatures);
router.get('/features/active', CompanyFeaturesController.listActiveFeatures);
router.post('/features/toggle', CompanyFeaturesController.toggleFeature);

export default router;
