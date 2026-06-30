import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createCourierRequest,
  estimateCourierPrice,
  getMyCourierRequests,
  getCourierById,
} from '../controllers/courierController';

const router = Router();

router.post('/estimate', authenticate, estimateCourierPrice);
router.post('/', authenticate, createCourierRequest);
router.get('/my', authenticate, getMyCourierRequests);
router.get('/:id', authenticate, getCourierById);

export default router;
