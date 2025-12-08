"use strict";
/**
 * company-admin.routes.ts
 * Routes for company administration
 *
 * Authorization is handled at the router mount level in tenant.router.ts
 * via ownerOrPermissionGuard('system.company.manage')
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CompanyProfileController_1 = require("../controllers/company-admin/CompanyProfileController");
const CompanyUsersController_1 = require("../controllers/company-admin/CompanyUsersController");
const CompanyRolesController_1 = require("../controllers/company-admin/CompanyRolesController");
const CompanyModulesController_1 = require("../controllers/company-admin/CompanyModulesController");
const CompanyBundleController_1 = require("../controllers/company-admin/CompanyBundleController");
const CompanyFeaturesController_1 = require("../controllers/company-admin/CompanyFeaturesController");
const router = (0, express_1.Router)();
// ============================================================================
// PROFILE ROUTES
// ============================================================================
router.get('/profile', CompanyProfileController_1.CompanyProfileController.getProfile);
router.post('/profile/update', CompanyProfileController_1.CompanyProfileController.updateProfile);
// ============================================================================
// USER ROUTES
// ============================================================================
router.get('/users', CompanyUsersController_1.CompanyUsersController.listUsers);
router.post('/users/invite', CompanyUsersController_1.CompanyUsersController.inviteUser);
router.post('/users/:userId/update-role', CompanyUsersController_1.CompanyUsersController.updateUserRole);
router.post('/users/:userId/disable', CompanyUsersController_1.CompanyUsersController.disableUser);
router.post('/users/:userId/enable', CompanyUsersController_1.CompanyUsersController.enableUser);
// ============================================================================
// ROLE ROUTES
// ============================================================================
router.get('/roles', CompanyRolesController_1.CompanyRolesController.listRoles);
router.get('/roles/:roleId', CompanyRolesController_1.CompanyRolesController.getRole);
router.post('/roles/create', CompanyRolesController_1.CompanyRolesController.createRole);
router.post('/roles/:roleId/update', CompanyRolesController_1.CompanyRolesController.updateRole);
router.delete('/roles/:roleId', CompanyRolesController_1.CompanyRolesController.deleteRole);
// ============================================================================
// MODULE ROUTES
// ============================================================================
router.get('/modules', CompanyModulesController_1.CompanyModulesController.listModules);
router.get('/modules/active', CompanyModulesController_1.CompanyModulesController.listActiveModules);
router.post('/modules/enable', CompanyModulesController_1.CompanyModulesController.enableModule);
router.post('/modules/disable', CompanyModulesController_1.CompanyModulesController.disableModule);
// ============================================================================
// BUNDLE ROUTES
// ============================================================================
router.get('/bundle', CompanyBundleController_1.CompanyBundleController.getCurrentBundle);
router.get('/bundle/available', CompanyBundleController_1.CompanyBundleController.listAvailableBundles);
router.post('/bundle/upgrade', CompanyBundleController_1.CompanyBundleController.upgradeBundle);
// ============================================================================
// FEATURE ROUTES
// ============================================================================
router.get('/features', CompanyFeaturesController_1.CompanyFeaturesController.listFeatures);
router.get('/features/active', CompanyFeaturesController_1.CompanyFeaturesController.listActiveFeatures);
router.post('/features/toggle', CompanyFeaturesController_1.CompanyFeaturesController.toggleFeature);
exports.default = router;
//# sourceMappingURL=company-admin.routes.js.map