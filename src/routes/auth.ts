import { Router } from 'express';
import { register, login, getMe, updateProfile, getAddresses, addAddress, deleteAccount } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { sendOtp, verifyOtp } from '../controllers/otpController';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/otp/send', authLimiter, sendOtp);
router.post('/otp/verify', authLimiter, verifyOtp);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);
router.delete('/me', authenticate, deleteAccount);
router.get('/addresses', authenticate, getAddresses);
router.post('/addresses', authenticate, addAddress);

export default router;
