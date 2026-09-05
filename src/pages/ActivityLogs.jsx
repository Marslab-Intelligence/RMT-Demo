import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Search, Clock, ArrowLeft, RefreshCw, Filter, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';

export default function ActivityLogs() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/activity-logs?limit=200', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      } else {
        toast.error('Failed to load activity logs');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
  }, [token]);

  const filteredLogs = logs.filter(log => {
    const matchRole = roleFilter === 'all' || log.role === roleFilter;
    if (!searchQuery) return matchRole;
    const query = searchQuery.toLowerCase();
    const matchSearch = (
      (log.details && log.details.toLowerCase().includes(query)) ||
      (log.full_name && log.full_name.toLowerCase().includes(query)) ||
      (log.role && log.role.toLowerCase().includes(query))
    );
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Activity Logs</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Complete audit trail of user logins, record modifications, and system operations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80 group/search">
          <Search className="w-4 h-4 text-slate-400 group-focus-within/search:text-brand-500 absolute left-3 top-2.5 transition-colors" />
          <input
            type="text"
            placeholder="Search activity details, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-white/60 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/15 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/60 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Role Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'admin', label: 'Admins Only' },
            { id: 'sales', label: 'Sales / CST' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                roleFilter === tab.id
                  ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30 shadow-sm'
                  : 'bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white/60 dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / Audit View */}
      <div className="card overflow-hidden border-slate-200/80 dark:border-white/10 shadow-xl">
        {loading ? (
          <div className="flex flex-col h-64 items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            <span className="text-xs font-medium text-slate-400">Loading audit trail...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity logs found"
            description="No system records match your search criteria or role filter."
            action={
              (searchQuery || roleFilter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Reset Filters
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar max-h-[700px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10 uppercase text-[10px] font-black sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="py-3 px-4 w-44">Timestamp</th>
                  <th className="py-3 px-4 w-52">User & Role</th>
                  <th className="py-3 px-4">Action Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-white/5 text-slate-700 dark:text-slate-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{log.full_name || 'System User'}</div>
                      <div className="mt-0.5">
                        <StatusBadge status={log.role || 'user'} size="xs" />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
