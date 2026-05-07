/**
 * components/script/PlatformStyleSelector.jsx
 */

import clsx from 'clsx';
import { PLATFORM_CONFIG, STYLE_CONFIG } from '../../utils';

function SelectionCard({ id, label, emoji, desc, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={clsx(
        'w-full text-left p-3 rounded-xl border transition-all duration-200',
        selected
          ? 'border-brand-500/60 bg-brand-500/10'
          : 'border-white/5 bg-dark-700 hover:border-white/15 hover:bg-dark-600'
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg leading-none">{emoji}</span>
        <div className="min-w-0">
          <div className={clsx('font-display font-semibold text-sm', selected ? 'text-brand-300' : 'text-white')}>
            {label}
          </div>
          {desc && (
            <div className="text-xs text-white/40 font-body truncate">{desc}</div>
          )}
        </div>
        {selected && (
          <div className="ml-auto w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

export function PlatformSelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="section-label">Platform</p>
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(PLATFORM_CONFIG).map(([id, cfg]) => (
          <SelectionCard
            key={id}
            id={id}
            label={cfg.label}
            emoji={cfg.icon}
            selected={value === id}
            onClick={onChange}
          />
        ))}
      </div>
    </div>
  );
}

export function StyleSelector({ value, onChange }) {
  return (
    <div className="space-y-2">
      <p className="section-label">Script Style</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(STYLE_CONFIG).map(([id, cfg]) => (
          <SelectionCard
            key={id}
            id={id}
            label={cfg.label}
            emoji={cfg.emoji}
            desc={cfg.desc}
            selected={value === id}
            onClick={onChange}
          />
        ))}
      </div>
    </div>
  );
}
