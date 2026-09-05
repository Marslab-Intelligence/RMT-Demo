import React from 'react';

export default function EmptyState({
  icon: Icon,
  title = 'No data found',
  description = 'There are no records to display at this time.',
  action = null,
  className = '',
  compact = false
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'p-6' : 'p-10 sm:p-14'} ${className}`}>
      {Icon && (
        <div className="p-3.5 rounded-2xl bg-brand-500/10 dark:bg-white/5 text-brand-600 dark:text-brand-400 border border-brand-500/20 dark:border-white/10 mb-3 shadow-sm">
          <Icon className="w-6 h-6 opacity-80" />
        </div>
      )}
      <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed font-medium">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
