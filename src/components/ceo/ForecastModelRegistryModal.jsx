import React from 'react';
import { X, Cpu, CheckCircle2, ShieldCheck, Database, BarChart3, AlertCircle } from 'lucide-react';

export default function ForecastModelRegistryModal({ isOpen, onClose, registry = [], dataQuality = null }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#151224] rounded-2xl border border-surface-200 dark:border-surface-800 shadow-2xl z-10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-surface-50/60 dark:bg-surface-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-surface-950 dark:text-white">
                Forecasting Model Registry & Audit Ledger
              </h3>
              <p className="text-xs text-surface-400 mt-0.5">
                Backtesting performance metrics, error scores (WAPE/MAE), and candidate model selection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
          {/* Data Quality Overview */}
          {dataQuality && (
            <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200/70 dark:border-surface-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-brand-500" />
                  Telemetry Data Quality
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {dataQuality.confidence} Confidence ({dataQuality.completenessPct}% Complete)
                </span>
              </div>
              <p className="text-surface-600 dark:text-surface-300">
                {dataQuality.reason}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-800 text-[11px]">
                <div>
                  <span className="text-surface-400 block">Observations:</span>
                  <span className="font-mono font-bold text-surface-900 dark:text-white">{dataQuality.totalObservations} contracts</span>
                </div>
                <div>
                  <span className="text-surface-400 block">Depth:</span>
                  <span className="font-mono font-bold text-surface-900 dark:text-white">{dataQuality.historicalDepthQuarters} quarters</span>
                </div>
                <div>
                  <span className="text-surface-400 block">Dates Valid:</span>
                  <span className="font-mono font-bold text-surface-900 dark:text-white">{dataQuality.dimensions?.dateCompleteness}%</span>
                </div>
                <div>
                  <span className="text-surface-400 block">Values Valid:</span>
                  <span className="font-mono font-bold text-surface-900 dark:text-white">{dataQuality.dimensions?.valueCompleteness}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Model Registry Cards */}
          <div>
            <h4 className="font-bold text-surface-900 dark:text-white uppercase tracking-wider text-[11px] mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Automated Candidate Model Selection & Backtesting
            </h4>

            <div className="space-y-3">
              {registry.map((m, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-white dark:bg-surface-900/30 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="text-sm font-bold text-surface-900 dark:text-white block">
                        {m.metric}
                      </span>
                      <span className="text-[11px] text-surface-400">
                        Selected Model: <strong className="text-brand-600 dark:text-brand-400">{m.selectedModel}</strong>
                      </span>
                    </div>
                    <span className="self-start sm:self-auto text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      WAPE: {m.backtestWape}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-800 text-[11px]">
                    <div>
                      <span className="text-surface-400 block">Validation Actual:</span>
                      <span className="font-mono font-bold text-surface-800 dark:text-surface-200">{m.backtestActual}</span>
                    </div>
                    <div>
                      <span className="text-surface-400 block">Model Predicted:</span>
                      <span className="font-mono font-bold text-surface-800 dark:text-surface-200">{m.backtestPredicted}</span>
                    </div>
                    <div>
                      <span className="text-surface-400 block">Mean Abs Error (MAE):</span>
                      <span className="font-mono font-bold text-surface-800 dark:text-surface-200">{m.mae}</span>
                    </div>
                    <div>
                      <span className="text-surface-400 block">Horizon:</span>
                      <span className="font-mono font-bold text-surface-800 dark:text-surface-200">{m.horizon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology Explainer */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-amber-800 dark:text-amber-300">
            <span className="font-bold text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Evaluation Methodology
            </span>
            <p className="leading-relaxed">
              Candidate models (Holt’s Linear Trend, Single Exponential Smoothing, OLS Linear Regression, and Moving Average) are evaluated using rolling backtesting. The candidate model delivering the minimum Weighted Absolute Percentage Error (WAPE) on historical holdout points is dynamically chosen for corporate projections.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-900 hover:bg-surface-800 dark:bg-white dark:hover:bg-surface-100 text-white dark:text-surface-900 text-xs font-bold transition-colors cursor-pointer"
          >
            Close Audit Ledger
          </button>
        </div>
      </div>
    </div>
  );
}
