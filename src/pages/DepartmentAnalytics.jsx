import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Building2,
  ArrowLeft,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Users as UsersIcon,
  X,
  Loader2,
  Clock,
  ChevronRight,
  Activity,
  Award,
  Flame,
  BarChart3,
  Grid3x3,
  Download,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Tag,
  Briefcase
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import EmptyState from '../components/common/EmptyState';
import MetricCard from '../components/common/MetricCard';
import AreaGraphVisualizer from '../components/AreaGraphVisualizer';

const TRAFFIC_LIGHT = {
  stalled: { label: 'Stalled', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800' },
  needs_attention: { label: 'Needs attention', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' },
  on_track: { label: 'On track', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
};

function exportDeptDetailCsv(deptDetail) {
  const lines = [`Department: ${deptDetail.department.name}`, ''];

  lines.push('Services');
  lines.push('name,renewals,revenue,purchase_cost,profit,margin_pct,conversion_pct');
  for (const s of deptDetail.services) {
    lines.push(`${s.name},${s.renewalCount},${s.revenue},${s.purchaseCost},${s.profit},${s.marginPct},${s.conversionRatePct}`);
  }
  lines.push('');

  lines.push('Rep Activity');
  lines.push('full_name,status,owned,renewed,overdue,untouched_overdue,followups_due,last_activity,profit');
  for (const u of deptDetail.users) {
    lines.push(`${u.fullName},${u.trafficLight},${u.ownedCount},${u.renewedCount},${u.overdueCount},${u.untouchedOverdueCount},${u.followupsDue},${u.lastActivity || 'Never'},${u.totalProfit}`);
  }

  const csv = `data:text/csv;charset=utf-8,${lines.join('\n')}`;
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csv));
  link.setAttribute('download', `${deptDetail.department.name.replace(/\s+/g, '-').toLowerCase()}-performance.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportCrossDeptCsv(departments) {
  const lines = ['Cross-Department Comparison', ''];
  lines.push('name,revenue,profit,margin_pct,conversion_pct,overdue_count,active_count,service_count,user_count');
  for (const d of [...departments].sort((a, b) => b.marginPct - a.marginPct)) {
    lines.push(`${d.name},${d.revenue},${d.profit},${d.marginPct},${d.conversionRatePct},${d.overdueCount},${d.activeCount},${d.service_count},${d.user_count}`);
  }
  const csv = `data:text/csv;charset=utf-8,${lines.join('\n')}`;
  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csv));
  link.setAttribute('download', 'department-comparison.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
}

function TrafficLightBadge({ status }) {
  const cfg = TRAFFIC_LIGHT[status] || TRAFFIC_LIGHT.on_track;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function DepartmentAnalytics() {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlDeptId = searchParams.get('deptId') ? parseInt(searchParams.get('deptId'), 10) : null;
  const initialTab = searchParams.get('tab') || 'overview';

  const [departments, setDepartments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState(urlDeptId || (isSuperAdmin ? null : user?.departmentId ?? null));
  const [deptDetail, setDeptDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeUser, setActiveUser] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Active Main Tab: 'overview' | 'comparison' | 'vendors' | 'leaderboard'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Active Scoped Sub-Tab for Department Detail: 'overview' | 'risk' | 'team' | 'services'
  const [departmentSubTab, setDepartmentSubTab] = useState('overview');

  // Vendor Concentration & Company Leaderboard data
  const [vendorConcentration, setVendorConcentration] = useState(null);
  const [companyLeaderboard, setCompanyLeaderboard] = useState(null);

  // Expiry Cliff / Revenue-at-risk
  const [expiryCliff, setExpiryCliff] = useState(null);
  const [loadingCliff, setLoadingCliff] = useState(false);

  // Filters inside tabs
  const [deptSearch, setDeptSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDepartments(await res.json());
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  useEffect(() => {
    if (!token || !isSuperAdmin || selectedDeptId) return;
    fetch('/api/analytics/vendor-concentration', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null).then(setVendorConcentration).catch(() => {});
    fetch('/api/analytics/leaderboard', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null).then(setCompanyLeaderboard).catch(() => {});
  }, [token, isSuperAdmin, selectedDeptId]);

  const fetchDetail = useCallback(async (id) => {
    if (!token || !id) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/departments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDeptDetail(await res.json());
      else toast.error('Failed to load department detail');
    } catch {
      toast.error('Network error');
    } finally {
      setLoadingDetail(false);
    }
  }, [token]);

  useEffect(() => {
    if (!selectedDeptId) { setDeptDetail(null); setExpiryCliff(null); return; }
    fetchDetail(selectedDeptId);
    setLoadingCliff(true);
    fetch(`/api/analytics/expiry-cliff?departmentId=${selectedDeptId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null).then(setExpiryCliff).catch(() => {}).finally(() => setLoadingCliff(false));
  }, [selectedDeptId, fetchDetail, token]);

  const openUserActivity = async (u) => {
    setActiveUser(u);
    setActivity(null);
    setLoadingActivity(true);
    try {
      const res = await fetch(`/api/users/${u.id}/activity`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setActivity(await res.json());
      else toast.error('Failed to load user activity');
    } catch {
      toast.error('Network error');
    } finally {
      setLoadingActivity(false);
    }
  };

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tabKey);
      return p;
    });
  };

  const handleSelectDepartment = (deptId) => {
    setSelectedDeptId(deptId);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('deptId', deptId);
      return p;
    });
  };

  const handleBackToAll = () => {
    setSelectedDeptId(null);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.delete('deptId');
      return p;
    });
  };

  // Filtered lists
  const filteredDepartments = useMemo(() => {
    const list = [...departments].sort((a, b) => b.marginPct - a.marginPct);
    if (!deptSearch.trim()) return list;
    return list.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
  }, [departments, deptSearch]);

  const filteredVendors = useMemo(() => {
    if (!vendorConcentration?.vendors) return [];
    if (!vendorSearch.trim()) return vendorConcentration.vendors;
    return vendorConcentration.vendors.filter(v => v.vendor.toLowerCase().includes(vendorSearch.toLowerCase()));
  }, [vendorConcentration, vendorSearch]);

  const filteredReps = useMemo(() => {
    if (!companyLeaderboard?.byProfit) return [];
    if (!leaderboardSearch.trim()) return companyLeaderboard.byProfit;
    const q = leaderboardSearch.toLowerCase();
    return companyLeaderboard.byProfit.filter(r =>
      r.fullName?.toLowerCase().includes(q) || r.departmentName?.toLowerCase().includes(q)
    );
  }, [companyLeaderboard, leaderboardSearch]);

  if (loadingList) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── SUPER ADMIN / COMPANY LEVEL TABS VIEW (When no specific department is isolated)
  // ═════════════════════════════════════════════════════════════════════════════
  if (isSuperAdmin && !selectedDeptId) {
    return (
      <div className="space-y-6 w-full pb-16 animate-fade-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Team Performance & Analytics</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Multi-dimensional operations: departments, partner concentrations, and specialist throughput
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {departments.length > 0 && (
              <button
                onClick={() => exportCrossDeptCsv(departments)}
                className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report</span>
              </button>
            )}
          </div>
        </div>

        {/* ── INTERACTIVE TAB NAVIGATION ── */}
        <div className="p-1.5 glass rounded-2xl border border-surface-200/80 dark:border-surface-700/80 shadow-xs flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => switchTab('overview')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'overview'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>All Overview</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('comparison')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'comparison'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
            }`}
          >
            <Percent className="w-4 h-4" />
            <span>Cross-Department Comparison</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'comparison' ? 'bg-white/20 text-white' : 'bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
            }`}>
              {departments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('vendors')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'vendors'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Vendor Concentration</span>
            {vendorConcentration?.vendors && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'vendors' ? 'bg-white/20 text-white' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
              }`}>
                {vendorConcentration.vendors.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchTab('leaderboard')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Company Leaderboard</span>
            {companyLeaderboard?.byProfit && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'leaderboard' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              }`}>
                {companyLeaderboard.byProfit.length}
              </span>
            )}
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────
            TAB 1: ALL OVERVIEW (The combined multi-panel executive view)
           ───────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Department Quick Tiles */}
            {departments.length === 0 ? (
              <EmptyState icon={Building2} title="No departments yet" description="Create a department first from the Departments screen." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDepartment(d.id)}
                    className="glass-card group text-left rounded-2xl border border-surface-200/80 dark:border-surface-700/80 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">{d.name}</h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {d.service_count} services · {d.user_count} reps
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform flex-shrink-0 mt-0.5" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-surface-100 dark:border-surface-800">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Revenue</span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 truncate">{formatCurrency(d.revenue)}</div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Margin</span>
                        <div className={`text-xs font-black mt-0.5 ${d.marginPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {d.marginPct}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Overdue</span>
                        <div className={`text-xs font-black mt-0.5 ${d.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                          {d.overdueCount}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Cross-Department Comparison Snippet (Clickable Rows) */}
            {departments.length > 0 && (
              <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                      <Percent className="w-4 h-4 text-brand-500" />
                      <span>Cross-Department Comparison</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Ranked by profit margin. Click any department row to view its full dedicated operational details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('comparison')}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Full Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                      <tr>
                        <th className="px-3 py-2.5">Department</th>
                        <th className="px-3 py-2.5 text-right">Revenue</th>
                        <th className="px-3 py-2.5 text-right">Profit</th>
                        <th className="px-3 py-2.5 text-right">Margin</th>
                        <th className="px-3 py-2.5 text-right">Conversion</th>
                        <th className="px-3 py-2.5 text-right">Overdue</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                      {[...departments].sort((a, b) => b.marginPct - a.marginPct).map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => handleSelectDepartment(d.id)}
                          className="cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-colors group"
                        >
                          <td className="px-3 py-3 font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {d.name}
                          </td>
                          <td className="px-3 py-3 text-right">{formatCurrency(d.revenue)}</td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(d.profit)}</td>
                          <td className={`px-3 py-3 text-right font-black ${d.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : d.marginPct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {d.marginPct}%
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">{d.conversionRatePct}%</td>
                          <td className={`px-3 py-3 text-right ${d.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                            {d.overdueCount}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
                              <span>Open</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Split Row: Vendor Concentration & Company Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vendor Concentration Card */}
              <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Vendor Concentration</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Click any partner to view focused vendor intelligence
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('vendors')}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Full Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!vendorConcentration ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : vendorConcentration.vendors.length === 0 ? (
                  <EmptyState icon={Flame} title="No vendor data" description="Renewals don't have a vendor set yet." compact />
                ) : (
                  <div className="space-y-2.5">
                    {vendorConcentration.vendors.slice(0, 8).map((v) => (
                      <div
                        key={v.vendor}
                        onClick={() => setSelectedVendor(v)}
                        className="p-2.5 rounded-xl glass-card hover:border-amber-400 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {v.vendor}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">
                            {v.revenueSharePct}% of revenue · <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(v.profit)}</span> profit
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${v.revenueSharePct > 40 ? 'bg-rose-500' : v.revenueSharePct > 20 ? 'bg-amber-500' : 'bg-brand-500'}`}
                            style={{ width: `${Math.min(100, v.revenueSharePct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Company Leaderboard Card */}
              <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-500" />
                      <span>Company Leaderboard</span>
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Top reps by profit. Click any rep to view their activity drawer
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('leaderboard')}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Full Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!companyLeaderboard ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : companyLeaderboard.byProfit.length === 0 ? (
                  <EmptyState icon={Award} title="No reps yet" description="No 'user' role accounts are assigned to any department." compact />
                ) : (
                  <div className="space-y-1.5">
                    {companyLeaderboard.byProfit.slice(0, 8).map((u, idx) => (
                      <div
                        key={u.id}
                        onClick={() => openUserActivity(u)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl glass-card hover:border-brand-400 transition-all cursor-pointer group"
                      >
                        <span className={`text-xs font-black w-4 ${idx < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                          {idx + 1}
                        </span>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-xs"
                          style={{ background: u.avatarColor || '#a559a5' }}
                        >
                          {getInitials(u.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {u.fullName}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{u.departmentName}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(u.totalProfit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────
            TAB 2: DEDICATED CROSS-DEPARTMENT COMPARISON (ONLY relative department details)
           ───────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'comparison' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Aggregates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Dept Revenue</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {formatCurrency(departments.reduce((s, d) => s + (d.revenue || 0), 0))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Combined corporate renewals</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Dept Profit</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(departments.reduce((s, d) => s + (d.profit || 0), 0))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Net earnings generated</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operating Units</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {departments.length}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Active departmental divisions</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overdue SLA Risk</span>
                <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {departments.reduce((s, d) => s + (d.overdueCount || 0), 0)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Expired accounts requiring attention</p>
              </div>
            </div>

            {/* Department Comparison Full Table */}
            <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Percent className="w-5 h-5 text-brand-500" />
                    <span>Cross-Department Performance Ledger</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any department row to drill down into its services, revenue at risk, and representative activity.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    placeholder="Search department..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-800 text-xs text-surface-900 dark:text-white placeholder-surface-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5 text-center">Services</th>
                      <th className="px-3 py-2.5 text-center">Team Reps</th>
                      <th className="px-3 py-2.5 text-right">Revenue</th>
                      <th className="px-3 py-2.5 text-right">Profit</th>
                      <th className="px-3 py-2.5 text-right">Margin</th>
                      <th className="px-3 py-2.5 text-right">Conversion</th>
                      <th className="px-3 py-2.5 text-right">Overdue</th>
                      <th className="px-3 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                    {filteredDepartments.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => handleSelectDepartment(d.id)}
                        className="cursor-pointer hover:bg-brand-50/60 dark:hover:bg-brand-950/30 transition-colors group"
                      >
                        <td className="px-3 py-3.5">
                          <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">
                            {d.name}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {d.activeCount || 0} active contracts
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                          {d.service_count}
                        </td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                          {d.user_count}
                        </td>
                        <td className="px-3 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(d.revenue)}
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(d.profit)}
                        </td>
                        <td className={`px-3 py-3.5 text-right font-black ${d.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : d.marginPct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {d.marginPct}%
                        </td>
                        <td className="px-3 py-3.5 text-right font-semibold">
                          {d.conversionRatePct}%
                        </td>
                        <td className={`px-3 py-3.5 text-right ${d.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                          {d.overdueCount}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold group-hover:bg-brand-600 group-hover:text-white transition-all shadow-2xs"
                          >
                            <span>Open Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────
            TAB 3: DEDICATED VENDOR CONCENTRATION (ONLY relative vendor details)
           ───────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'vendors' && (
          <div className="space-y-6 animate-fade-in">
            {/* Vendor Aggregates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Vendor Revenue</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {formatCurrency(vendorConcentration?.totalRevenue || 0)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Portfolio revenue generated</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Vendor Profit</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(vendorConcentration?.totalProfit || 0)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Partner procurement margin</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Supplier Footprint</span>
                <div className="text-xl font-black text-amber-500 mt-1">
                  {vendorConcentration?.vendors?.[0]?.revenueSharePct || 0}%
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{vendorConcentration?.vendors?.[0]?.vendor || 'None'}</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracked Partners</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {vendorConcentration?.vendors?.length || 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Active OEM / software vendors</p>
              </div>
            </div>

            {/* Vendor List & Drill-down */}
            <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <span>Vendor Ecosystem & Dependency Concentration</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any partner row to inspect vendor telemetry, profit share, and renewals
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    placeholder="Search vendor..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-800 text-xs text-surface-900 dark:text-white placeholder-surface-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2.5">Vendor</th>
                      <th className="px-3 py-2.5 text-right">Revenue</th>
                      <th className="px-3 py-2.5 text-left w-48">Share of Portfolio</th>
                      <th className="px-3 py-2.5 text-right">Profit</th>
                      <th className="px-3 py-2.5 text-center">Renewals</th>
                      <th className="px-3 py-2.5 text-center">Concentration Risk</th>
                      <th className="px-3 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                    {filteredVendors.map((v) => (
                      <tr
                        key={v.vendor}
                        onClick={() => setSelectedVendor(v)}
                        className="cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors group"
                      >
                        <td className="px-3 py-3.5 font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {v.vendor}
                        </td>
                        <td className="px-3 py-3.5 text-right font-semibold">
                          {formatCurrency(v.revenue)}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${v.revenueSharePct > 40 ? 'bg-rose-500' : v.revenueSharePct > 20 ? 'bg-amber-500' : 'bg-brand-500'}`}
                                style={{ width: `${Math.min(100, v.revenueSharePct)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                              {v.revenueSharePct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(v.profit)}
                        </td>
                        <td className="px-3 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                          {v.renewalCount}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          {v.revenueSharePct > 40 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                              High Risk
                            </span>
                          ) : v.revenueSharePct > 20 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Moderate
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Balanced
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold group-hover:bg-amber-500 group-hover:text-white transition-all shadow-2xs"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────
            TAB 4: DEDICATED COMPANY LEADERBOARD (ONLY relative rep throughput details)
           ───────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Leaderboard Aggregates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Rep Generated Profit</span>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatCurrency(companyLeaderboard?.byProfit?.[0]?.totalProfit || 0)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{companyLeaderboard?.byProfit?.[0]?.fullName || 'Specialist'}</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Active Reps</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {companyLeaderboard?.byProfit?.length || 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Across all operating departments</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Contracts Managed</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {companyLeaderboard?.byProfit?.reduce((s, u) => s + (u.ownedCount || 0), 0) || 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Assigned renewal accounts</p>
              </div>

              <div className="glass p-5 rounded-2xl shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Follow-ups Due</span>
                <div className="text-xl font-black text-brand-600 dark:text-brand-400 mt-1">
                  {companyLeaderboard?.byProfit?.reduce((s, u) => s + (u.followupsDue || 0), 0) || 0}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Outreach tasks pending execution</p>
              </div>
            </div>

            {/* Rep Leaderboard Full Table */}
            <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-500" />
                    <span>Company Specialist Leaderboard & Performance</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any specialist row to open their complete activity ledger and assigned contracts
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={leaderboardSearch}
                    onChange={(e) => setLeaderboardSearch(e.target.value)}
                    placeholder="Search specialist or dept..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-800 text-xs text-surface-900 dark:text-white placeholder-surface-400 focus:outline-hidden focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left text-xs min-w-[750px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-12">Rank</th>
                      <th className="px-3 py-2.5">Specialist</th>
                      <th className="px-3 py-2.5">Department</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5 text-right">Owned</th>
                      <th className="px-3 py-2.5 text-right">Renewed</th>
                      <th className="px-3 py-2.5 text-right">Conversion</th>
                      <th className="px-3 py-2.5 text-right">Overdue</th>
                      <th className="px-3 py-2.5 text-right">Profit</th>
                      <th className="px-3 py-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                    {filteredReps.map((u, idx) => (
                      <tr
                        key={u.id}
                        onClick={() => openUserActivity(u)}
                        className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors group"
                      >
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                            idx === 0
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300'
                              : idx === 1
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                              : idx === 2
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-2xs"
                              style={{ background: u.avatarColor || '#a559a5' }}
                            >
                              {getInitials(u.fullName)}
                            </div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                              {u.fullName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 font-semibold">
                          {u.departmentName}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <TrafficLightBadge status={u.trafficLight} />
                        </td>
                        <td className="px-3 py-3.5 text-right font-semibold">
                          {u.ownedCount}
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {u.renewedCount}
                        </td>
                        <td className="px-3 py-3.5 text-right font-bold text-brand-600 dark:text-brand-400">
                          {u.conversionRatePct != null ? `${u.conversionRatePct}%` : `${u.ownedCount > 0 ? Math.round((u.renewedCount / u.ownedCount) * 100) : 0}%`}
                        </td>
                        <td className={`px-3 py-3.5 text-right ${u.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                          {u.overdueCount}
                        </td>
                        <td className="px-3 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(u.totalProfit)}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs"
                          >
                            <span>Activity</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── VENDOR DETAIL SLIDE-OVER DRAWER ── */}
        {selectedVendor && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedVendor(null)} />
            <div className="relative w-full max-w-md h-full bg-white dark:bg-surface-900 shadow-2xl border-l border-surface-200 dark:border-surface-800 flex flex-col z-10 animate-fade-in">
              <div className="flex items-center justify-between p-5 border-b border-surface-200 dark:border-surface-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-surface-900 dark:text-white">{selectedVendor.vendor}</h3>
                    <p className="text-xs text-surface-500">Partner Concentration Telemetry</p>
                  </div>
                </div>
                <button onClick={() => setSelectedVendor(null)} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl glass-card">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Revenue Generated</span>
                    <div className="text-lg font-black text-surface-900 dark:text-white mt-1">
                      {formatCurrency(selectedVendor.revenue)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl glass-card">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Net Profit</span>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(selectedVendor.profit)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl glass-card">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Portfolio Share</span>
                    <div className="text-lg font-black text-amber-500 mt-1">
                      {selectedVendor.revenueSharePct}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl glass-card">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Active Contracts</span>
                    <div className="text-lg font-black text-surface-900 dark:text-white mt-1">
                      {selectedVendor.renewalCount}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-surface-500">Partner Strategic Footprint</span>
                  <p className="text-xs text-surface-700 dark:text-surface-300">
                    {selectedVendor.revenueSharePct > 40
                      ? '⚠️ High Dependency Alert: Over 40% of organizational revenue relies upon this vendor. Consider product diversification or strategic OEM tier renegotiation.'
                      : selectedVendor.revenueSharePct > 20
                      ? '⚡ Moderate Exposure: Solid commercial partner generating consistent profitability.'
                      : '✅ Balanced Portfolio: Healthy margin contribution without critical operational risk.'}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendor(null);
                      navigate(`/renewals?search=${encodeURIComponent(selectedVendor.vendor)}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <span>View All {selectedVendor.vendor} Contracts</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendor(null);
                      navigate('/pricing');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl btn-secondary text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Inspect Catalog ERP Margins</span>
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── USER ACTIVITY MODAL ── */}
        {activeUser && createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setActiveUser(null)} />
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-surface-200/80 dark:border-white/15">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/60 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-xs"
                    style={{ background: activeUser.avatarColor || '#a559a5' }}
                  >
                    {getInitials(activeUser.fullName)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">{activeUser.fullName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeUser.departmentName || 'Specialist'} · Throughput Ledger
                    </p>
                  </div>
                </div>
                <button onClick={() => setActiveUser(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loadingActivity || !activity ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="px-6 py-5 space-y-5">
                  {activity.performance && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owned</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{activity.performance.ownedCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Renewed</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{activity.performance.renewedCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overdue</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-400">{activity.performance.overdueCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                        <div className="mt-1"><TrafficLightBadge status={activity.performance.trafficLight} /></div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Recent activity</h4>
                    {activity.timeline.length === 0 ? (
                      <EmptyState icon={Clock} title="No logged actions" description="This user has no recorded renewal_history entries yet." compact />
                    ) : (
                      <div className="space-y-1.5">
                        {activity.timeline.slice(0, 15).map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/30">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white capitalize">{t.action.replace(/_/g, ' ')}</span>
                              <span className="text-slate-500 dark:text-slate-400"> — {t.client_name} ({t.unique_id})</span>
                            </div>
                            <span className="text-slate-400 whitespace-nowrap flex-shrink-0">{formatDateTime(t.performed_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Renewals on their desk ({activity.ownedRenewals.length})</h4>
                    {activity.ownedRenewals.length === 0 ? (
                      <EmptyState icon={UsersIcon} title="Nothing assigned" description="No renewals currently owned by this user." compact />
                    ) : (
                      <div className="space-y-1.5">
                        {activity.ownedRenewals.slice(0, 15).map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/30">
                            <div className="min-w-0 truncate">
                              <span className="font-bold text-slate-900 dark:text-white">{r.client_name}</span>
                              <span className="text-slate-500 dark:text-slate-400"> · {r.service} · {r.unique_id}</span>
                            </div>
                            <span className="font-semibold whitespace-nowrap flex-shrink-0">{formatCurrency(r.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── FOCUSED DEPARTMENT DETAIL VIEW (Scoped ONLY to the selected department)
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 w-full pb-16 animate-fade-in">
      {/* Header with clear back button on right side */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {deptDetail?.department?.name || 'Department Analytics'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Service line breakdown, revenue at risk, and representative throughput for this division
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {deptDetail && (
            <button onClick={() => exportDeptDetailCsv(deptDetail)} className="btn-secondary flex items-center gap-1.5 py-1 px-2.5 text-xs font-bold rounded-lg shadow-xs cursor-pointer">
              <Download className="w-3 h-3" /> <span>Export CSV</span>
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleBackToAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-bold bg-white/90 dark:bg-surface-800/90 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-200/80 dark:border-surface-700/80 shadow-xs transition-all cursor-pointer group shrink-0"
              title="Return to All Tabs"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to All Tabs</span>
            </button>
          )}
        </div>
      </div>

      {loadingDetail || !deptDetail ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <>
          {/* Department Sub-Tabs */}
          <div className="p-1 glass rounded-xl border border-surface-200/80 dark:border-surface-700/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setDepartmentSubTab('overview')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                departmentSubTab === 'overview'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Overview & KPIs</span>
            </button>

            <button
              type="button"
              onClick={() => setDepartmentSubTab('risk')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                departmentSubTab === 'risk'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Revenue at Risk</span>
              {expiryCliff?.summary?.within30?.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
                  {expiryCliff.summary.within30.count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setDepartmentSubTab('team')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                departmentSubTab === 'team'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Rep Activity ({deptDetail.users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setDepartmentSubTab('services')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                departmentSubTab === 'services'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800/60'
              }`}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>Service Line Mix</span>
            </button>
          </div>

          {/* ── SUB-TAB: OVERVIEW ── */}
          {departmentSubTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Revenue" value={formatCurrency(deptDetail.services.reduce((s, x) => s + x.revenue, 0))} icon={IndianRupee} color="emerald" badgeText="Total" />
                <MetricCard title="Profit" value={formatCurrency(deptDetail.services.reduce((s, x) => s + x.profit, 0))} icon={TrendingUp} color="blue" badgeText="Total" />
                <MetricCard title="Users On Track" value={`${deptDetail.userSummary.onTrack} / ${deptDetail.userSummary.total}`} icon={CheckCircle2} color="teal" badgeText="Team" />
                <MetricCard title="Stalled Reps" value={deptDetail.userSummary.stalled} icon={AlertTriangle} color="rose" badgeText="Needs review" />
              </div>

              {/* Service breakdown */}
              <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-brand-500" />
                  <span>Service Line Margin Breakdown</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-3">
                  Ranked by profit margin, not raw profit
                </p>
                {deptDetail.services.length === 0 ? (
                  <EmptyState icon={Percent} title="No services yet" description="Add a service to this department to see its breakdown." compact />
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-left text-xs min-w-[600px]">
                      <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                        <tr>
                          <th className="px-3 py-2.5">Service</th>
                          <th className="px-3 py-2.5 text-right">Renewals</th>
                          <th className="px-3 py-2.5 text-right">Revenue</th>
                          <th className="px-3 py-2.5 text-right">Purchase Cost</th>
                          <th className="px-3 py-2.5 text-right">Profit</th>
                          <th className="px-3 py-2.5 text-right">Margin</th>
                          <th className="px-3 py-2.5 text-right">Conversion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                        {deptDetail.services.map((s) => (
                          <tr key={s.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-950/20 transition-colors">
                            <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                            <td className="px-3 py-3 text-right">{s.renewalCount}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(s.revenue)}</td>
                            <td className="px-3 py-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(s.purchaseCost)}</td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.profit)}</td>
                            <td className={`px-3 py-3 text-right font-black ${s.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : s.marginPct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{s.marginPct}%</td>
                            <td className="px-3 py-3 text-right">{s.conversionRatePct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Profit trend */}
              {deptDetail.monthlyTrend.length > 0 && (
                <AreaGraphVisualizer
                  title="Department Profit Trend"
                  type="profit"
                  totalValue={deptDetail.services.reduce((s, x) => s + x.profit, 0)}
                  monthlyData={deptDetail.monthlyTrend}
                  height="h-[280px]"
                />
              )}
            </div>
          )}

          {/* ── SUB-TAB: REVENUE AT RISK (EXPIRY CLIFF) ── */}
          {departmentSubTab === 'risk' && (
            <div className="glass p-6 rounded-2xl shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500" />
                    <span>Revenue at Risk Horizon</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Expiring renewals with no logged specialist action yet
                  </p>
                </div>
              </div>

              {loadingCliff || !expiryCliff ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'within30', label: 'Next 30 days', accent: 'text-rose-600 dark:text-rose-400' },
                      { key: 'within60', label: '31–60 days', accent: 'text-amber-600 dark:text-amber-400' },
                      { key: 'within90', label: '61–90 days', accent: 'text-slate-700 dark:text-slate-300' },
                    ].map((b) => (
                      <div key={b.key} className="glass-card rounded-xl p-4 border border-surface-200/80 dark:border-surface-700/80">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{b.label}</p>
                        <p className={`text-xl font-black mt-1 ${b.accent}`}>{expiryCliff.summary[b.key].count}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatCurrency(expiryCliff.summary[b.key].value)}</p>
                      </div>
                    ))}
                  </div>

                  {expiryCliff.buckets.within30.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="Nothing at risk in the next 30 days" description="Every renewal due soon already has a logged action." compact />
                  ) : (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Urgent Outreach List ({expiryCliff.buckets.within30.length})
                      </span>
                      {expiryCliff.buckets.within30.map((r) => (
                        <div
                          key={r.id}
                          onClick={() => navigate(`/renewals?search=${encodeURIComponent(r.clientName)}`)}
                          className="flex items-center justify-between gap-3 text-xs p-3 rounded-xl glass-card hover:border-rose-400 transition-all cursor-pointer group"
                        >
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400">{r.clientName}</span>
                            <span className="text-slate-500 dark:text-slate-400"> · {r.service} · {r.uniqueId} · {r.owner || 'Unassigned'}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-rose-600 dark:text-rose-400 font-bold whitespace-nowrap">{r.daysOut}d left</span>
                            <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(r.value)}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SUB-TAB: REP ACTIVITY ── */}
          {departmentSubTab === 'team' && (
            <div className="glass p-6 rounded-2xl shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-500" />
                    <span>Specialist Operational Activity</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Click any specialist to inspect recent client actions and assigned accounts
                  </p>
                </div>
              </div>

              {deptDetail.users.length === 0 ? (
                <EmptyState icon={UsersIcon} title="No reps assigned" description="No 'user' role accounts are assigned to this department yet." compact />
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                      <tr>
                        <th className="px-3 py-2.5">Rep</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-3 py-2.5 text-right">Owned</th>
                        <th className="px-3 py-2.5 text-right">Renewed</th>
                        <th className="px-3 py-2.5 text-right">Overdue</th>
                        <th className="px-3 py-2.5 text-right">Untouched</th>
                        <th className="px-3 py-2.5 text-right">Follow-ups</th>
                        <th className="px-3 py-2.5">Last Activity</th>
                        <th className="px-3 py-2.5 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                      {[...deptDetail.users].sort((a, b) => ({ stalled: 0, needs_attention: 1, on_track: 2 }[a.trafficLight] - { stalled: 0, needs_attention: 1, on_track: 2 }[b.trafficLight])).map((u) => (
                        <tr
                          key={u.id}
                          onClick={() => openUserActivity(u)}
                          className="cursor-pointer hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-colors group"
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: u.avatarColor || '#a559a5' }}>
                                {getInitials(u.fullName)}
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                {u.fullName}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center"><TrafficLightBadge status={u.trafficLight} /></td>
                          <td className="px-3 py-3 text-right font-semibold">{u.ownedCount}</td>
                          <td className="px-3 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{u.renewedCount}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${u.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{u.overdueCount}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${u.untouchedOverdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{u.untouchedOverdueCount}</td>
                          <td className="px-3 py-3 text-right font-semibold">{u.followupsDue}</td>
                          <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {u.lastActivity ? formatDateTime(u.lastActivity) : 'Never'}
                          </td>
                          <td className="px-3 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(u.totalProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── SUB-TAB: SERVICE MIX & RESPONSE TIME ── */}
          {departmentSubTab === 'services' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Response-time distribution */}
                <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-brand-500" />
                    <span>Response Time Distribution</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">Time to first logged action, all renewals</p>
                  {deptDetail.responseTimeDistribution.every((b) => b.count === 0) ? (
                    <EmptyState icon={BarChart3} title="No history yet" description="No renewal_history entries recorded for this department yet." compact />
                  ) : (
                    (() => {
                      const max = Math.max(...deptDetail.responseTimeDistribution.map((b) => b.count), 1);
                      return (
                        <div className="space-y-2">
                          {deptDetail.responseTimeDistribution.map((b) => (
                            <div key={b.label} className="flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 w-24 flex-shrink-0">{b.label}</span>
                              <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${b.label === 'Never touched' ? 'bg-rose-500' : 'bg-brand-500'}`}
                                  style={{ width: `${(b.count / max) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-900 dark:text-white w-8 text-right flex-shrink-0">{b.count}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Weekly activity trend */}
                <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                  <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-500" />
                    <span>Weekly Activity Trend</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">Logged actions per week, last 8 weeks</p>
                  {deptDetail.activityTrend.length === 0 ? (
                    <EmptyState icon={Activity} title="No activity yet" description="No renewal_history entries in the last 8 weeks." compact />
                  ) : (
                    (() => {
                      const max = Math.max(...deptDetail.activityTrend.map((w) => w.action_count), 1);
                      return (
                        <div className="flex items-end gap-2 h-32 pt-2">
                          {deptDetail.activityTrend.map((w) => (
                            <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{w.action_count}</span>
                              <div
                                className="w-full bg-brand-500 rounded-t-md min-h-[4px]"
                                style={{ height: `${(w.action_count / max) * 100}%` }}
                              />
                              <span className="text-[9px] text-slate-400 whitespace-nowrap">{new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Service mix per rep */}
              <div className="glass p-6 rounded-2xl shadow-xs space-y-4">
                <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-brand-500" />
                  <span>Service Mix Per Specialist</span>
                </h2>
                {deptDetail.serviceMix.length === 0 ? (
                  <EmptyState icon={Grid3x3} title="No mix data" description="No reps own renewals in this department yet." compact />
                ) : (
                  <div className="space-y-3">
                    {deptDetail.serviceMix.map((rep) => (
                      <div key={rep.userId} className="flex items-start gap-3 p-3 rounded-xl glass-card">
                        <span className="text-xs font-bold text-slate-900 dark:text-white w-32 flex-shrink-0 pt-0.5 truncate">{rep.fullName}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {rep.services.length === 0 ? (
                            <span className="text-[11px] text-slate-400">No renewals owned</span>
                          ) : rep.services.map((s) => (
                            <span key={s.name} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                              {s.name} · {s.count} accounts
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Per-user activity modal */}
      {activeUser && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setActiveUser(null)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-surface-200/80 dark:border-white/15">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/60 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-surface-900/95 backdrop-blur-2xl z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-xs"
                  style={{ background: activeUser.avatarColor || '#a559a5' }}
                >
                  {getInitials(activeUser.fullName)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{activeUser.fullName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Specialist Operations Ledger</p>
                </div>
              </div>
              <button onClick={() => setActiveUser(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingActivity || !activity ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {activity.performance && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-card rounded-xl p-3 border border-surface-200/60 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Owned</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white">{activity.performance.ownedCount}</p>
                    </div>
                    <div className="glass-card rounded-xl p-3 border border-surface-200/60 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Renewed</p>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{activity.performance.renewedCount}</p>
                    </div>
                    <div className="glass-card rounded-xl p-3 border border-surface-200/60 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overdue</p>
                      <p className="text-lg font-black text-rose-600 dark:text-rose-400">{activity.performance.overdueCount}</p>
                    </div>
                    <div className="glass-card rounded-xl p-3 border border-surface-200/60 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
                      <div className="mt-1"><TrafficLightBadge status={activity.performance.trafficLight} /></div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Recent activity</h4>
                  {activity.timeline.length === 0 ? (
                    <EmptyState icon={Clock} title="No logged actions" description="This user has no recorded renewal_history entries yet." compact />
                  ) : (
                    <div className="space-y-1.5">
                      {activity.timeline.slice(0, 15).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-3 text-xs p-3 rounded-xl glass-card">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white capitalize">{t.action.replace(/_/g, ' ')}</span>
                            <span className="text-slate-500 dark:text-slate-400"> — {t.client_name} ({t.unique_id})</span>
                          </div>
                          <span className="text-slate-400 whitespace-nowrap flex-shrink-0">{formatDateTime(t.performed_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Renewals on their desk ({activity.ownedRenewals.length})</h4>
                  {activity.ownedRenewals.length === 0 ? (
                    <EmptyState icon={UsersIcon} title="Nothing assigned" description="No renewals currently owned by this user." compact />
                  ) : (
                    <div className="space-y-1.5">
                      {activity.ownedRenewals.slice(0, 15).map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 text-xs p-3 rounded-xl glass-card">
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-slate-900 dark:text-white">{r.client_name}</span>
                            <span className="text-slate-500 dark:text-slate-400"> · {r.service} · {r.unique_id}</span>
                          </div>
                          <span className="font-semibold whitespace-nowrap flex-shrink-0">{formatCurrency(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
