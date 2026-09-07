import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  IndianRupee,
  Clock,
  ArrowUpRight,
  Bell,
  TrendingUp,
  FileText,
  Percent,
  PhoneCall,
  ArrowRight,
  Sparkles,
  Calendar,
  Download,
  ChevronDown,
  X
} from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import MetricCard from '../components/common/MetricCard';
import AreaGraphVisualizer from '../components/AreaGraphVisualizer';
import RadialGauge from '../components/RadialGauge';
import IndianDateInput from '../components/IndianDateInput';

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This month', thisMonth: true },
];

const formatRangeLabel = (start, end) => {
  const opts = { month: 'short', day: 'numeric' };
  return `${new Date(start).toLocaleDateString('en-US', opts)} – ${new Date(end).toLocaleDateString('en-US', opts)}`;
};

const ACTION_QUEUE_CONFIG = [
  { key: 'dueToday', label: 'Due today', filter: 'dateRange=today' },
  { key: 'overdue', label: 'Overdue', filter: 'dateRange=expired' },
  { key: 'followupsDueToday', label: 'Follow-ups pending', filter: 'pendingFollowup=true' },
  { key: 'clientResponse', label: 'Awaiting client response', filter: 'renewalConfirmation=awaiting_client_approval' },
  { key: 'quotePending', label: 'Quotes pending', filter: 'quotesSent=true' },
  { key: 'paymentPending', label: 'Payment pending', filter: 'paymentStatus=No' }
];

