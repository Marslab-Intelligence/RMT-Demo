import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import {
  ShieldCheck,
  Users,
  History,
  Trash2,
  Mail,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Clock,
  Sparkles,
  Building2,
  Tag,
  DollarSign,
  PieChart,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, usersRes, deptsRes, logsRes, trashRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/admin/users', { headers }),
        fetch('/api/departments', { headers }),
        fetch('/api/dashboard/activity-logs?limit=8', { headers }).catch(() => ({ ok: false })),
        fetch('/api/renewals/trash/count', { headers }).catch(() => ({ ok: false })),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsersList(Array.isArray(uData) ? uData : (uData.users || []));
      }
      if (deptsRes.ok) {
        const dData = await deptsRes.json();
        setDepartmentsList(Array.isArray(dData) ? dData : (dData.departments || []));
      }
      if (logsRes && logsRes.ok) {
        const lData = await logsRes.json();
        setActivityLogs(Array.isArray(lData) ? lData : []);
      }
      if (trashRes && trashRes.ok) {
        const tData = await trashRes.json();
        setTrashCount(tData.count || 0);
      }
    } catch (err) {
      console.error('SuperAdmin Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // User distribution calculations
  const superAdminsCount = usersList.filter(u => u.role === 'super_admin').length;
  const deptAdminsCount = usersList.filter(u => u.role === 'dept_admin').length;
  const specialistsCount = usersList.filter(u => u.role === 'user').length;
  const activeUsersCount = usersList.filter(u => u.is_active !== false).length;

  return (
    <div className="space-y-6 animate-fade-in pb-16 text-[var(--text-primary)]">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium mb-1">
            <span>Enterprise Platform</span>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-semibold">Governance Cockpit</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Platform Control Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-brand-500/15 text-[var(--brand)] border border-brand-500/30">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
            Organization-wide operations, cross-department profitability, RBAC governance, and audit intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Users</span>
          </button>
        </div>
      </div>

      {/* ── Top Governance KPIs ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Users */}
          <div
            onClick={() => navigate('/admin/users')}
            className="stat-card p-5 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Organization Users
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {usersList.length}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--text-muted)] font-medium">
              <span className="text-[var(--success)] font-bold">{activeUsersCount} Active</span>
              <span>•</span>
              <span>{specialistsCount} Specialists</span>
            </div>
          </div>

          {/* Master Portfolio Value */}
          <div
            onClick={() => navigate('/renewals')}
            className="stat-card p-5 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Platform Contracts
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-[var(--success)]">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {formatCurrency(stats?.revenue || 0)}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--text-muted)] font-medium">
              <span className="text-[var(--success)] font-bold">{stats?.active || 0} Active</span>
              <span>•</span>
              <span className="text-[var(--danger)] font-bold">{stats?.overdue || 0} Overdue</span>
            </div>
          </div>

          {/* Platform Audit Sentinel */}
          <div
            onClick={() => navigate('/activity-logs')}
            className="stat-card p-5 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Audit Intelligence
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-[var(--brand)]">
                <History className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Active Sentinel
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--brand)] font-bold">
              <span>{activityLogs.length}+ events logged</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Trash & Quarantine */}
          <div
            onClick={() => navigate('/trash')}
            className="stat-card p-5 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Quarantine Trash
              </span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-[var(--danger)]">
                <Trash2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
              {trashCount}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--text-muted)] font-medium">
              <span>Protected in soft-delete vault</span>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPARTMENT PROFIT & LOSS PERFORMANCE MATRIX ── */}
      <div className="glass p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--brand)]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Department Profit & Loss Intelligence
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Cross-department comparison of contract revenue, partner procurement costs, and net margin generation
            </p>
          </div>
          <button
            onClick={() => navigate('/analytics')}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Full Analytics Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {departmentsList.map(dept => {
            const rev = dept.revenue || 0;
            const prof = dept.profit || 0;
            const cost = Math.max(0, rev - prof);
            const margin = dept.marginPct || 0;

            return (
              <div
                key={dept.id}
                onClick={() => navigate(`/analytics?deptId=${dept.id}`)}
                className="stat-card p-4 rounded-xl cursor-pointer hover:border-brand-500/40 hover:-translate-y-0.5 transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                      {dept.name}
                    </h3>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                      {dept.service_count || 0} services • {dept.user_count || 0} specialists
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      margin >= 20
                        ? 'bg-emerald-500/15 text-[var(--success)] border border-emerald-500/30'
                        : margin > 0
                        ? 'bg-amber-500/15 text-[var(--warning)] border border-amber-500/30'
                        : 'bg-black/10 dark:bg-white/10 text-[var(--text-muted)] border border-transparent'
                    }`}
                  >
                    {margin}% Margin
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--glass-border)] text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Revenue</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {formatCurrency(rev)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Cost</span>
                    <span className="font-mono font-medium text-[var(--warning)]">
                      {formatCurrency(cost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">Profit</span>
                    <span className="font-mono font-bold text-[var(--success)]">
                      {formatCurrency(prof)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>{dept.activeCount || 0} active contracts</span>
                  {dept.overdueCount > 0 ? (
                    <span className="text-[var(--danger)] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {dept.overdueCount} overdue
                    </span>
                  ) : (
                    <span className="text-[var(--success)] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      100% on schedule
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Middle Section: User Governance Roster & Administrative Shortcuts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Role Distribution Roster */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Platform Role & Access Governance
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Active users categorized by privilege scope and departmental ownership
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
            >
              <span>View All Users</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[var(--glass-border)] text-xs">
            {usersList.slice(0, 6).map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs"
                    style={{ background: u.avatar_color || 'var(--brand)' }}
                  >
                    {u.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <span>{u.full_name}</span>
                      {u.is_active === false && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-[var(--text-muted)] text-[11px] font-mono">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={u.role} size="xs" />
                  <span className="text-[11px] text-[var(--text-muted)] font-medium hidden sm:inline">
                    {u.department_name || (u.role === 'super_admin' ? 'Global Platform' : 'Unassigned')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Administrative Actions Panel */}
        <div className="glass p-6 rounded-2xl space-y-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Administrative Shortcuts
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Essential intervention workflows for Super Administrators
          </p>

          <div className="space-y-2 pt-2 text-xs">
            <button
              type="button"
              onClick={() => navigate('/admin/users?action=invite')}
              className="w-full p-3 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-indigo-500" />
                <span className="font-bold text-[var(--text-primary)]">
                  Provision User / Assign Role
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/activity-logs')}
              className="w-full p-3 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-[var(--brand)]" />
                <span className="font-bold text-[var(--text-primary)]">
                  Inspect Activity Intelligence
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/pricing')}
              className="w-full p-3 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-[var(--text-primary)]">
                  Vendor Pricing & ERP Margins
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/trash')}
              className="w-full p-3 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span className="font-bold text-[var(--text-primary)]">
                  Trash & Data Restoration Vault
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/automation')}
              className="w-full p-3 rounded-xl border border-[var(--glass-border)] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-[var(--text-primary)]">
                  Email Dispatch Automation
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
