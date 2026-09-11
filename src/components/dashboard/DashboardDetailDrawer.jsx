import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Users,
  Building,
  ArrowUpRight
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import StatusBadge from '../common/StatusBadge';

export default function DashboardDetailDrawer({
  isOpen,
  onClose,
  title = 'Detailed Analysis',
  subtitle = 'In-depth breakdown of selected metric records',
  metricValue,
  metricLabel,
  type = 'renewals',
  records = [],
  loading = false,
}) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredRecords = records.filter((r) => {
    const textMatch =
      !searchTerm ||
      (r.client_name && r.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.service && r.service.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.unique_id && r.unique_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.full_name && r.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.name && r.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!textMatch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return r.status === 'Active';
    if (filterStatus === 'pending') return r.status === 'Pending Renewal' || r.renewal_confirmation === 'pending';
    if (filterStatus === 'renewed') return r.status === 'Renewed' || r.renewal_confirmation === 'renewed';
    if (filterStatus === 'expired') return r.status === 'Expired' || (r.days_left !== undefined && r.days_left < 0);
    return true;
  });

  const totalValue = records.reduce((sum, r) => sum + (parseFloat(r.value || r.revenue || 0) || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#0B1730] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col transition-transform animate-slide-in-right">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-navy-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-500/10 dark:bg-blue-500/20 text-brand-600 dark:text-blue-400 border border-brand-500/20 mb-2 inline-block">
                  Investigative Deep Dive
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {subtitle}
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                title="Close drawer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metric Summary Ribbon */}
            <div className="mt-4 grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shadow-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {metricLabel || 'Current Metric'}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {metricValue || records.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Records
                </span>
                <span className="text-lg font-black text-brand-600 dark:text-blue-400">
                  {records.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Aggregate Value
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {totalValue > 0 ? formatCurrency(totalValue) : '—'}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, client, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {records.some((r) => r.status) && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900/60 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="renewed">Renewed</option>
                  <option value="expired">Expired</option>
                </select>
              )}
            </div>
          </div>

          {/* Records List Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <FileText className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching records found</p>
                <p className="text-xs mt-1">Try clearing your search or adjusting filters.</p>
              </div>
            ) : (
              filteredRecords.map((item, idx) => {
                const isRenewal = item.client_name || item.service;
                const isUser = item.full_name || item.email;
                const isDept = item.department_name && !isRenewal;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      if (isRenewal && item.id) {
                        onClose();
                        navigate(`/renewals/${item.id}`);
                      }
                    }}
                    className={`p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/5 hover:border-brand-500/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all group ${
                      isRenewal ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.client_name || item.full_name || item.department_name || item.name || 'Record'}
                          </span>
                          {item.unique_id && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {item.unique_id}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {item.service && <span>Service: <strong className="text-slate-700 dark:text-slate-300">{item.service}</strong></span>}
                          {item.role && <span className="capitalize">Role: <strong className="text-slate-700 dark:text-slate-300">{item.role}</strong></span>}
                          {item.owner && <span>Owner: {item.owner}</span>}
                          {item.renewal_date && <span>Renewal: {formatDate(item.renewal_date)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.value !== undefined && item.value !== null && (
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {formatCurrency(item.value)}
                          </span>
                        )}
                        {item.status && (
                          <StatusBadge status={item.status} />
                        )}
                        {isRenewal && (
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-navy-950/60 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Showing {filteredRecords.length} of {records.length} records
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white transition-colors"
            >
              Done Inspecting
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
