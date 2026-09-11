import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useCeo } from '../../context/CeoContext';

/**
 * Standard Executive Page Header for all CEO views.
 * Provides:
 * - Prominent, context-aware in-app Back navigation (e.g. "← Back to Executive Overview")
 * - Compact, non-intrusive breadcrumb trail
 * - Clear Page Title & Executive Subtitle
 * - Analysis Period & Comparison Context
 * - Subtle Data Freshness indicator
 * - Optional custom right-hand action controls
 */
export default function ExecutivePageHeader({
  title,
  subtitle,
  backTo = '/ceo/dashboard',
  backLabel = 'Back to Executive Overview',
  breadcrumbs = [],
  actions = null,
  showPeriodBadge = true,
  comparisonText = null,
}) {
  const navigate = useNavigate();
  const { selectedPeriod } = useCeo();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="pb-3 border-b border-surface-200/80 dark:border-surface-800/80">
      {/* Main Title & Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-surface-950 dark:text-white truncate">
              {title}
            </h1>
            {showPeriodBadge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                <Calendar className="w-3 h-3 text-brand-500" />
                <span>{selectedPeriod}</span>
              </span>
            )}
            {comparisonText && (
              <span className="hidden md:inline text-xs font-medium text-surface-400">
                ({comparisonText})
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-1 leading-relaxed max-w-4xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right-Aligned Small Back Button & Action Controls */}
        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
          {actions}
          {backTo && (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-bold bg-white/90 dark:bg-surface-800/90 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-200/80 dark:border-surface-700/80 shadow-xs transition-all cursor-pointer group shrink-0"
              title={`Return to ${backLabel}`}
            >
              <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
              <span>{backLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
