import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { SharedController } from '../controllers/shared/SharedController';

const router = Router();
router.use(authMiddleware);

router.post('/parties', SharedController.createParty);
router.get('/parties', SharedController.listParties);
router.get('/parties/:id', SharedController.getParty);
router.put('/parties/:id', SharedController.updateParty);

router.post('/tax-codes', SharedController.createTaxCode);
router.get('/tax-codes', SharedController.listTaxCodes);
router.get('/tax-codes/:id', SharedController.getTaxCode);
router.put('/tax-codes/:id', SharedController.updateTaxCode);

export default router;
