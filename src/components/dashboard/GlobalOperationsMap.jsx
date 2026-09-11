import React from 'react';
import { Globe, MapPin, Radio } from 'lucide-react';

const REGIONS = [
  { name: 'North America', count: 12, color: '#611c69', coords: { x: '26%', y: '36%' } },
  { name: 'Europe', count: 8, color: '#F59E0B', coords: { x: '51%', y: '30%' } },
  { name: 'Asia', count: 18, color: '#A855F7', coords: { x: '72%', y: '40%' } },
  { name: 'Others', count: 6, color: '#06B6D4', coords: { x: '42%', y: '68%' } },
];

export default function GlobalOperationsMap({ className = '', onRegionClick }) {
  return (
    <div className={`p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0B1730]/80 backdrop-blur-xl shadow-lg flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" />
            Global Operations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active client footprint & geographically distributed service delivery
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Nodes: 44
        </span>
      </div>

      {/* Stylized Operations Map Container */}
      <div className="relative h-48 w-full my-2 rounded-xl bg-slate-900/5 dark:bg-navy-950/60 border border-slate-200/50 dark:border-white/5 overflow-hidden flex items-center justify-center">
        {/* World Grid SVG Background */}
        <svg
          className="w-full h-full opacity-25 dark:opacity-35 text-slate-400 dark:text-blue-500/40"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1000 500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          {/* Subtle continent silhouettes / coordinate lattice */}
          <path d="M150,150 Q200,100 320,130 Q350,200 280,260 Q180,240 150,150 Z" strokeDasharray="3 3" />
          <path d="M460,110 Q540,80 580,140 Q520,220 450,160 Z" strokeDasharray="3 3" />
          <path d="M600,120 Q780,100 850,200 Q780,320 620,240 Z" strokeDasharray="3 3" />
          <path d="M220,300 Q280,280 320,380 Q260,450 200,380 Z" strokeDasharray="3 3" />
          <path d="M720,340 Q820,320 860,400 Q780,450 720,380 Z" strokeDasharray="3 3" />
        </svg>

        {/* Region Ping Points */}
        {REGIONS.map((r, i) => (
          <div
            key={i}
            style={{ left: r.coords.x, top: r.coords.y }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            onClick={() => onRegionClick && onRegionClick(r)}
          >
            <div className="relative flex items-center justify-center">
              <span
                className="animate-ping absolute inline-flex h-6 w-6 rounded-full opacity-60"
                style={{ backgroundColor: r.color }}
              />
              <span
                className="relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white dark:border-navy-900 shadow-md"
                style={{ backgroundColor: r.color }}
              />
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg pointer-events-none z-20">
              {r.name}: {r.count} accounts
            </div>
          </div>
        ))}
      </div>

      {/* Region Badges Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
        {REGIONS.map((r, idx) => (
          <button
            key={idx}
            onClick={() => onRegionClick && onRegionClick(r)}
            className="flex items-center gap-2 text-xs hover:bg-slate-100 dark:hover:bg-white/5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-slate-600 dark:text-slate-300 font-medium">{r.name}</span>
            <span className="font-black text-slate-900 dark:text-white tabular-nums">{r.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