export default function Dashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(null); // Portfolio Attainment quarter tab; null = "All" (current month)
  const [actionableItems, setActionableItems] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [actionQueue, setActionQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalClosed, setIsModalClosed] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  // Top-right date-range filter — scopes the revenue trend chart and the
  // upcoming-renewals board to a window the user picks. dueToday/overdue/etc.
  // stay as live snapshots (unaffected): they're "as of right now" figures
  // computed server-side, not a time series RMT stores, so filtering them to
  // an arbitrary past window would mean fabricating numbers.
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const dateFilterRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target)) {
        setShowDateFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (preset) => {
    const end = new Date();
    let start;
    if (preset.thisMonth) {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else {
      start = new Date();
      start.setDate(start.getDate() - preset.days);
    }
    setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
  };

  const clearDateRange = () => setDateRange({ start: null, end: null });

  const isDateFiltered = Boolean(dateRange.start && dateRange.end);

  const filteredMonthlyData = useMemo(() => {
    if (!isDateFiltered) return monthlyData;
    const startMonth = dateRange.start.slice(0, 7);
    const endMonth = dateRange.end.slice(0, 7);
    return monthlyData.filter((m) => m.month >= startMonth && m.month <= endMonth);
  }, [monthlyData, isDateFiltered, dateRange]);

  const filteredActionableItems = useMemo(() => {
    if (!isDateFiltered) return actionableItems;
    return actionableItems.filter((item) => {
      if (!item.renewal_date) return false;
      const d = new Date(item.renewal_date).toISOString().slice(0, 10);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [actionableItems, isDateFiltered, dateRange]);

  const filteredRevenueTotal = filteredMonthlyData.reduce((sum, m) => sum + (parseFloat(m.revenue) || 0), 0);

  const handleExport = () => {
    const rows = filteredMonthlyData.map((m) => ({
      month: m.month,
      renewals: m.count,
      revenue: m.revenue,
      profit: m.profit,
    }));
    if (rows.length === 0) {
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map((r) => Object.values(r).join(',')).join('\n');
    const csv = `data:text/csv;charset=utf-8,${headers}\n${body}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `dashboard-summary${isDateFiltered ? `_${dateRange.start}_to_${dateRange.end}` : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const hasNotifications = user?.role === 'user' || (user?.role === 'super_admin' || user?.role === 'dept_admin');

        const promises = [
          fetch('/api/dashboard/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/dashboard/actionable-items?limit=8', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/dashboard/charts/monthly', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/dashboard/notification-center', { headers: { 'Authorization': `Bearer ${token}` } })
        ];

        if (hasNotifications) {
          promises.push(
            fetch('/api/dashboard/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
          );
        }

        const results = await Promise.all(promises);

        if (results[0].ok) setStats(await results[0].json());
        if (results[1].ok) setActionableItems(await results[1].json());
        if (results[2].ok) setMonthlyData(await results[2].json());
        if (results[3].ok) setActionQueue(await results[3].json());

        if (hasNotifications) {
          if (results[4]?.ok) {
            const data = await results[4].json();
            const fetched = data.notifications || [];
            setNotifications(fetched);
            const filtered = fetched.filter(notif => notif.title?.toLowerCase() !== 'email sent');
            const unreadCount = filtered.filter(n => n.read === 0).length;
            setPrevUnreadCount(unreadCount);
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchData();
    }
  }, [token, user]);

  useEffect(() => {
    if (!token || (user?.role !== 'user' && (user?.role !== 'super_admin' && user?.role !== 'dept_admin'))) return;
    
    const fetchNotificationsOnly = async () => {
      try {
        const res = await fetch('/api/dashboard/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const fetched = data.notifications || [];
          setNotifications(fetched);
          
          const filtered = fetched.filter(notif => notif.title?.toLowerCase() !== 'email sent');
          const unreadCount = filtered.filter(n => n.read === 0).length;
          
          setPrevUnreadCount(prev => {
            if (unreadCount > prev) {
              setIsModalClosed(false);
            }
            return unreadCount;
          });
        }
      } catch (err) {
        console.error('Failed to fetch notifications in background', err);
      }
    };

    const interval = setInterval(fetchNotificationsOnly, 8000);
    return () => clearInterval(interval);
  }, [token, user]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  // Phase 2 Actionable Widgets Grid (10 iPhone Liquid Glass Widgets)
  const widgets = [
    {
      id: 'dueToday',
      title: 'Renewals Due Today',
      value: stats?.dueToday || 0,
      badgeText: 'Action Today',
      icon: CalendarCheck,
      cardStyle: 'bg-gradient-to-br from-amber-500/15 via-amber-400/10 to-amber-500/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-slate-900/60 border-amber-400/50 dark:border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-500/80 hover:shadow-amber-500/15 backdrop-blur-xl',
      iconStyle: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40',
      badgeStyle: 'bg-amber-500/20 text-amber-950 dark:text-amber-200 border border-amber-500/40 font-bold',
      onClick: () => navigate('/renewals?dateRange=today')
    },
    {
      id: 'dueThisWeek',
      title: 'Renewals Due This Week',
      value: stats?.dueThisWeek || 0,
      badgeText: 'Next 7 Days',
      icon: CalendarDays,
      cardStyle: 'bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-indigo-500/5 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-slate-900/60 border-indigo-400/50 dark:border-indigo-500/40 shadow-lg shadow-indigo-500/5 hover:border-indigo-500/80 hover:shadow-indigo-500/15 backdrop-blur-xl',
      iconStyle: 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-500/40',
      badgeStyle: 'bg-indigo-500/20 text-indigo-950 dark:text-indigo-200 border border-indigo-500/40 font-bold',
      onClick: () => navigate('/renewals?dateRange=next7')
    },
    {
      id: 'dueThisMonth',
      title: 'Renewals Due This Month',
      value: stats?.dueThisMonth || 0,
      badgeText: 'Current Month',
      icon: CalendarClock,
      cardStyle: 'bg-gradient-to-br from-sky-500/15 via-cyan-500/10 to-sky-500/5 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-slate-900/60 border-sky-400/50 dark:border-sky-500/40 shadow-lg shadow-sky-500/5 hover:border-sky-500/80 hover:shadow-sky-500/15 backdrop-blur-xl',
      iconStyle: 'bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-500/40',
      badgeStyle: 'bg-sky-500/20 text-sky-950 dark:text-sky-200 border border-sky-500/40 font-bold',
      onClick: () => navigate('/renewals?dateRange=this_month')
    },
    {
      id: 'overdue',
      title: 'Overdue Renewals',
      value: stats?.overdue || 0,
      badgeText: 'Urgent',
      icon: AlertTriangle,
      cardStyle: 'bg-gradient-to-br from-rose-500/15 via-red-500/10 to-rose-500/5 dark:from-rose-950/40 dark:via-red-950/30 dark:to-slate-900/60 border-rose-400/50 dark:border-rose-500/40 shadow-lg shadow-rose-500/5 hover:border-rose-500/80 hover:shadow-rose-500/15 backdrop-blur-xl',
      iconStyle: 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40',
      badgeStyle: 'bg-rose-500/20 text-rose-950 dark:text-rose-200 border border-rose-500/40 font-bold',
      onClick: () => navigate('/renewals?dateRange=expired')
    },
    {
      id: 'pendingClientApproval',
      title: 'Pending Client Approval',
      value: stats?.pendingClientApproval || 0,
      badgeText: 'Decision Needed',
      icon: Clock,
      cardStyle: 'bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-orange-500/5 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-slate-900/60 border-orange-400/50 dark:border-orange-500/40 shadow-lg shadow-orange-500/5 hover:border-orange-500/80 hover:shadow-orange-500/15 backdrop-blur-xl',
      iconStyle: 'bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-500/40',
      badgeStyle: 'bg-orange-500/20 text-orange-950 dark:text-orange-200 border border-orange-500/40 font-bold',
      onClick: () => navigate('/renewals?renewalConfirmation=pending')
    },
    {
      id: 'quotesSent',
      title: 'Quotes Sent',
      value: stats?.quotesSent || 0,
      badgeText: 'Invoices/Quotes',
      icon: FileText,
      cardStyle: 'bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-blue-500/5 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/60 border-blue-400/50 dark:border-blue-500/40 shadow-lg shadow-blue-500/5 hover:border-blue-500/80 hover:shadow-blue-500/15 backdrop-blur-xl',
      iconStyle: 'bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-500/40',
      badgeStyle: 'bg-blue-500/20 text-blue-950 dark:text-blue-200 border border-blue-500/40 font-bold',
      onClick: () => navigate('/renewals?quotesSent=true')
    },
    {
      id: 'revenueThisMonth',
      title: 'Revenue This Month',
      value: formatCurrency(stats?.revenueThisMonth || 0),
      badgeText: 'MTD Confirmed',
      icon: IndianRupee,
      cardStyle: 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900/60 border-emerald-400/50 dark:border-emerald-500/40 shadow-lg shadow-emerald-500/5 hover:border-emerald-500/80 hover:shadow-emerald-500/15 backdrop-blur-xl',
      iconStyle: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40',
      badgeStyle: 'bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border border-emerald-500/40 font-bold',
      onClick: () => navigate('/renewals?status=Renewed')
    },
    {
      id: 'expectedRevenue',
      title: 'Expected Renewal Revenue',
      value: formatCurrency(stats?.expectedRevenue || 0),
      badgeText: 'Pipeline',
      icon: TrendingUp,
      cardStyle: 'bg-gradient-to-br from-purple-500/15 via-fuchsia-500/10 to-purple-500/5 dark:from-purple-950/40 dark:via-fuchsia-950/30 dark:to-slate-900/60 border-purple-400/50 dark:border-purple-500/40 shadow-lg shadow-purple-500/5 hover:border-purple-500/80 hover:shadow-purple-500/15 backdrop-blur-xl',
      iconStyle: 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/40',
      badgeStyle: 'bg-purple-500/20 text-purple-950 dark:text-purple-200 border border-purple-500/40 font-bold',
      onClick: () => navigate('/renewals?status=Active')
    },
    {
      id: 'conversionRate',
      title: 'Renewal Conversion Rate',
      value: `${stats?.conversionRate || 0}%`,
      badgeText: 'Performance',
      icon: Percent,
      cardStyle: 'bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-teal-500/5 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-slate-900/60 border-teal-400/50 dark:border-teal-500/40 shadow-lg shadow-teal-500/5 hover:border-teal-500/80 hover:shadow-teal-500/15 backdrop-blur-xl',
      iconStyle: 'bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/40',
      badgeStyle: 'bg-teal-500/20 text-teal-950 dark:text-teal-200 border border-teal-500/40 font-bold',
      onClick: () => navigate('/reports')
    },
    {
      id: 'pendingFollowups',
      title: 'Pending Follow-ups',
      value: stats?.pendingFollowups || 0,
      badgeText: 'Outreach Required',
      icon: PhoneCall,
      cardStyle: 'bg-gradient-to-br from-fuchsia-500/15 via-pink-500/10 to-fuchsia-500/5 dark:from-fuchsia-950/40 dark:via-pink-950/30 dark:to-slate-900/60 border-fuchsia-400/50 dark:border-fuchsia-500/40 shadow-lg shadow-fuchsia-500/5 hover:border-fuchsia-500/80 hover:shadow-fuchsia-500/15 backdrop-blur-xl',
      iconStyle: 'bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-500/40',
      badgeStyle: 'bg-fuchsia-500/20 text-fuchsia-950 dark:text-fuchsia-200 border border-fuchsia-500/40 font-bold',
      onClick: () => navigate('/renewals?pendingFollowup=true')
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const extractClientFromNotification = (notif) => {
    if (notif.link) return notif.link;

    const msg = notif.message;
    if (!msg) return null;

    if (msg.includes('CST team requested edit access for ')) {
      return '/renewals?search=' + encodeURIComponent(msg.split('CST team requested edit access for ')[1].trim());
    }
    if (msg.includes('Edit approved for ')) {
      return '/renewals?search=' + encodeURIComponent(msg.split('Edit approved for ')[1].trim());
    }
    if (msg.includes('New renewal created for ')) {
      const after = msg.split('New renewal created for ')[1];
      const client = after.split(' (')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }
    if (msg.includes('Please meet ')) {
      const after = msg.split('Please meet ')[1];
      const client = after.split(' regarding')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }
    if (msg.includes(' reminder sent for ')) {
      const after = msg.split(' reminder sent for ')[1];
      const client = after.split(' (')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }
    if (msg.includes("'s ") && msg.includes(" renewal has expired")) {
      const client = msg.split("'s ")[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }
    if (msg.includes('Renewal processed for ')) {
      const after = msg.split('Renewal processed for ')[1];
      const client = after.split('.')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    return null;
  };

  const handleNotificationClick = async (notif) => {
    if (notif.read === 0) {
      try {
        await fetch(`/api/dashboard/notifications/${notif.id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: 1 } : n));
      } catch (err) {
        console.error('Failed to mark notification as read', err);
      }
    }
    const path = extractClientFromNotification(notif);
    if (path) {
      navigate(path);
    }
  };

  const handleMarkRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setPrevUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await fetch(`/api/dashboard/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setPrevUnreadCount(0);
    setIsModalClosed(true);
    try {
      await fetch('/api/dashboard/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  };

  const filteredNotifications = notifications.filter(notif => notif.title?.toLowerCase() !== 'email sent');
  const unreadNotifications = filteredNotifications.filter(n => n.read === 0);

  // Attainment gauges — three ratios that have a natural 100% ceiling (unlike
  // most of RMT's data, which has no stored "target"/quota field), so each
  // can honestly be shown as "% of target" without fabricating a goal number.
  const conversionPct = stats?.conversionRate || 0;
  const retentionPct = stats?.total > 0
    ? Math.round((stats.active / stats.total) * 100)
    : 0;

  // Quarter selector for the attainment card — always shows real calendar
  // quarters (Q1 = Jan-Mar, ... Q4 = Oct-Dec) of the current year, so the
  // tabs are always present regardless of how much data is loaded. Only
  // "Revenue Capture" reacts to it: it's the only one of the three gauges
  // with real per-month figures (monthlyData) behind it. Conversion &
  // retention are live snapshots — RMT doesn't store a historical breakdown
  // for those — so they stay constant across quarters, labeled as such.
  const currentYear = new Date().getFullYear();
  const calendarQuarters = [0, 1, 2, 3].map((q) => {
    const monthNums = [q * 3 + 1, q * 3 + 2, q * 3 + 3];
    return monthNums.map((n) => `${currentYear}-${String(n).padStart(2, '0')}`);
  });

  let revenueCapturePct = 0;
  let revenueCaptureSublabel = `${formatCurrency(stats?.revenueThisMonth || 0)} of ${formatCurrency(stats?.expectedRevenue || 0)}`;
  if (selectedQuarterIdx === null) {
    revenueCapturePct = stats?.expectedRevenue > 0
      ? Math.round((stats.revenueThisMonth / stats.expectedRevenue) * 100)
      : 0;
  } else {
    const quarterMonthKeys = calendarQuarters[selectedQuarterIdx];
    const quarterRevenue = monthlyData
      .filter((m) => quarterMonthKeys.includes(m.month))
      .reduce((sum, m) => sum + (parseFloat(m.revenue) || 0), 0);
    const perQuarterTarget = (stats?.expectedRevenue || 0) / 4;
    revenueCapturePct = perQuarterTarget > 0 ? Math.round((quarterRevenue / perQuarterTarget) * 100) : 0;
    const monthLabels = quarterMonthKeys.map((m) => {
      const d = new Date(`${m}-01`);
      return isNaN(d) ? m : d.toLocaleDateString('en-US', { month: 'short' });
    }).join('–');
    revenueCaptureSublabel = `${formatCurrency(quarterRevenue)} in ${monthLabels}`;
  }

  const blendedAttainment = Math.round((conversionPct + revenueCapturePct + retentionPct) / 3);

  return (
    <div className="space-y-8 pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard</h1>
          <p className="text-slate-800 dark:text-surface-400 mt-1 text-sm">
            Welcome back, <span className="font-semibold text-black dark:text-surface-200">{user?.fullName}</span>. Prioritize immediate actions and manage upcoming renewals.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div ref={dateFilterRef} className="relative">
            <button
              onClick={() => setShowDateFilter((v) => !v)}
              className="dropdown-btn-glass h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="font-semibold">
                {isDateFiltered ? formatRangeLabel(dateRange.start, dateRange.end) : 'All time'}
              </span>
              {isDateFiltered ? (
                <span
                  onClick={(e) => { e.stopPropagation(); clearDateRange(); }}
                  className="p-0.5 -mr-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </span>
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {showDateFilter && (
              <div className="absolute right-0 mt-2 w-72 dropdown-menu-glass z-50 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2">Quick ranges</p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => { applyPreset(preset); setShowDateFilter(false); }}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-black/[0.03] dark:bg-white/[0.05] hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400 text-surface-700 dark:text-surface-300 transition-colors text-left"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2">Custom range</p>
                <div className="grid grid-cols-2 gap-2">
                  <IndianDateInput
                    value={dateRange.start}
                    onChange={(val) => setDateRange((prev) => ({ ...prev, start: val }))}
                    placeholder="Start"
                    size="sm"
                  />
                  <IndianDateInput
                    value={dateRange.end}
                    onChange={(val) => setDateRange((prev) => ({ ...prev, end: val }))}
                    placeholder="End"
                    size="sm"
                  />
                </div>
                {isDateFiltered && (
                  <button
                    onClick={() => { clearDateRange(); setShowDateFilter(false); }}
                    className="w-full mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={filteredMonthlyData.length === 0}
            className="btn-secondary h-9 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export the currently filtered monthly summary as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Primary stat row — highest-signal metrics, Dashboard-11 style */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        {[
          { id: 'dueToday', title: 'Due Today', value: stats?.dueToday || 0, icon: CalendarCheck, color: 'amber', badgeText: 'Today', onClick: () => navigate('/renewals?dateRange=today') },
          { id: 'dueThisWeek', title: 'Due This Week', value: stats?.dueThisWeek || 0, icon: CalendarDays, color: 'cyan', badgeText: '7 Days', onClick: () => navigate('/renewals?dateRange=next7') },
          { id: 'overdue', title: 'Overdue', value: stats?.overdue || 0, icon: AlertTriangle, color: 'rose', badgeText: 'Urgent', onClick: () => navigate('/renewals?dateRange=expired') },
          { id: 'pendingClientApproval', title: 'Approvals', value: stats?.pendingClientApproval || 0, icon: Clock, color: 'purple', badgeText: 'Open', onClick: () => navigate('/renewals?renewalConfirmation=pending') },
          { id: 'revenueThisMonth', title: 'Revenue This Month', value: formatCurrency(stats?.revenueThisMonth || 0), icon: IndianRupee, color: 'emerald', badgeText: 'MTD', onClick: () => navigate('/renewals?status=Renewed') },
        ].map((m) => (
          <motion.div key={m.id} variants={item}>
            <MetricCard title={m.title} value={m.value} icon={m.icon} color={m.color} badgeText={m.badgeText} onClick={m.onClick} />
          </motion.div>
        ))}
      </motion.div>

      {/* Secondary metrics row — same compact single-row card shape as the
          primary stat row above it (icon + title/badge + value), just kept
          on each widget's own gradient palette instead of MetricCard's. */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
      >
        {widgets.filter(w => ['dueThisMonth', 'quotesSent', 'expectedRevenue', 'conversionRate', 'pendingFollowups'].includes(w.id)).map((widget) => {
          const Icon = widget.icon;
          return (
            <motion.div
              key={widget.id}
              variants={item}
              onClick={widget.onClick}
              className={`group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 flex items-center gap-3.5 shadow-lg shadow-black/5 hover:-translate-y-1 hover:shadow-xl cursor-pointer ${widget.cardStyle}`}
            >
              <div className="pointer-events-none absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent" />

              <div className={`p-3 rounded-xl border flex-shrink-0 backdrop-blur-md transition-transform duration-300 group-hover:scale-105 ${widget.iconStyle}`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[8px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-400 leading-tight">
                    {widget.title}
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-extrabold uppercase tracking-wide border backdrop-blur-md flex-shrink-0 whitespace-nowrap ${widget.badgeStyle}`}>
                    {widget.badgeText}
                  </span>
                </div>
                <p className="text-lg sm:text-xl font-black text-slate-950 dark:text-white mt-1 leading-none tracking-tight">
                  {widget.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Portfolio attainment — radial gauges against a natural 100% target */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="card p-6 shadow-md"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Portfolio Attainment</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              {selectedQuarterIdx === null
                ? 'Live performance against a 100% target'
                : 'Revenue Capture shown for the selected quarter · Conversion & Retention are live totals'}
            </p>
          </div>

          <div className="flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl w-fit">
            <button
              onClick={() => setSelectedQuarterIdx(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedQuarterIdx === null ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                onClick={() => setSelectedQuarterIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedQuarterIdx === idx ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Q{idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-around gap-8">
          <RadialGauge
            percent={conversionPct}
            color="#10b981"
            label="Renewal Conversion"
            sublabel={`${stats?.renewed || 0} of ${stats?.total || 0} renewed`}
          />
          <RadialGauge
            percent={revenueCapturePct}
            color="#6366f1"
            label="Revenue Capture"
            sublabel={revenueCaptureSublabel}
          />
          <RadialGauge
            percent={retentionPct}
            color="#f59e0b"
            label="Active Retention"
            sublabel={`${stats?.active || 0} of ${stats?.total || 0} active`}
          />
        </div>

        <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Blended attainment</span>
          <span className="text-sm font-black text-slate-900 dark:text-white">{blendedAttainment}%</span>
        </div>
      </motion.div>

      {/* Board + Chart (left) / Action Queue (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: upcoming renewals board + revenue trend */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-6 shadow-md"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white">Upcoming renewals</h2>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    {isDateFiltered
                      ? `Showing ${filteredActionableItems.length} of ${actionableItems.length} matching ${formatRangeLabel(dateRange.start, dateRange.end)}`
                      : 'Due today, overdue, or waiting on a client decision'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/renewals?dateRange=expired')}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {filteredActionableItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={isDateFiltered ? 'Nothing in this range' : 'All caught up!'}
                description={isDateFiltered ? 'No renewals fall within the selected date range.' : 'No high-priority overdue or due today items currently pending.'}
                compact={true}
                className="py-6"
              />
            ) : (
              <div className="divide-y divide-slate-200/50 dark:divide-white/5">
                {filteredActionableItems.map((rItem) => (
                  <div
                    key={rItem.id}
                    onClick={() => navigate(`/renewals?search=${encodeURIComponent(rItem.client_name)}`)}
                    className="flex items-center gap-3 py-3 cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 bg-gradient-to-br from-brand-500 to-brand-700">
                      {rItem.client_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{rItem.client_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rItem.service}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(rItem.value)}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {rItem.renewal_date ? formatDate(rItem.renewal_date) : 'N/A'}
                      </p>
                    </div>
                    <StatusBadge status={rItem.status} size="xs" />
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/renewals?search=${encodeURIComponent(rItem.client_name)}`); }}
                      className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-brand-700 dark:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-xl transition-all border border-brand-500/20"
                    >
                      Review <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <AreaGraphVisualizer
              title={isDateFiltered ? `Revenue Trend (${formatRangeLabel(dateRange.start, dateRange.end)})` : 'Renewal Revenue Trend'}
              type="profit"
              totalValue={isDateFiltered ? filteredRevenueTotal : (stats?.revenueThisMonth || 0)}
              monthlyData={filteredMonthlyData}
              height="h-[280px]"
            />
          </motion.div>
        </div>

        {/* Right: action queue */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="card p-5 shadow-md lg:sticky lg:top-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Action queue</h2>
            {actionQueue?.categories && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {Object.values(actionQueue.categories).reduce((a, b) => a + b, 0)} before cutoff
              </span>
            )}
          </div>

          {!actionQueue?.categories || Object.values(actionQueue.categories).every(v => !v) ? (
            <EmptyState icon={CheckCircle2} title="Queue is clear" description="Nothing needs attention right now." compact className="py-4" />
          ) : (
            <div className="space-y-2">
              {ACTION_QUEUE_CONFIG.filter(c => (actionQueue.categories[c.key] || 0) > 0).map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{c.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{actionQueue.categories[c.key]} item{actionQueue.categories[c.key] > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/renewals?${c.filter}`)}
                    className="flex-shrink-0 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg transition-all border border-brand-500/20"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Cutoff: end of day</span>
            <span>{unreadNotifications.length} unread update{unreadNotifications.length !== 1 ? 's' : ''}</span>
          </div>
        </motion.div>
      </div>

      {/* Unread Notifications Alert Modal */}
      {(user?.role === 'user' || (user?.role === 'super_admin' || user?.role === 'dept_admin')) && unreadNotifications.length > 0 && !isModalClosed && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-emerald-600 px-6 py-4 flex items-center gap-3 text-white">
              <div className="bg-white/20 p-2 rounded-lg animate-bounce">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">New System Updates</h3>
                <p className="text-xs text-white/80">You have {unreadNotifications.length} unread update{unreadNotifications.length > 1 ? 's' : ''} to review</p>
              </div>
            </div>

            {/* Notifications List */}
            <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar space-y-4">
              {unreadNotifications.map((notif) => {
                const notifColorMap = {
                  success: 'bg-emerald-500',
                  warning: 'bg-amber-500',
                  error: 'bg-rose-500',
                  info: 'bg-blue-500'
                };
                const bulletColor = notifColorMap[notif.type] || 'bg-brand-500';
                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className="flex items-start gap-4 p-4 rounded-xl bg-surface-50 dark:bg-surface-900/40 border border-surface-200/60 dark:border-surface-700/50 cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-800/60 transition-colors text-left"
                  >
                    <div className={`w-3 h-3 rounded-full ${bulletColor} mt-1.5 flex-shrink-0 animate-pulse`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-bold text-surface-900 dark:text-white">{notif.title}</h4>
                        <span className="text-[10px] text-surface-400 font-medium">{formatDateTime(notif.created_at)}</span>
                      </div>
                      <p className="text-xs text-surface-600 dark:text-surface-300 mt-1 leading-relaxed whitespace-pre-line">
                        {notif.message}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notif.id);
                      }}
                      title="Mark as Read"
                      className="flex-shrink-0 p-2 text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-surface-800 rounded-lg transition-colors border border-transparent hover:border-surface-200 dark:hover:border-surface-700 font-semibold text-xs flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full"></span>
                      Mark Read
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="bg-surface-50 dark:bg-surface-900/50 px-6 py-4 border-t border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                Mark all as read
              </button>
              <button
                onClick={() => setIsModalClosed(true)}
                className="btn-secondary w-full sm:w-auto px-5 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
