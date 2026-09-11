import React, { useState } from 'react';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import { Clock, AlertTriangle, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function RenewalTimelineBar({ pipeline = {}, atRiskRenewals = [], loading = false }) {
  const { openDrawer } = useCeo();
  const [activeHorizon, setActiveHorizon] = useState('d30');

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse min-h-[220px] flex items-center justify-center">
        <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-1/3"></div>
      </div>
    );
  }

  const p = pipeline.timeline || pipeline;

  const horizons = [
    { key: 'expired', label: 'Overdue / Expired', data: p.expired || { count: 0, value: 0, items: [] }, color: 'rose' },
    { key: 'd30', label: 'Within 30 Days', data: p.within30Days || p.d30 || { count: 0, value: 0, items: [] }, color: 'rose' },
    { key: 'd60', label: 'Within 60 Days', data: p.within60Days || p.d60 || { count: 0, value: 0, items: [] }, color: 'amber' },
    { key: 'd90', label: 'Within 90 Days', data: p.within90Days || p.d90 || { count: 0, value: 0, items: [] }, color: 'indigo' },
    { key: 'd180', label: 'Within 180 Days', data: p.within180Days || p.d180 || { count: 0, value: 0, items: [] }, color: 'emerald' },
  ];

  const currentHorizonData = horizons.find((h) => h.key === activeHorizon) || horizons[2];

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Renewal Pipeline Command Center
            </h3>
          </div>
          <p className="text-[11.5px] text-surface-400 mt-0.5">
            Temporal expiration runway across business horizons with real portfolio value
          </p>
        </div>
      </div>

      {/* Horizon Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-2">
        {horizons.map((h) => {
          const isSelected = activeHorizon === h.key;
          const count = h.data.count;
          const value = h.data.value;

          return (
            <button
              key={h.key}
              onClick={() => setActiveHorizon(h.key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-brand-500/10 border-brand-500/50 dark:bg-brand-900/30 ring-1 ring-brand-500/40'
                  : 'bg-surface-50/50 dark:bg-surface-800/30 border-surface-200/60 dark:border-surface-800 hover:border-surface-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 truncate">
                  {h.label}
                </span>
                {h.key === 'expired' && count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-surface-900 dark:text-white">
                  {count}
                </span>
                <span className="text-[11px] text-surface-400 font-medium">contracts</span>
              </div>
              <p className="text-[11px] font-mono text-surface-600 dark:text-surface-300 font-semibold truncate mt-1">
                {formatCurrency(value)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Horizon Preview Table */}
      <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
            {currentHorizonData.label} — Contract Pipeline ({currentHorizonData.data.count})
          </span>
          <span className="text-xs font-mono font-bold text-surface-700 dark:text-surface-300">
            Total Exposure: {formatCurrency(currentHorizonData.data.value)}
          </span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {(() => {
            const displayItems = (currentHorizonData.data.items && currentHorizonData.data.items.length > 0)
              ? currentHorizonData.data.items
              : (atRiskRenewals || []);

            if (displayItems.length === 0) {
              return (
                <div className="py-4 text-center text-xs text-surface-400 italic">
                  No renewals requiring attention in this window.
                </div>
              );
            }

            return displayItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => openDrawer('renewal', item.id, `${item.client_name || item.client} - ${item.product_name || item.product}`)}
                className="p-2.5 rounded-lg border border-surface-200/60 dark:border-surface-800/80 bg-white/40 dark:bg-surface-900/40 hover:bg-white dark:hover:bg-surface-800/60 transition-colors flex items-center justify-between cursor-pointer group"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-surface-900 dark:text-white truncate group-hover:text-brand-500 transition-colors">
                      {item.client_name || item.client}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                      {item.product_name || item.product}
                    </span>
                  </div>
                  <span className="text-[11px] text-surface-400">
                    Expiry: {item.renewal_date || item.expiry_date} • Vendor: {item.vendor_name || item.vendor || 'Direct'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold text-surface-900 dark:text-white">
                    {formatCurrency(item.value || item.renewal_cost || 0)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-surface-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
