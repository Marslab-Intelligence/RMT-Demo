import React from 'react';

export default function RadialGauge({
  percent = 0,
  label,
  sublabel,
  color = '#a559a5',
  size = 132,
  stroke = 10,
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const overTarget = percent > 100;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-black/[0.07] dark:stroke-white/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
            {Math.round(percent)}%
          </span>
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1">
            of target
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-900 dark:text-white">{label}</p>
        {sublabel && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sublabel}</p>
        )}
        {overTarget && (
          <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
            {Math.round(percent - 100)}% over target
          </p>
        )}
      </div>
    </div>
  );
}
