/**
 * routes/generate.js
 * Script generation endpoints.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { checkQuota, incrementUsage } from '../middleware/quota.js';
import { generateScript, regenerateHooks, PLATFORM_SPECS, STYLE_SPECS } from '../services/aiService.js';

const router = Router();

/**
 * POST /api/generate
 * Body:
 *   - article: enriched article object
 *   - platform: 'tiktok' | 'youtube_shorts' | 'youtube_long'
 *   - style: 'dark_channel' | 'storytelling' | 'controversial' | 'educational'
 *   - version: 1 | 2 | 3 (optional, default 1)
 */
router.post('/', requireAuth, checkQuota, async (req, res) => {
  try {
    const { article, platform, style, version = 1, lang = "en" } = req.body;
    console.log('[generate] body:', JSON.stringify({ platform, style, articleTitle: article?.title }));

    // Validate required fields
    if (!article || !article.title) {
      return res.status(400).json({
        success: false,
        error: 'article with title is required.',
      });
    }

    const validPlatforms = Object.keys(PLATFORM_SPECS);
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `platform is required. Valid options: ${validPlatforms.join(', ')}`,
      });
    }

    const validStyles = Object.keys(STYLE_SPECS);
    if (!style || !validStyles.includes(style)) {
      return res.status(400).json({
        success: false,
        error: `style is required. Valid options: ${validStyles.join(', ')}`,
      });
    }

    const parsedVersion = Math.max(1, Math.min(3, parseInt(version, 10) || 1));

    const script = await generateScript({ article, platform, style, version: parsedVersion, lang });
    await incrementUsage(req.user.id);

    return res.json({ success: true, script });
  } catch (err) {
    console.error('[POST /api/generate]', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/generate/hooks
 * Regenerate only hooks for an existing script.
 * Body:
 *   - article: article object
 *   - platform: platform string
 *   - style: style string
 *   - existingHooks: current hooks array to avoid repetition
 */
router.post('/hooks', async (req, res) => {
  try {
    const { article, platform, style, existingHooks } = req.body;

    if (!article || !platform || !style) {
      return res.status(400).json({
        success: false,
        error: 'article, platform, and style are required.',
      });
    }

    const hooks = await regenerateHooks({ article, platform, style, existingHooks });
    return res.json({ success: true, hooks });
  } catch (err) {
    console.error('[POST /api/generate/hooks]', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/generate/options
 * Returns available platforms and styles.
 */
router.get('/options', (_req, res) => {
  res.json({
    success: true,
    platforms: Object.entries(PLATFORM_SPECS).map(([key, val]) => ({
      id: key,
      name: val.name,
      duration: val.duration,
    })),
    styles: Object.entries(STYLE_SPECS).map(([key, val]) => ({
      id: key,
      name: val.name,
      tone: val.tone,
    })),
  });
});

export default router;
