import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listActiveCoupons, previewCoupon } from '../controllers/couponController';

const router = Router();

router.get('/', listActiveCoupons);
router.post('/preview', authenticate, previewCoupon);

export default router;
