import { Router } from 'express';
import { WebsiteContentService } from '@/services/website-content.service';

const router = Router();
router.get('/landing-media', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json({ success: true, data: await WebsiteContentService.getPublic() });
  } catch {
    return res.status(503).json({ success: false, error: 'Website media is temporarily unavailable.' });
  }
});
export default router;
