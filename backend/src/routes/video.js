/**
 * routes/video.js
 * Novelinha Viral — Veo 3 script generation
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { checkQuota, incrementUsage } from '../middleware/quota.js';
import { generateVideoScript } from '../services/aiService.js';

const router = Router();

const VALID_DURATIONS = [30, 45, 60];
const VALID_STYLES    = ['pixar_body', 'battle', 'superhero', 'drama', 'adventure'];

router.post('/', requireAuth, checkQuota, async (req, res) => {
  try {
    const { topic, style = 'pixar_body', durationSec = 60, hint = '' } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'topic is required.' });
    }
    if (!VALID_DURATIONS.includes(Number(durationSec))) {
      return res.status(400).json({ success: false, error: `durationSec must be one of: ${VALID_DURATIONS.join(', ')}` });
    }
    if (!VALID_STYLES.includes(style)) {
      return res.status(400).json({ success: false, error: `style must be one of: ${VALID_STYLES.join(', ')}` });
    }

    const script = await generateVideoScript({
      topic: topic.trim(),
      style,
      durationSec: Number(durationSec),
      hint: hint.trim(),
    });

    await incrementUsage(req.user.id);
    return res.json({ success: true, script });
  } catch (err) {
    console.error('[POST /api/video]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
