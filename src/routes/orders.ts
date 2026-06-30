import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  tipOrder,
  getOrderTimeline,
  streamOrder,
} from '../controllers/orderController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createOrder);
router.get('/my', authenticate, getMyOrders);
router.get('/:id', authenticate, getOrder);
router.get('/:id/stream', authenticate, streamOrder);
router.get('/:id/events', authenticate, getOrderTimeline);
router.put('/:id/status', authenticate, updateOrderStatus);
router.put('/:id/cancel', authenticate, cancelOrder);
router.put('/:id/tip', authenticate, tipOrder);

export default router;
