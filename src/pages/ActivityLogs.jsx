import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDateTime, formatTimeAgo } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import {
  Activity,
  Search,
  Clock,
  ArrowLeft,
  RefreshCw,
  Filter,
  Shield,
  ShieldAlert,
  User,
  Building2,
  Calendar,
  Layers,
  FileText,
  Tag,
  Store,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  X,
  SlidersHorizontal,
  Download,
  AlertTriangle,
  CheckCircle2,
  Info,
  Laptop,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  BarChart2,
  Eye,
  ExternalLink
} from 'lucide-react';

// Classify log actions into semantic categories & colors
function categorizeAction(log) {
  const action = (log.action || '').toLowerCase();
  const details = (log.details || '').toLowerCase();
  const entity = (log.entity_type || '').toLowerCase();

  if (action.includes('delete') || action.includes('trash') || details.includes('deleted') || details.includes('removed')) {
    return {
      category: 'destructive',
      label: 'Deletion / Purge',
      color: 'var(--danger)',
      bg: 'var(--danger-soft)',
      border: 'rgba(244, 63, 94, 0.3)',
      icon: ShieldAlert
    };
  }

  if (action.includes('login') || details.includes('logged in')) {
    return {
      category: 'auth',
      label: 'User Session',
      color: 'var(--success)',
      bg: 'var(--success-soft)',
      border: 'rgba(16, 185, 129, 0.3)',
      icon: CheckCircle2
    };
  }

  if (action.includes('pricing') || details.includes('pricing') || entity.includes('pricing') || details.includes('margin')) {
    return {
      category: 'pricing',
      label: 'Pricing & Margin',
      color: 'var(--warning)',
      bg: 'var(--warning-soft)',
      border: 'rgba(245, 158, 11, 0.3)',
      icon: Tag
    };
  }

  if (action.includes('renew') || details.includes('renew') || entity.includes('renewal')) {
    return {
      category: 'renewal',
      label: 'Renewal Ops',
      color: 'var(--brand)',
      bg: 'rgba(99, 102, 241, 0.14)',
      border: 'rgba(99, 102, 241, 0.3)',
      icon: FileText
    };
  }

  if (action.includes('vendor') || details.includes('vendor') || entity.includes('vendor')) {
    return {
      category: 'vendor',
      label: 'Vendor Intel',
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.14)',
      border: 'rgba(6, 182, 212, 0.3)',
      icon: Store
    };
  }

  return {
    category: 'system',
    label: 'System Event',
    color: 'var(--info)',
    bg: 'var(--info-soft)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: Activity
  };
}

