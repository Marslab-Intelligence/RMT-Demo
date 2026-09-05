import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Maximize2, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function AreaGraphVisualizer({ 
  title = "Profit Analytics", 
  type = "profit", 
  totalValue = 0, 
  monthlyData = [],
  onExpand,
  height = "h-[380px]",
  fullScreenMode = false
}) {
  const containerRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 320 });

  // Theme configuration based on Profit vs Loss
  const isProfit = type === 'profit';
  const config = useMemo(() => {
    return isProfit ? {
      lineStroke: '#10b981',
      lineStrokeDark: '#34d399',
      areaGradTop: '#10b981',
      dotFill: '#10b981',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/25 dark:border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      glowColor: 'rgba(16, 185, 129, 0.12)',
      label: 'Total Net Profit'
    } : {
      lineStroke: '#f43f5e',
      lineStrokeDark: '#fb7185',
      areaGradTop: '#f43f5e',
      dotFill: '#f43f5e',
      accentText: 'text-rose-600 dark:text-rose-400',
      badgeBorder: 'border-rose-500/25 dark:border-rose-500/30',
      badgeBg: 'bg-rose-500/10 dark:bg-rose-500/15',
      badgeText: 'text-rose-700 dark:text-rose-300',
      glowColor: 'rgba(244, 63, 94, 0.12)',
      label: 'Total Expired Loss'
    };
  }, [isProfit]);

  // Update container dimensions on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 320,
        });
      }
    };
    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Generate detailed micro-fluctuation stock-style data points
  const detailedPoints = useMemo(() => {
    const baseVal = totalValue > 0 ? totalValue : (isProfit ? 2599463 : 18992);
    const months = ['May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26', 'Dec 26', 'Jan 27'];
    
    const totalSamples = 80;
    const result = [];
    
    for (let i = 0; i < totalSamples; i++) {
      const progress = i / (totalSamples - 1);
      
      const wave1 = Math.sin(progress * Math.PI * 4) * 0.15;
      const wave2 = Math.cos(progress * Math.PI * 9) * 0.08;
      const noise = (Math.sin(i * 1.7) * 0.05);
      
      const trend = Math.pow(progress, 1.4) * 0.65 + 0.35;
      const factor = Math.max(0.1, trend + wave1 + wave2 + noise);
      
      const val = Math.round(baseVal * factor);
      const monthIdx = Math.min(months.length - 1, Math.floor(progress * months.length));
      const monthLabel = months[monthIdx];
      
      result.push({
        idx: i,
        progress,
        val,
        monthLabel
      });
    }
    return result;
  }, [totalValue, isProfit]);

  // Scaled coordinates mapping
  const mappedPoints = useMemo(() => {
    if (detailedPoints.length === 0) return [];
    
    const margin = { top: 24, right: 24, bottom: 36, left: 24 };
    const innerW = Math.max(10, dimensions.width - margin.left - margin.right);
    const innerH = Math.max(10, dimensions.height - margin.top - margin.bottom);
    
    const maxV = Math.max(...detailedPoints.map(p => p.val), 1);
    const minV = Math.min(...detailedPoints.map(p => p.val), 0);

    return detailedPoints.map(p => {
      const x = margin.left + p.progress * innerW;
      const y = margin.top + innerH - ((p.val - minV * 0.8) / (maxV - minV * 0.8 || 1)) * innerH;
      return { ...p, x, y };
    });
  }, [detailedPoints, dimensions]);

  // Build SVG Path Commands
  const pathD = useMemo(() => {
    if (mappedPoints.length < 2) return '';
    let d = `M ${mappedPoints[0].x} ${mappedPoints[0].y}`;
    for (let i = 0; i < mappedPoints.length - 1; i++) {
      const p1 = mappedPoints[i];
      const p2 = mappedPoints[i + 1];
      const midX = (p1.x + p2.x) / 2;
      d += ` C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [mappedPoints]);

  const areaD = useMemo(() => {
    if (!pathD || mappedPoints.length === 0) return '';
    const first = mappedPoints[0];
    const last = mappedPoints[mappedPoints.length - 1];
    const bottomY = dimensions.height - 36;
    return `${pathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [pathD, mappedPoints, dimensions.height]);

  // Interactive Mouse Scan Handler
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || mappedPoints.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    let closest = mappedPoints[0];
    let minDiff = Math.abs(mouseX - mappedPoints[0].x);

    for (let i = 1; i < mappedPoints.length; i++) {
      const diff = Math.abs(mouseX - mappedPoints[i].x);
      if (diff < minDiff) {
        minDiff = diff;
        closest = mappedPoints[i];
      }
    }

    setHoverData(closest);
  }, [mappedPoints]);

  const handleMouseLeave = useCallback(() => {
    setHoverData(null);
  }, []);

  const cardBackground = fullScreenMode
    ? 'bg-slate-900/90 border-white/15 text-white'
    : 'bg-white/75 dark:bg-slate-900/70 border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white';

  return (
    <div 
      className={`group/card relative w-full overflow-hidden rounded-2xl border backdrop-blur-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between p-5 ${cardBackground} ${height}`}
      style={{
        boxShadow: `0 10px 30px -10px ${config.glowColor}, 0 20px 25px -5px rgba(0, 0, 0, 0.05)`
      }}
    >
      {/* Liquid glass ambient background accent */}
      <div 
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-30 transition-opacity group-hover/card:opacity-50"
        style={{ background: config.glowColor }}
      />
      
      {/* Subtle top glare line */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent" />

      {/* Card Header */}
      <div className="relative z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${config.badgeBg} ${config.badgeText} border ${config.badgeBorder}`}>
              {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <h3 className="text-base font-black tracking-tight">{title}</h3>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${config.badgeBorder} ${config.badgeBg} ${config.badgeText} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isProfit ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
              {fullScreenMode ? 'Full Screen Analytics' : 'Live Timeline'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            High-frequency portfolio value & performance curve
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Total Value Pill */}
          <div className={`px-3 py-1.5 rounded-xl border ${config.badgeBorder} ${config.badgeBg} backdrop-blur-md text-right shadow-sm`}>
            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
              {config.label}
            </span>
            <span className={`text-base font-mono font-black ${config.accentText}`}>
              {formatCurrency(totalValue > 0 ? totalValue : (isProfit ? 2599463 : 18992))}
            </span>
          </div>

          {!fullScreenMode && onExpand && (
            <button
              onClick={onExpand}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/15 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              title="Open Fullscreen & Detailed Data"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Screen</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex-1 w-full min-h-0 cursor-crosshair mt-3 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-white/5"
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id={`area-grad-${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.areaGradTop} stopOpacity={0.45} />
              <stop offset="60%" stopColor={config.areaGradTop} stopOpacity={0.15} />
              <stop offset="100%" stopColor={config.areaGradTop} stopOpacity={0.0} />
            </linearGradient>
            <filter id={`glow-${type}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={config.areaGradTop} floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Grid Columns (Vertical Dashed Lines) */}
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((ratio, i) => (
            <line
              key={`vgrid-${i}`}
              x1={dimensions.width * ratio}
              y1="12"
              x2={dimensions.width * ratio}
              y2={dimensions.height - 36}
              stroke="currentColor"
              className="stroke-slate-900/5 dark:stroke-white/10"
              strokeDasharray="3 4"
            />
          ))}

          {/* Grid Rows (Horizontal Dashed Lines) */}
          {[0.25, 0.5, 0.75].map((ratio, i) => (
            <line
              key={`hgrid-${i}`}
              x1="20"
              y1={dimensions.height * ratio}
              x2={dimensions.width - 20}
              y2={dimensions.height * ratio}
              stroke="currentColor"
              className="stroke-slate-900/5 dark:stroke-white/10"
              strokeDasharray="3 4"
            />
          ))}

          {/* Filled Stock Area */}
          {areaD && (
            <path d={areaD} fill={`url(#area-grad-${type})`} />
          )}

          {/* Monotone Curve Line with Glow */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={config.lineStroke}
              filter={`url(#glow-${type})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Active Hover Crosshair Line & Point Node */}
          {hoverData && (
            <g>
              {/* Full height vertical dashed scanner line */}
              <line
                x1={hoverData.x}
                y1="8"
                x2={hoverData.x}
                y2={dimensions.height - 36}
                stroke={config.dotFill}
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              
              {/* Outer halo circle */}
              <circle
                cx={hoverData.x}
                cy={hoverData.y}
                r="8"
                fill={config.dotFill}
                fillOpacity="0.25"
                className="animate-ping"
              />
              
              {/* Inner active node dot */}
              <circle
                cx={hoverData.x}
                cy={hoverData.y}
                r="4.5"
                fill={config.dotFill}
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip Pill at Hover Node */}
        {hoverData && (
          <>
            <div 
              className="pointer-events-none absolute z-30 transform -translate-y-1/2 ml-3.5 bg-slate-900/90 dark:bg-slate-950/95 border border-white/20 text-white font-mono text-xs font-black px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-xl whitespace-nowrap flex items-center gap-1.5"
              style={{ 
                top: Math.max(30, Math.min(dimensions.height - 60, hoverData.y)), 
                left: Math.min(dimensions.width - 130, hoverData.x) 
              }}
            >
              <span className={`w-2 h-2 rounded-full ${isProfit ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              {formatCurrency(hoverData.val)}
            </div>

            {/* Date Pill at Bottom X-Axis */}
            <div 
              className="pointer-events-none absolute bottom-1.5 z-30 transform -translate-x-1/2 bg-slate-900/90 dark:bg-slate-950/95 border border-white/20 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-lg shadow-lg backdrop-blur-xl"
              style={{ left: Math.max(35, Math.min(dimensions.width - 35, hoverData.x)) }}
            >
              {hoverData.monthLabel}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
