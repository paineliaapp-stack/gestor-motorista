import { useState, useCallback } from 'react';
import { generateApi } from '../services/api';
import { storageService } from '../services/storage';
import { useLang } from '../contexts/LanguageContext';

const DEFAULT_PLATFORM = 'youtube_shorts';
const DEFAULT_STYLE = 'storytelling';

/**
 * Extracts a clean string from whatever the API returns.
 * The API returns an object { hooks, script, titles, hashtags, captions, thumbnail_prompt }.
 * The .script field is the main body string.
 */
function extractScript(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    if (typeof data.script === 'string') return data.script;
    if (typeof data.body === 'string') return data.body;
    // Last resort: stringify
    return JSON.stringify(data);
  }
  return String(data);
}

export function useScriptGenerator() {
  const { lang } = useLang();
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(1);

  // Aceita (article, version) ou (article, { platform, style, version })
  const generate = useCallback(async (article, versionOrOpts = 1) => {
    let version = 1;
    let overridePlatform = null;
    let overrideStyle = null;

    let overrideBias = null;
    if (typeof versionOrOpts === 'object' && versionOrOpts !== null) {
      version = versionOrOpts.version || 1;
      overridePlatform = versionOrOpts.platform || null;
      overrideStyle = versionOrOpts.style || null;
      overrideBias = versionOrOpts.bias || null;
    } else {
      version = versionOrOpts || 1;
    }

    const effectivePlatform = overridePlatform || platform;
    const effectiveStyle = overrideStyle || style;

    if (overridePlatform) setPlatform(overridePlatform);
    if (overrideStyle) setStyle(overrideStyle);

    setLoading(true);
    setError(null);
    setScript(null);
    setCurrentVersion(version);

    try {
      const effectiveBias = overrideBias || 'neutral';
      const data = await generateApi.createScript({
        article,
        platform: effectivePlatform,
        style: effectiveStyle,
        version,
        lang,
        bias: effectiveBias,
      });

      // Salva o objeto interno { hooks, script, titles, hashtags, captions, thumbnail_prompt }
      setScript(data.script ?? data);
      // Auto-save no localStorage
      try {
        const scriptData = data.script ?? data;
        const toSave = {
          ...scriptData,
          article_title: article.title,
          article_source: article.source,
          article_image: article.image,
          platform: effectivePlatform,
          style: effectiveStyle,
          savedAt: new Date().toISOString(),
        };
        const existing = JSON.parse(localStorage.getItem('viralnews_saved_scripts') || '[]');
        const updated = [{ id: 'script_' + Date.now(), ...toSave }, ...existing].slice(0, 50);
        localStorage.setItem('viralnews_saved_scripts', JSON.stringify(updated));
      } catch(e) { console.warn('localStorage save failed', e); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [platform, style, lang]);

  const generateVersion = useCallback(async (article, version) => {
    await generate(article, version);
  }, [generate]);

  const regenerateHooks = useCallback(async (article) => {
    if (!script) return;
    setHooksLoading(true);
    try {
      const data = await generateApi.regenerateHooks({
        article,
        platform,
        style,
        existingHooks: script.hooks,
        lang,
      });
      setScript((prev) => ({ ...prev, hooks: data.hooks }));
    } catch (err) {
      setError(err.message);
    } finally {
      setHooksLoading(false);
    }
  }, [script, platform, style, lang]);

  const saveScript = useCallback((article) => {
    if (!script) return null;
    return storageService.save({
      ...script,
      article_image: article?.image,
      article_source: article?.source,
    });
  }, [script]);

  const reset = useCallback(() => {
    setScript(null);
    setError(null);
    setCurrentVersion(1);
  }, []);

  return {
    platform, setPlatform,
    style, setStyle,
    script, loading, error, hooksLoading,
    currentVersion,
    generate, generateVersion,
    regenerateHooks,
    saveScript,
    reset,
    extractScript,
  };
}
