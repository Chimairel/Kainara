import { Router } from 'express';
import { WebsiteContentService } from '@/services/website-content.service';

const router = Router();
router.get('/landing-media', async (_req, res) => {
  try {
    return res
      .set('Cache-Control', 'public, max-age=60')
      .json({ success: true, data: await WebsiteContentService.getPublic() });
  } catch {
    return res.status(503).json({ success: false, error: 'Website media is temporarily unavailable.' });
  }
});
export default router;
