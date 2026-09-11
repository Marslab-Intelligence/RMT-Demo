import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, TrendingUp, TrendingDown, Mail, AlertCircle, CheckCircle2, Clock, 
  Activity, Zap, Users, ArrowUpRight, Maximize2, Minimize2, X, Search, Download, Filter,
  Layers, Building2, ChevronRight, ChevronDown, PieChart as PieIcon, ExternalLink, Calendar, Shield, ShieldAlert, ArrowRight, XCircle
} from 'lucide-react';
import { formatCurrency, formatCompactCurrency, formatDateTime } from '../utils/formatters';
import MetricCard from '../components/common/MetricCard';
import AreaGraphVisualizer from '../components/AreaGraphVisualizer';
import ServiceDistributionPieChart from '../components/ServiceDistributionPieChart';
import ClientDetailsModal from '../components/ClientDetailsModal';
import GlassSelect from '../components/GlassSelect';
import GlassDatePicker from '../components/GlassDatePicker';

const STATUS_COLORS = {
  'Active': '#611c69',          // Blue
  'Pending Renewal': '#f97316',  // Orange
  'Renewed': '#10b981',          // Emerald
  'Expired': '#ef4444',          // Red
  'Closed': '#64748b'            // Slate
};

const formatEmailTypeBadge = (type) => {
  const normalized = (type || '').toLowerCase().trim();

  if (normalized.includes('payment_received') || normalized.includes('payment received')) {
    return {
      label: 'Payment Received',
      color: 'bg-emerald-200 text-[#013220] border-emerald-600 font-black',
      style: { backgroundColor: '#dcfce7', color: '#013220', borderColor: '#16a34a', fontWeight: '900' }
    };
  }

  if (normalized.includes('renewal_status') || normalized.includes('status_update') || normalized.includes('status update') || normalized.includes('renewal status update')) {
    return {
      label: 'Renewal Status Update',
      color: 'bg-slate-200 text-[#000000] border-slate-600 font-black',
      style: { backgroundColor: '#e2e8f0', color: '#000000', borderColor: '#475569', fontWeight: '900' }
    };
  }

  switch (normalized) {
    case '30_day_reminder': return { label: '30-Day Reminder', color: 'bg-blue-200 text-[#000000] border-blue-500 font-black', style: { backgroundColor: '#dbeafe', color: '#000000', borderColor: '#2563eb', fontWeight: '900' } };
    case '20_day_reminder': return { label: '20-Day Reminder', color: 'bg-indigo-200 text-[#000000] border-indigo-500 font-black', style: { backgroundColor: '#e0e7ff', color: '#000000', borderColor: '#4b154c', fontWeight: '900' } };
    case '15_day_reminder': return { label: '15-Day Reminder', color: 'bg-amber-200 text-[#000000] border-amber-500 font-black', style: { backgroundColor: '#fef3c7', color: '#000000', borderColor: '#d97706', fontWeight: '900' } };
    case '10_day_reminder': return { label: '10-Day Reminder', color: 'bg-orange-200 text-[#000000] border-orange-500 font-black', style: { backgroundColor: '#ffedd5', color: '#000000', borderColor: '#ea580c', fontWeight: '900' } };
    case '5_day_reminder':  return { label: '5-Day Reminder',  color: 'bg-rose-200 text-[#000000] border-rose-500 font-black', style: { backgroundColor: '#ffe4e6', color: '#000000', borderColor: '#e11d48', fontWeight: '900' } };
    case '3_day_reminder':  return { label: '3-Day Reminder',  color: 'bg-red-200 text-[#000000] border-red-500 font-black', style: { backgroundColor: '#fee2e2', color: '#000000', borderColor: '#ef4444', fontWeight: '900' } };
    case 'sales_special_15_day': return { label: 'CST 15-Day Followup', color: 'bg-purple-200 text-[#000000] border-purple-500 font-black', style: { backgroundColor: '#f3e8ff', color: '#000000', borderColor: '#9333ea', fontWeight: '900' } };
    case 'sales_special_5_day':  return { label: 'CST 5-Day Followup',  color: 'bg-pink-200 text-[#000000] border-pink-500 font-black', style: { backgroundColor: '#fce7f3', color: '#000000', borderColor: '#ec4899', fontWeight: '900' } };
    case 'sales_special_3_day':  return { label: 'CST 3-Day Followup',  color: 'bg-rose-200 text-[#000000] border-rose-500 font-black', style: { backgroundColor: '#ffe4e6', color: '#000000', borderColor: '#e11d48', fontWeight: '900' } };
    case 'renewal_expired': return { label: 'Expiry Alert', color: 'bg-red-200 text-[#000000] border-red-500 font-black', style: { backgroundColor: '#fee2e2', color: '#000000', borderColor: '#ef4444', fontWeight: '900' } };
    case 'automation_toggle': return { label: 'Automation Toggle', color: 'bg-slate-200 text-[#000000] border-slate-500 font-black', style: { backgroundColor: '#e2e8f0', color: '#000000', borderColor: '#64748b', fontWeight: '900' } };
    case 'manual_email': return { label: 'Manual Email', color: 'bg-teal-200 text-[#013220] border-teal-500 font-black', style: { backgroundColor: '#ccfbf1', color: '#013220', borderColor: '#14b8a6', fontWeight: '900' } };
    default: return { label: type ? type.replace(/_/g, ' ') : 'General', color: 'bg-slate-200 text-[#000000] border-slate-500 font-black', style: { backgroundColor: '#e2e8f0', color: '#000000', borderColor: '#64748b', fontWeight: '900' } };
  }
};

