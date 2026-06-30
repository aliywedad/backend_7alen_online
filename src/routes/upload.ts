import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

const router = Router();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/', authenticate, (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large — max 8 MB' });
    if (err) return next(err);
    next();
  });
}, async (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const key = `${uuidv4()}${ext}`;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    res.json({ url: `${process.env.R2_PUBLIC_URL}/${key}` });
  } catch (err) {
    console.error('[R2 Upload Error]', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
