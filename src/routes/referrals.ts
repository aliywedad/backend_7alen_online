import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyReferrals } from '../controllers/referralController';

const router = Router();

router.get('/me', authenticate, getMyReferrals);

export default router;
