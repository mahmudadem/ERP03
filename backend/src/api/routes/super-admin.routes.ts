

import { Router } from 'express';
import { SuperAdminController } from '../controllers/super-admin/SuperAdminController';
import { PermissionRegistryController } from '../controllers/super-admin/PermissionRegistryController';
import { ModuleRegistryController } from '../controllers/super-admin/ModuleRegistryController';
import { BusinessDomainRegistryController } from '../controllers/super-admin/BusinessDomainRegistryController';
import { BundleRegistryController } from '../controllers/super-admin/BundleRegistryController';
import { PlanRegistryController } from '../controllers/super-admin/PlanRegistryController';
import { RoleTemplateRegistryController } from '../controllers/super-admin/RoleTemplateRegistryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

// User management
router.get('/users', SuperAdminController.listAllUsers);
router.patch('/users/:userId/promote', SuperAdminController.promoteUser);
router.patch('/users/:userId/demote', SuperAdminController.demoteUser);

// Company management
router.get('/companies', SuperAdminController.listAllCompanies);

// System overview
router.get('/overview', SuperAdminController.getSystemOverview);

// Permission Registry
router.get('/permissions', PermissionRegistryController.list);
router.post('/permissions', PermissionRegistryController.create);
router.patch('/permissions/:id', PermissionRegistryController.update);
router.delete('/permissions/:id', PermissionRegistryController.delete);

// Module Registry
router.get('/modules', ModuleRegistryController.list);
router.post('/modules', ModuleRegistryController.create);
router.patch('/modules/:id', ModuleRegistryController.update);
router.delete('/modules/:id', ModuleRegistryController.delete);

// Business Domains
router.get('/business-domains', BusinessDomainRegistryController.list);
router.post('/business-domains', BusinessDomainRegistryController.create);
router.patch('/business-domains/:id', BusinessDomainRegistryController.update);
router.delete('/business-domains/:id', BusinessDomainRegistryController.delete);

// Bundles
router.get('/bundles', BundleRegistryController.list);
router.post('/bundles', BundleRegistryController.create);
router.patch('/bundles/:id', BundleRegistryController.update);
router.delete('/bundles/:id', BundleRegistryController.delete);

// Plans
router.get('/plans', PlanRegistryController.list);
router.post('/plans', PlanRegistryController.create);
router.patch('/plans/:id', PlanRegistryController.update);
router.delete('/plans/:id', PlanRegistryController.delete);

// Role Templates
router.get('/role-templates', RoleTemplateRegistryController.list);
router.get('/role-templates/:id', RoleTemplateRegistryController.getById);
router.post('/role-templates', RoleTemplateRegistryController.create);
router.patch('/role-templates/:id', RoleTemplateRegistryController.update);
router.delete('/role-templates/:id', RoleTemplateRegistryController.delete);

export default router;

