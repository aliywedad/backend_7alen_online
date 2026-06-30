import { Router } from 'express';
import { registerDriver, toggleOnline, updateLocation, getAvailableOrders, acceptOrder, getDriverOrders, streamDriver } from '../controllers/driverController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', authenticate, registerDriver);
router.put('/online', authenticate, toggleOnline);
router.put('/location', authenticate, updateLocation);
router.get('/orders/available', authenticate, getAvailableOrders);
router.put('/orders/:id/accept', authenticate, acceptOrder);
router.get('/stream', authenticate, streamDriver);
router.get('/orders', authenticate, getDriverOrders);

export default router;
