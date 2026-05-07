/**
 * components/ui/CopyButton.jsx
 */

import { Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

export function CopyButton({ text, copyKey, className, label = 'Copy', size = 'sm' }) {
  const { copy, isCopied } = useCopyToClipboard();
  const copied = isCopied(copyKey || text?.slice(0, 20));

  const handleCopy = async (e) => {
    e.stopPropagation();
    await copy(text, copyKey || text?.slice(0, 20));
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'flex items-center gap-1.5 transition-all duration-200 rounded-lg',
        size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5',
        copied
          ? 'text-green-400 bg-green-500/10'
          : 'text-white/40 hover:text-white/70 hover:bg-white/5',
        className
      )}
      title={`Copy ${label}`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? 'Copied!' : label}</span>
    </button>
  );
}
