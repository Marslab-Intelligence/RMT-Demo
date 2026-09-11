import React, { useState, useMemo } from 'react';
import {
  Layers,
  BarChart3,
  TrendingUp,
  Percent,
  Sparkles,
  DollarSign,
  Building2,
  PieChart,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

export default function PerformanceVisualizer({
  departments = [],
  onSelectDepartment,
  selectedDepartmentId,
  loading = false,
}) {
  const [viewMode, setViewMode] = useState('composition'); // 'composition' | 'pillars' | 'efficiency'
  const [hoveredDept, setHoveredDept] = useState(null);

  // Compute overall portfolio totals
  const portfolioSummary = useMemo(() => {
    const totalRev = departments.reduce((acc, d) => acc + (d.revenue || 0), 0);
    const totalProfit = departments.reduce((acc, d) => acc + (d.profit || 0), 0);
    const totalCost = Math.max(0, totalRev - totalProfit);
    const avgMargin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : 0;
    return { totalRev, totalProfit, totalCost, avgMargin };
  }, [departments]);

  // Chart data format
  const chartData = useMemo(() => {
    return departments.map((d) => {
      const rev = Number(d.revenue) || 0;
      const profit = Number(d.profit) || 0;
      const cost = Math.max(0, rev - profit);
      const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      const profitShare = portfolioSummary.totalProfit > 0 ? ((profit / portfolioSummary.totalProfit) * 100).toFixed(1) : 0;

      return {
        id: d.id,
        name: d.name,
        revenue: rev,
        profit: profit,
        cost: cost,
        margin: margin,
        profitShare: Number(profitShare),
        activeCount: d.activeCount || 0,
        healthScore: d.healthScore || 0,
      };
    });
  }, [departments, portfolioSummary.totalProfit]);

  // Custom Glassmorphism Tooltip with zero white cursor glitch
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const revShare = portfolioSummary.totalRev > 0 
      ? ((data.revenue / portfolioSummary.totalRev) * 100).toFixed(1)
      : 0;

    return (
      <div className="p-4 rounded-2xl bg-slate-950/95 dark:bg-[#0b111e]/95 backdrop-blur-2xl border border-white/15 text-white shadow-2xl min-w-[240px] text-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-100">
            <Building2 className="w-3.5 h-3.5 text-brand-400" />
            <span>{data.name}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
            {data.margin}% Margin
          </span>
        </div>

        <div className="space-y-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" /> Total Revenue:
            </span>
            <span className="font-bold text-slate-100">{formatCurrency(data.revenue)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Net Gross Profit:
            </span>
            <span className="font-bold text-emerald-400">{formatCurrency(data.profit)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Sourcing Cost:
            </span>
            <span className="font-bold text-rose-300">{formatCurrency(data.cost)}</span>
          </div>
        </div>

        {/* Portfolio Contribution Footnote */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10.5px] text-slate-400">
          <span>Portfolio Volume Share</span>
          <span className="font-bold text-slate-200">{revShare}%</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm animate-pulse h-96 flex flex-col justify-between">
        <div className="h-5 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
        <div className="h-56 bg-surface-200 dark:bg-surface-800/60 rounded-xl my-4"></div>
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/4"></div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-5">
      {/* ── Visualizer Header & Segmented Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-surface-200/60 dark:border-surface-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-surface-950 dark:text-white tracking-tight">
              Financial Architecture & Cost Structure
            </h3>
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/20">
              Interactive
            </span>
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
            Decomposed view of client contract revenue vs supplier pass-through costs and retained profit margins
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-surface-100 dark:bg-surface-800/90 border border-surface-200/80 dark:border-surface-700/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('composition')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'composition'
                ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Cashflow Layer</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pillars')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'pillars'
                ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Comparative Pillars</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('efficiency')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'efficiency'
                ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-300 shadow-xs'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Margin Yield</span>
          </button>
        </div>
      </div>

      {/* ── View 1: Cashflow Layer (Stacked Composition with Margin Badges) ── */}
      {viewMode === 'composition' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 text-brand-500" />
              Each column stacks <strong>Sourcing Cost</strong> (rose) and <strong>Net Profit</strong> (emerald) to sum to <strong>Total Revenue</strong>
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-semibold text-[11.5px]">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80" />
                <span>Supplier Cost</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[11.5px]">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Gross Profit</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 25, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    onSelectDepartment?.(e.activePayload[0].payload.id);
                  }
                }}
              >
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#be123c" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-surface-200 dark:text-surface-800/60"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-surface-600 dark:text-surface-400 font-medium"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  className="text-surface-600 dark:text-surface-400 font-mono"
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                />
                {/* Stacked Bars */}
                <Bar
                  dataKey="cost"
                  stackId="flow"
                  fill="url(#costGrad)"
                  name="Sourcing Cost"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="profit"
                  stackId="flow"
                  fill="url(#profitGrad)"
                  name="Operating Profit"
                  radius={[6, 6, 0, 0]}
                  label={({ x, y, width, index }) => {
                    const item = chartData[index];
                    if (!item) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={Math.max(12, y - 8)}
                        fill="#34d399"
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="bold"
                        className="font-mono"
                      >
                        {item.margin}%
                      </text>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── View 2: Comparative Pillars (Multi-bar with glowing capsules) ── */}
      {viewMode === 'pillars' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 px-1">
            <span className="font-medium">Side-by-side volume comparison across financial vectors</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-semibold text-[11.5px]">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
                <span>Client Revenue</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[11.5px]">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>Gross Profit</span>
              </div>
              <div className="flex items-center gap-1.5 font-semibold text-[11.5px]">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>Sourcing Cost</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    onSelectDepartment?.(e.activePayload[0].payload.id);
                  }
                }}
              >
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="profitGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="costGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#be123c" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-surface-200 dark:text-surface-800/60"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-surface-600 dark:text-surface-400 font-medium"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  className="text-surface-600 dark:text-surface-400 font-mono"
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                />
                <Bar
                  dataKey="revenue"
                  fill="url(#revGrad)"
                  radius={[5, 5, 0, 0]}
                  name="Client Revenue"
                />
                <Bar
                  dataKey="profit"
                  fill="url(#profitGrad2)"
                  radius={[5, 5, 0, 0]}
                  name="Gross Profit"
                />
                <Bar
                  dataKey="cost"
                  fill="url(#costGrad2)"
                  radius={[5, 5, 0, 0]}
                  name="Sourcing Cost"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── View 3: Margin Yield (Efficiency Spectrum) ── */}
      {viewMode === 'efficiency' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 px-1">
            <span className="font-medium">Departmental Margin Efficiency vs Overall Volume Weight</span>
            <span className="font-bold text-emerald-500 font-mono">
              Portfolio Average: {portfolioSummary.avgMargin}% Margin
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {chartData.map((d) => {
              const isHigh = d.margin >= 25;
              const isModerate = d.margin >= 18 && d.margin < 25;
              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDepartment?.(d.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                    selectedDepartmentId === d.id
                      ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                      : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/40 hover:border-surface-300 dark:hover:border-surface-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-surface-950 dark:text-white truncate">
                      {d.name}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isHigh
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-300/40'
                          : isModerate
                          ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border-brand-300/40'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300/40'
                      }`}
                    >
                      {d.margin}%
                    </span>
                  </div>

                  {/* Visual Margin Bar */}
                  <div className="w-full bg-surface-200 dark:bg-surface-800 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHigh
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : isModerate
                          ? 'bg-gradient-to-r from-brand-500 to-indigo-400'
                          : 'bg-gradient-to-r from-amber-500 to-rose-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(8, d.margin))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-surface-200/60 dark:border-surface-800/60 font-mono">
                    <div>
                      <span className="text-[10.5px] text-surface-400 font-sans block">Revenue</span>
                      <span className="font-bold text-surface-900 dark:text-white">
                        {formatCurrency(d.revenue)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10.5px] text-surface-400 font-sans block">Profit</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(d.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Interactive Financial Metrics Footstrip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-surface-200/60 dark:border-surface-800/60 text-xs">
        <div className="p-3 rounded-xl bg-surface-50/90 dark:bg-surface-900/40 border border-surface-200/90 dark:border-surface-800/50 shadow-2xs">
          <span className="text-[10.5px] font-semibold text-surface-500 uppercase tracking-wider block">
            Aggregated Revenue
          </span>
          <span className="text-sm font-bold font-mono text-surface-950 dark:text-white mt-0.5 block">
            {formatCurrency(portfolioSummary.totalRev)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-50/90 dark:bg-surface-900/40 border border-surface-200/90 dark:border-surface-800/50 shadow-2xs">
          <span className="text-[10.5px] font-semibold text-surface-500 uppercase tracking-wider block">
            Net Gross Margin
          </span>
          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {portfolioSummary.avgMargin}%
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-50/90 dark:bg-surface-900/40 border border-surface-200/90 dark:border-surface-800/50 shadow-2xs">
          <span className="text-[10.5px] font-semibold text-surface-500 uppercase tracking-wider block">
            Sourcing Outlay
          </span>
          <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
            {formatCurrency(portfolioSummary.totalCost)}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-surface-50/90 dark:bg-surface-900/40 border border-surface-200/90 dark:border-surface-800/50 shadow-2xs">
          <span className="text-[10.5px] font-semibold text-surface-500 uppercase tracking-wider block">
            Cost-to-Revenue Ratio
          </span>
          <span className="text-sm font-bold font-mono text-surface-800 dark:text-surface-300 mt-0.5 block">
            {portfolioSummary.totalRev > 0 ? ((portfolioSummary.totalCost / portfolioSummary.totalRev) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