export default function ActivityLogs() {
  const { token, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedDept, setSelectedDept] = useState(searchParams.get('dept') || 'all');
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get('user') || 'all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [datePreset, setDatePreset] = useState('all');

  // Selected Detail Drawer
  const [activeLogDetail, setActiveLogDetail] = useState(null);
  const [showAnalyticsDrawer, setShowAnalyticsDrawer] = useState(false);

  // Fetch Activity Logs & Users Roster in parallel
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        fetch('/api/dashboard/activity-logs?limit=400', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/auth/demo/users').catch(() => ({ ok: false }))
      ]);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(Array.isArray(logsData) ? logsData : []);
      } else {
        toast.error('Failed to load activity logs');
      }

      if (usersRes && usersRes.ok) {
        const uData = await usersRes.json();
        setUsersList(Array.isArray(uData) ? uData : []);
      }
    } catch (err) {
      console.error('Activity logs load error:', err);
      toast.error('Network error loading audit logs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extract list of unique departments from users and logs
  const departments = useMemo(() => {
    const deptSet = new Set();
    usersList.forEach(u => {
      if (u.department_name) deptSet.add(u.department_name);
    });
    logs.forEach(l => {
      if (l.department_name) deptSet.add(l.department_name);
    });
    return Array.from(deptSet).sort();
  }, [usersList, logs]);

  // Group users by department for hierarchical selector
  const usersByDept = useMemo(() => {
    const map = {};
    usersList.forEach(u => {
      const dept = u.department_name || 'General Operations';
      if (!map[dept]) map[dept] = [];
      map[dept].push(u);
    });
    return map;
  }, [usersList]);

  // Find currently selected user object if one is chosen
  const selectedUser = useMemo(() => {
    if (selectedUserId === 'all') return null;
    return usersList.find(u => String(u.id) === String(selectedUserId)) ||
           logs.find(l => String(l.user_id) === String(selectedUserId));
  }, [selectedUserId, usersList, logs]);

  // Filter logs based on active state
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return logs.filter(log => {
      // User filter
      if (selectedUserId !== 'all' && String(log.user_id) !== String(selectedUserId)) {
        return false;
      }

      // Department filter
      if (selectedDept !== 'all') {
        const logDept = (log.department_name || '').toLowerCase();
        if (!logDept.includes(selectedDept.toLowerCase())) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const meta = categorizeAction(log);
        if (meta.category !== selectedCategory) return false;
      }

      // Date preset
      if (datePreset !== 'all') {
        const logTime = new Date(log.created_at).getTime();
        if (datePreset === 'today' && logTime < oneDayAgo) return false;
        if (datePreset === 'week' && logTime < sevenDaysAgo) return false;
        if (datePreset === 'month' && logTime < thirtyDaysAgo) return false;
      }

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText =
          (log.details && log.details.toLowerCase().includes(q)) ||
          (log.full_name && log.full_name.toLowerCase().includes(q)) ||
          (log.action && log.action.toLowerCase().includes(q)) ||
          (log.entity_type && log.entity_type.toLowerCase().includes(q)) ||
          (log.entity_id && String(log.entity_id).toLowerCase().includes(q)) ||
          (log.department_name && log.department_name.toLowerCase().includes(q));
        if (!matchText) return false;
      }

      return true;
    });
  }, [logs, selectedUserId, selectedDept, selectedCategory, datePreset, searchQuery]);

  // Analytics metrics derived from filtered dataset
  const analytics = useMemo(() => {
    const total = filteredLogs.length;
    const byCategory = {
      renewal: 0,
      pricing: 0,
      vendor: 0,
      auth: 0,
      destructive: 0,
      system: 0
    };
    const userActivityMap = {};
    const riskSignals = [];

    filteredLogs.forEach(l => {
      const meta = categorizeAction(l);
      byCategory[meta.category] = (byCategory[meta.category] || 0) + 1;

      const userName = l.full_name || 'System Operator';
      userActivityMap[userName] = (userActivityMap[userName] || 0) + 1;

      if (meta.category === 'destructive') {
        riskSignals.push({
          type: 'deletion',
          title: 'Record Deleted',
          detail: l.details,
          time: l.created_at,
          user: userName
        });
      }
      if (meta.category === 'pricing' && (l.action === 'update' || (l.details || '').includes('updated'))) {
        riskSignals.push({
          type: 'pricing_edit',
          title: 'Pricing Modification',
          detail: l.details,
          time: l.created_at,
          user: userName
        });
      }
    });

    const topUsers = Object.entries(userActivityMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total,
      byCategory,
      topUsers,
      riskSignals: riskSignals.slice(0, 8)
    };
  }, [filteredLogs]);

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (!filteredLogs.length) {
      toast.error('No logs to export');
      return;
    }
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Department', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.created_at,
      `"${(l.full_name || '').replace(/"/g, '""')}"`,
      l.role || '',
      `"${(l.department_name || '').replace(/"/g, '""')}"`,
      l.action || '',
      l.entity_type || '',
      l.entity_id || '',
      `"${(l.details || '').replace(/"/g, '""')}"`,
      l.ip_address || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rmt_system_activity_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit trail exported to CSV');
  };

  // ── Scroll control for single-page stream view ──
  const streamContainerRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);

  const checkScroll = useCallback(() => {
    const el = streamContainerRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 20);
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 20);
  }, []);

  useEffect(() => {
    const el = streamContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll, filteredLogs]);

  const scrollStream = (direction) => {
    const el = streamContainerRef.current;
    if (!el) return;
    const scrollAmount = 340; // scrolls ~4-5 cards
    if (direction === 'up') {
      el.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    } else if (direction === 'down') {
      el.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else if (direction === 'top') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (direction === 'bottom') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 w-full pb-20 animate-fade-in text-[var(--text-primary)]">
      {/* ── BREADCRUMB & HEADER SECTION ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
          <button
            onClick={() => navigate('/')}
            className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
          >
            <span>Home</span>
          </button>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-semibold">Activity Intelligence</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-[var(--brand)] shadow-sm flex-shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  System Activity Intelligence
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-brand-500/15 text-[var(--brand)] border border-brand-500/30">
                  Audit Sentinel
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                Inspect cross-department operations, track real-time user behavior, and audit security events.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={handleExportCSV}
              className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 rounded-lg shadow-xs cursor-pointer"
              title="Export filtered records"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 rounded-lg shadow-xs cursor-pointer"
              title="Refresh audit stream"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-bold bg-white/90 dark:bg-surface-800/90 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-200/80 dark:border-surface-700/80 shadow-xs transition-all cursor-pointer group shrink-0"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP AUDIT METRICS SUMMARY ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="stat-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Total Logged Events
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {logs.length.toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Across all operating divisions
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-[var(--brand)] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Active Operators
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {usersList.length || analytics.topUsers.length}
            </div>
            <div className="text-[10px] text-[var(--success)] font-bold mt-0.5">
              Verified identity accounts
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[var(--success)] flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Filtered Records
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {filteredLogs.length.toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Matching active query filters
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[var(--info)] flex items-center justify-center">
            <Filter className="w-5 h-5" />
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Risk & Audit Signals
            </div>
            <div className="text-2xl font-black text-[var(--danger)] mt-1">
              {analytics.riskSignals.length}
            </div>
            <div className="text-[10px] text-[var(--danger)] font-bold mt-0.5">
              Deletions / price adjustments
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-[var(--danger)] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── POWERFUL HIERARCHICAL FILTER & SEARCH CONTROLS ── */}
      <div className="glass p-4 rounded-2xl space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Global Search */}
          <div className="relative md:col-span-4">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, contract, action, details..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm"
              >
                ×
              </button>
            )}
          </div>

          {/* Department Selector */}
          <div className="md:col-span-3">
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedDept}
                onChange={e => {
                  setSelectedDept(e.target.value);
                  setSelectedUserId('all'); // reset user when dept changes
                }}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d} className="dark:bg-slate-900">{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hierarchical User Selector */}
          <div className="md:col-span-3">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">
                  {selectedDept === 'all' ? 'All Operating Users' : `All Users in ${selectedDept}`}
                </option>
                {Object.entries(usersByDept)
                  .filter(([dept]) => selectedDept === 'all' || dept.toLowerCase().includes(selectedDept.toLowerCase()))
                  .map(([dept, uList]) => (
                    <optgroup key={dept} label={dept} className="dark:bg-slate-950 font-bold">
                      {uList.map(u => (
                        <option key={u.id} value={u.id} className="dark:bg-slate-900 font-normal">
                          {u.full_name} ({u.role})
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </div>
          </div>

          {/* Date Range Preset */}
          <div className="md:col-span-2">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/40 appearance-none cursor-pointer"
              >
                <option value="all" className="dark:bg-slate-900">All Time</option>
                <option value="today" className="dark:bg-slate-900">Today (Last 24h)</option>
                <option value="week" className="dark:bg-slate-900">Last 7 Days</option>
                <option value="month" className="dark:bg-slate-900">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)] overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 flex-nowrap">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'renewal', label: 'Renewals & Contracts' },
              { id: 'pricing', label: 'Pricing & Margins' },
              { id: 'vendor', label: 'Vendor Intelligence' },
              { id: 'auth', label: 'User Sessions' },
              { id: 'destructive', label: 'Deletions / Purges' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCategory === tab.id
                    ? 'bg-brand-500/20 text-[var(--brand)] border-brand-500/40 shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border-transparent hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(searchQuery || selectedDept !== 'all' || selectedUserId !== 'all' || selectedCategory !== 'all' || datePreset !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDept('all');
                setSelectedUserId('all');
                setSelectedCategory('all');
                setDatePreset('all');
              }}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 whitespace-nowrap ml-auto"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* ── SELECTED USER PROFILE SPOTLIGHT CARD (WHEN USER CHOSEN) ── */}
      {selectedUser && (
        <div className="glass p-5 rounded-2xl border-l-4 border-l-[var(--brand)] animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-black shadow-md flex-shrink-0"
                style={{ backgroundColor: selectedUser.avatar_color || 'var(--brand)' }}
              >
                {(selectedUser.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {selectedUser.full_name}
                  </h3>
                  <StatusBadge status={selectedUser.role || 'user'} size="xs" />
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--success)] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active User
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {selectedUser.department_name || 'General Operations'}
                  </span>
                  {selectedUser.category_name && (
                    <span>• {selectedUser.category_name}</span>
                  )}
                  {selectedUser.email && (
                    <span className="font-mono text-[11px] opacity-75">
                      {selectedUser.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 sm:border-l sm:border-[var(--glass-border)] sm:pl-6">
              <div>
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  User Audit Count
                </div>
                <div className="text-xl font-black text-[var(--text-primary)] mt-0.5">
                  {filteredLogs.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                  Latest Action
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate max-w-[160px]">
                  {filteredLogs[0]?.action ? filteredLogs[0].action.toUpperCase() : 'N/A'}
                </div>
              </div>
              <button
                onClick={() => setSelectedUserId('all')}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-white/10"
                title="Clear user selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT: HYBRID TIMELINE / AUDIT STREAM + ANALYTICS SIDEBAR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Column: Activity Stream (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--brand)]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Chronological Activity Stream
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Showing {filteredLogs.length} events
              </span>

              {/* Scroll buttons toolbar */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-[var(--glass-border)] shadow-2xs">
                <button
                  type="button"
                  onClick={() => scrollStream('top')}
                  disabled={!canScrollUp}
                  className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                  title="Scroll to top"
                  aria-label="Scroll to top"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollStream('up')}
                  disabled={!canScrollUp}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                  title="Scroll up"
                  aria-label="Scroll up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollStream('down')}
                  disabled={!canScrollDown}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                  title="Scroll down"
                  aria-label="Scroll down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">Down</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollStream('bottom')}
                  disabled={!canScrollDown}
                  className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                  title="Scroll to bottom"
                  aria-label="Scroll to bottom"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Loading system audit trail...
              </span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="glass p-12 rounded-2xl">
              <EmptyState
                icon={Activity}
                title="No activity events found"
                description="No log records match your current user selection, department, or filter criteria."
                action={
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedDept('all');
                      setSelectedUserId('all');
                      setSelectedCategory('all');
                      setDatePreset('all');
                    }}
                    className="btn-secondary py-1.5 px-3 text-xs"
                  >
                    Reset Filter Parameters
                  </button>
                }
              />
            </div>
          ) : (
            <div className="relative">
              {/* Scrollable list bounded to fit a single page */}
              <div
                ref={streamContainerRef}
                className="space-y-2.5 max-h-[620px] overflow-y-auto custom-scrollbar pr-1.5 rounded-2xl scroll-smooth"
              >
              {filteredLogs.map(log => {
                const meta = categorizeAction(log);
                const IconComponent = meta.icon;

                return (
                  <div
                    key={log.id}
                    onClick={() => setActiveLogDetail(log)}
                    className="glass p-4 rounded-xl hover:translate-x-1 transition-all duration-200 cursor-pointer border border-[var(--glass-border)] hover:border-brand-500/40 group relative overflow-hidden"
                  >
                    {/* Visual left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: meta.color }}
                    />

                    <div className="flex items-start justify-between gap-3.5 pl-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          {/* Main Human Readable Action */}
                          <div className="text-xs font-bold text-[var(--text-primary)] leading-snug group-hover:text-[var(--brand)] transition-colors">
                            {log.details || `${log.action} on ${log.entity_type || 'system'}`}
                          </div>

                          {/* Metadata row */}
                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)] flex-wrap">
                            <span className="font-semibold text-[var(--text-secondary)]">
                              {log.full_name || 'System'}
                            </span>
                            <span>•</span>
                            <StatusBadge status={log.role || 'user'} size="xs" />
                            {log.department_name && (
                              <>
                                <span>•</span>
                                <span>{log.department_name}</span>
                              </>
                            )}
                            {log.entity_id && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10">
                                  #{log.entity_id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right timestamp & inspect indicator */}
                      <div className="flex items-center gap-2 flex-shrink-0 text-right">
                        <div>
                          <div className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
                            {formatDateTime(log.created_at)}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {formatTimeAgo(log.created_at)}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>

              {/* Floating Quick Scroll Controls (Over bottom right of list) */}
              {filteredLogs.length > 4 && (
                <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-1 rounded-full shadow-xl border border-[var(--glass-border)] animate-fade-in">
                  <button
                    type="button"
                    onClick={() => scrollStream('up')}
                    disabled={!canScrollUp}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                    title="Scroll list up"
                    aria-label="Scroll list up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="w-px h-3.5 bg-black/10 dark:bg-white/10" />
                  <button
                    type="button"
                    onClick={() => scrollStream('down')}
                    disabled={!canScrollDown}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                    title="Scroll list down"
                    aria-label="Scroll list down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Activity Analytics & Risk Sentinel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Module Breakdown Card */}
          <div className="glass p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Module Usage Focus
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)]">
                {analytics.total} total
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {[
                { label: 'Renewals & Contracts', count: analytics.byCategory.renewal, color: 'var(--brand)' },
                { label: 'Pricing & Margin Engine', count: analytics.byCategory.pricing, color: 'var(--warning)' },
                { label: 'Vendor Intelligence', count: analytics.byCategory.vendor, color: '#06b6d4' },
                { label: 'User Authentication', count: analytics.byCategory.auth, color: 'var(--success)' },
                { label: 'Deletions / Critical Actions', count: analytics.byCategory.destructive, color: 'var(--danger)' },
                { label: 'System & Automated Tasks', count: analytics.byCategory.system, color: 'var(--info)' }
              ].map(item => {
                const pct = analytics.total > 0 ? Math.round((item.count / analytics.total) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)] font-medium">{item.label}</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Sentinel Signals */}
          <div className="glass p-5 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Critical Risk Signals
                </h3>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                {analytics.riskSignals.length} flagged
              </span>
            </div>

            {analytics.riskSignals.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--text-muted)]">
                <CheckCircle2 className="w-6 h-6 text-[var(--success)] mx-auto mb-1.5 opacity-80" />
                <span>No high-risk operations detected in current view.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                {analytics.riskSignals.map((signal, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--danger)] text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {signal.title}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatTimeAgo(signal.time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {signal.detail}
                    </p>
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">
                      By: <span className="text-[var(--text-primary)] font-semibold">{signal.user}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Active Operators Leaderboard */}
          <div className="glass p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Top Active Operators
              </h3>
            </div>

            <div className="divide-y divide-[var(--glass-border)] text-xs max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
              {analytics.topUsers.map((item, index) => (
                <div key={item.name} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10px] text-[var(--text-muted)] w-4">
                      #{index + 1}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-brand-500/10 text-[var(--brand)] text-[11px]">
                    {item.count} ops
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SLIDE-OVER DETAIL DRAWER FOR SELECTED AUDIT RECORD ── */}
      {activeLogDetail && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => setActiveLogDetail(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-[var(--app-bg)] h-full shadow-2xl border-l border-[var(--glass-border)] flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="h-16 px-6 border-b border-[var(--glass-border)] flex items-center justify-between flex-shrink-0 header-glass">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/15 text-[var(--brand)]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    Audit Record #{activeLogDetail.id}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Recorded {formatDateTime(activeLogDetail.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveLogDetail(null)}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-xs">
              {/* Event Overview Section */}
              <div className="stat-card p-4 rounded-xl space-y-3">
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Event Action Details
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)] leading-relaxed">
                  {activeLogDetail.details}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)]">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-500/15 text-[var(--brand)]">
                    Action: {activeLogDetail.action}
                  </span>
                  {activeLogDetail.entity_type && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/10 dark:bg-white/10 text-[var(--text-secondary)]">
                      Entity: {activeLogDetail.entity_type}
                    </span>
                  )}
                </div>
              </div>

              {/* Operator / User Snapshot */}
              <div className="glass p-4 rounded-xl space-y-3">
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Operator Identity
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-sm"
                    style={{ backgroundColor: activeLogDetail.avatar_color || 'var(--brand)' }}
                  >
                    {(activeLogDetail.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--text-primary)] text-sm">
                      {activeLogDetail.full_name || 'System Operator'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={activeLogDetail.role || 'user'} size="xs" />
                      {activeLogDetail.department_name && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {activeLogDetail.department_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {activeLogDetail.email && (
                  <div className="pt-2 text-[11px] text-[var(--text-muted)] font-mono">
                    Email: {activeLogDetail.email}
                  </div>
                )}
              </div>

              {/* Technical / Network Audit Metadata */}
              <div className="glass p-4 rounded-xl space-y-2.5">
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Network & Context Origin
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-[var(--glass-border)]">
                    <span className="text-[var(--text-muted)] font-sans">IP Address</span>
                    <span className="text-[var(--text-primary)] font-bold">
                      {activeLogDetail.ip_address || 'Internal / Proxy (127.0.0.1)'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--glass-border)]">
                    <span className="text-[var(--text-muted)] font-sans">Timestamp (UTC)</span>
                    <span className="text-[var(--text-primary)]">
                      {activeLogDetail.created_at}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--glass-border)]">
                    <span className="text-[var(--text-muted)] font-sans">Entity ID</span>
                    <span className="text-[var(--text-primary)]">
                      {activeLogDetail.entity_id || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Links */}
              {activeLogDetail.entity_type === 'renewal' && activeLogDetail.entity_id && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      navigate(`/renewals/${activeLogDetail.entity_id}`);
                      setActiveLogDetail(null);
                    }}
                    className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>View Related Contract Record</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[var(--glass-border)] flex items-center justify-between flex-shrink-0 bg-black/5 dark:bg-white/5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                RMT Security Audit Engine
              </span>
              <button
                onClick={() => setActiveLogDetail(null)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
