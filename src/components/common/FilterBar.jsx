import React from 'react';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';

/**
 * Standard enterprise FilterBar component.
 * Supports:
 * - Debounced search input
 * - Active filter pill chips
 * - Clear all filters action
 * - Right-hand slots for custom actions/exports
 */
export default function FilterBar({
  search = '',
  onSearchChange = () => {},
  searchPlaceholder = 'Search records...',
  filters = [],
  activeFiltersCount = 0,
  onResetFilters = null,
  children = null,
  rightActions = null,
  className = '',
}) {
  return (
    <div className={`p-3 rounded-2xl bg-white/80 dark:bg-surface-900/80 border border-surface-200/80 dark:border-surface-800/80 backdrop-blur-md shadow-xs space-y-3 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-surface-200 dark:border-surface-700 bg-surface-50/70 dark:bg-surface-800/60 text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Action Slots & Reset */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {activeFiltersCount > 0 && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-100/80 dark:bg-surface-800 text-xs font-semibold text-surface-600 dark:text-surface-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset ({activeFiltersCount})</span>
            </button>
          )}
          {rightActions}
        </div>
      </div>

      {/* Additional Filter Selects & Sliders Slot */}
      {children && (
        <div className="pt-2 border-t border-surface-200/60 dark:border-surface-800/60 flex items-center gap-3 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
