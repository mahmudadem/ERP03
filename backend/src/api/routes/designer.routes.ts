
import { Router } from 'express';
import { DesignerController } from '../controllers/designer/DesignerController';
import { VoucherTypeController } from '../controllers/designer/VoucherTypeController';
import { FieldLibraryController } from '../controllers/designer/FieldLibraryController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

// Admin / Designer actions
router.post('/forms', permissionsMiddleware('designer.forms.create'), DesignerController.createForm);
router.post('/voucher-types', permissionsMiddleware('designer.vouchertypes.create'), DesignerController.createVoucherType);
router.post('/adopt-template', permissionsMiddleware('designer.forms.create'), DesignerController.adoptTemplate);

// Consumption endpoints (Used by the frontend engine)
router.get('/voucher-types', permissionsMiddleware('designer.vouchertypes.view'), VoucherTypeController.listVoucherTypes);
router.get('/voucher-types/:code', permissionsMiddleware('designer.vouchertypes.view'), VoucherTypeController.getVoucherTypeByCode);

// Field Library — Layer 1 of task 135 (Phase A: read-only, no UI consumer yet)
router.get('/field-library', permissionsMiddleware('designer.vouchertypes.view'), FieldLibraryController.list);
router.get('/field-library/system', permissionsMiddleware('designer.vouchertypes.view'), FieldLibraryController.listSystem);

export default router;
