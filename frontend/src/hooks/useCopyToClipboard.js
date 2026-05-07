/**
 * hooks/useCopyToClipboard.js
 */

import { useState, useCallback } from 'react';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedKey, setCopiedKey] = useState(null);

  const copy = useCallback(async (text, key = 'default') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), resetDelay);
      return true;
    } catch {
      return false;
    }
  }, [resetDelay]);

  const isCopied = useCallback((key = 'default') => copiedKey === key, [copiedKey]);

  return { copy, isCopied, copiedKey };
}
