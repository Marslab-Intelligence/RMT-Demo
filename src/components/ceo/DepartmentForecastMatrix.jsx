import React from 'react';
import { useCeo } from '../../context/CeoContext';
import { TrendingUp, TrendingDown, Minus, Building2, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DepartmentForecastMatrix({ departmentForecasts = [], loading = false }) {
  const { openDrawer } = useCeo();

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse min-h-[220px] flex items-center justify-center">
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Department Performance & Forecast Matrix
            </h3>
          </div>
          <p className="text-[11.5px] text-surface-400 mt-0.5">
            Quarter-over-quarter health trajectories, risk exposure, and forward projections
          </p>
        </div>

        <span className="text-xs font-semibold text-surface-400">
          Click row for executive drill-down
        </span>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-surface-200/70 dark:border-surface-800/70 text-[11px] font-bold text-surface-400 uppercase tracking-wider">
              <th className="py-3 px-3">Department</th>
              <th className="py-3 px-3">Current Health</th>
              <th className="py-3 px-3 text-center">Trend</th>
              <th className="py-3 px-3">Projected Health</th>
              <th className="py-3 px-3">Risk Tier</th>
              <th className="py-3 px-3">Confidence</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200/60 dark:divide-surface-800/60 font-medium">
            {departmentForecasts.map((d) => {
              const isImproving = d.trend === 'Improving';
              const isDeclining = d.trend === 'Declining';

              return (
                <tr
                  key={d.departmentId}
                  onClick={() => openDrawer('department', d.departmentId, d.departmentName)}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-3">
                    <span className="font-bold text-surface-900 dark:text-white group-hover:text-brand-500 transition-colors">
                      {d.departmentName}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-mono font-bold text-surface-900 dark:text-white">
                      {d.currentHealth}
                    </span>
                    <span className="text-surface-400 font-normal"> / 100</span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      {isImproving ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : isDeclining ? (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                      ) : (
                        <Minus className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                      <span
                        className={`text-[11px] font-bold ${
                          isImproving ? 'text-emerald-600 dark:text-emerald-400' : isDeclining ? 'text-rose-600 dark:text-rose-400' : 'text-surface-500'
                        }`}
                      >
                        {d.trend}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {d.forecastedHealth}
                    </span>
                    <span className="text-surface-400 font-normal"> / 100</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                        d.riskLevel === 'Low'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : d.riskLevel === 'High'
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}
                    >
                      {d.riskLevel} Risk
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="text-surface-500 font-semibold">{d.confidence}</span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
