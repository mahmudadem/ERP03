"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SuperAdminController_1 = require("../controllers/super-admin/SuperAdminController");
const PermissionRegistryController_1 = require("../controllers/super-admin/PermissionRegistryController");
const ModuleRegistryController_1 = require("../controllers/super-admin/ModuleRegistryController");
const BusinessDomainRegistryController_1 = require("../controllers/super-admin/BusinessDomainRegistryController");
const BundleRegistryController_1 = require("../controllers/super-admin/BundleRegistryController");
const PlanRegistryController_1 = require("../controllers/super-admin/PlanRegistryController");
const RoleTemplateRegistryController_1 = require("../controllers/super-admin/RoleTemplateRegistryController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const assertSuperAdmin_1 = require("../middlewares/assertSuperAdmin");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.use(assertSuperAdmin_1.assertSuperAdmin);
// User management
router.get('/users', SuperAdminController_1.SuperAdminController.listAllUsers);
router.patch('/users/:userId/promote', SuperAdminController_1.SuperAdminController.promoteUser);
router.patch('/users/:userId/demote', SuperAdminController_1.SuperAdminController.demoteUser);
// Company management
router.get('/companies', SuperAdminController_1.SuperAdminController.listAllCompanies);
// System overview
router.get('/overview', SuperAdminController_1.SuperAdminController.getSystemOverview);
// Permission Registry
router.get('/permissions', PermissionRegistryController_1.PermissionRegistryController.list);
router.post('/permissions', PermissionRegistryController_1.PermissionRegistryController.create);
router.patch('/permissions/:id', PermissionRegistryController_1.PermissionRegistryController.update);
router.delete('/permissions/:id', PermissionRegistryController_1.PermissionRegistryController.delete);
// Module Registry
router.get('/modules', ModuleRegistryController_1.ModuleRegistryController.list);
router.post('/modules', ModuleRegistryController_1.ModuleRegistryController.create);
router.patch('/modules/:id', ModuleRegistryController_1.ModuleRegistryController.update);
router.delete('/modules/:id', ModuleRegistryController_1.ModuleRegistryController.delete);
// Business Domains
router.get('/business-domains', BusinessDomainRegistryController_1.BusinessDomainRegistryController.list);
router.post('/business-domains', BusinessDomainRegistryController_1.BusinessDomainRegistryController.create);
router.patch('/business-domains/:id', BusinessDomainRegistryController_1.BusinessDomainRegistryController.update);
router.delete('/business-domains/:id', BusinessDomainRegistryController_1.BusinessDomainRegistryController.delete);
// Bundles
router.get('/bundles', BundleRegistryController_1.BundleRegistryController.list);
router.post('/bundles', BundleRegistryController_1.BundleRegistryController.create);
router.patch('/bundles/:id', BundleRegistryController_1.BundleRegistryController.update);
router.delete('/bundles/:id', BundleRegistryController_1.BundleRegistryController.delete);
// Plans
router.get('/plans', PlanRegistryController_1.PlanRegistryController.list);
router.post('/plans', PlanRegistryController_1.PlanRegistryController.create);
router.patch('/plans/:id', PlanRegistryController_1.PlanRegistryController.update);
router.delete('/plans/:id', PlanRegistryController_1.PlanRegistryController.delete);
// Role Templates
router.get('/role-templates', RoleTemplateRegistryController_1.RoleTemplateRegistryController.list);
router.get('/role-templates/:id', RoleTemplateRegistryController_1.RoleTemplateRegistryController.getById);
router.post('/role-templates', RoleTemplateRegistryController_1.RoleTemplateRegistryController.create);
router.patch('/role-templates/:id', RoleTemplateRegistryController_1.RoleTemplateRegistryController.update);
router.delete('/role-templates/:id', RoleTemplateRegistryController_1.RoleTemplateRegistryController.delete);
exports.default = router;
//# sourceMappingURL=super-admin.routes.js.map