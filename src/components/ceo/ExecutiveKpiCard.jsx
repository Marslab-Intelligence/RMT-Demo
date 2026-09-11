import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';

export default function ExecutiveKpiCard({
  title,
  value,
  subtitle,
  change,
  changeType = 'positive', // 'positive' | 'negative' | 'neutral'
  changePeriod = 'vs prior quarter',
  contextNote,
  icon: Icon,
  badge,
  badgeColor = 'emerald',
  onClick,
  isScore = false,
  scoreMax = 100,
  loading = false,
}) {
  const getTrendIcon = () => {
    if (changeType === 'positive') return <TrendingUp className="w-3.5 h-3.5" />;
    if (changeType === 'negative') return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  const getTrendColor = () => {
    if (changeType === 'positive') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40';
    if (changeType === 'negative') return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/40';
    return 'text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800/60 border-surface-200 dark:border-surface-700';
  };

  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-white/70 dark:bg-surface-900/60 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse min-h-[140px] flex flex-col justify-between">
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/2"></div>
        <div className="h-8 bg-surface-200 dark:bg-surface-800 rounded w-3/4 my-2"></div>
        <div className="h-3 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group relative p-5 rounded-2xl transition-all duration-300 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-brand-400/80 dark:hover:border-brand-500/50 hover:-translate-y-0.5' : ''
      } bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between`}
    >
      <div>
        {/* Header line: Title, Icon & Optional Badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-surface-100 dark:bg-surface-800/80 flex items-center justify-center text-surface-600 dark:text-surface-300">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <span className="text-[12.5px] font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              {title}
            </span>
          </div>
          {badge && (
            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${badgeColor === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50' : badgeColor === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50'}`}>
              {badge}
            </span>
          )}
          {onClick && (
            <ArrowUpRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Primary Metric Display */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white font-mono">
            {value}
          </span>
          {isScore && (
            <span className="text-sm font-semibold text-surface-400 dark:text-surface-500">
              / {scoreMax}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-surface-500 dark:text-surface-400 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Footer line: Delta trend indicator & context note */}
      <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/60 flex items-center justify-between gap-2 flex-wrap">
        {change !== undefined && change !== null && (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${getTrendColor()}`}>
              {getTrendIcon()}
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
            <span className="text-[11px] text-surface-400 dark:text-surface-500">
              {changePeriod}
            </span>
          </div>
        )}
        {contextNote && (
          <span className="text-[11px] text-surface-500 dark:text-surface-400 italic">
            {contextNote}
          </span>
        )}
      </div>
    </div>
  );
}
