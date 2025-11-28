
import { Router } from 'express';
import { DesignerController } from '../controllers/designer/DesignerController';
import { VoucherTypeController } from '../controllers/designer/VoucherTypeController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

// Admin / Designer actions
router.post('/forms', permissionsMiddleware('designer.forms.create'), DesignerController.createForm);
router.post('/voucher-types', permissionsMiddleware('designer.vouchertypes.create'), DesignerController.createVoucherType);

// Consumption endpoints (Used by the frontend engine)
router.get('/voucher-types', permissionsMiddleware('designer.vouchertypes.view'), VoucherTypeController.listVoucherTypes);
router.get('/voucher-types/:code', permissionsMiddleware('designer.vouchertypes.view'), VoucherTypeController.getVoucherTypeByCode);

export default router;
