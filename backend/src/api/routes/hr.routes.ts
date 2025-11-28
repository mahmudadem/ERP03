import { Router } from 'express';
import { HrController } from '../controllers/hr/HrController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { permissionsMiddleware } from '../middlewares/permissionsMiddleware';

const router = Router();
router.use(authMiddleware);

router.post('/employees', permissionsMiddleware('hr.employees.create'), HrController.registerEmployee);
router.post('/attendance', permissionsMiddleware('hr.attendance.record'), HrController.recordAttendance);

export default router;