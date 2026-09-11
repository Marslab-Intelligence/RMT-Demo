import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';

/**
 * Standard enterprise DataTable component.
 * Features:
 * - Sortable columns with visual direction arrows
 * - Clean alternating hover states
 * - Sticky header with backdrop-blur
 * - Pagination bar with total item count and page jumps
 * - Built-in EmptyState fallback
 */
export default function DataTable({
  columns = [],
  data = [],
  sortKey = '',
  sortOrder = 'asc',
  onSort = null,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no entries matching the current filter criteria.',
  emptyIcon = null,
  loading = false,
  pagination = null,
  className = '',
}) {
  const handleSort = (key) => {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'asc');
    }
  };

  return (
    <div className={`rounded-2xl border border-surface-200/80 dark:border-surface-800/80 bg-white/80 dark:bg-surface-900/80 overflow-hidden shadow-xs backdrop-blur-md ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          {/* Header Row */}
          <thead>
            <tr className="border-b border-surface-200/80 dark:border-surface-800/80 bg-surface-50/90 dark:bg-surface-800/60 backdrop-blur-md">
              {columns.map((col) => {
                const isSortable = col.sortable !== false && onSort;
                const isCurrentSort = sortKey === col.key;

                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => isSortable && handleSort(col.key)}
                    className={`py-3.5 px-4 font-bold text-surface-700 dark:text-surface-300 select-none ${
                      isSortable ? 'cursor-pointer hover:text-surface-950 dark:hover:text-white' : ''
                    } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${
                      col.headerClassName || ''
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${
                      col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                    }`}>
                      <span>{col.label}</span>
                      {isSortable && (
                        <span className="text-surface-400">
                          {isCurrentSort ? (
                            sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" /> : <ChevronDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-surface-200/60 dark:divide-surface-800/60">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    icon={emptyIcon}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-surface-50/80 dark:hover:bg-surface-800/40 transition-colors group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 text-surface-800 dark:text-surface-200 font-medium ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      } ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="p-3 border-t border-surface-200/80 dark:border-surface-800/80 bg-surface-50/60 dark:bg-surface-800/30 flex items-center justify-between gap-3 text-xs text-surface-500">
          <div>
            Showing <span className="font-bold text-surface-900 dark:text-white">{pagination.from || 1}</span> to{' '}
            <span className="font-bold text-surface-900 dark:text-white">{pagination.to || data.length}</span> of{' '}
            <span className="font-bold text-surface-900 dark:text-white">{pagination.total || data.length}</span> entries
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 disabled:opacity-40 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-surface-800 dark:text-surface-200">
              Page {pagination.currentPage} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 disabled:opacity-40 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
