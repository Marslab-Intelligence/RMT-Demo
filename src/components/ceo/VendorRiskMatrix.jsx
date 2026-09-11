import React from 'react';
import { useCeo } from '../../context/CeoContext';
import { Store, AlertTriangle, ShieldCheck, Eye, Sparkles } from 'lucide-react';

export default function VendorRiskMatrix({ vendors = [], matrix = null, loading = false }) {
  const { openDrawer } = useCeo();

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse min-h-[340px] flex items-center justify-center">
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
      </div>
    );
  }

  const critical = matrix?.critical || [];
  const monitor = matrix?.monitor || [];
  const attention = matrix?.attention || [];
  const healthy = matrix?.healthy || [];

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Vendor Dependency & Risk Matrix
            </h3>
          </div>
          <p className="text-[11.5px] text-surface-400 mt-0.5">
            Classifies vendor ecosystem by contract concentration vs near-term renewal exposure
          </p>
        </div>
        <span className="text-xs font-semibold text-surface-400 font-mono">
          {vendors.length} Vendors Total
        </span>
      </div>

      {/* 2x2 Quadrant Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-2">
        {/* Quadrant 1: Critical (High Dependency + High Risk) */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Critical
                </span>
              </div>
              <span className="text-[10px] font-medium text-rose-600/80 dark:text-rose-400/80">
                High Dep + High Risk
              </span>
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-400 mb-2">
              High corporate dependency with imminent renewals requiring leadership retention action.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {critical.length > 0 ? (
              critical.map((v) => (
                <button
                  key={v.name}
                  onClick={() => openDrawer('vendor', v.name, v.name)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-surface-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 shadow-xs hover:scale-105 transition-all flex items-center gap-1"
                >
                  <span>{v.name}</span>
                  <span className="text-[10px] opacity-75">({v.contractCount})</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-surface-400 italic">No critical vendor risks detected</span>
            )}
          </div>
        </div>

        {/* Quadrant 2: Monitor (High Dependency + Low Risk) */}
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Monitor
                </span>
              </div>
              <span className="text-[10px] font-medium text-indigo-600/80 dark:text-indigo-400/80">
                High Dep + Low Risk
              </span>
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-400 mb-2">
              Heavy operational reliance but healthy contract horizons. Keep strategic oversight.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {monitor.length > 0 ? (
              monitor.map((v) => (
                <button
                  key={v.name}
                  onClick={() => openDrawer('vendor', v.name, v.name)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-surface-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800/80 shadow-xs hover:scale-105 transition-all flex items-center gap-1"
                >
                  <span>{v.name}</span>
                  <span className="text-[10px] opacity-75">({v.contractCount})</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-surface-400 italic">None</span>
            )}
          </div>
        </div>

        {/* Quadrant 3: Attention (Low Dependency + High Risk) */}
        <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Attention
                </span>
              </div>
              <span className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80">
                Low Dep + High Risk
              </span>
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-400 mb-2">
              Smaller vendor footprint with contracts expiring soon. Decide on renewal vs consolidation.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {attention.length > 0 ? (
              attention.map((v) => (
                <button
                  key={v.name}
                  onClick={() => openDrawer('vendor', v.name, v.name)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-surface-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 shadow-xs hover:scale-105 transition-all flex items-center gap-1"
                >
                  <span>{v.name}</span>
                  <span className="text-[10px] opacity-75">({v.contractCount})</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-surface-400 italic">None</span>
            )}
          </div>
        </div>

        {/* Quadrant 4: Healthy (Low Dependency + Low Risk) */}
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col justify-between min-h-[140px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Healthy
                </span>
              </div>
              <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                Low Dep + Low Risk
              </span>
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-400 mb-2">
              Low vulnerability suppliers operating smoothly without near-term expiration pressure.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {healthy.slice(0, 5).map((v) => (
              <button
                key={v.name}
                onClick={() => openDrawer('vendor', v.name, v.name)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-surface-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 shadow-xs hover:scale-105 transition-all flex items-center gap-1"
              >
                <span>{v.name}</span>
                <span className="text-[10px] opacity-75">({v.contractCount})</span>
              </button>
            ))}
            {healthy.length > 5 && (
              <span className="text-xs text-surface-400 font-medium self-center">
                +{healthy.length - 5} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
