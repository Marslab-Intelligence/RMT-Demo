import React from 'react';
import { Maximize2 } from 'lucide-react';

const COLOR_VARIANTS = {
  emerald: {
    border: 'border-emerald-400/40 dark:border-emerald-500/30 hover:border-emerald-500/70',
    bg: 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900/60',
    iconBg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border-emerald-500/40',
    shadow: 'hover:shadow-emerald-500/15',
    accent: 'text-emerald-600 dark:text-emerald-400'
  },
  blue: {
    border: 'border-blue-400/40 dark:border-blue-500/30 hover:border-blue-500/70',
    bg: 'bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-500/5 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/60',
    iconBg: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-950 dark:text-blue-200 border-blue-500/40',
    shadow: 'hover:shadow-blue-500/15',
    accent: 'text-blue-600 dark:text-blue-400'
  },
  amber: {
    border: 'border-amber-400/40 dark:border-amber-500/30 hover:border-amber-500/70',
    bg: 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-slate-900/60',
    iconBg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-500/40',
    shadow: 'hover:shadow-amber-500/15',
    accent: 'text-amber-600 dark:text-amber-400'
  },
  rose: {
    border: 'border-rose-400/40 dark:border-rose-500/30 hover:border-rose-500/70',
    bg: 'bg-gradient-to-br from-rose-500/15 via-red-500/10 to-rose-500/5 dark:from-rose-950/40 dark:via-red-950/30 dark:to-slate-900/60',
    iconBg: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-950 dark:text-rose-200 border-rose-500/40',
    shadow: 'hover:shadow-rose-500/15',
    accent: 'text-rose-600 dark:text-rose-400'
  },
  purple: {
    border: 'border-purple-400/40 dark:border-purple-500/30 hover:border-purple-500/70',
    bg: 'bg-gradient-to-br from-purple-500/15 via-fuchsia-500/10 to-purple-500/5 dark:from-purple-950/40 dark:via-fuchsia-950/30 dark:to-slate-900/60',
    iconBg: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-950 dark:text-purple-200 border-purple-500/40',
    shadow: 'hover:shadow-purple-500/15',
    accent: 'text-purple-600 dark:text-purple-400'
  },
  cyan: {
    border: 'border-cyan-400/40 dark:border-cyan-500/30 hover:border-cyan-500/70',
    bg: 'bg-gradient-to-br from-cyan-500/15 via-teal-500/10 to-cyan-500/5 dark:from-cyan-950/40 dark:via-teal-950/30 dark:to-slate-900/60',
    iconBg: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-950 dark:text-cyan-200 border-cyan-500/40',
    shadow: 'hover:shadow-cyan-500/15',
    accent: 'text-cyan-600 dark:text-cyan-400'
  },
  teal: {
    border: 'border-teal-400/40 dark:border-teal-500/30 hover:border-teal-500/70',
    bg: 'bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-teal-500/5 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-slate-900/60',
    iconBg: 'bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30',
    badge: 'bg-teal-500/20 text-teal-950 dark:text-teal-200 border-teal-500/40',
    shadow: 'hover:shadow-teal-500/15',
    accent: 'text-teal-600 dark:text-teal-400'
  },
  fuchsia: {
    border: 'border-fuchsia-400/40 dark:border-fuchsia-500/30 hover:border-fuchsia-500/70',
    bg: 'bg-gradient-to-br from-fuchsia-500/15 via-pink-500/10 to-fuchsia-500/5 dark:from-fuchsia-950/40 dark:via-pink-950/30 dark:to-slate-900/60',
    iconBg: 'bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
    badge: 'bg-fuchsia-500/20 text-fuchsia-950 dark:text-fuchsia-200 border-fuchsia-500/40',
    shadow: 'hover:shadow-fuchsia-500/15',
    accent: 'text-fuchsia-600 dark:text-fuchsia-400'
  }
};

export default function MetricCard({
  title,
  value,
  subtext,
  badgeText,
  icon: Icon,
  color = 'blue',
  onClick,
  onExpand,
  className = ''
}) {
  const theme = COLOR_VARIANTS[color] || COLOR_VARIANTS.blue;

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 flex items-center gap-3.5 shadow-lg shadow-black/5 hover:-translate-y-1 hover:shadow-xl ${theme.border} ${theme.bg} ${theme.shadow} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Top glossy edge line */}
      <div className="pointer-events-none absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent" />

      {Icon && (
        <div className={`p-3 rounded-xl border flex-shrink-0 backdrop-blur-md transition-transform duration-300 group-hover:scale-105 ${theme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 truncate">
            {title}
          </p>
          {badgeText && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border backdrop-blur-md truncate ${theme.badge}`}>
              {badgeText}
            </span>
          )}
        </div>
        <p className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-none tracking-tight">
          {value}
        </p>
        {subtext && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>

      {(onExpand || onClick) && (
        <Maximize2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2" />
      )}
    </div>
  );
}
