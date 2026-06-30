import { Router } from 'express';
import {
  getRestaurants, getRestaurant, getCategories,
  createRestaurant, getMyRestaurant, addMenuCategory, addMenuItem,
  updateRestaurant, getMyOrders, updateMenuItem, deleteMenuItem, deleteMenuCategory,
  streamMyOrders,
} from '../controllers/restaurantController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/categories', getCategories);
router.get('/', getRestaurants);
router.get('/my', authenticate, getMyRestaurant);
router.get('/my/orders', authenticate, getMyOrders);
router.get('/my/orders/stream', authenticate, streamMyOrders);
router.put('/my', authenticate, updateRestaurant);
router.get('/:id', getRestaurant);
router.post('/', authenticate, createRestaurant);
router.post('/menu/categories', authenticate, addMenuCategory);
router.post('/menu/items', authenticate, addMenuItem);
router.put('/menu/items/:id', authenticate, updateMenuItem);
router.delete('/menu/items/:id', authenticate, deleteMenuItem);
router.delete('/menu/categories/:id', authenticate, deleteMenuCategory);

export default router;
