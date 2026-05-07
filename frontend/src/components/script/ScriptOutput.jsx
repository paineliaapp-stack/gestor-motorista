import { RefreshCw, Bookmark, BookmarkCheck, Crown, MousePointerClick } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { CopyButton } from "../ui/CopyButton";
import { formatHashtags } from "../../utils";
import { storageService } from "../../services/storage";
import { useLang } from "../../contexts/LanguageContext";
import { t } from "../../i18n/translations";

const MARKER_STYLES = {
  "[BEAT]":       { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  "[PAUSE]":      { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  "[SLOW DOWN]":  { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20"   },
  "[SPEED UP]":   { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20"  },
};

function renderScriptWithMarkers(text) {
  if (!text) return null;
  const parts = [];
  const markerRegex = /(\[BEAT\]|\[PAUSE\]|\[SLOW DOWN\]|\[SPEED UP\]|\(quieter\)|\.\.\.)/g;
  let lastIndex = 0;
  let match;
  markerRegex.lastIndex = 0;
  while ((match = markerRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    const token = match[1];
    if (token === "...") parts.push({ type: "ellipsis", content: token });
    else if (token === "(quieter)") parts.push({ type: "quieter", content: token });
    else parts.push({ type: "marker", content: token });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", content: text.slice(lastIndex) });
  return parts.map((part, i) => {
    if (part.type === "marker") {
      const style = MARKER_STYLES[part.content] || { bg: "bg-white/5", text: "text-white/40", border: "border-white/10" };
      return (
        <span key={i} className={clsx("inline-flex items-center mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border", style.bg, style.text, style.border)}>
          {part.content}
        </span>
      );
    }
    if (part.type === "ellipsis") return <span key={i} className="text-white/30 mx-0.5">...</span>;
    if (part.type === "quieter") return <span key={i} className="text-white/40 italic text-xs mx-1">(quieter)</span>;
    const words = part.content.split(/(\s+)/);
    return (
      <span key={i}>
        {words.map((word, j) => {
          const trimmed = word.trim();
          const isAllCaps = trimmed.length > 1 && trimmed === trimmed.toUpperCase() && /^[A-Z]+$/.test(trimmed);
          return isAllCaps
            ? <strong key={j} className="text-white font-bold tracking-wide">{word}</strong>
            : <span key={j}>{word}</span>;
        })}
      </span>
    );
  });
}

const INTERRUPT_COLORS = {
  "HARD STOP":          { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20"    },
  "REFRAME":            { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  "DIRECT ADDRESS":     { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20"   },
  "SCALE SHIFT":        { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20"  },
  "CONTRADICTION BOMB": { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/20"   },
  "VELOCITY CHANGE":    { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20"  },
};

const POSITION_COLORS = { Early: "text-green-400", Middle: "text-yellow-400", Late: "text-orange-400" };

function Section({ label, children, copyText, copyKey, className }) {
  return (
    <div className={clsx("group", className)}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">{label}</p>
        {copyText && <CopyButton text={copyText} copyKey={copyKey} />}
      </div>
      {children}
    </div>
  );
}

function HookCard({ hook, index, isBest, bestHookLabel }) {
  const hookText  = typeof hook === "string" ? hook : hook.text;
  const hookLabel = typeof hook === "string" ? null : hook.label;
  const hookWhy   = typeof hook === "string" ? null : hook.why_it_works;
  return (
    <div className={clsx("group relative rounded-xl p-3.5 transition-all duration-200", isBest ? "bg-brand-500/10 border border-brand-500/30" : "bg-dark-700 border border-white/5 hover:border-white/10")}>
      {isBest && (
        <div className="flex items-center gap-1.5 mb-2">
          <Crown size={11} className="text-brand-400" fill="currentColor" />
          <span className="text-[10px] font-mono font-bold text-brand-400 uppercase tracking-widest">{bestHookLabel}</span>
        </div>
      )}
      <div className="flex gap-2.5">
        <span className="font-mono text-xs text-brand-500 font-bold flex-shrink-0 mt-0.5">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          {hookLabel && (
            <span className="inline-block text-[10px] font-mono text-white/30 bg-white/5 border border-white/8 rounded px-1.5 py-0.5 mb-1.5">
              {hookLabel}
            </span>
          )}
          <p className={clsx("text-sm font-body leading-relaxed", isBest ? "text-white font-medium" : "text-white/80")}>{hookText}</p>
          {hookWhy && <p className="text-xs text-white/30 font-body mt-1.5 leading-relaxed">{hookWhy}</p>}
        </div>
        <CopyButton text={hookText} copyKey={"hook-" + index} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </div>
    </div>
  );
}

function TitleCard({ title, index }) {
  return (
    <div className="group flex items-start gap-2 bg-dark-700 border border-white/5 rounded-xl p-3 hover:border-white/10 transition-all">
      <span className="font-mono text-xs text-brand-500 font-bold flex-shrink-0 mt-0.5">{String.fromCharCode(65 + index)}</span>
      <p className="text-sm text-white/80 font-body flex-1">{title}</p>
      <CopyButton text={title} copyKey={"title-" + index} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
    </div>
  );
}

function ScriptBlock({ text }) {
  return (
    <div className="group relative">
      <div className="bg-dark-700 border border-white/5 rounded-xl p-4 max-h-72 overflow-y-auto">
        <p className="text-sm text-white/75 font-body leading-loose whitespace-pre-wrap">{renderScriptWithMarkers(text)}</p>
      </div>
      <div className="absolute top-2 right-2">
        <CopyButton text={text} copyKey="full-script" label="Copy script" size="sm" />
      </div>
    </div>
  );
}

function PacingLegend() {
  const items = [
    { label: "[BEAT]",      color: "text-yellow-400" },
    { label: "[PAUSE]",     color: "text-orange-400" },
    { label: "[SLOW DOWN]", color: "text-blue-400"   },
    { label: "[SPEED UP]",  color: "text-green-400"  },
    { label: "ALL CAPS",    color: "text-white font-bold" },
    { label: "(quieter)",   color: "text-white/40 italic" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {items.map(({ label, color }) => (
        <span key={label} className={clsx("text-[10px] font-mono", color)}>{label}</span>
      ))}
    </div>
  );
}

function PatternInterruptCard({ interrupt, index }) {
  const typeKey = Object.keys(INTERRUPT_COLORS).find(k => interrupt.type?.toUpperCase().includes(k));
  const colors = INTERRUPT_COLORS[typeKey] || { bg: "bg-white/5", text: "text-white/40", border: "border-white/10" };
  const posColor = POSITION_COLORS[interrupt.position] || "text-white/30";
  return (
    <div className="bg-dark-700 border border-white/5 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-white/30 font-bold">{index + 1}</span>
        <span className={clsx("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", colors.bg, colors.text, colors.border)}>
          {interrupt.type}
        </span>
        <span className={clsx("text-[10px] font-mono ml-auto", posColor)}>@ {interrupt.position}</span>
      </div>
      <p className="text-xs text-white/50 font-body italic leading-relaxed pl-4">"{interrupt.text}"</p>
    </div>
  );
}

export function ScriptOutput({ script, article, onRegenerateHooks, hooksLoading, onSave }) {
  const { lang } = useLang();
  const tx = t[lang];

  const [saved, setSaved] = useState(
    storageService.isSaved(article?.title, script?.platform, script?.style)
  );

  if (!script) return null;

  const handleSave = () => { onSave?.(); setSaved(true); };

  const bestHookId = script.best_hook?.id || null;
  const hooks = (script.hooks || []).map(h =>
    typeof h === "string" ? { text: h, label: null, why_it_works: null, id: null } : h
  );
  const hooksAllText = hooks.map(h => h.text).join("\n\n");

  const fullExport = [
    "=== VIRAL SCRIPT ===",
    "Article: " + script.article_title,
    "Platform: " + script.platform + " | Style: " + script.style,
    "\n--- HOOKS ---",
    ...hooks.map((h, i) => {
      const best = bestHookId && h.id === bestHookId ? " BEST" : "";
      return (i + 1) + ". [" + (h.label || "") + "]" + best + "\n   " + h.text;
    }),
    "\n--- FULL SCRIPT ---", script.script,
    "\n--- TITLES ---", ...(script.titles || []).map((tt, i) => String.fromCharCode(65 + i) + ". " + tt),
    "\n--- CTA ---", script.cta,
    "\n--- HASHTAGS ---", formatHashtags(script.hashtags),
    script.thumbnail_idea ? "\n--- THUMBNAIL ---\n" + script.thumbnail_idea : "",
  ].filter(Boolean).join("\n");

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-white/40">{tx.scriptReady}</span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={fullExport} copyKey="export-all" label={tx.copyAll} size="sm" />
          <button onClick={handleSave} disabled={saved} className={clsx("btn-ghost", saved && "text-brand-400")}>
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            <span className="text-xs">{saved ? tx.saved2 : tx.save}</span>
          </button>
        </div>
      </div>

      <Section label={tx.hookVariations} copyText={hooksAllText} copyKey="all-hooks">
        {script.best_hook?.reason && (
          <div className="flex gap-2 bg-brand-500/5 border border-brand-500/15 rounded-xl p-3 mb-3">
            <Crown size={13} className="text-brand-400 flex-shrink-0 mt-0.5" fill="currentColor" />
            <p className="text-xs text-brand-300/80 font-body leading-relaxed">{script.best_hook.reason}</p>
          </div>
        )}
        <div className="space-y-2">
          {hooks.map((hook, i) => (
            <HookCard key={i} hook={hook} index={i} isBest={bestHookId ? hook.id === bestHookId : false} bestHookLabel={tx.bestHook} />
          ))}
        </div>
        <button onClick={onRegenerateHooks} disabled={hooksLoading} className="mt-3 btn-ghost text-xs">
          <RefreshCw size={12} className={hooksLoading ? "animate-spin" : ""} />
          {hooksLoading ? tx.regenerating : tx.regenerateHooks}
        </button>
      </Section>

      <Section label={tx.fullScript} copyKey="full-script-section">
        <ScriptBlock text={script.script} />
        <PacingLegend />
      </Section>

      {script.pattern_interrupt_moments?.length > 0 && (
        <Section label={tx.patternInterrupts}>
          <div className="space-y-2">
            {script.pattern_interrupt_moments.map((p, i) => (
              <PatternInterruptCard key={i} interrupt={p} index={i} />
            ))}
          </div>
        </Section>
      )}

      <Section label={tx.titleVariations} copyText={(script.titles || []).join("\n")} copyKey="all-titles">
        <div className="space-y-2">
          {(script.titles || []).map((title, i) => (
            <TitleCard key={i} title={title} index={i} />
          ))}
        </div>
      </Section>

      <Section label={tx.callToAction} copyText={script.cta} copyKey="cta">
        <div className="bg-dark-700 border border-brand-500/20 rounded-xl p-3 flex items-start gap-2">
          <MousePointerClick size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-brand-300 font-body">{script.cta}</p>
        </div>
      </Section>

      <Section label={tx.hashtags} copyText={formatHashtags(script.hashtags)} copyKey="hashtags">
        <div className="flex flex-wrap gap-1.5">
          {(script.hashtags || []).map((tag, i) => (
            <span key={i} className="tag font-mono">{tag.startsWith("#") ? tag : "#" + tag}</span>
          ))}
        </div>
      </Section>

      {script.thumbnail_idea && (
        <Section label={tx.thumbnailIdea} copyText={script.thumbnail_idea} copyKey="thumbnail">
          <div className="bg-dark-700 border border-white/5 rounded-xl p-3">
            <p className="text-sm text-white/50 font-body italic">{script.thumbnail_idea}</p>
          </div>
          <a
            href={"https://chat.openai.com/?q=" + encodeURIComponent("Gere uma thumbnail para YouTube com a seguinte descrição: " + script.thumbnail_idea)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-dark-700 text-xs font-mono text-white/50 hover:text-white/80 hover:border-white/20 transition-all duration-200"
          >
            Gerar thumbnail no ChatGPT →
          </a>
        </Section>
      )}

    </div>
  );
}
