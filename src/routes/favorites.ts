import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getMyFavorites, toggleFavorite } from '../controllers/favoriteController';

const router = Router();

router.get('/my', authenticate, getMyFavorites);
router.post('/toggle', authenticate, toggleFavorite);

export default router;
