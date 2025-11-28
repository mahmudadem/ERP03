import { Router } from 'express';
import { PosController } from '../controllers/pos/PosController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/shifts/open', permissionsMiddleware('pos.shift.open'), PosController.openShift);
router.post('/orders', permissionsMiddleware('pos.order.create'), PosController.createOrder);

export default router;