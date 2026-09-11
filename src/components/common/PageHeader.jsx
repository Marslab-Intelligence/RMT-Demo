import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Standard Page Header for all operational views (Super Admin, Admin, User).
 * Provides:
 * - Prominent in-app Back button (e.g. "← Back to Dashboard")
 * - Title and descriptive subtitle
 * - Contextual badges (Role, Department, Scope)
 * - Optional custom right-hand action controls
 */
export default function PageHeader({
  title,
  subtitle,
  description,
  backTo = null,
  backLabel = 'Back',
  breadcrumbs = [],
  badge = null,
  badgeColor = 'brand',
  actions = null,
  updatedAt = null,
  className = '',
}) {
  const navigate = useNavigate();

  const effectiveSubtitle = subtitle || description;

  const handleBack = () => {
    if (typeof backTo === 'string') {
      navigate(backTo);
    } else if (typeof backTo === 'function') {
      backTo();
    } else {
      navigate(-1);
    }
  };

  const getBadgeStyle = (color) => {
    switch (color) {
      case 'rose':
      case 'red':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'emerald':
      case 'green':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'indigo':
        return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800';
    }
  };

  return (
    <div className={`space-y-2.5 pb-2.5 border-b border-surface-200/80 dark:border-surface-800/80 ${className}`}>
      {/* Main Row: Title, Subtitle, Context Badge, Actions & Small Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-surface-950 dark:text-white">
              {title}
            </h1>
            {badge && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${getBadgeStyle(badgeColor)}`}>
                {badge}
              </span>
            )}
          </div>
          {effectiveSubtitle && (
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-1 max-w-3xl leading-relaxed">
              {effectiveSubtitle}
            </p>
          )}
        </div>

        {/* Right side: Actions & Small Back Button */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {actions}
          {backTo && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-bold bg-white/90 dark:bg-surface-800/90 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-200/80 dark:border-surface-700/80 shadow-xs transition-all cursor-pointer group shrink-0"
              title={`Return to ${backLabel}`}
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              <span>{backLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
