import React from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const BAR_GRADIENTS = [
  'from-blue-600 to-indigo-500',
  'from-indigo-600 to-purple-500',
  'from-purple-600 to-pink-500',
  'from-cyan-600 to-blue-500',
  'from-emerald-600 to-teal-500',
  'from-slate-600 to-slate-500',
];

export default function BusinessUnitsRanking({
  departments = [],
  onViewAll,
  onSelectDepartment,
  className = '',
}) {
  const maxTotal = Math.max(...departments.map((d) => d.total || 0), 1);

  return (
    <div className={`p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0B1730]/80 backdrop-blur-xl shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-500 dark:text-blue-400" />
            Top Business Units
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Performance & renewal distribution across organizational divisions
          </p>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-blue-400 hover:text-brand-700 dark:hover:text-blue-300 transition-colors group cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {departments.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No department data available.
          </div>
        ) : (
          departments.slice(0, 5).map((dept, idx) => {
            const count = dept.total || 0;
            const pct = Math.min(100, Math.round((count / maxTotal) * 100));
            const gradient = BAR_GRADIENTS[idx % BAR_GRADIENTS.length];

            return (
              <div
                key={dept.department_id || idx}
                onClick={() => onSelectDepartment && onSelectDepartment(dept)}
                className={`group ${onSelectDepartment ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-blue-400 transition-colors">
                    {dept.department_name || dept.name || 'Division'}
                  </span>
                  <div className="flex items-center gap-3">
                    {dept.revenue ? (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {formatCurrency(dept.revenue)}
                      </span>
                    ) : null}
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {count}
                    </span>
                  </div>
                </div>

                {/* Progress Bar with Pill Style matching Reference */}
                <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-white/5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 shadow-sm`}
                    style={{ width: `${Math.max(8, pct)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
