import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyWallet, redeemLoyaltyPoints } from '../controllers/walletController';

const router = Router();

router.get('/me', authenticate, getMyWallet);
router.post('/redeem', authenticate, redeemLoyaltyPoints);

export default router;
