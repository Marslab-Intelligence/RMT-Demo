import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MapPin,
  Tag,
  ArrowRight,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Sparkles,
  PhoneCall,
  Send
} from 'lucide-react';

const getImmediateAction = (item) => {
  if (!item) return { text: 'Review Contract', subtext: 'Pending check', badgeClass: 'bg-surface-500/15 text-surface-600 dark:text-surface-300 border-surface-500/30', dotClass: 'bg-surface-400' };

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
        subtext: 'Client agreed, process invoice & receipt',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
        dotClass: 'bg-rose-500 animate-ping'
      };
    }
    return {
      text: 'Call Client Urgently',
      subtext: 'Overdue contract requires immediate escalation',
      badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
      dotClass: 'bg-rose-500 animate-ping'
    };
  }

  if (isDueToday) {
    return {
      text: 'Close Renewal Today',
      subtext: 'Contract expires before end of business day',
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
      dotClass: 'bg-amber-500 animate-pulse'
    };
  }

  if (item.renewal_confirmation === 'awaiting_client_approval' || item.renewal_confirmation === 'pending') {
    return {
      text: 'Confirm Client Decision',
      subtext: item.follow_up_status ? `${item.follow_up_status}` : 'Awaiting client approval',
      badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
      dotClass: 'bg-indigo-500'
    };
  }

  if (item.follow_up_status === 'Quote Sent' || item.invoice_status === 'pending') {
    return {
      text: 'Send Payment Request',
      subtext: 'Quotation sent, follow-up for PO/payment',
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
      dotClass: 'bg-emerald-500'
    };
  }

  if (item.follow_up_status && item.follow_up_status !== 'Completed') {
    return {
      text: `Follow-up: ${item.follow_up_status}`,
      subtext: 'Scheduled client contact pending',
      badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30',
      dotClass: 'bg-blue-500'
    };
  }

  return {
    text: 'Client Check-in',
    subtext: 'Review upcoming expiration',
    badgeClass: 'bg-surface-500/15 text-surface-600 dark:text-surface-300 border border-surface-500/30',
    dotClass: 'bg-surface-400'
  };
};

