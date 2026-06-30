import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listMyNotifications, markAllRead, markRead } from '../controllers/notificationController';

const router = Router();

router.get('/my', authenticate, listMyNotifications);
router.put('/:id/read', authenticate, markRead);
router.put('/read-all', authenticate, markAllRead);

export default router;
