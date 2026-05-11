import { Router } from 'express';
import axios from 'axios';

const router = Router();

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  }, { timeout: 30000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.post('/', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt obrigatorio' });
    const text = await callGemini(prompt);
    res.json({ text });
  } catch (err) {
    console.error('[ai-diagnosis]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