export default function UserDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [actionableItems, setActionableItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsRes, actRes] = await Promise.all([
        fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/dashboard/actionable-items?limit=8', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ ok: false }))
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (actRes && actRes.ok) {
        setActionableItems(await actRes.json());
      }
    } catch (err) {
      console.error('User Dashboard fetch error:', err);
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
  const quotesSent = stats?.quotesSent || 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <PageHeader
        title={`Welcome back, ${user?.fullName || 'Specialist'}`}
        subtitle="Here is your personal renewal queue, accounts requiring follow-up, and upcoming deadlines today"
        badge={user?.categoryName ? `Service: ${user.categoryName}` : 'My Workspace'}
        badgeColor="emerald"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs font-bold text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/renewals?create=1')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-bold hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </button>
          </div>
        }
      />

      {/* ── My Work Today (Personal Priorities) ── */}
      <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-surface-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span>My Priorities Today</span>
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Action items directly assigned to your account and service category
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/renewals')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors"
          >
            <span>Open Worklist</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Overdue */}
          <div
            onClick={() => navigate('/renewals?dateRange=expired')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              overdueCount > 0
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 shadow-xs'
                : 'glass-card border-surface-200/80 dark:border-surface-700/80'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Overdue</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
              {overdueCount}
            </div>
            <span className="text-[11px] text-surface-500">Requires follow-up</span>
          </div>

          {/* Due Today */}
          <div
            onClick={() => navigate('/renewals?dateRange=today')}
            className="p-4 rounded-xl glass-card border border-surface-200/80 dark:border-surface-700/80 transition-all cursor-pointer hover:border-amber-400"
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Due Today</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-surface-900 dark:text-white">
              {dueTodayCount}
            </div>
            <span className="text-[11px] text-surface-500">Expiring today</span>
          </div>

          {/* Follow-ups Pending */}
          <div
            onClick={() => navigate('/renewals?pendingFollowup=true')}
            className="p-4 rounded-xl glass-card border border-surface-200/80 dark:border-surface-700/80 transition-all cursor-pointer hover:border-blue-400"
          >
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Follow-ups</span>
              <PhoneCall className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-surface-900 dark:text-white">
              {pendingFollowups}
            </div>
            <span className="text-[11px] text-surface-500">Calls / Emails logged</span>
          </div>

          {/* Quotes Sent */}
          <div
            onClick={() => navigate('/renewals?quotesSent=true')}
            className="p-4 rounded-xl glass-card border border-surface-200/80 dark:border-surface-700/80 transition-all cursor-pointer hover:border-emerald-400"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Quotes Sent</span>
              <Send className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-surface-900 dark:text-white">
              {quotesSent}
            </div>
            <span className="text-[11px] text-surface-500">Awaiting payment</span>
          </div>
        </div>
      </div>

      {/* ── My Personal Pipeline Summary ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">My Total Assigned</span>
            <div className="text-2xl font-black text-surface-950 dark:text-white mt-1">
              {stats?.total || 0}
            </div>
            <div className="text-xs text-surface-500 mt-2">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats?.active || 0}</span> active contracts
            </div>
          </div>

          <div className="glass p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">My Renewed Accounts</span>
            <div className="text-2xl font-black text-surface-950 dark:text-white mt-1">
              {stats?.renewed || 0}
            </div>
            <div className="text-xs text-surface-500 mt-2">
              Conversion rate: <span className="font-bold text-brand-600 dark:text-brand-400">{stats?.conversionRate || 0}%</span>
            </div>
          </div>

          <div className="glass p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">Maturing in 30 Days</span>
            <div className="text-2xl font-black text-surface-950 dark:text-white mt-1">
              {stats?.upcoming || 0}
            </div>
            <div className="text-xs text-surface-500 mt-2">
              Immediate client outreach window
            </div>
          </div>

          <div className="glass p-5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500">My Portfolio Revenue</span>
            <div className="text-2xl font-black text-surface-950 dark:text-white mt-1">
              {formatCurrency(stats?.revenue || 0)}
            </div>
            <div className="text-xs text-surface-500 mt-2">
              Contract value under your care
            </div>
          </div>
        </div>
      )}

      {/* ── Immediate Action Required (Personal Priorities Needing Attention) ── */}
      <div className="glass p-6 rounded-2xl shadow-xs space-y-4 border-t-2 border-amber-500/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-surface-900 dark:text-white">
                  Immediate Action Required
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Today's Intervention
                </span>
              </div>
              <p className="text-xs text-surface-500 mt-0.5">
                Top priorities needing attention today: renewals due today, overdue, or pending client decision
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/renewals?dateRange=expired')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 self-start sm:self-auto transition-colors"
          >
            <span>View All Priorities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-surface-500">Loading priority action items...</div>
        ) : actionableItems.length === 0 ? (
          <div className="py-8 text-center bg-surface-50 dark:bg-surface-900/30 rounded-xl border border-dashed border-surface-200 dark:border-surface-700">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">All caught up!</p>
            <p className="text-xs text-surface-500 mt-1">No high-priority overdue or due today items currently pending in your service.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700/60 text-[11px] uppercase tracking-wider text-surface-500 dark:text-surface-400 font-bold bg-surface-50/50 dark:bg-surface-900/40">
                  <th className="py-3 px-4 rounded-l-xl">Client & Service</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Follow-up</th>
                  <th className="py-3 px-4">Immediate Action</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200/60 dark:divide-surface-700/40 text-xs">
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
                      <td className="py-3 px-4 font-semibold text-surface-900 dark:text-white">
                        <div className="truncate max-w-[200px] text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500 transition-colors">
                          {item.client_name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 border border-surface-200/60 dark:border-surface-700/60">
                            {item.unique_id || `#${item.id}`}
                          </span>
                          <span className="text-[11px] font-normal text-surface-500 truncate max-w-[150px]">
                            {item.service}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isDueToday
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 animate-pulse'
                            : isOverdue
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-200 dark:border-surface-700'
                        }`}>
                          {item.renewal_date ? formatDate(item.renewal_date) : 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-surface-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={item.status} size="xs" />
                      </td>
                      <td className="py-3 px-4 text-surface-600 dark:text-surface-300 whitespace-nowrap">
                        <span className="text-[11px] font-medium text-surface-700 dark:text-surface-300">
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
                        <div className="text-[10px] text-surface-400 mt-0.5 truncate max-w-[220px]">
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
                          className="px-2.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <span>Take Action</span>
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

      {/* ── Quick Specialist Execution Tools ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/renewals')}
          className="glass p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-surface-900 dark:text-white">My Renewals Worklist</h3>
          <p className="text-xs text-surface-500 mt-1">
            Access, filter, update statuses, or log notes for all clients assigned to you.
          </p>
        </div>

        <div
          onClick={() => navigate('/visits')}
          className="glass p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-surface-900 dark:text-white">Log Client Visit / Call</h3>
          <p className="text-xs text-surface-500 mt-1">
            Record meeting minutes, client feedback, on-site audits, or verification photos.
          </p>
        </div>

        <div
          onClick={() => navigate('/pricing')}
          className="glass p-5 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Tag className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-surface-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="font-bold text-sm text-surface-900 dark:text-white">Pricing & Quotes</h3>
          <p className="text-xs text-surface-500 mt-1">
            Calculate pricing, profit margins, and discounts before issuing client quotes.
          </p>
        </div>
      </div>
    </div>
  );
}
