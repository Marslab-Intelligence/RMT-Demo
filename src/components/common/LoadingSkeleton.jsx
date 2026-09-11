import React from 'react';

/**
 * Standard Loading Skeleton Components for high visual stability during async data loads.
 */
export function CardSkeleton({ count = 1, height = 'h-32' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} rounded-2xl bg-surface-100/80 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-800/60 animate-pulse p-5 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between">
            <div className="w-24 h-3 rounded-full bg-surface-200 dark:bg-surface-700" />
            <div className="w-6 h-6 rounded-lg bg-surface-200 dark:bg-surface-700" />
          </div>
          <div className="w-32 h-7 rounded-lg bg-surface-200 dark:bg-surface-700" />
          <div className="w-20 h-2.5 rounded-full bg-surface-200 dark:bg-surface-700" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="rounded-2xl border border-surface-200/80 dark:border-surface-800/80 bg-white/70 dark:bg-surface-900/60 overflow-hidden shadow-xs animate-pulse">
      <div className="h-12 bg-surface-100/90 dark:bg-surface-800/60 border-b border-surface-200/80 dark:border-surface-800/80 flex items-center px-6 gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 h-3 rounded-full bg-surface-200 dark:bg-surface-700" />
        ))}
      </div>
      <div className="divide-y divide-surface-200/60 dark:divide-surface-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-14 px-6 flex items-center gap-6">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="flex-1 h-3 rounded-full bg-surface-200/70 dark:bg-surface-800" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default { CardSkeleton, TableSkeleton };
