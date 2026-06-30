import { Router } from 'express';
import { listBanners } from '../controllers/bannerController';

const router = Router();

router.get('/', listBanners);

export default router;
