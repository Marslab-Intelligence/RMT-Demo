import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import PerformanceVisualizer from '../../components/ceo/PerformanceVisualizer';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Building2,
  Package,
  Server,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Percent,
  Sparkles,
  Search,
  SlidersHorizontal,
  Wallet,
  ArrowDownRight,
  CheckCircle2,
  Layers
} from 'lucide-react';

export default function CeoCompanyPerformance() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('revenue'); // 'revenue' | 'profit' | 'margin' | 'health'

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const periodParam = `?period=${encodeURIComponent(selectedPeriod)}`;

    Promise.all([
      fetch(`/api/ceo/overview${periodParam}`, { headers }),
      fetch(`/api/ceo/departments${periodParam}`, { headers }),
    ])
      .then(async ([ovRes, deptRes]) => {
        if (ovRes.ok) setOverview(await ovRes.json());
        if (deptRes.ok) {
          const d = await deptRes.json();
          setDepartments(Array.isArray(d) ? d : (d.departments || []));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const kpis = overview?.kpis || {};
  const revenue = kpis.revenue?.value || 0;
  const profit = kpis.profit?.value || 0;
  const cost = Math.max(0, revenue - profit);
  const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const costPct = revenue > 0 ? Math.round((cost / revenue) * 100) : 0;

  // Department insights computation
  const insights = useMemo(() => {
    if (!departments || departments.length === 0) return null;
    const sortedByRev = [...departments].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    const sortedByMargin = [...departments].sort((a, b) => (b.marginPct || 0) - (a.marginPct || 0));
    const sortedByCost = [...departments].sort((a, b) => 
      Math.max(0, (b.revenue || 0) - (b.profit || 0)) - Math.max(0, (a.revenue || 0) - (a.profit || 0))
    );

    const topRev = sortedByRev[0];
    const topMargin = sortedByMargin[0];
    const topCost = sortedByCost[0];

    const revShare = revenue > 0 && topRev ? Math.round((topRev.revenue / revenue) * 100) : 0;
    const costShare = cost > 0 && topCost ? Math.round((Math.max(0, topCost.revenue - topCost.profit) / cost) * 100) : 0;

    return {
      topRev: { ...topRev, revShare },
      topMargin,
      topCost: { ...topCost, costShare }
    };
  }, [departments, revenue, cost]);

  // Filter & sort matrix records
  const filteredDepartments = useMemo(() => {
    let list = departments.map((d) => {
      const rev = Number(d.revenue) || 0;
      const prof = Number(d.profit) || 0;
      const deptCost = Math.max(0, rev - prof);
      const profitShare = profit > 0 ? Math.round((prof / profit) * 100) : 0;
      return {
        ...d,
        revenue: rev,
        profit: prof,
        cost: deptCost,
        profitShare,
      };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) => d.name?.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'profit') return b.profit - a.profit;
      if (sortBy === 'margin') return b.marginPct - a.marginPct;
      if (sortBy === 'health') return b.healthScore - a.healthScore;
      return b.revenue - a.revenue;
    });

    return list;
  }, [departments, searchQuery, sortBy, profit]);

  const getDepartmentTierBadge = (marginPct, revShare) => {
    if (marginPct >= 25 && revShare >= 30) {
      return { label: 'Prime Engine', bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    }
    if (marginPct >= 25) {
      return { label: 'High Margin', bg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' };
    }
    if (revShare >= 40) {
      return { label: 'Volume Core', bg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
    }
    if (marginPct < 15) {
      return { label: 'Cost Heavy', bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' };
    }
    return { label: 'Standard', bg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Company Performance & Financial Architecture"
        subtitle="Executive analysis of total contract run-rate, purchase cost obligations, and operating margins across departments"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Performance']}
      />

      {/* ── Top Financial Executive Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveKpiCard
          title="Portfolio Revenue"
          value={formatCurrency(revenue)}
          change={kpis.revenue?.deltaPct}
          changeType={kpis.revenue?.deltaPct >= 0 ? 'positive' : 'negative'}
          changePeriod="vs prior period"
          contextNote={`${departments.length} reporting divisions`}
          icon={DollarSign}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Operating Gross Profit"
          value={formatCurrency(profit)}
          change={kpis.profit?.deltaPct}
          changeType={kpis.profit?.deltaPct >= 0 ? 'positive' : 'negative'}
          changePeriod="vs prior period"
          contextNote={`${marginPct}% operating retention`}
          icon={TrendingUp}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Vendor Sourcing Cost"
          value={formatCurrency(cost)}
          changeType="neutral"
          contextNote={`${costPct}% direct supplier outlay`}
          icon={PieChart}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Blended Gross Margin"
          value={`${marginPct}%`}
          changeType={marginPct >= 20 ? 'positive' : 'negative'}
          badge={marginPct >= 25 ? 'High Margin' : 'Standard Yield'}
          badgeColor={marginPct >= 20 ? 'emerald' : 'amber'}
          contextNote="Corporate target ≥ 20%"
          icon={Percent}
          loading={loading}
        />
      </div>

      {/* ── Executive Financial Insights Bar (Light & Dark Theme Adaptive) ── */}
      {insights && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-brand-50/90 via-surface-50/80 to-white dark:from-brand-950/40 dark:via-surface-900/60 dark:to-surface-900/40 border border-brand-200/80 dark:border-brand-500/25 backdrop-blur-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 dark:bg-brand-500/15 border border-brand-500/25 dark:border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                  Portfolio Architecture Analysis
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-xs text-surface-700 dark:text-surface-300 mt-1 leading-relaxed">
                <strong className="text-surface-950 dark:text-white font-bold">{insights.topRev?.name || 'Primary Unit'}</strong> anchors the portfolio driving <strong className="text-brand-600 dark:text-brand-300 font-bold">{insights.topRev?.revShare}%</strong> of overall volume. Meanwhile, <strong className="text-surface-950 dark:text-white font-bold">{insights.topMargin?.name}</strong> delivers peak margin efficiency at <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{insights.topMargin?.marginPct}%</strong>.
              </p>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-surface-200/90 dark:border-white/10 text-xs font-mono shadow-2xs">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 block font-sans font-medium">Retained Yield</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{marginPct}% Net</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-surface-200/90 dark:border-white/10 text-xs font-mono shadow-2xs">
              <span className="text-[10px] text-surface-500 dark:text-surface-400 block font-sans font-medium">Cost Outlay</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{costPct}% Pass-through</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Bespoke Financial Visualizer (Replaces basic bar chart) ── */}
      <PerformanceVisualizer
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        onSelectDepartment={(id) => setSelectedDepartmentId(selectedDepartmentId === id ? null : id)}
        loading={loading}
      />

      {/* ── Comparative Department Financial Matrix ── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-surface-950 dark:text-white">
              Departmental Financial Contribution Matrix
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              Granular breakdown of contract volume, procurement outlay, net profit yield, and operational health
            </p>
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200/80 dark:border-surface-700 text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Sort Segmented Pills */}
            <div className="inline-flex items-center p-1 rounded-xl bg-surface-100 dark:bg-surface-800/90 border border-surface-200/80 dark:border-surface-700/80 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setSortBy('revenue')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  sortBy === 'revenue'
                    ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setSortBy('profit')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  sortBy === 'profit'
                    ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                Profit
              </button>
              <button
                type="button"
                onClick={() => setSortBy('margin')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  sortBy === 'margin'
                    ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                Margin
              </button>
              <button
                type="button"
                onClick={() => setSortBy('health')}
                className={`px-2 py-1 rounded-lg transition-all ${
                  sortBy === 'health'
                    ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-2xs'
                    : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                }`}
              >
                Health
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold text-[11px]">
                <th className="pb-3 pl-2">Department</th>
                <th className="pb-3">Strategic Role</th>
                <th className="pb-3 text-right">Contracts</th>
                <th className="pb-3 text-right">Revenue</th>
                <th className="pb-3 text-right">Sourcing Cost</th>
                <th className="pb-3 text-right">Gross Profit</th>
                <th className="pb-3 text-right">Margin Efficiency</th>
                <th className="pb-3 text-right">Profit Share</th>
                <th className="pb-3 text-right">Health Score</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {filteredDepartments.map((dept) => {
                const revShare = revenue > 0 ? Math.round((dept.revenue / revenue) * 100) : 0;
                const tier = getDepartmentTierBadge(dept.marginPct, revShare);
                const isSelected = selectedDepartmentId === dept.id;

                return (
                  <tr
                    key={dept.id}
                    onClick={() => setSelectedDepartmentId(isSelected ? null : dept.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50/40 dark:bg-brand-950/40 border-l-2 border-brand-500'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                    }`}
                  >
                    {/* Department Name & Icon */}
                    <td className="py-3.5 pl-2 font-bold text-surface-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-brand-500 flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">{dept.name}</span>
                      </div>
                    </td>

                    {/* Strategic Tier Badge */}
                    <td className="py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${tier.bg}`}>
                        {tier.label}
                      </span>
                    </td>

                    {/* Contracts Count */}
                    <td className="py-3.5 text-right font-mono text-surface-600 dark:text-surface-300">
                      {dept.activeCount}
                    </td>

                    {/* Revenue */}
                    <td className="py-3.5 text-right font-mono font-bold text-surface-900 dark:text-white">
                      {formatCurrency(dept.revenue)}
                    </td>

                    {/* Sourcing Cost */}
                    <td className="py-3.5 text-right font-mono text-rose-500 dark:text-rose-400">
                      {formatCurrency(dept.cost)}
                    </td>

                    {/* Gross Profit */}
                    <td className="py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(dept.profit)}
                    </td>

                    {/* Margin with Progress Bar */}
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 sm:w-20 bg-surface-200 dark:bg-surface-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${
                              dept.marginPct >= 25
                                ? 'bg-emerald-500'
                                : dept.marginPct >= 18
                                ? 'bg-brand-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, dept.marginPct))}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-surface-800 dark:text-surface-200 min-w-[36px]">
                          {dept.marginPct}%
                        </span>
                      </div>
                    </td>

                    {/* Profit Contribution Share */}
                    <td className="py-3.5 text-right font-mono font-semibold text-brand-600 dark:text-brand-300">
                      {dept.profitShare}%
                    </td>

                    {/* Health Score */}
                    <td className="py-3.5 text-right">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          dept.healthScore >= 80
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : dept.healthScore >= 60
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {dept.healthScore} / 100
                      </span>
                    </td>

                    {/* Drawer Drill Down Action */}
                    <td className="py-3.5 text-right pr-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDrawer('department', dept.id, dept.name);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors p-1"
                        title={`Inspect ${dept.name} details`}
                      >
                        <span>Drill down</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredDepartments.length === 0 && (
            <div className="py-12 text-center text-xs text-surface-500 dark:text-surface-400">
              No departments match the filter "{searchQuery}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
