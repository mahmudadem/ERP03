/**
 * super-admin.field-library.routes.ts
 *
 * Authoring endpoints for the Layer 1 field library. Mounted at
 * `/super-admin/field-library` in platform.router.ts; gated by
 * `assertSuperAdmin`.
 */

import { Router } from 'express';
import { SuperAdminFieldLibraryController } from '../controllers/super-admin/SuperAdminFieldLibraryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { assertSuperAdmin } from '../middlewares/assertSuperAdmin';

const router = Router();

router.use(authMiddleware);
router.use(assertSuperAdmin);

router.get('/', SuperAdminFieldLibraryController.list);
router.get('/:id', SuperAdminFieldLibraryController.getOne);
router.post('/', SuperAdminFieldLibraryController.create);
router.put('/:id', SuperAdminFieldLibraryController.update);
router.patch('/:id/deprecated', SuperAdminFieldLibraryController.setDeprecated);
router.delete('/:id', SuperAdminFieldLibraryController.hardDelete);

export default router;
