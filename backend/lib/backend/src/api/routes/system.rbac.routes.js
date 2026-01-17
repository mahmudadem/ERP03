"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RbacController_1 = require("../controllers/rbac/RbacController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
// Global
router.get('/permissions', RbacController_1.RbacController.getPermissions);
router.get('/system-role-templates', RbacController_1.RbacController.getSystemRoleTemplates);
router.get('/current-user-permissions', RbacController_1.RbacController.getCurrentUserPermissions);
// Company Roles
router.get('/companies/:companyId/roles', RbacController_1.RbacController.listCompanyRoles);
router.post('/companies/:companyId/roles', RbacController_1.RbacController.createCompanyRole);
router.patch('/companies/:companyId/roles/:roleId', RbacController_1.RbacController.updateCompanyRole);
router.delete('/companies/:companyId/roles/:roleId', RbacController_1.RbacController.deleteCompanyRole);
// Company Users (RBAC)
router.get('/companies/:companyId/users', RbacController_1.RbacController.listCompanyUsers);
router.post('/companies/:companyId/users/:uid/assign-role', RbacController_1.RbacController.assignRoleToUser);
router.delete('/companies/:companyId/users/:userId', RbacController_1.RbacController.removeUserFromCompany);
exports.default = router;
//# sourceMappingURL=system.rbac.routes.js.map