const exportToCSV = (data, filename) => {
  if (!data || !data.length) return;
  const keys = Object.keys(data[0]);
  const headers = keys.join(',');
  const rows = data.map(obj => keys.map(k => `"${(obj[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
  const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function Reports() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [serviceData, setServiceData] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matrixMode, setMatrixMode] = useState('value'); // 'value' | 'count'
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(null); // null = show all months
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all'); // 'all' | department_name
  const [matrixDimension, setMatrixDimension] = useState('service'); // 'service' | 'department'

  // Search & Filter states for Admin Telemetry
  const [emailLogSearch, setEmailLogSearch] = useState('');
  const [emailLogFilter, setEmailLogFilter] = useState('All');
  const [auditLogSearch, setAuditLogSearch] = useState('');
  const [auditLogRoleFilter, setAuditLogRoleFilter] = useState('All');

  // Modal Full Screen State
  const [activeModal, setActiveModal] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCategoryFilter, setModalCategoryFilter] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [modalStatusFilter, setModalStatusFilter] = useState([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [modalDateFilter, setModalDateFilter] = useState('All');
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalViewMode, setModalViewMode] = useState('both');
  const [selectedMonthDrilldown, setSelectedMonthDrilldown] = useState(null);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState(null);

  // Close modal on ESC key + lock body scroll when modal is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveModal(null);
        setSelectedMonthDrilldown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll and hide sidebar when modal is open
  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activeModal]);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    try {
      const promises = [
        fetch('/api/dashboard/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/dashboard/charts/status', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/dashboard/charts/monthly', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/dashboard/charts/services', { headers: { 'Authorization': `Bearer ${token}` } })
      ];

      const isAdmin = (user?.role === 'super_admin' || user?.role === 'dept_admin');
      if (isAdmin) {
        promises.push(fetch('/api/dashboard/activity-logs?limit=50', { headers: { 'Authorization': `Bearer ${token}` } }));
        promises.push(fetch('/api/dashboard/email-logs?limit=50', { headers: { 'Authorization': `Bearer ${token}` } }));
      }

      const responses = await Promise.all(promises);
      
      const statsRes = await responses[0].json();
      const statusRes = await responses[1].json();
      const monthlyRes = await responses[2].json();
      const servicesRes = await responses[3].json();

      if (statsRes) setStats(statsRes);
      if (statusRes) setStatusData(statusRes);
      if (monthlyRes) setMonthlyData(monthlyRes);
      if (servicesRes) {
        setServiceData(servicesRes.summary || []);
        setServiceRecords(servicesRes.allRecords || []);
      }

      if (isAdmin) {
        if (responses[4]) setActivityLogs(await responses[4].json());
        if (responses[5]) setEmailLogs(await responses[5].json());
      }
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  // Extract distinct departments from raw records with counts, revenues, and services list
  const departmentList = useMemo(() => {
    if (!serviceRecords || serviceRecords.length === 0) return [];
    const depts = {};
    serviceRecords.forEach(r => {
      const dept = r.department_name || r.department || 'General Operations';
      if (!depts[dept]) {
        depts[dept] = { 
          name: dept, 
          count: 0, 
          totalValue: 0,
          services: new Set()
        };
      }
      depts[dept].count += 1;
      depts[dept].totalValue += (parseFloat(r.value) || 0);
      if (r.service) depts[dept].services.add(r.service);
    });
    return Object.values(depts)
      .map(d => ({
        ...d,
        servicesList: Array.from(d.services)
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [serviceRecords]);

  const activeDeptStats = useMemo(() => {
    if (selectedDeptFilter === 'all') return null;
    return departmentList.find(d => d.name === selectedDeptFilter) || null;
  }, [selectedDeptFilter, departmentList]);

  const deptSelectOptions = useMemo(() => {
    const totalAllCount = serviceRecords ? serviceRecords.length : 0;
    const totalAllVal = serviceRecords ? serviceRecords.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0) : 0;
    const list = [
      {
        value: 'all',
        label: 'All Departments',
        badge: `${totalAllCount} contracts • ${formatCompactCurrency(totalAllVal)}`
      }
    ];
    departmentList.forEach(d => {
      list.push({
        value: d.name,
        label: d.name,
        badge: `${d.count} contracts • ${formatCompactCurrency(d.totalValue)}`
      });
    });
    return list;
  }, [departmentList, serviceRecords]);

  // Department-scoped service records: Single Source of Truth for entire page
  const filteredServiceRecords = useMemo(() => {
    if (!serviceRecords) return [];
    if (selectedDeptFilter === 'all') return serviceRecords;
    return serviceRecords.filter(r => (r.department_name || r.department || 'General Operations') === selectedDeptFilter);
  }, [serviceRecords, selectedDeptFilter]);

  // Department-aware overall KPIs
  const effectiveStats = useMemo(() => {
    if (!serviceRecords || serviceRecords.length === 0) return stats;
    if (selectedDeptFilter === 'all' && stats) return stats;

    let active = 0;
    let upcoming = 0;
    let revenue = 0;
    let profit = 0;
    let loss = 0;

    filteredServiceRecords.forEach(r => {
      const val = parseFloat(r.value) || 0;
      const prof = parseFloat(r.profit) || 0;
      revenue += val;

      const st = (r.status || '').toLowerCase();
      if (st === 'active' || st === 'renewed') {
        active += 1;
        profit += prof;
      } else if (st === 'pending renewal' || st === 'pending') {
        upcoming += 1;
        profit += prof;
      } else if (st === 'expired') {
        loss += (prof || val);
      } else {
        profit += prof;
      }
    });

    return {
      active,
      upcoming,
      revenue,
      profit,
      loss,
      total: filteredServiceRecords.length
    };
  }, [filteredServiceRecords, selectedDeptFilter, stats, serviceRecords]);

  // Department-scoped monthly chart timeline
  const effectiveMonthlyData = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return [];
    if (selectedDeptFilter === 'all') return monthlyData;

    const monthMap = {};
    monthlyData.forEach(m => {
      monthMap[m.month] = {
        month: m.month,
        count: 0,
        revenue: 0,
        profit: 0,
        revenueWithProfit: 0
      };
    });

    filteredServiceRecords.forEach(r => {
      const rawDate = r.renewal_date || r.expiry_date;
      if (!rawDate) return;
      const dStr = typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString();
      const mKey = dStr.slice(0, 7);
      if (monthMap[mKey]) {
        monthMap[mKey].count += 1;
        const val = parseFloat(r.value) || 0;
        const prof = parseFloat(r.profit) || 0;
        monthMap[mKey].revenue += val;
        monthMap[mKey].profit += prof;
        if (r.profit !== null && r.profit !== undefined && r.profit !== '') {
          monthMap[mKey].revenueWithProfit += val;
        }
      }
    });

    return Object.values(monthMap);
  }, [monthlyData, filteredServiceRecords, selectedDeptFilter]);

  const filteredEmailLogs = useMemo(() => {
    if (!emailLogs) return [];
    return emailLogs.filter(log => {
      if (selectedDeptFilter !== 'all' && activeDeptStats?.servicesList) {
        if (log.service && !activeDeptStats.servicesList.includes(log.service)) {
          return false;
        }
      }
      const q = emailLogSearch.toLowerCase();
      const matchSearch = !emailLogSearch.trim() || 
        (log.client_name && log.client_name.toLowerCase().includes(q)) ||
        (log.recipient_email && log.recipient_email.toLowerCase().includes(q)) ||
        (log.service && log.service.toLowerCase().includes(q)) ||
        (log.email_type && log.email_type.toLowerCase().includes(q)) ||
        (log.subject && log.subject.toLowerCase().includes(q));

      const matchFilter = emailLogFilter === 'All' || 
        (emailLogFilter === 'sent' && log.status === 'sent') ||
        (emailLogFilter === 'reminder' && log.email_type && log.email_type.includes('reminder')) ||
        (emailLogFilter === 'expired' && log.email_type && log.email_type.includes('expired'));

      return matchSearch && matchFilter;
    });
  }, [emailLogs, emailLogSearch, emailLogFilter, selectedDeptFilter, activeDeptStats]);

  const filteredAuditLogs = useMemo(() => {
    if (!activityLogs) return [];
    return activityLogs.filter(log => {
      const q = auditLogSearch.toLowerCase();
      const matchSearch = !auditLogSearch.trim() ||
        (log.details && log.details.toLowerCase().includes(q)) ||
        (log.full_name && log.full_name.toLowerCase().includes(q)) ||
        (log.role && log.role.toLowerCase().includes(q));

      const matchRole = auditLogRoleFilter === 'All'
        || (auditLogRoleFilter === 'admin' ? (log.role === 'super_admin' || log.role === 'dept_admin') : log.role === auditLogRoleFilter);

      return matchSearch && matchRole;
    });
  }, [activityLogs, auditLogSearch, auditLogRoleFilter]);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 8000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  // Derived metrics
  const totalEmailsSent = filteredEmailLogs.length;
  const successfulEmails = filteredEmailLogs.filter(log => log.status === 'sent').length;
  const deliverabilityRate = totalEmailsSent > 0 ? Math.round((successfulEmails / totalEmailsSent) * 100) : 100;

  // Filtered dataset for modal tables
  const filteredModalRecords = useMemo(() => {
    if (!filteredServiceRecords || filteredServiceRecords.length === 0) return [];
    
    return filteredServiceRecords.filter(item => {
      const matchSearch = modalSearchTerm === '' || 
        (item.client_name && item.client_name.toLowerCase().includes(modalSearchTerm.toLowerCase())) ||
        (item.service && item.service.toLowerCase().includes(modalSearchTerm.toLowerCase())) ||
        (item.vendor && item.vendor.toLowerCase().includes(modalSearchTerm.toLowerCase()));

      const matchCategory = modalCategoryFilter.length === 0 || 
        (item.service && modalCategoryFilter.includes(item.service));

      const matchStatus = modalStatusFilter.length === 0 || 
        (item.status && modalStatusFilter.includes(item.status));

      let matchDate = true;
      if (modalDateFilter !== 'All' && item.expiry_date) {
        const itemDate = new Date(item.expiry_date);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (modalDateFilter === 'this_month') {
          matchDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        } else if (modalDateFilter === 'next_month') {
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          matchDate = itemDate.getMonth() === nextMonth.getMonth() && itemDate.getFullYear() === nextMonth.getFullYear();
        } else if (modalDateFilter === '30_days') {
          const in30 = new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000);
          matchDate = itemDate >= startOfToday && itemDate <= in30;
        } else if (modalDateFilter === '60_days') {
          const in60 = new Date(startOfToday.getTime() + 60 * 24 * 60 * 60 * 1000);
          matchDate = itemDate >= startOfToday && itemDate <= in60;
        } else if (modalDateFilter === '90_days') {
          const in90 = new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000);
          matchDate = itemDate >= startOfToday && itemDate <= in90;
        } else if (modalDateFilter === 'expired') {
          matchDate = itemDate < startOfToday || item.status === 'Expired';
        } else if (modalDateFilter === 'custom') {
          if (modalStartDate && modalEndDate) {
            const start = new Date(modalStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(modalEndDate);
            end.setHours(23, 59, 59, 999);
            matchDate = itemDate >= start && itemDate <= end;
          } else if (modalStartDate) {
            const start = new Date(modalStartDate);
            start.setHours(0, 0, 0, 0);
            matchDate = itemDate >= start;
          } else if (modalEndDate) {
            const end = new Date(modalEndDate);
            end.setHours(23, 59, 59, 999);
            matchDate = itemDate <= end;
          }
        }
      }

      if (activeModal === 'active_kpi') return matchSearch && matchCategory && matchStatus && matchDate && (item.status === 'Active' || item.status === 'Renewed');
      if (activeModal === 'pending_kpi') return matchSearch && matchCategory && matchStatus && matchDate && item.status === 'Pending Renewal';
      if (activeModal === 'loss_kpi' || activeModal === 'loss') return matchSearch && matchCategory && matchStatus && matchDate && item.status === 'Expired';
      
      return matchSearch && matchCategory && matchStatus && matchDate;
    });
  }, [filteredServiceRecords, modalSearchTerm, modalCategoryFilter, modalStatusFilter, modalDateFilter, modalStartDate, modalEndDate, activeModal]);

  // Available categories for modal dropdown filter
  const availableModalCategories = useMemo(() => {
    if (!filteredServiceRecords) return ['All'];
    const cats = Array.from(new Set(filteredServiceRecords.map(r => r.service).filter(Boolean))).sort();
    return ['All', ...cats];
  }, [filteredServiceRecords]);

  // Modal summary stats
  const modalSummary = useMemo(() => {
    const totalCount = filteredModalRecords.length;
    const totalVal = filteredModalRecords.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);
    const totalProfit = filteredModalRecords.reduce((acc, r) => acc + (parseFloat(r.profit) || 0), 0);
    const uniqueClients = new Set(filteredModalRecords.map(r => r.client_name)).size;
    return { totalCount, totalVal, totalProfit, uniqueClients };
  }, [filteredModalRecords]);

  const getModalTitle = (type) => {
    switch (type) {
      case 'services': return 'Service Plan Portfolio Analysis & Breakdown';
      case 'revenue': return 'Volume & Portfolio Revenue Analytics';
      case 'profit': return 'Portfolio Net Profit Analytics';
      case 'loss':
      case 'loss_kpi': return 'Expired Portfolio Loss Audit';
      case 'active_kpi': return 'Active & Renewed Subscriptions Audit';
      case 'pending_kpi': return 'Pending Renewals Pipeline Audit';
      case 'deliverability_kpi': return 'Email Automation Logs & Deliverability';
      case 'pipeline_kpi': return 'Total Portfolio Pipeline Breakdown';
      default: return `Drilldown Analysis: ${type}`;
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Active':
      case 'Renewed':
        return 'bg-emerald-200/90 text-[#022c22] border-emerald-500 dark:bg-emerald-200/90 dark:text-[#022c22] dark:border-emerald-500 font-extrabold';
      case 'Pending Renewal':
        return 'bg-amber-200/90 text-[#451a03] border-amber-500 dark:bg-amber-200/90 dark:text-[#451a03] dark:border-amber-500 font-extrabold';
      case 'Expired':
        return 'bg-rose-200/90 text-[#4c0519] border-rose-500 dark:bg-rose-200/90 dark:text-[#4c0519] dark:border-rose-500 font-extrabold';
      default:
        return 'bg-slate-200/90 text-black border-slate-400 dark:bg-slate-200/90 dark:text-black dark:border-slate-400 font-extrabold';
    }
  };

  // Monthly profit & loss analytical breakdown (driven by effectiveMonthlyData)
  const monthlyAnalysis = useMemo(() => {
    if (!effectiveMonthlyData || effectiveMonthlyData.length === 0) return null;

    const enriched = effectiveMonthlyData.map(m => {
      const rev = parseFloat(m.revenue) || 0;
      const profit = parseFloat(m.profit) || 0;
      // Share of the month's revenue that actually has a profit figure recorded.
      const revWithProfit = parseFloat(m.revenueWithProfit) || 0;
      const coverage = rev > 0 ? revWithProfit / rev : 0;
      return {
        month: m.month,
        count: m.count || 0,
        revenue: rev,
        profit,
        margin: rev > 0 ? (profit / rev) * 100 : 0,
        coverage,
        profitIncomplete: rev > 0 && coverage < 0.99
      };
    });

    let peakMonth = enriched[0];
    let riskMonth = enriched[0];

    enriched.forEach(m => {
      if (m.revenue > peakMonth.revenue) peakMonth = m;
      if (m.revenue < riskMonth.revenue) riskMonth = m;
    });

    const totalRev = enriched.reduce((acc, m) => acc + m.revenue, 0);
    const totalProfit = enriched.reduce((acc, m) => acc + m.profit, 0);
    const avgRev = enriched.length > 0 ? totalRev / enriched.length : 0;
    const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
    const anyProfitIncomplete = enriched.some(m => m.profitIncomplete);

    return {
      enriched,
      peakMonth,
      riskMonth,
      avgRev,
      totalRev,
      totalProfit,
      avgMargin,
      anyProfitIncomplete,
      totalTrackedMonths: enriched.length
    };
  }, [effectiveMonthlyData]);

  // Clients belonging to selected month drilldown, respecting active department filter
  const monthDrilldownClients = useMemo(() => {
    if (!selectedMonthDrilldown || !serviceRecords) return [];
    return serviceRecords.filter(item => {
      const rawDate = item.expiry_date || item.renewal_date;
      if (!rawDate) return false;
      const dStr = typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString();
      if (!dStr.startsWith(selectedMonthDrilldown)) return false;
      if (selectedDeptFilter !== 'all') {
        const itemDept = item.department_name || item.department || 'General Operations';
        if (itemDept !== selectedDeptFilter) return false;
      }
      return true;
    });
  }, [selectedMonthDrilldown, serviceRecords, selectedDeptFilter]);

  // Service / Department x Month matrix for the Analytics section — aggregates the same
  // per-record data already fetched for the service pie chart (serviceRecords)
  // over the same month range the revenue/profit chart uses.
  const serviceMonthMatrix = useMemo(() => {
    if (!serviceRecords || serviceRecords.length === 0 || !monthlyAnalysis) return null;

    const months = monthlyAnalysis.enriched.map(m => m.month);

    // Apply department filter if one is selected
    const records = selectedDeptFilter === 'all'
      ? serviceRecords
      : serviceRecords.filter(r => (r.department_name || 'General Operations') === selectedDeptFilter);

    if (matrixDimension === 'department') {
      // Group by Department across months
      const byDept = {};
      records.forEach(r => {
        const dept = r.department_name || 'General Operations';
        const rawDate = r.renewal_date || r.expiry_date;
        if (!rawDate) return;
        const dStr = typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString();
        const monthKey = dStr.slice(0, 7);
        if (!months.includes(monthKey)) return;

        if (!byDept[dept]) {
          byDept[dept] = { 
            name: dept, 
            service: dept, // for backward compatibility
            isDepartment: true,
            totalValue: 0, 
            totalCount: 0, 
            cells: {},
            services: new Set()
          };
        }
        if (!byDept[dept].cells[monthKey]) byDept[dept].cells[monthKey] = { value: 0, count: 0 };
        const val = parseFloat(r.value) || 0;
        byDept[dept].cells[monthKey].value += val;
        byDept[dept].cells[monthKey].count += 1;
        byDept[dept].totalValue += val;
        byDept[dept].totalCount += 1;
        if (r.service) byDept[dept].services.add(r.service);
      });

      const rows = Object.values(byDept)
        .map(d => ({ ...d, serviceCount: d.services.size }))
        .sort((a, b) => b.totalValue - a.totalValue);

      const maxValue = Math.max(1, ...rows.flatMap(s => months.map(m => s.cells[m]?.value || 0)));
      const maxCount = Math.max(1, ...rows.flatMap(s => months.map(m => s.cells[m]?.count || 0)));

      return { months, services: rows, rows, maxValue, maxCount, dimension: 'department' };
    }

    // Default: Group by Service
    const byService = {};
    records.forEach(r => {
      const svc = r.service || 'Unspecified';
      const rawDate = r.renewal_date || r.expiry_date;
      if (!rawDate) return;
      const dStr = typeof rawDate === 'string' ? rawDate : new Date(rawDate).toISOString();
      const monthKey = dStr.slice(0, 7);
      if (!months.includes(monthKey)) return;

      if (!byService[svc]) {
        byService[svc] = { 
          name: svc,
          service: svc, 
          department: r.department_name || 'General Operations',
          totalValue: 0, 
          totalCount: 0, 
          cells: {} 
        };
      }
      if (!byService[svc].cells[monthKey]) byService[svc].cells[monthKey] = { value: 0, count: 0 };
      const val = parseFloat(r.value) || 0;
      byService[svc].cells[monthKey].value += val;
      byService[svc].cells[monthKey].count += 1;
      byService[svc].totalValue += val;
      byService[svc].totalCount += 1;
    });

    const rows = Object.values(byService)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 12);

    const maxValue = Math.max(1, ...rows.flatMap(s => months.map(m => s.cells[m]?.value || 0)));
    const maxCount = Math.max(1, ...rows.flatMap(s => months.map(m => s.cells[m]?.count || 0)));

    return { months, services: rows, rows, maxValue, maxCount, dimension: 'service' };
  }, [serviceRecords, monthlyAnalysis, selectedDeptFilter, matrixDimension]);

  const formatMonthLabel = (m) => {
    const d = new Date(`${m}-01`);
    return isNaN(d) ? m : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Fixed calendar quarters (Q1 = Jan-Mar ... Q4 = Oct-Dec) of the current
  // year, so the Q1-Q4 tabs are always present regardless of how many months
  // of data happen to be loaded. Columns just render "–" for a quarter's
  // months that aren't in serviceMonthMatrix.months.
  const currentYear = new Date().getFullYear();
  const calendarQuarters = [0, 1, 2, 3].map((q) => {
    const monthNums = [q * 3 + 1, q * 3 + 2, q * 3 + 3];
    return monthNums.map((n) => `${currentYear}-${String(n).padStart(2, '0')}`);
  });

  const visibleMatrixMonths = selectedQuarterIdx === null
    ? serviceMonthMatrix?.months || []
    : calendarQuarters[selectedQuarterIdx];

  const openModal = (type) => {
    setModalSearchTerm('');
    setModalCategoryFilter([]);
    setCategoryDropdownOpen(false);
    setModalStatusFilter([]);
    setModalDateFilter('All');
    setModalStartDate('');
    setModalEndDate('');
    const isGraphType = ['revenue', 'profit', 'loss', 'services'].includes(type);
    setModalViewMode(isGraphType ? 'graph' : 'both');
    setSelectedMonthDrilldown(null);
    setActiveModal(type);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const CustomComposedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const rev = payload.find(p => p.dataKey === 'revenue')?.value || 0;
      const count = payload.find(p => p.dataKey === 'count')?.value || 0;
      return (
        <div className="bg-slate-950/90 backdrop-blur-xl border border-white/20 p-3.5 rounded-xl shadow-2xl text-white">
          <p className="font-bold text-xs text-brand-300 border-b border-white/10 pb-1 mb-2">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-indigo-400 font-medium">Revenue:</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(rev)}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-emerald-400 font-medium">Renewals Volume:</span>
              <span className="font-mono font-bold text-white">{count} contracts</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in relative pb-28">
      {/* Top Header with Global Department Selector and Quick Filter Pills */}
      <div className="bg-white/80 dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-indigo-950/80 dark:to-slate-900/90 p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl transition-all space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 dark:border-brand-500/30 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Reports & Executive Analytics</h1>
                {selectedDeptFilter !== 'all' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 shadow-sm animate-pulse">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{selectedDeptFilter}</span>
                    <button
                      onClick={() => setSelectedDeptFilter('all')}
                      className="ml-1 hover:text-rose-500 transition-colors p-0.5 rounded-full hover:bg-white/20"
                      title="Reset to All Departments"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    All Departments View
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                {selectedDeptFilter !== 'all'
                  ? `Filtering entire page analytics to ${selectedDeptFilter} • ${effectiveStats?.total || 0} contracts • ${formatCurrency(effectiveStats?.revenue || 0)} pipeline`
                  : 'Real-time performance metrics, portfolio revenue, service distribution & system audit logs across all departments'}
              </p>
            </div>
          </div>

          {/* Department Dropdown Selector */}
          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <div className="w-64 sm:w-72">
              <GlassSelect
                value={selectedDeptFilter}
                onChange={(e, val) => {
                  const nextVal = val !== undefined ? val : e.target.value;
                  setSelectedDeptFilter(nextVal);
                  if (nextVal !== 'all' && matrixDimension === 'department') {
                    setMatrixDimension('service');
                  }
                }}
                options={deptSelectOptions}
                icon={Building2}
                size="sm"
                placeholder="Filter by Department..."
              />
            </div>
            {selectedDeptFilter !== 'all' && (
              <button
                onClick={() => setSelectedDeptFilter('all')}
                className="px-2.5 py-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-bold transition-all flex items-center gap-1 border border-slate-300 dark:border-white/10"
                title="Clear filter & view All Departments"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Department Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-white/10">
          <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Quick Filter:
          </span>
          <button
            onClick={() => setSelectedDeptFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedDeptFilter === 'all'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/[0.08]'
            }`}
          >
            <span>All Departments</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedDeptFilter === 'all' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-400'
            }`}>
              {serviceRecords?.length || 0}
            </span>
          </button>
          {departmentList.map(dept => {
            const isSelected = selectedDeptFilter === dept.name;
            return (
              <button
                key={dept.name}
                onClick={() => {
                  setSelectedDeptFilter(dept.name);
                  if (matrixDimension === 'department') setMatrixDimension('service');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.12] border border-black/[0.06] dark:border-white/[0.08]'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>{dept.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                }`}>
                  {dept.count}
                </span>
                <span className="text-[10px] opacity-75 font-mono">
                  {formatCompactCurrency(dept.totalValue)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Active Portfolio"
          value={`${effectiveStats?.active || 0} Services`}
          icon={Users}
          color="blue"
          onClick={() => openModal('active_kpi')}
        />
        <MetricCard
          title="Pending Reminders"
          value={`${effectiveStats?.upcoming || 0} Upcoming`}
          icon={Clock}
          color="amber"
          onClick={() => openModal('pending_kpi')}
        />
        <MetricCard
          title="Email Deliverability"
          value={`${deliverabilityRate}%`}
          subtext="Success"
          icon={Mail}
          color="cyan"
          onClick={() => openModal('deliverability_kpi')}
        />
        <MetricCard
          title="Total Contract Pipeline"
          value={formatCurrency(effectiveStats?.revenue || 0)}
          icon={TrendingUp}
          color="purple"
          onClick={() => openModal('pipeline_kpi')}
        />
        <MetricCard
          title="Total Profit"
          value={formatCurrency(effectiveStats?.profit || 0)}
          icon={TrendingUp}
          color="emerald"
          onClick={() => openModal('profit')}
        />
        <MetricCard
          title="Total Loss (Expired)"
          value={formatCurrency(effectiveStats?.loss || 0)}
          icon={TrendingDown}
          color="rose"
          onClick={() => openModal('loss')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="group/animated-card relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/15 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl shadow-black/5 p-5 lg:col-span-5 h-[420px] flex flex-col justify-between transition-all duration-500 hover:shadow-2xl hover:border-brand-500/40">
          <ServiceDistributionPieChart 
            rawServiceData={serviceData} 
            allRecords={filteredServiceRecords} 
            onExpand={() => openModal('services')}
          />
        </div>

        <div className="group/animated-card relative overflow-hidden rounded-2xl border border-white/80 dark:border-white/15 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl shadow-black/5 p-6 lg:col-span-7 h-[420px] flex flex-col justify-between transition-all duration-500 hover:shadow-2xl hover:border-brand-500/40">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-70 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-black dark:text-white">Volume & Revenue Analysis</h2>
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 backdrop-blur-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Live Data
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openModal('revenue')}
                className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all flex items-center gap-1 text-[11px] font-bold"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Screen</span>
              </button>
            </div>
          </div>
          <div className="relative z-10 flex-1 min-h-0 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={effectiveMonthlyData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="month" interval={0} tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis yAxisId="left" width={60} tick={{ fontSize: 10, fontWeight: 600 }} tickFormatter={(val) => formatCompactCurrency(val)} />
                <YAxis yAxisId="right" orientation="right" width={35} tick={{ fontSize: 10, fontWeight: 600 }} />
                <RechartsTooltip content={<CustomComposedTooltip />} />
                <Bar yAxisId="left" dataKey="revenue" fill="#a559a5" radius={[8, 8, 0, 0]} barSize={34} />
                <Line yAxisId="right" dataKey="count" stroke="#10b981" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AreaGraphVisualizer
          title="Portfolio Profit Analytics"
          type="profit"
          totalValue={effectiveStats?.profit || 0}
          monthlyData={effectiveMonthlyData}
          onExpand={() => openModal('profit')}
        />
        <AreaGraphVisualizer
          title="Expired Portfolio Loss Analytics"
          type="loss"
          totalValue={effectiveStats?.loss || 0}
          monthlyData={effectiveMonthlyData}
          onExpand={() => openModal('loss')}
        />
      </div>

      {/* Service / Department x Month Matrix */}
      {serviceMonthMatrix && (
        <div className="card p-6 relative overflow-hidden transition-all duration-300">
          <div className="flex flex-col gap-4 mb-5">
            {/* Top Row: Title + Mode/Dimension Toggles */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-500/10 text-brand-500 dark:text-brand-400 border border-brand-500/20">
                    {matrixDimension === 'service' ? <Layers className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{matrixDimension === 'service' ? 'Service' : 'Department'} &times; Month Matrix</span>
                    {selectedDeptFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        <Building2 className="w-3 h-3" />
                        {selectedDeptFilter}
                        <button
                          onClick={() => setSelectedDeptFilter('all')}
                          className="ml-1 hover:text-rose-500 transition-colors"
                          title="Reset to All Departments"
                        >
                          &times;
                        </button>
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedDeptFilter !== 'all'
                    ? `Showing ${selectedDeptFilter} details (${activeDeptStats?.count || 0} contracts • ${formatCompactCurrency(activeDeptStats?.totalValue || 0)}) across months`
                    : `Top ${matrixDimension === 'service' ? 'services' : 'departments'} by renewal ${matrixMode === 'value' ? 'value' : 'count'}, tracked across ${visibleMatrixMonths.length} months`}
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* View Dimension Toggle: By Service vs By Department */}
                <div className="flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl">
                  <button
                    onClick={() => setMatrixDimension('service')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      matrixDimension === 'service'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="View rows by Service"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>By Service</span>
                  </button>
                  <button
                    onClick={() => setMatrixDimension('department')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      matrixDimension === 'department'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="View rows by Department"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>By Department</span>
                  </button>
                </div>

                {/* Metric Mode Toggle: By Value vs By Count */}
                <div className="flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl">
                  <button
                    onClick={() => setMatrixMode('value')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      matrixMode === 'value'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    By value
                  </button>
                  <button
                    onClick={() => setMatrixMode('count')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      matrixMode === 'count'
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    By count
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar: Department Dropdown + Department Quick Pills + Quarter Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
              {/* Left: Department Dropdown Selector & Quick Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-56 sm:w-64">
                  <GlassSelect
                    value={selectedDeptFilter}
                    onChange={(e, val) => {
                      const nextVal = val !== undefined ? val : e.target.value;
                      setSelectedDeptFilter(nextVal);
                      if (nextVal !== 'all' && matrixDimension === 'department') {
                        setMatrixDimension('service');
                      }
                    }}
                    options={deptSelectOptions}
                    icon={Building2}
                    size="xs"
                    placeholder="Select Department..."
                  />
                </div>

                {/* Department Quick Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5 max-w-full">
                  <button
                    onClick={() => setSelectedDeptFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      selectedDeptFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-black/[0.08] dark:hover:bg-white/10'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] opacity-70">({serviceRecords?.length || 0})</span>
                  </button>
                  {departmentList.map(dept => {
                    const isSelected = selectedDeptFilter === dept.name;
                    return (
                      <button
                        key={dept.name}
                        onClick={() => {
                          setSelectedDeptFilter(dept.name);
                          if (matrixDimension === 'department') setMatrixDimension('service');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-brand-500 text-white shadow-sm ring-2 ring-brand-500/30'
                            : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-black/[0.08] dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>{dept.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-black/[0.06] dark:bg-white/10 text-slate-500 dark:text-slate-300'
                        }`}>
                          {dept.count}
                        </span>
                      </button>
                    );
                  })}
                  {selectedDeptFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedDeptFilter('all')}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Calendar Quarter Tabs */}
              <div className="flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl self-start md:self-auto">
                <button
                  onClick={() => setSelectedQuarterIdx(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedQuarterIdx === null
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedQuarterIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedQuarterIdx === idx
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Spotlight Card (shown when a department is selected) */}
            {activeDeptStats && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Department</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{activeDeptStats.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      <span>Total Value: <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeDeptStats.totalValue)}</strong></span>
                      <span>• Contracts: <strong className="font-mono font-bold">{activeDeptStats.count}</strong></span>
                      {activeDeptStats.servicesList.length > 0 && (
                        <span>• Services: <strong className="font-semibold">{activeDeptStats.servicesList.slice(0, 4).join(', ')}{activeDeptStats.servicesList.length > 4 ? ` +${activeDeptStats.servicesList.length - 4}` : ''}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setSelectedDeptFilter('all')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 border border-slate-300/50 dark:border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>View All Departments</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200/60 dark:border-white/10">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md">
                  <th className="py-2.5 px-4 text-left sticky left-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
                    {matrixDimension === 'service' ? 'Service' : 'Department'}
                  </th>
                  {visibleMatrixMonths.map(m => (
                    <th key={m} className="py-2.5 px-3 text-center whitespace-nowrap">{formatMonthLabel(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                {serviceMonthMatrix.rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleMatrixMonths.length + 1} className="p-8 text-center text-slate-400">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50 text-amber-400" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No renewals found for this filter combination</p>
                      <button
                        onClick={() => { setSelectedDeptFilter('all'); setSelectedQuarterIdx(null); }}
                        className="mt-2 text-xs font-semibold text-brand-500 hover:underline"
                      >
                        Reset Department and Quarter Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  serviceMonthMatrix.rows.map(row => (
                    <tr key={row.name} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white truncate max-w-[200px] sticky left-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md z-10 border-r border-slate-200/30 dark:border-white/5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            {matrixDimension === 'department' && (
                              <Building2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                            )}
                            <span className="font-bold text-slate-900 dark:text-white truncate">{row.name}</span>
                          </div>
                          {matrixDimension === 'service' && row.department && selectedDeptFilter === 'all' && (
                            <span className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                              {row.department}
                            </span>
                          )}
                          {matrixDimension === 'department' && (
                            <button
                              onClick={() => {
                                setSelectedDeptFilter(row.name);
                                setMatrixDimension('service');
                              }}
                              className="text-[10px] text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-bold flex items-center gap-1 mt-0.5 w-fit hover:underline"
                            >
                              <span>View Services ({row.serviceCount || 0})</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      {visibleMatrixMonths.map(m => {
                        const cell = row.cells[m];
                        const raw = matrixMode === 'value' ? (cell?.value || 0) : (cell?.count || 0);
                        const max = matrixMode === 'value' ? serviceMonthMatrix.maxValue : serviceMonthMatrix.maxCount;
                        const intensity = raw > 0 ? Math.min(1, raw / max) : 0;
                        return (
                          <td
                            key={m}
                            onClick={() => {
                              if (cell && cell.count > 0) {
                                if (matrixDimension === 'department' && selectedDeptFilter === 'all') {
                                  setSelectedDeptFilter(row.name);
                                }
                                setSelectedMonthDrilldown(m);
                              }
                            }}
                            className={`py-2 px-3 text-center font-mono font-medium whitespace-nowrap transition-colors ${
                              cell && cell.count > 0 ? 'cursor-pointer hover:ring-1 hover:ring-brand-500/50' : ''
                            }`}
                            style={{
                              backgroundColor: intensity > 0 ? `rgba(var(--brand-rgb), ${0.08 + intensity * 0.42})` : 'transparent',
                              color: intensity > 0.55 ? '#fff' : undefined
                            }}
                            title={cell && cell.count > 0 ? `${row.name} · ${formatMonthLabel(m)}: ${matrixMode === 'value' ? formatCurrency(cell.value) : `${cell.count} renewals`}` : undefined}
                          >
                            {raw > 0 ? (matrixMode === 'value' ? formatCompactCurrency(raw) : raw) : '–'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADMIN EXCLUSIVE: Email Logs & Audit Logs Section */}
      {(user?.role === 'super_admin' || user?.role === 'dept_admin') && (
        <div className="space-y-6 pt-6 border-t border-slate-200/50 dark:border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 backdrop-blur-md">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">System Audit & Email Telemetry</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Admin Profile Exclusive
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Real-time outbound notification dispatches and complete system activity audit trail
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/email-automation')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-white/95 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/15 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-500" />
                <span>Email Settings</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>
              <button
                onClick={() => navigate('/activity-logs')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-white/10 hover:bg-white/95 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/15 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md"
              >
                <Activity className="w-3.5 h-3.5 text-brand-500" />
                <span>All Activity Logs</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Outbound Email Logs Panel */}
            <div className="group/animated-card relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl p-5 flex flex-col justify-between transition-all duration-300 hover:border-cyan-500/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Outbound Email Logs
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                        {filteredEmailLogs.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Automated client renewal notifications</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Filter Dropdown */}
                  <div className="relative">
                    <GlassSelect
                      value={emailLogFilter}
                      onChange={(e, val) => setEmailLogFilter(val !== undefined ? val : e.target.value)}
                      size="xs"
                      options={[
                        { value: 'All', label: 'All Email Types' },
                        { value: 'sent', label: 'Sent Status' },
                        { value: 'reminder', label: 'Reminders Only' },
                        { value: 'expired', label: 'Expiry Alerts' },
                      ]}
                    />
                  </div>

                  {/* Search */}
                  <div className="relative group/search">
                    <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-cyan-500 absolute left-2.5 top-2.5 transition-colors" />
                    <input
                      type="text"
                      value={emailLogSearch}
                      onChange={(e) => setEmailLogSearch(e.target.value)}
                      placeholder="Search emails..."
                      className="pl-8 pr-6 py-1.5 bg-white/60 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/60 w-32 sm:w-40 focus:w-44 sm:focus:w-52 transition-all duration-300 shadow-sm"
                    />
                    {emailLogSearch && (
                      <button
                        onClick={() => setEmailLogSearch('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-y-auto custom-scrollbar max-h-[360px] rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40">
                {filteredEmailLogs.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center">
                    <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-500 mb-2 border border-cyan-500/20">
                      <Mail className="w-5 h-5 opacity-80" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No outbound email logs found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search terms or filter</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10 uppercase text-[10px] font-black sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3.5 py-2.5">Sent Time</th>
                        <th className="px-3.5 py-2.5">Client / Service</th>
                        <th className="px-3.5 py-2.5">Email Type</th>
                        <th className="px-3.5 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-white/5 text-slate-700 dark:text-slate-200">
                      {filteredEmailLogs.map((log) => {
                        const badge = formatEmailTypeBadge(log.email_type);
                        const isSent = log.status === 'sent';
                        return (
                          <tr key={log.id} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                            <td className="px-3.5 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                              {formatDateTime(log.sent_at)}
                            </td>
                            <td className="px-3.5 py-3 max-w-[160px] truncate">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{log.client_name || 'System'}</div>
                              {log.recipient_email && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{log.recipient_email}</div>
                              )}
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.color}`}
                                style={badge.style}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border backdrop-blur-md ${
                                  isSent
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isSent ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {log.status ? log.status.toUpperCase() : 'SENT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* 2. System Audit Logs Panel */}
            <div className="group/animated-card relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/15 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl p-5 flex flex-col justify-between transition-all duration-300 hover:border-brand-500/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shadow-sm">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      System Audit Logs
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                        {filteredAuditLogs.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">User actions & record change tracking</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Filter Dropdown */}
                  <div className="relative">
                    <GlassSelect
                      value={auditLogRoleFilter}
                      onChange={(e, val) => setAuditLogRoleFilter(val !== undefined ? val : e.target.value)}
                      size="xs"
                      options={[
                        { value: 'All', label: 'All Roles' },
                        { value: 'admin', label: 'Admin' },
                        { value: 'user', label: 'User / Sales' },
                      ]}
                    />
                  </div>

                  {/* Search */}
                  <div className="relative group/search">
                    <Search className="w-3.5 h-3.5 text-slate-400 group-focus-within/search:text-brand-500 absolute left-2.5 top-2.5 transition-colors" />
                    <input
                      type="text"
                      value={auditLogSearch}
                      onChange={(e) => setAuditLogSearch(e.target.value)}
                      placeholder="Search activity..."
                      className="pl-8 pr-6 py-1.5 bg-white/60 dark:bg-slate-950/70 border border-slate-200/80 dark:border-white/15 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/60 w-32 sm:w-40 focus:w-44 sm:focus:w-52 transition-all duration-300 shadow-sm"
                    />
                    {auditLogSearch && (
                      <button
                        onClick={() => setAuditLogSearch('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-y-auto custom-scrollbar max-h-[360px] rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/40">
                {filteredAuditLogs.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center">
                    <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500 mb-2 border border-brand-500/20">
                      <Activity className="w-5 h-5 opacity-80" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No activity logs match your search or role filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search query or selecting All Roles</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-white/10 uppercase text-[10px] font-black sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-3.5 py-2.5">Timestamp</th>
                        <th className="px-3.5 py-2.5">User / Role</th>
                        <th className="px-3.5 py-2.5">Action Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-white/5 text-slate-700 dark:text-slate-200">
                      {filteredAuditLogs.map((log) => {
                        const isAdmin = log.role === 'super_admin' || log.role === 'dept_admin';
                        return (
                          <tr key={log.id} className="hover:bg-slate-100/60 dark:hover:bg-white/5 transition-colors">
                            <td className="px-3.5 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                              {formatDateTime(log.created_at)}
                            </td>
                            <td className="px-3.5 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900 dark:text-white">{log.full_name || 'System User'}</div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border mt-0.5 ${
                                isAdmin
                                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                  : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                              }`}>
                                {log.role || 'user'}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {log.details}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Modal Drilldown Portal */}
      {activeModal && createPortal(
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              background: 'rgba(7, 10, 24, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: 'white',
              padding: '24px 28px',
            }}
          >
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/15 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl border border-brand-500/30">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-black text-white tracking-tight">{getModalTitle(activeModal)}</h2>
                    {selectedDeptFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
                        <Building2 className="w-3.5 h-3.5" />
                        {selectedDeptFilter}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {selectedDeptFilter !== 'all' 
                      ? `Scoped to ${selectedDeptFilter} • ${filteredModalRecords.length} contracts • ${formatCurrency(modalSummary.totalVal)} pipeline`
                      : 'Comprehensive telemetry & contract breakdown across all departments'}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* View Mode Switcher for Graph Modals */}
                {['revenue', 'profit', 'loss', 'services'].includes(activeModal) && (
                  <div className="flex items-center p-1 bg-slate-900 border border-white/20 rounded-xl">
                    <button
                      onClick={() => setModalViewMode('graph')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        modalViewMode === 'graph' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Graph & Insights
                    </button>
                    <button
                      onClick={() => setModalViewMode('both')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        modalViewMode === 'both' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Graph & Table
                    </button>
                    <button
                      onClick={() => setModalViewMode('table')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        modalViewMode === 'table' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Table Only
                    </button>
                  </div>
                )}

                {/* Multi-Select Category Dropdown */}
                <div className="relative flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <button
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className="dropdown-btn-glass min-w-[145px]"
                  >
                    <span className="truncate max-w-[200px]">
                      {modalCategoryFilter.length === 0 
                        ? 'All Services' 
                        : modalCategoryFilter.length === 1 
                          ? modalCategoryFilter[0] 
                          : `${modalCategoryFilter.length} Services`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {categoryDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[10]" onClick={() => setCategoryDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1.5 z-[20] dropdown-menu-glass min-w-[220px] max-h-[320px] overflow-y-auto custom-scrollbar py-1.5">
                        {/* Select All / Clear */}
                        <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                          <button
                            onClick={() => { setModalCategoryFilter([]); }}
                            className={`text-[11px] font-bold transition-colors ${
                              modalCategoryFilter.length === 0 ? 'text-brand-500 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                            }`}
                          >
                            All Services
                          </button>
                          {modalCategoryFilter.length > 0 && (
                            <button
                              onClick={() => setModalCategoryFilter([])}
                              className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                            >
                              Clear ({modalCategoryFilter.length})
                            </button>
                          )}
                        </div>
                        {availableModalCategories.filter(c => c !== 'All').map(cat => {
                          const isSelected = modalCategoryFilter.includes(cat);
                          return (
                            <div
                              key={cat}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setModalCategoryFilter(modalCategoryFilter.filter(c => c !== cat));
                                } else {
                                  setModalCategoryFilter([...modalCategoryFilter, cat]);
                                }
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 ${
                                isSelected ? 'bg-brand-500/10' : ''
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                isSelected 
                                  ? 'bg-brand-500 border-brand-500' 
                                  : 'border-slate-400 dark:border-slate-500'
                              }`}>
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-xs font-semibold ${
                                isSelected ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300'
                              }`}>{cat}</span>
                              <span className="ml-auto text-[10px] text-slate-400 font-mono">
                                {filteredServiceRecords.filter(r => r.service === cat).length}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Multi-Select Status Dropdown Filter */}
                <div className="relative flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className="dropdown-btn-glass min-w-[135px]"
                  >
                    <span className="truncate max-w-[180px]">
                      {modalStatusFilter.length === 0 
                        ? 'All Statuses' 
                        : modalStatusFilter.length === 1 
                          ? modalStatusFilter[0] 
                          : `${modalStatusFilter.length} Statuses`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {statusDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-[10]" onClick={() => setStatusDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-1.5 z-[20] dropdown-menu-glass min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar py-1.5">
                        <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                          <button
                            onClick={() => { setModalStatusFilter([]); }}
                            className={`text-[11px] font-bold transition-colors ${
                              modalStatusFilter.length === 0 ? 'text-brand-500 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white'
                            }`}
                          >
                            All Statuses
                          </button>
                          {modalStatusFilter.length > 0 && (
                            <button
                              onClick={() => setModalStatusFilter([])}
                              className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                            >
                              Clear ({modalStatusFilter.length})
                            </button>
                          )}
                        </div>
                        {['Active', 'Pending Renewal', 'Renewed', 'Expired'].map(st => {
                          const isSelected = modalStatusFilter.includes(st);
                          return (
                            <div
                              key={st}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setModalStatusFilter(modalStatusFilter.filter(s => s !== st));
                                } else {
                                  setModalStatusFilter([...modalStatusFilter, st]);
                                }
                              }}
                              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 ${
                                isSelected ? 'bg-brand-500/10' : ''
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                isSelected 
                                  ? 'bg-brand-500 border-brand-500' 
                                  : 'border-slate-400 dark:border-slate-500'
                              }`}>
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <span className={`text-xs font-semibold ${
                                isSelected ? 'text-black dark:text-white' : 'text-slate-700 dark:text-slate-300'
                              }`}>{st}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Renewal Date Dropdown & Calendar Range Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <GlassSelect
                      value={modalDateFilter}
                      onChange={(e, val) => setModalDateFilter(val !== undefined ? val : e.target.value)}
                      icon={Calendar}
                      size="sm"
                      options={[
                        { value: 'All', label: 'All Renewal Dates' },
                        { value: 'this_month', label: 'This Month' },
                        { value: 'next_month', label: 'Next Month' },
                        { value: '30_days', label: 'Next 30 Days' },
                        { value: '60_days', label: 'Next 60 Days' },
                        { value: '90_days', label: 'Next 90 Days' },
                        { value: 'expired', label: 'Expired / Past Due' },
                        { value: 'custom', label: '📅 Custom Date Range...' },
                      ]}
                    />
                  </div>

                  {modalDateFilter === 'custom' && (
                    <div className="flex items-center gap-2 bg-slate-900/90 border border-emerald-500/40 px-3 py-1.5 rounded-2xl backdrop-blur-md">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                        <GlassDatePicker
                          value={modalStartDate}
                          onChange={(e, val) => setModalStartDate(val !== undefined ? val : e.target.value)}
                          outputFormat="YYYY-MM-DD"
                          placeholder="From date"
                          size="xs"
                          className="min-w-[110px]"
                        />
                      </div>
                      <span className="text-slate-500 font-bold">-</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
                        <GlassDatePicker
                          value={modalEndDate}
                          onChange={(e, val) => setModalEndDate(val !== undefined ? val : e.target.value)}
                          outputFormat="YYYY-MM-DD"
                          placeholder="To date"
                          size="xs"
                          className="min-w-[110px]"
                        />
                      </div>
                      {(modalStartDate || modalEndDate) && (
                        <button
                          onClick={() => { setModalStartDate(''); setModalEndDate(''); }}
                          className="text-[11px] text-rose-400 hover:text-rose-300 font-bold ml-1 cursor-pointer"
                          title="Clear date range"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Search client, vendor, service..."
                    className="pl-9 pr-4 py-2 bg-slate-900 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-36 sm:w-48"
                  />
                </div>

                {/* Export CSV */}
                <button
                  onClick={() => exportToCSV(filteredModalRecords, `report-${activeModal}`)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold transition-all"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all ml-auto lg:ml-0"
                  title="Close Full Screen View"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FULL SCREEN GRAPH DISPLAY & EXECUTIVE MONTHLY ANALYSIS PANEL */}
            {modalViewMode !== 'table' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar my-3 space-y-4 pr-1">
                {/* 1. Primary Full Screen Visualizer Chart */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/15 backdrop-blur-xl shadow-2xl">
                  {activeModal === 'revenue' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-black text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-400" />
                            Month-by-Month Volume & Revenue Breakdown
                          </h3>
                          <p className="text-xs text-slate-400">Granular monthly revenue distribution and contract counts</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-indigo-400">
                            <span className="w-3 h-3 rounded bg-indigo-500 inline-block"></span> Revenue (₹)
                          </span>
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Contract Count
                          </span>
                        </div>
                      </div>
                      <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={effectiveMonthlyData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                            <XAxis dataKey="month" interval={0} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                            <YAxis yAxisId="left" width={70} tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(val) => formatCompactCurrency(val)} />
                            <YAxis yAxisId="right" orientation="right" width={40} tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} />
                            <RechartsTooltip content={<CustomComposedTooltip />} />
                            <Bar yAxisId="left" dataKey="revenue" fill="#a559a5" radius={[8, 8, 0, 0]} barSize={40} />
                            <Line yAxisId="right" dataKey="count" stroke="#10b981" strokeWidth={3.5} dot={{ r: 4, fill: '#10b981' }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {(activeModal === 'profit' || activeModal === 'loss') && (
                    <AreaGraphVisualizer
                      title={activeModal === 'profit' ? "Portfolio Profit Analytics (Full Screen View)" : "Expired Portfolio Loss Analytics (Full Screen View)"}
                      type={activeModal === 'profit' ? "profit" : "loss"}
                      totalValue={activeModal === 'profit' ? (modalSummary.totalProfit || effectiveStats?.profit || 0) : (effectiveStats?.loss || 0)}
                      monthlyData={effectiveMonthlyData}
                      height="h-[340px]"
                      fullScreenMode={true}
                    />
                  )}

                  {activeModal === 'services' && (
                    <div className="h-[340px] flex items-center justify-center">
                      <ServiceDistributionPieChart 
                        rawServiceData={serviceData} 
                        allRecords={filteredServiceRecords} 
                      />
                    </div>
                  )}
                </div>

                {/* 2. Month-by-Month Profit vs Loss Chart */}
                {monthlyAnalysis && (
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/15 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                          Month-by-Month Estimated Net Profit & Target Telemetry
                        </h3>
                        <p className="text-xs text-slate-400">Comparing estimated monthly gross profit with total contract revenue</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span> Est. Net Profit
                        </span>
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <span className="w-3 h-3 rounded bg-indigo-500/50 inline-block"></span> Gross Revenue
                        </span>
                      </div>
                    </div>
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyAnalysis.enriched} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.25} />
                          <XAxis dataKey="month" interval={0} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                          <YAxis width={65} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(val) => formatCompactCurrency(val)} />
                          <RechartsTooltip content={<CustomComposedTooltip />} />
                          <Bar dataKey="revenue" fill="#a559a5" opacity={0.4} radius={[6, 6, 0, 0]} barSize={24} />
                          <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 3. AI Executive Strategic Monthly Profit & Loss Analysis Panel */}
                {monthlyAnalysis && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/95 to-slate-950 border border-brand-500/30 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
                      <div className="p-2 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white flex items-center gap-2">
                          Executive AI Profit & Loss Analysis
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase">
                            Actionable Insights
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400">Monthly profit peaks, risk analysis & strategic revenue growth recommendations</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Peak Profit Month Card */}
                      <div 
                        onClick={() => setSelectedMonthDrilldown(monthlyAnalysis.peakMonth?.month)}
                        className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md cursor-pointer hover:border-emerald-400 hover:bg-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/10 hover:scale-[1.01] transition-all group relative"
                        title="Click to view related clients for this month"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">🏆 Highest Profit Month</span>
                          <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                        </div>
                        <p className="text-2xl font-black text-white mt-1.5">{monthlyAnalysis.peakMonth?.month || 'N/A'}</p>
                        <p className="text-sm font-bold text-emerald-300 mt-0.5">
                          {formatCurrency(monthlyAnalysis.peakMonth?.revenue || 0)} <span className="text-[10px] text-slate-400 font-medium">(Rev)</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Profit: <strong className="text-white">{formatCurrency(monthlyAnalysis.peakMonth?.profit || 0)}</strong>
                          {monthlyAnalysis.peakMonth?.revenue > 0 && (
                            <span className="text-slate-400"> ({monthlyAnalysis.peakMonth.margin.toFixed(1)}% margin)</span>
                          )} across {monthlyAnalysis.peakMonth?.count || 0} contracts.
                          {monthlyAnalysis.peakMonth?.profitIncomplete && (
                            <span className="text-amber-400" title="Some contracts in this month have no profit recorded, so this figure is understated."> Partial data.</span>
                          )}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-bold text-emerald-400 group-hover:text-white transition-colors">
                          <span>View {monthlyAnalysis.peakMonth?.count || 0} Related Clients</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* Highest Risk Month Card */}
                      <div 
                        onClick={() => setSelectedMonthDrilldown(monthlyAnalysis.riskMonth?.month)}
                        className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-md cursor-pointer hover:border-rose-400 hover:bg-rose-500/15 hover:shadow-lg hover:shadow-rose-500/10 hover:scale-[1.01] transition-all group relative"
                        title="Click to view related clients for this month"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black tracking-wider text-rose-400">⚠️ Lowest Revenue / High Risk Month</span>
                          <TrendingDown className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                        </div>
                        <p className="text-2xl font-black text-white mt-1.5">{monthlyAnalysis.riskMonth?.month || 'N/A'}</p>
                        <p className="text-sm font-bold text-rose-300 mt-0.5">
                          {formatCurrency(monthlyAnalysis.riskMonth?.revenue || 0)} <span className="text-[10px] text-slate-400 font-medium">(Rev)</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Profit: <strong className="text-white">{formatCurrency(monthlyAnalysis.riskMonth?.profit || 0)}</strong>
                          {monthlyAnalysis.riskMonth?.revenue > 0 && (
                            <span className="text-slate-400"> ({monthlyAnalysis.riskMonth.margin.toFixed(1)}% margin)</span>
                          )} across {monthlyAnalysis.riskMonth?.count || 0} active renewals.
                          {monthlyAnalysis.riskMonth?.profitIncomplete && (
                            <span className="text-amber-400" title="Some contracts in this month have no profit recorded, so this figure is understated."> Partial data.</span>
                          )}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex items-center justify-between text-[11px] font-bold text-rose-400 group-hover:text-white transition-colors">
                          <span>View {monthlyAnalysis.riskMonth?.count || 0} Related Clients</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* Average Monthly Telemetry */}
                      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300">📈 Monthly Average Run-Rate</span>
                          <Activity className="w-4 h-4 text-indigo-400" />
                        </div>
                        <p className="text-2xl font-black text-white mt-1.5">{formatCurrency(monthlyAnalysis.avgRev)}</p>
                        <p className="text-xs font-semibold text-indigo-300 mt-0.5">
                          Tracked Period: {monthlyAnalysis.totalTrackedMonths} Months
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Total Forecasted Portfolio: <strong className="text-white">{formatCurrency(monthlyAnalysis.totalRev)}</strong>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Total Profit: <strong className="text-white">{formatCurrency(monthlyAnalysis.totalProfit)}</strong>
                          {monthlyAnalysis.totalRev > 0 && (
                            <span className="text-indigo-300"> ({monthlyAnalysis.avgMargin.toFixed(1)}% margin)</span>
                          )}
                        </p>
                        {monthlyAnalysis.anyProfitIncomplete && (
                          <p className="text-[11px] text-amber-400 mt-1.5 leading-snug">
                            Some contracts have no profit recorded — margins shown are understated, not estimated.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Strategic Action Plan */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2.5">
                        <Zap className="w-3.5 h-3.5" />
                        Strategic Action Plan to Improve Net Profit & Reduce Loss:
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-start gap-2">
                          <span className="p-1 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] mt-0.5">1</span>
                          <div>
                            <strong className="text-white block font-bold">Advance Renewal Campaigns (60-Day Lock)</strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">Launch automated notification triggers 60 days prior to peak months like <span className="text-emerald-300 font-semibold">{monthlyAnalysis.peakMonth?.month}</span> to lock in recurring contracts early and remove drop-off risk.</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-start gap-2">
                          <span className="p-1 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] mt-0.5">2</span>
                          <div>
                            <strong className="text-white block font-bold">Upsell High-Margin Cloud Services</strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">Focus CST follow-ups on bundling high-margin Managed Services and Enterprise SSL add-ons to boost overall contract gross margin beyond 75%.</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-start gap-2">
                          <span className="p-1 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] mt-0.5">3</span>
                          <div>
                            <strong className="text-white block font-bold">Risk Month Churn Prevention</strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">Prioritize proactive account executive outreach for accounts in lower revenue months like <span className="text-rose-300 font-semibold">{monthlyAnalysis.riskMonth?.month}</span> to prevent contract expiry and net revenue loss.</p>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-start gap-2">
                          <span className="p-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] mt-0.5">4</span>
                          <div>
                            <strong className="text-white block font-bold">Vendor Cost Structuring</strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">Negotiate volume discounts with vendors for high-volume renewal items to lower cost of goods sold (COGS) and increase net profitability.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary Stat Cards */}
            {modalViewMode !== 'graph' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 flex-shrink-0">
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Matching Contracts</p>
                  <p className="text-xl font-black text-white mt-1">{modalSummary.totalCount}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Portfolio Value</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{formatCurrency(modalSummary.totalVal)}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Net Profit</p>
                  <p className="text-xl font-black text-indigo-300 mt-1">{formatCurrency(modalSummary.totalProfit)}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unique Clients</p>
                  <p className="text-xl font-black text-amber-400 mt-1">{modalSummary.uniqueClients}</p>
                </div>
              </div>
            )}

            {/* Table Container */}
            {modalViewMode !== 'graph' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl bg-slate-900/60 shadow-2xl">
              {filteredModalRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-sm text-white">No matching records found</p>
                  <p className="text-xs mt-1 text-slate-400">Try adjusting your filters or search query.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-300 border-b border-white/10 uppercase tracking-wider text-[11px] font-semibold sticky top-0 backdrop-blur-md z-10">
                    <tr>
                      <th className="px-4 py-3 text-left">Client Name</th>
                      <th className="px-4 py-3 text-left">Vendor</th>
                      <th className="px-4 py-3 text-left">Service Plan</th>
                      <th className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1 justify-center">
                          <span>Status</span>
                          <GlassSelect
                            value={modalStatusFilter}
                            onChange={(e, val) => setModalStatusFilter(val !== undefined ? val : e.target.value)}
                            size="xs"
                            className="min-w-[80px]"
                            options={[
                              { value: 'All', label: 'All' },
                              { value: 'Active', label: 'Active' },
                              { value: 'Pending Renewal', label: 'Pending' },
                              { value: 'Renewed', label: 'Renewed' },
                              { value: 'Expired', label: 'Expired' },
                            ]}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <div className="inline-flex items-center gap-1">
                          <span>Renewal Date</span>
                          <GlassSelect
                            value={modalDateFilter}
                            onChange={(e, val) => setModalDateFilter(val !== undefined ? val : e.target.value)}
                            size="xs"
                            className="min-w-[90px]"
                            options={[
                              { value: 'All', label: 'All' },
                              { value: 'this_month', label: 'This Month' },
                              { value: 'next_month', label: 'Next Month' },
                              { value: '30_days', label: '30 Days' },
                              { value: '60_days', label: '60 Days' },
                              { value: '90_days', label: '90 Days' },
                              { value: 'expired', label: 'Expired' },
                            ]}
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right">Contract Value</th>
                      <th className="px-4 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-slate-200">
                    {filteredModalRecords.map((r, i) => (
                      <tr 
                        key={i} 
                        onClick={() => setSelectedClientForDetails(r)}
                        className="hover:bg-white/10 cursor-pointer transition-colors group"
                        title="Click to view full client contract details"
                      >
                        <td className="px-4 py-3 font-semibold text-white group-hover:text-brand-300 transition-colors">
                          <div className="flex items-center gap-1.5">
                            <span>{r.client_name || 'N/A'}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-300">{r.vendor || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {r.service || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(r.status)}`}>
                            {r.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(r.value || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-indigo-300">
                          {formatCurrency(r.profit || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Month Client Drilldown Modal */}
      {selectedMonthDrilldown && createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2 flex-wrap">
                    <span>Client Contracts for {selectedMonthDrilldown}</span>
                    {selectedDeptFilter !== 'all' && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        {selectedDeptFilter}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      {monthDrilldownClients.length} Contracts
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-slate-400">Click on any client card below to view full client contract details</p>
                    {selectedDeptFilter !== 'all' && (
                      <button
                        onClick={() => setSelectedDeptFilter('all')}
                        className="text-xs font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>Show all departments for this month</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMonthDrilldown(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Client Table / Grid */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
              {monthDrilldownClients.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-400" />
                  <p className="text-sm font-bold text-white">No active contracts found for {selectedMonthDrilldown}{selectedDeptFilter !== 'all' ? ` in ${selectedDeptFilter}` : ''}</p>
                  {selectedDeptFilter !== 'all' && (
                    <button
                      onClick={() => setSelectedDeptFilter('all')}
                      className="mt-2 text-xs font-semibold text-brand-400 hover:text-brand-300 underline underline-offset-2"
                    >
                      Show contracts across all departments
                    </button>
                  )}
                  <p className="text-xs mt-1">Check back once new renewals are assigned to this month.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {monthDrilldownClients.map((client, idx) => (
                    <div 
                      key={client.id || idx}
                      onClick={() => setSelectedClientForDetails(client)}
                      className="p-4 rounded-xl bg-slate-800/70 border border-white/10 hover:border-brand-500/50 hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors truncate">
                              {client.client_name}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(client.status)}`}>
                              {client.status || 'Active'}
                            </span>
                            {client.department_name && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 flex items-center gap-1">
                                <Building2 className="w-2.5 h-2.5" />
                                {client.department_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-300">{client.service}</span>
                            {client.vendor && <span>• Vendor: {client.vendor}</span>}
                            {client.unique_id && <span className="font-mono text-[10px] text-slate-500">({client.unique_id})</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(client.value || 0)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Renewal: <strong className="text-white">{client.expiry_date ? new Date(client.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</strong>
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-brand-500 group-hover:text-white text-slate-400 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/90 flex justify-between items-center text-xs text-slate-300">
              <div className="flex items-center gap-4">
                <span>Total Portfolio Revenue: <strong className="text-emerald-400 font-mono font-bold text-sm ml-1">{formatCurrency(monthDrilldownClients.reduce((acc, c) => acc + (parseFloat(c.value) || 0), 0))}</strong></span>
                {(() => {
                  /* Sum only the recorded profit. The old fallback invented a
                     72% margin for any client without one, which silently
                     inflated this total. Missing rows are now counted and
                     disclosed rather than estimated. */
                  const withProfit = monthDrilldownClients.filter(c => c.profit !== null && c.profit !== undefined && c.profit !== '');
                  const netProfit = withProfit.reduce((acc, c) => acc + (parseFloat(c.profit) || 0), 0);
                  const missing = monthDrilldownClients.length - withProfit.length;
                  return (
                    <span>
                      Net Profit:
                      <strong className="text-indigo-400 font-mono font-bold text-sm ml-1">{formatCurrency(netProfit)}</strong>
                      {missing > 0 && (
                        <span
                          className="ml-1.5 text-[11px] text-amber-400"
                          title={`${missing} of ${monthDrilldownClients.length} contracts have no profit recorded, so they contribute ₹0 to this total.`}
                        >
                          ({missing} without profit data)
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
              <button 
                onClick={() => setSelectedMonthDrilldown(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Client Full Details Modal */}
      {selectedClientForDetails && (
        <ClientDetailsModal 
          client={selectedClientForDetails} 
          onClose={() => setSelectedClientForDetails(null)} 
        />
      )}
    </div>
  );
}
