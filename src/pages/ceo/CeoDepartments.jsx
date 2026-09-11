import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Server,
  Package,
  Store,
  ChevronRight,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';

export default function CeoDepartments() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/ceo/departments?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDepartments(Array.isArray(data) ? data : (data.departments || [])))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  // Sort departments by health score
  const sortedDepts = [...departments].sort((a, b) => b.healthScore - a.healthScore);
  const topDept = sortedDepts[0];
  const attentionDept = sortedDepts[sortedDepts.length - 1];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Department Performance & Intelligence"
        subtitle="Comparative performance, operational health indices, renewal execution, and risk exposure by operating division"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Departments']}
      />

      {/* Top Performer vs Attention Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topDept && (
          <div
            onClick={() => openDrawer('department', topDept.id, topDept.name)}
            className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 shadow-sm cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Top Performing Department
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                Health Score: {topDept.healthScore}/100
              </span>
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-emerald-600 transition-colors">
              {topDept.name}
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">
              Delivering {formatCurrency(topDept.revenue)} across {topDept.activeCount} active contracts with {topDept.marginPct}% margin.
            </p>
          </div>
        )}

        {attentionDept && sortedDepts.length > 1 && (
          <div
            onClick={() => openDrawer('department', attentionDept.id, attentionDept.name)}
            className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 shadow-sm cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Department Requiring Attention
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                Health Score: {attentionDept.healthScore}/100
              </span>
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-amber-600 transition-colors">
              {attentionDept.name}
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">
              Has {attentionDept.overdueCount || 0} overdue renewals with {attentionDept.riskLevel} risk index.
            </p>
          </div>
        )}
      </div>

      {/* Visual Ranking of All Departments */}
      <div className="space-y-4">
        {sortedDepts.map((dept, index) => (
          <div
            key={dept.id}
            onClick={() => openDrawer('department', dept.id, dept.name)}
            className="p-5 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm hover:border-brand-400 dark:hover:border-brand-500/50 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left Column: Department Identity & Rank */}
              <div className="flex items-center gap-4 min-w-[240px]">
                <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center font-mono font-black text-sm text-surface-500 group-hover:text-brand-500 group-hover:bg-brand-50 dark:group-hover:bg-brand-950/40 transition-colors">
                  #{index + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-surface-950 dark:text-white group-hover:text-brand-500 transition-colors">
                      {dept.name}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        dept.riskLevel === 'Low'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : dept.riskLevel === 'High'
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}
                    >
                      {dept.riskLevel} Risk
                    </span>
                  </div>
                  <span className="text-xs text-surface-400">
                    {dept.serviceCount || 0} service categories • {dept.userCount || 0} specialists
                  </span>
                </div>
              </div>

              {/* Middle Column: Visual Health Progress Bar */}
              <div className="flex-1 max-w-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-surface-500">Department Health</span>
                  <span className="font-mono font-bold text-surface-900 dark:text-white">
                    {dept.healthScore} / 100
                  </span>
                </div>
                <div className="w-full bg-surface-100 dark:bg-surface-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${dept.healthScore}%`,
                      backgroundColor: dept.healthScore >= 80 ? '#10b981' : dept.healthScore >= 65 ? '#a559a5' : '#f59e0b',
                    }}
                  />
                </div>
              </div>

              {/* Right Column: Key Metrics & Drill-Down Trigger */}
              <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-surface-100 dark:border-surface-800">
                <div className="text-right">
                  <span className="text-[11px] text-surface-400 uppercase font-semibold block">Revenue</span>
                  <span className="text-xs font-mono font-bold text-surface-900 dark:text-white">
                    {formatCurrency(dept.revenue)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-surface-400 uppercase font-semibold block">Margin</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {dept.marginPct}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-surface-400 uppercase font-semibold block">Active</span>
                  <span className="text-xs font-mono font-bold text-surface-800 dark:text-surface-200">
                    {dept.activeCount}
                  </span>
                </div>
                <div className="pl-2">
                  <button className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-400 group-hover:text-white group-hover:bg-brand-600 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
