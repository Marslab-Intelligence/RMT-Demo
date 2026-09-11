import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Info, ChevronRight, Activity, ArrowUpRight } from 'lucide-react';

export default function CompanyHealthGauge({ healthData, loading = false }) {
  const navigate = useNavigate();

  if (loading || !healthData) {
    return (
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm animate-pulse flex items-center justify-center min-h-[220px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full border-4 border-surface-200 dark:border-surface-800"></div>
          <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded w-28"></div>
        </div>
      </div>
    );
  }

  const score = healthData.score ?? healthData.overallScore ?? 0;
  const status = healthData.status || (score >= 80 ? 'Optimal' : score >= 65 ? 'Moderate' : 'Critical');
  const dimensions = healthData.dimensions || [];

  // Gauge colors based on score
  const getScoreColor = () => {
    if (score >= 80) return { stroke: '#10b981', text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
    if (score >= 65) return { stroke: '#a559a5', text: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/30' };
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    return { stroke: '#ef4444', text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
  };

  const color = getScoreColor();
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
            Company Health Score
          </span>
        </div>
        <button
          onClick={() => navigate('/ceo/health')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors cursor-pointer"
          title="Inspect Health Drivers & Methodology"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Why {score}/100?</span>
        </button>
      </div>

      {/* Main Gauge Graphic and Status */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        {/* SVG Circular Radial Gauge */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-surface-100 dark:text-surface-800"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={color.stroke}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black tracking-tight text-surface-950 dark:text-white font-mono">
              {score}
            </span>
            <span className="text-[11px] font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide">
              out of 100
            </span>
          </div>
        </div>

        {/* Status & Sub-Scores List */}
        <div className="flex-1 w-full max-w-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Executive Health Index</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${color.bg} ${color.border} ${color.text}`}>
              {status}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {dimensions.slice(0, 4).map((dim) => (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-surface-600 dark:text-surface-300 font-medium truncate">{dim.name}</span>
                  <span className="font-mono font-bold text-surface-800 dark:text-surface-200">{dim.score}%</span>
                </div>
                <div className="w-full bg-surface-100 dark:bg-surface-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, dim.score))}%`,
                      backgroundColor: dim.score >= 80 ? '#10b981' : dim.score >= 60 ? '#a559a5' : dim.score >= 40 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Context */}
      <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800/60 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-500">
        <span>Evaluated from verified database telemetry</span>
        <button
          onClick={() => navigate('/ceo/health')}
          className="text-brand-600 dark:text-brand-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          View all {dimensions.length} drivers & attribution <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
