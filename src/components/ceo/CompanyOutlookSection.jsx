import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Cpu, Sliders, HelpCircle } from 'lucide-react';
import ForecastModelRegistryModal from './ForecastModelRegistryModal';

export default function CompanyOutlookSection({ forecast = null, loading = false }) {
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse min-h-[260px] flex items-center justify-center">
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
      </div>
    );
  }

  const horizon = forecast?.horizonSummary || {};
  const scenarios = forecast?.scenarios || {};
  const registry = forecast?.modelRegistry || [];

  const isImproving = horizon.direction === 'Improving';
  const isDeclining = horizon.direction === 'Declining';

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-200/70 dark:border-surface-800/70">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-extrabold text-surface-950 dark:text-white">
              Company Outlook & Statistical Projections
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Horizon: {horizon.targetQuarter || '2026-Q4'}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            Backtested multi-scenario models across revenue run-rates, margins, and contract renewals
          </p>
        </div>

        {/* Model Transparency Button */}
        <button
          onClick={() => setIsRegistryOpen(true)}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Cpu className="w-3.5 h-3.5 text-brand-500" />
          <span>Model Registry & Error Metrics</span>
        </button>
      </div>

      {/* Trajectory Header Banner */}
      <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200/70 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isImproving
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : isDeclining
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'
            }`}
          >
            {isImproving ? (
              <TrendingUp className="w-5 h-5" />
            ) : isDeclining ? (
              <TrendingDown className="w-5 h-5" />
            ) : (
              <Minus className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
              Projected Corporate Trajectory
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h4 className="text-sm sm:text-base font-extrabold text-surface-950 dark:text-white">
                {horizon.direction} Trajectory ({horizon.growthRatePct > 0 ? `+${horizon.growthRatePct}%` : `${horizon.growthRatePct}%`})
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                Confidence: {horizon.confidence}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-surface-500 max-w-sm sm:text-right">
          {horizon.confidenceReason}
        </p>
      </div>

      {/* 3 Scenario Cards: Conservative, Base, Optimistic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Conservative */}
        <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800/80 bg-white/60 dark:bg-surface-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
              Conservative Floor
            </span>
            <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
              -0.75σ Variance
            </span>
          </div>
          <div>
            <span className="text-xs text-surface-400">Projected Revenue</span>
            <p className="text-lg font-bold font-mono text-surface-900 dark:text-white mt-0.5">
              {formatCurrency(scenarios.conservativeCase?.revenue || 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-800 text-xs">
            <div>
              <span className="text-[10.5px] text-surface-400 block">Gross Margin</span>
              <span className="font-mono font-bold text-surface-700 dark:text-surface-300">
                {scenarios.conservativeCase?.marginPct}%
              </span>
            </div>
            <div>
              <span className="text-[10.5px] text-surface-400 block">Contracts</span>
              <span className="font-mono font-bold text-surface-700 dark:text-surface-300">
                {scenarios.conservativeCase?.totalContracts}
              </span>
            </div>
          </div>
        </div>

        {/* Base Case (Highlighted) */}
        <div className="p-4 rounded-xl border-2 border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 space-y-3 shadow-md relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Base Case (Expected)
            </span>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-brand-500 text-white">
              Primary Model
            </span>
          </div>
          <div>
            <span className="text-xs text-surface-500">Projected Revenue</span>
            <p className="text-xl font-black font-mono text-surface-950 dark:text-white mt-0.5">
              {formatCurrency(scenarios.baseCase?.revenue || 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-200 dark:border-brand-800/60 text-xs">
            <div>
              <span className="text-[10.5px] text-surface-500 block">Gross Margin</span>
              <span className="font-mono font-bold text-surface-900 dark:text-white">
                {scenarios.baseCase?.marginPct}%
              </span>
            </div>
            <div>
              <span className="text-[10.5px] text-surface-500 block">Contracts</span>
              <span className="font-mono font-bold text-surface-900 dark:text-white">
                {scenarios.baseCase?.totalContracts}
              </span>
            </div>
          </div>
        </div>

        {/* Optimistic */}
        <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800/80 bg-white/60 dark:bg-surface-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Optimistic Expansion
            </span>
            <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              +0.75σ Growth
            </span>
          </div>
          <div>
            <span className="text-xs text-surface-400">Projected Revenue</span>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(scenarios.optimisticCase?.revenue || 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-800 text-xs">
            <div>
              <span className="text-[10.5px] text-surface-400 block">Gross Margin</span>
              <span className="font-mono font-bold text-surface-700 dark:text-surface-300">
                {scenarios.optimisticCase?.marginPct}%
              </span>
            </div>
            <div>
              <span className="text-[10.5px] text-surface-400 block">Contracts</span>
              <span className="font-mono font-bold text-surface-700 dark:text-surface-300">
                {scenarios.optimisticCase?.totalContracts}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Model Transparency Modal */}
      {isRegistryOpen && (
        <ForecastModelRegistryModal
          isOpen={isRegistryOpen}
          onClose={() => setIsRegistryOpen(false)}
          registry={registry}
          dataQuality={forecast?.dataQuality}
        />
      )}
    </div>
  );
}
