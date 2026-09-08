import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Building2, ArrowLeft, TrendingUp, IndianRupee, AlertTriangle, CheckCircle2,
  Percent, Users as UsersIcon, X, Loader2, Clock, ChevronRight, Activity, Award, Flame,
  BarChart3, Grid3x3, Download
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

// Exports the currently-viewed department's scoped data — services and rep
// activity — as CSV. Same client-side-CSV pattern already used on the main
// Dashboard's Export button.
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

// Company-wide export for the super_admin overview page — the
// cross-department comparison table.
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

  const [departments, setDepartments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState(isSuperAdmin ? null : user?.departmentId ?? null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeUser, setActiveUser] = useState(null); // { id } or null
  const [activity, setActivity] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Company-wide overview (super_admin, list view only) — cross-department
  // comparison reuses `departments` itself; these two need their own fetch.
  const [vendorConcentration, setVendorConcentration] = useState(null);
  const [companyLeaderboard, setCompanyLeaderboard] = useState(null);

  // Revenue-at-risk / untouched-renewals queue, scoped to whichever
  // department is currently in view (works for both the super_admin detail
  // view and the dept_admin's own department).
  const [expiryCliff, setExpiryCliff] = useState(null);
  const [loadingCliff, setLoadingCliff] = useState(false);

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

  if (loadingList) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ── Department list (super_admin only, no department yet selected) ──
  if (isSuperAdmin && !selectedDeptId) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Team Performance</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Revenue, profit, and rep activity by department. Click a department to drill in.
              </p>
            </div>
          </div>
          {departments.length > 0 && (
            <button onClick={() => exportCrossDeptCsv(departments)} className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          )}
        </div>

        {departments.length === 0 ? (
          <EmptyState icon={Building2} title="No departments yet" description="Create a department first from the Departments screen." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDeptId(d.id)}
                className="group text-left rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">{d.name}</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{d.service_count} service{d.service_count === '1' ? '' : 's'} · {d.user_count} user{d.user_count === '1' ? '' : 's'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform flex-shrink-0 mt-1" />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Revenue</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(d.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Margin</p>
                    <p className={`text-sm font-black mt-0.5 ${d.marginPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{d.marginPct}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overdue</p>
                    <p className={`text-sm font-black mt-0.5 ${d.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{d.overdueCount}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Cross-department comparison — ranked by margin, not raw profit,
            so a small-but-efficient department doesn't get lost under a
            large-but-thin one. */}
        {departments.length > 1 && (
          <div className="card p-6 space-y-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-brand-500" /> Cross-Department Comparison
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">Ranked by profit margin</p>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                  <tr>
                    <th className="px-2 py-2">Department</th>
                    <th className="px-2 py-2 text-right">Revenue</th>
                    <th className="px-2 py-2 text-right">Profit</th>
                    <th className="px-2 py-2 text-right">Margin</th>
                    <th className="px-2 py-2 text-right">Conversion</th>
                    <th className="px-2 py-2 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                  {[...departments].sort((a, b) => b.marginPct - a.marginPct).map((d) => (
                    <tr key={d.id}>
                      <td className="px-2 py-2.5 font-bold text-slate-900 dark:text-white">{d.name}</td>
                      <td className="px-2 py-2.5 text-right">{formatCurrency(d.revenue)}</td>
                      <td className="px-2 py-2.5 text-right font-bold">{formatCurrency(d.profit)}</td>
                      <td className={`px-2 py-2.5 text-right font-black ${d.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : d.marginPct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{d.marginPct}%</td>
                      <td className="px-2 py-2.5 text-right">{d.conversionRatePct}%</td>
                      <td className={`px-2 py-2.5 text-right ${d.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>{d.overdueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vendor concentration — company-wide risk: how much revenue/
              profit rides on a single vendor. */}
          <div className="card p-6 space-y-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" /> Vendor Concentration
            </h2>
            {!vendorConcentration ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : vendorConcentration.vendors.length === 0 ? (
              <EmptyState icon={Flame} title="No vendor data" description="Renewals don't have a vendor set yet." compact />
            ) : (
              <div className="space-y-2">
                {vendorConcentration.vendors.slice(0, 8).map((v) => (
                  <div key={v.vendor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">{v.vendor}</span>
                      <span className="text-slate-500 dark:text-slate-400">{v.revenueSharePct}% of revenue · {formatCurrency(v.profit)} profit</span>
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

          {/* Company-wide leaderboard — recognition/coaching, ranked by
              profit generated. */}
          <div className="card p-6 space-y-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" /> Company Leaderboard
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">Top reps by profit generated</p>
            {!companyLeaderboard ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : companyLeaderboard.byProfit.length === 0 ? (
              <EmptyState icon={Award} title="No reps yet" description="No 'user' role accounts are assigned to any department." compact />
            ) : (
              <div className="space-y-1.5">
                {companyLeaderboard.byProfit.slice(0, 8).map((u, idx) => (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/30">
                    <span className="text-xs font-black text-slate-400 w-4">{idx + 1}</span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: u.avatarColor || '#4f91a8' }}>
                      {getInitials(u.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.fullName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{u.departmentName}</p>
                    </div>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(u.totalProfit)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Department detail ──
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button onClick={() => setSelectedDeptId(null)} className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Departments
            </button>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {deptDetail?.department?.name || 'Team Performance'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Service breakdown, pipeline, and rep activity</p>
          </div>
        </div>
        {deptDetail && (
          <button onClick={() => exportDeptDetailCsv(deptDetail)} className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        )}
      </div>

      {loadingDetail || !deptDetail ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard title="Revenue" value={formatCurrency(deptDetail.services.reduce((s, x) => s + x.revenue, 0))} icon={IndianRupee} color="emerald" badgeText="Total" />
            <MetricCard title="Profit" value={formatCurrency(deptDetail.services.reduce((s, x) => s + x.profit, 0))} icon={TrendingUp} color="blue" badgeText="Total" />
            <MetricCard title="Users On Track" value={`${deptDetail.userSummary.onTrack} / ${deptDetail.userSummary.total}`} icon={CheckCircle2} color="teal" badgeText="Team" />
            <MetricCard title="Stalled Reps" value={deptDetail.userSummary.stalled} icon={AlertTriangle} color="rose" badgeText="Needs review" />
          </div>

          {/* Revenue at risk — expiring soon with zero logged action yet.
              Doubles as the untouched-renewals reassignment queue. */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" /> Revenue at Risk
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Expiring soon, no logged action yet</p>
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
                    <div key={b.key} className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200/60 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{b.label}</p>
                      <p className={`text-lg font-black mt-0.5 ${b.accent}`}>{expiryCliff.summary[b.key].count}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatCurrency(expiryCliff.summary[b.key].value)}</p>
                    </div>
                  ))}
                </div>
                {expiryCliff.buckets.within30.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Nothing at risk in the next 30 days" description="Every renewal due soon already has a logged action." compact />
                ) : (
                  <div className="space-y-1.5">
                    {expiryCliff.buckets.within30.slice(0, 8).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100/60 dark:border-rose-900/30">
                        <div className="min-w-0 truncate">
                          <span className="font-bold text-slate-900 dark:text-white">{r.clientName}</span>
                          <span className="text-slate-500 dark:text-slate-400"> · {r.service} · {r.uniqueId} · {r.owner || 'Unassigned'}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-rose-600 dark:text-rose-400 font-bold whitespace-nowrap">{r.daysOut}d left</span>
                          <span className="font-semibold whitespace-nowrap">{formatCurrency(r.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* User activity — leads the admin view per the traffic-light monitoring ask */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500" /> Rep Activity
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Stalled reps surface first</p>
            </div>
            {deptDetail.users.length === 0 ? (
              <EmptyState icon={UsersIcon} title="No reps assigned" description="No 'user' role accounts are assigned to this department yet." compact />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                    <tr>
                      <th className="px-2 py-2">Rep</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Owned</th>
                      <th className="px-2 py-2 text-right">Renewed</th>
                      <th className="px-2 py-2 text-right">Overdue</th>
                      <th className="px-2 py-2 text-right">Untouched Overdue</th>
                      <th className="px-2 py-2 text-right">Follow-ups Due</th>
                      <th className="px-2 py-2">Last Activity</th>
                      <th className="px-2 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                    {[...deptDetail.users].sort((a, b) => ({ stalled: 0, needs_attention: 1, on_track: 2 }[a.trafficLight] - { stalled: 0, needs_attention: 1, on_track: 2 }[b.trafficLight])).map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => openUserActivity(u)}
                        className="cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: u.avatarColor || '#4f91a8' }}>
                              {getInitials(u.fullName)}
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{u.fullName}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5"><TrafficLightBadge status={u.trafficLight} /></td>
                        <td className="px-2 py-2.5 text-right font-semibold">{u.ownedCount}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{u.renewedCount}</td>
                        <td className={`px-2 py-2.5 text-right font-semibold ${u.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{u.overdueCount}</td>
                        <td className={`px-2 py-2.5 text-right font-semibold ${u.untouchedOverdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{u.untouchedOverdueCount}</td>
                        <td className="px-2 py-2.5 text-right font-semibold">{u.followupsDue}</td>
                        <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {u.lastActivity ? formatDateTime(u.lastActivity) : 'Never'}
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold">{formatCurrency(u.totalProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Service breakdown */}
          <div className="card p-6 space-y-4">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-brand-500" /> Service Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-3">Ranked by profit margin, not raw profit</p>
            {deptDetail.services.length === 0 ? (
              <EmptyState icon={Percent} title="No services yet" description="Add a service to this department to see its breakdown." compact />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200/60 dark:border-white/10">
                    <tr>
                      <th className="px-2 py-2">Service</th>
                      <th className="px-2 py-2 text-right">Renewals</th>
                      <th className="px-2 py-2 text-right">Revenue</th>
                      <th className="px-2 py-2 text-right">Purchase Cost</th>
                      <th className="px-2 py-2 text-right">Profit</th>
                      <th className="px-2 py-2 text-right">Margin</th>
                      <th className="px-2 py-2 text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                    {deptDetail.services.map((s) => (
                      <tr key={s.id}>
                        <td className="px-2 py-2.5 font-bold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="px-2 py-2.5 text-right">{s.renewalCount}</td>
                        <td className="px-2 py-2.5 text-right">{formatCurrency(s.revenue)}</td>
                        <td className="px-2 py-2.5 text-right text-slate-500 dark:text-slate-400">{formatCurrency(s.purchaseCost)}</td>
                        <td className="px-2 py-2.5 text-right font-bold">{formatCurrency(s.profit)}</td>
                        <td className={`px-2 py-2.5 text-right font-black ${s.marginPct >= 20 ? 'text-emerald-600 dark:text-emerald-400' : s.marginPct >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{s.marginPct}%</td>
                        <td className="px-2 py-2.5 text-right">{s.conversionRatePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Response-time distribution — how long after a renewal enters
                the queue does the first logged action happen, as a
                distribution so one outlier doesn't hide inside an average. */}
            <div className="card p-6 space-y-3">
              <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-500" /> Response Time Distribution
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

            {/* Weekly activity trend — team action volume, independent of
                revenue timing (the profit trend chart below covers that). */}
            <div className="card p-6 space-y-3">
              <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500" /> Weekly Activity Trend
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

          {/* Service mix per rep — spots whether a low conversion rate is a
              skill issue or they've been handed the worst-margin service line. */}
          <div className="card p-6 space-y-3">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-brand-500" /> Service Mix Per Rep
            </h2>
            {deptDetail.serviceMix.length === 0 ? (
              <EmptyState icon={Grid3x3} title="No mix data" description="No reps own renewals in this department yet." compact />
            ) : (
              <div className="space-y-3">
                {deptDetail.serviceMix.map((rep) => (
                  <div key={rep.userId} className="flex items-start gap-3">
                    <span className="text-xs font-bold text-slate-900 dark:text-white w-28 flex-shrink-0 pt-1 truncate">{rep.fullName}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {rep.services.length === 0 ? (
                        <span className="text-[11px] text-slate-400">No renewals owned</span>
                      ) : rep.services.map((s) => (
                        <span key={s.name} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20">
                          {s.name} · {s.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
        </>
      )}

      {/* Per-user activity modal */}
      {activeUser && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setActiveUser(null)} />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl z-10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">{activeUser.fullName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Individual activity</p>
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
