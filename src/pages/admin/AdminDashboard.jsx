import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import {
  CalendarClock,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Users,
  MapPin,
  RefreshCw,
  Plus,
  Award,
  ChevronRight,
  Sparkles,
  PhoneCall,
  Tag
} from 'lucide-react';

const getImmediateAction = (item) => {
  if (!item) return { text: 'Review Contract', subtext: 'Pending review', badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30', dotClass: 'bg-slate-400' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = item.renewal_date ? new Date(item.renewal_date) : null;
  if (itemDate) itemDate.setHours(0, 0, 0, 0);

  const isDueToday = itemDate && itemDate.getTime() === today.getTime();
  const isOverdue = itemDate && itemDate.getTime() < today.getTime();

  if (item.status === 'Expired' || isOverdue) {
    if (item.follow_up_status === 'Client Agreed - Processing') {
      return {
        text: 'Finalize Renewal / PO',
        subtext: 'Client agreed, complete billing & receipt',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
        dotClass: 'bg-rose-500 animate-ping'
      };
    }
    return {
      text: 'Call Client Urgently',
      subtext: 'Overdue renewal requires immediate outreach',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
      dotClass: 'bg-rose-500 animate-ping'
    };
  }

  if (isDueToday) {
    return {
      text: 'Close Renewal Today',
      subtext: 'Contract expires before end of day',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
      dotClass: 'bg-amber-500 animate-pulse'
    };
  }

  if (item.renewal_confirmation === 'awaiting_client_approval' || item.renewal_confirmation === 'pending') {
    return {
      text: 'Confirm Client Decision',
      subtext: item.follow_up_status ? `${item.follow_up_status}` : 'Awaiting client confirmation',
      badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
      dotClass: 'bg-indigo-500'
    };
  }

  if (item.follow_up_status === 'Quote Sent' || item.invoice_status === 'pending') {
    return {
      text: 'Send Payment Request',
      subtext: 'Quoted sent, follow-up for PO/payment',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
      dotClass: 'bg-emerald-500'
    };
  }

  if (item.follow_up_status && item.follow_up_status !== 'Completed') {
    return {
      text: `Follow-up: ${item.follow_up_status}`,
      subtext: 'Scheduled client interaction',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30',
      dotClass: 'bg-blue-500'
    };
  }

  return {
    text: 'Account Review',
    subtext: 'Upcoming expiration audit',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30',
    dotClass: 'bg-slate-400'
  };
};

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [actionableItems, setActionableItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsRes, lbRes, actRes] = await Promise.all([
        fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/analytics/leaderboard', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ ok: false })),
        fetch('/api/dashboard/actionable-items?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ ok: false }))
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (lbRes && lbRes.ok) {
        setLeaderboard(await lbRes.json());
      }
      if (actRes && actRes.ok) {
        setActionableItems(await actRes.json());
      }
    } catch (err) {
      console.error('Admin Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const overdueCount = stats?.overdue || 0;
  const dueTodayCount = stats?.dueToday || 0;
  const pendingFollowups = stats?.pendingFollowups || 0;
  const pendingApproval = stats?.pendingClientApproval || 0;
  const quotesSent = stats?.quotesSent || 0;

  const reps = leaderboard?.byProfit || [];

  return (
    <div className="space-y-6 animate-fade-in pb-16 text-[var(--text-primary)]">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium mb-1">
            <span>Operations Command</span>
            <span>/</span>
            <span className="text-[var(--text-primary)] font-semibold">
              {user?.departmentName || 'Department Operations'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              Operations Command Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-brand-500/15 text-[var(--brand)] border border-brand-500/30">
              {user?.departmentName || 'Dept Admin'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
            Departmental renewal queue, daily intervention priorities, upcoming client deadlines, and team throughput.
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
            onClick={() => navigate('/renewals?create=1')}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Renewal</span>
          </button>
        </div>
      </div>

      {/* ── Today's Priority Action Queue ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
              <span>Today's Priorities & Action Queue</span>
              {overdueCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  {overdueCount} Critical Overdue
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/renewals')}
            className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
          >
            <span>Full Work Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Overdue */}
          <div
            onClick={() => navigate('/renewals?dateRange=expired')}
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
              overdueCount > 0
                ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50'
                : 'glass'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--danger)]">
                Overdue
              </span>
              <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
            </div>
            <div className="text-2xl font-black text-[var(--danger)]">
              {overdueCount}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">Expired accounts</p>
          </div>

          {/* Due Today */}
          <div
            onClick={() => navigate('/renewals?dateRange=today')}
            className="glass p-4 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--warning)]">
                Due Today
              </span>
              <Clock className="w-4 h-4 text-[var(--warning)]" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)]">
              {dueTodayCount}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">Expiring today</p>
          </div>

          {/* Follow-ups Pending */}
          <div
            onClick={() => navigate('/renewals?pendingFollowup=true')}
            className="glass p-4 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--info)]">
                Follow-ups
              </span>
              <CalendarClock className="w-4 h-4 text-[var(--info)]" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)]">
              {pendingFollowups}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">Pending contact</p>
          </div>

          {/* Awaiting Client Approval */}
          <div
            onClick={() => navigate('/renewals?renewalConfirmation=awaiting_client_approval')}
            className="glass p-4 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--brand)]">
                Awaiting Approval
              </span>
              <Send className="w-4 h-4 text-[var(--brand)]" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)]">
              {pendingApproval}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">Response awaited</p>
          </div>

          {/* Quotes Sent */}
          <div
            onClick={() => navigate('/renewals?quotesSent=true')}
            className="glass p-4 rounded-xl cursor-pointer hover:border-brand-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--success)]">
                Quotes Sent
              </span>
              <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div className="text-2xl font-black text-[var(--text-primary)]">
              {quotesSent}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 truncate">Invoiced / Quoted</p>
          </div>
        </div>
      </div>

      {/* ── Operational Commercial Metrics ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card p-5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Department Revenue
            </span>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {formatCurrency(stats?.revenue || 0)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-2">
              <span className="font-bold text-[var(--success)]">+{formatCurrency(stats?.profit || 0)}</span> gross margin
            </div>
          </div>

          <div className="stat-card p-5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Renewal Conversion Rate
            </span>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {stats?.conversionRate || 0}%
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-2">
              <span className="font-bold text-[var(--brand)]">{stats?.renewed || 0}</span> accounts completed
            </div>
          </div>

          <div className="stat-card p-5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              30-Day Expiry Horizon
            </span>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {stats?.upcoming || 0}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-2">
              Maturing within 30 days
            </div>
          </div>

          <div className="stat-card p-5 rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Pipeline at Stake
            </span>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {formatCurrency(stats?.expectedRevenue || 0)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-2">
              Unclosed pipeline exposure
            </div>
          </div>
        </div>
      )}

      {/* ── Department Immediate Action Required ── */}
      <div className="glass p-6 rounded-2xl space-y-4 border-t-2 border-amber-500/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[var(--text-primary)]">
                  Immediate Action Required
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Department Priorities
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Top departmental priorities requiring intervention today: overdue accounts, expiring contracts, and awaiting client decision
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/renewals?dateRange=expired')}
            className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All Priorities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">Loading priority action items...</div>
        ) : actionableItems.length === 0 ? (
          <div className="py-8 text-center bg-surface-50 dark:bg-surface-900/30 rounded-xl border border-dashed border-surface-200 dark:border-surface-700">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">All caught up!</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">No urgent overdue or due today items currently pending in your department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold bg-surface-50/50 dark:bg-surface-900/40">
                  <th className="py-3 px-4 rounded-l-xl">Client & Service</th>
                  <th className="py-3 px-4">Specialist</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Follow-up</th>
                  <th className="py-3 px-4">Immediate Action</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)] text-xs">
                {actionableItems.map((item) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const itemDate = item.renewal_date ? new Date(item.renewal_date) : null;
                  if (itemDate) itemDate.setHours(0, 0, 0, 0);

                  const isDueToday = itemDate && itemDate.getTime() === today.getTime();
                  const isOverdue = itemDate && itemDate.getTime() < today.getTime();
                  const action = getImmediateAction(item);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/renewals?search=${encodeURIComponent(item.client_name)}`)}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        <div className="truncate max-w-[190px] text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                          {item.client_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-[var(--text-muted)] border border-[var(--glass-border)]">
                            {item.unique_id || `#${item.id}`}
                          </span>
                          <span className="text-[11px] font-normal text-[var(--text-muted)] truncate max-w-[130px]">
                            {item.service}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-500/20 text-[var(--brand)] border border-brand-500/30 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {(item.owner || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-[var(--text-primary)]">
                            {item.owner || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isDueToday
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                            : isOverdue
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
                              : 'bg-surface-100 dark:bg-surface-800 text-[var(--text-primary)] border-[var(--glass-border)]'
                        }`}>
                          {item.renewal_date ? formatDate(item.renewal_date) : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)] whitespace-nowrap">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} size="xs" />
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap">
                        <span className="text-[11px] font-medium text-[var(--text-primary)]">
                          {item.follow_up_status || 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${action.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${action.dotClass}`}></span>
                            <span>{action.text}</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate max-w-[220px]">
                          {action.subtext}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/renewals?search=${encodeURIComponent(item.client_name)}`);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-[var(--brand)] bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <span>Review</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DEPARTMENT SPECIALISTS LEADERBOARD & REPS PERFORMANCE ── */}
      {reps.length > 0 && (
        <div className="glass p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--brand)]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                Department Specialist Leaderboard & Throughput
              </h2>
            </div>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
            >
              <span>View Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {reps.map((rep, idx) => (
              <div
                key={rep.id}
                onClick={() => navigate(`/renewals?owner=${encodeURIComponent(rep.fullName)}`)}
                className="stat-card p-4 rounded-xl hover:border-brand-500/40 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs flex-shrink-0"
                      style={{ backgroundColor: rep.avatarColor || 'var(--brand)' }}
                    >
                      {(rep.fullName || 'R').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                        {rep.fullName}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        {rep.ownedCount || 0} contracts assigned
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] font-bold">
                    #{idx + 1}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2 border-y border-[var(--glass-border)] text-xs mt-2 mb-2">
                  <div>
                    <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold block">Renewed</span>
                    <span className="font-mono font-bold text-[var(--success)]">
                      {rep.renewedCount || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold block">Profit</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {formatCurrency(rep.totalProfit || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {rep.followupsDue || 0} follow-ups due
                  </span>
                  {rep.overdueCount > 0 ? (
                    <span className="text-[10px] text-[var(--danger)] font-bold">
                      {rep.overdueCount} overdue
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--success)] font-semibold">
                      Clear
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Operational Management Links & Navigation ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/admin/users')}
          className="glass p-5 rounded-xl hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Specialists Roster</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Manage your departmental personnel, active roles, and assigned accounts.
          </p>
        </div>

        <div
          onClick={() => navigate('/analytics')}
          className="glass p-5 rounded-xl hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-[var(--success)]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Team Performance</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Inspect individual specialist renewal conversion rates, targets, and volume metrics.
          </p>
        </div>

        <div
          onClick={() => navigate('/visits')}
          className="glass p-5 rounded-xl hover:border-brand-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-[var(--info)]">
              <MapPin className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Client Visit Logs</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Track field engagements, client check-ins, and on-site meeting logs recorded by your team.
          </p>
        </div>
      </div>
    </div>
  );
}
