import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createReview, listMyReviews, listRestaurantReviews } from '../controllers/reviewController';

const router = Router();

router.post('/', authenticate, createReview);
router.get('/my', authenticate, listMyReviews);
router.get('/restaurant/:id', listRestaurantReviews);

export default router;
