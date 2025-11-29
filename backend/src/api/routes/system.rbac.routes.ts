
import { Router } from 'express';
import { RbacController } from '../controllers/rbac/RbacController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

// Global
router.get('/permissions', RbacController.getPermissions);
router.get('/system-role-templates', RbacController.getSystemRoleTemplates);
router.get('/current-user-permissions', RbacController.getCurrentUserPermissions);

// Company Roles
router.get('/companies/:companyId/roles', RbacController.listCompanyRoles);
router.post('/companies/:companyId/roles', RbacController.createCompanyRole);
router.patch('/companies/:companyId/roles/:roleId', RbacController.updateCompanyRole);
router.delete('/companies/:companyId/roles/:roleId', RbacController.deleteCompanyRole);

// Company Users (RBAC)
router.get('/companies/:companyId/users', RbacController.listCompanyUsers);
router.post('/companies/:companyId/users/:uid/assign-role', RbacController.assignRoleToUser);

export default router;
