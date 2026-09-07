import React from 'react';

export default function StatusBadge({ 
  status = '', 
  label = null, 
  showDot = true, 
  size = 'sm', 
  className = '' 
}) {
  if (!status && !label) return null;

  const text = label || status;
  const s = String(status || '').toLowerCase().trim();

  let colorClasses = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
  let dotColor = 'bg-slate-400';
  let shouldPulse = false;

  if (s === 'active' || s === 'renewed' || s === 'sent' || s === 'yes' || s === 'low' || s === 'approved') {
    colorClasses = 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30';
    dotColor = 'bg-emerald-500';
    shouldPulse = s === 'active';
  } else if (s === 'pending renewal' || s === 'pending' || s === 'reminder_sent' || s === 'quote_sent' || s === 'medium' || s === 'awaiting_client_approval') {
    colorClasses = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
    dotColor = 'bg-amber-500';
    shouldPulse = true;
  } else if (s === 'expired' || s === 'failed' || s === 'no' || s === 'high' || s === 'rejected' || s === 'cancelled' || s === 'lost') {
    colorClasses = 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
    dotColor = 'bg-rose-500';
  } else if (s === 'admin' || s === 'super_admin' || s === 'dept_admin') {
    colorClasses = 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30';
    dotColor = 'bg-indigo-500';
  } else if (s === 'sales' || s === 'cst' || s === 'user') {
    colorClasses = 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30';
    dotColor = 'bg-teal-500';
  } else if (s === 'blue' || s === 'info') {
    colorClasses = 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30';
    dotColor = 'bg-blue-500';
  }

  const sizeClasses = size === 'xs' 
    ? 'px-2 py-0.5 text-[9px]' 
    : size === 'md' 
      ? 'px-3 py-1 text-xs' 
      : 'px-2.5 py-0.5 text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider border backdrop-blur-md transition-all ${sizeClasses} ${colorClasses} ${className}`}>
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${shouldPulse ? 'animate-pulse' : ''}`} />
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}
