import { Router } from 'express';
import authenticate from '@/middleware/auth';
import { createLiveStreamHandler } from '@/lib/live-stream';
const router = Router();
router.get('/events', authenticate, createLiveStreamHandler());
export default router;
