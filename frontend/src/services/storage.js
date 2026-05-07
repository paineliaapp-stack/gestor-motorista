/**
 * services/storage.js
 * LocalStorage service for saving scripts (Phase 2).
 */

const STORAGE_KEY = 'viralnews_saved_scripts';
const MAX_SAVED = 50;

export const storageService = {
  /**
   * Get all saved scripts.
   */
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Save a script.
   * @param {Object} script - Script object with article metadata
   */
  save(script) {
    try {
      const existing = this.getAll();
      const id = `script_${Date.now()}`;
      const toSave = {
        id,
        savedAt: new Date().toISOString(),
        ...script,
      };

      // Prepend new script, keep only MAX_SAVED
      const updated = [toSave, ...existing].slice(0, MAX_SAVED);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return id;
    } catch {
      console.error('Failed to save script to localStorage.');
      return null;
    }
  },

  /**
   * Delete a saved script by ID.
   */
  delete(id) {
    try {
      const updated = this.getAll().filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if a script is saved (by article title + platform + style).
   */
  isSaved(articleTitle, platform, style) {
    const all = this.getAll();
    return all.some(
      (s) =>
        s.article_title === articleTitle &&
        s.platform === platform &&
        s.style === style
    );
  },

  /**
   * Clear all saved scripts.
   */
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
