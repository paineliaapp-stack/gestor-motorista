/**
 * components/script/SavedScriptsDrawer.jsx
 * Side drawer for viewing/managing saved scripts.
 */

import { useEffect, useState } from 'react';
import { X, Trash2, Clock, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { storageService } from '../../services/storage';
import { PLATFORM_CONFIG, STYLE_CONFIG, formatRelativeTime } from '../../utils';
import { CopyButton } from '../ui/CopyButton';

function SavedScriptCard({ script, onDelete, onExpand }) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {script.article_image && (
          <img
            src={script.article_image}
            alt=""
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            onError={(e) => (e.target.style.display = 'none')}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-display font-semibold text-white line-clamp-2 mb-1">
            {script.article_title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tag">{PLATFORM_CONFIG[script.platform]?.label}</span>
            <span className="tag">{STYLE_CONFIG[script.style]?.label}</span>
            <span className="flex items-center gap-1 text-xs text-white/30 font-body">
              <Clock size={10} />
              {formatRelativeTime(script.savedAt)}
            </span>
          </div>
        </div>
        <button
          onClick={() => onDelete(script.id)}
          className="btn-ghost text-red-400/50 hover:text-red-400 flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Preview hook */}
      {script.hooks?.[0] && (
        <div className="bg-dark-700 border border-white/5 rounded-lg p-2">
          <p className="text-xs text-white/50 font-body line-clamp-2">{script.hooks[0]}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <CopyButton
          text={script.script}
          copyKey={`saved-${script.id}`}
          label="Copy Script"
          size="sm"
        />
        <button onClick={() => onExpand(script)} className="btn-ghost text-xs">
          <ExternalLink size={12} />
          View Full
        </button>
      </div>
    </div>
  );
}

export function SavedScriptsDrawer({ open, onClose }) {
  const [scripts, setScripts] = useState([]);

  useEffect(() => {
    if (open) {
      setScripts(storageService.getAll());
    }
  }, [open]);

  const handleDelete = (id) => {
    storageService.delete(id);
    setScripts((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAll = () => {
    storageService.clearAll();
    setScripts([]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-sm h-full bg-dark-800 border-l border-white/5 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-white">Saved Scripts</h2>
            <p className="text-xs text-white/30 font-body">{scripts.length} saved</p>
          </div>
          <div className="flex items-center gap-2">
            {scripts.length > 0 && (
              <button onClick={handleClearAll} className="btn-ghost text-red-400/60 hover:text-red-400 text-xs">
                Clear all
              </button>
            )}
            <button onClick={onClose} className="btn-ghost">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <span className="text-4xl">📂</span>
              <div>
                <p className="font-display font-semibold text-white mb-1">No saved scripts</p>
                <p className="text-sm text-white/30 font-body">Generate and save scripts to access them here.</p>
              </div>
            </div>
          ) : (
            scripts.map((script) => (
              <SavedScriptCard
                key={script.id}
                script={script}
                onDelete={handleDelete}
                onExpand={() => {}}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
