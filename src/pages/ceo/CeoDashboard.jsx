import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import CompanyHealthGauge from '../../components/ceo/CompanyHealthGauge';
import VendorRiskMatrix from '../../components/ceo/VendorRiskMatrix';
import RenewalTimelineBar from '../../components/ceo/RenewalTimelineBar';
import ExecutiveBriefCard from '../../components/ceo/ExecutiveBriefCard';
import ExecutiveQueryBar from '../../components/ceo/ExecutiveQueryBar';
import CompanyOutlookSection from '../../components/ceo/CompanyOutlookSection';
import DepartmentForecastMatrix from '../../components/ceo/DepartmentForecastMatrix';
import { useNavigate } from 'react-router-dom';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveHealthDriversSection from '../../components/ceo/ExecutiveHealthDriversSection';
import {
  TrendingUp,
  Building2,
  Package,
  Server,
  Store,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  DollarSign,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

export default function CeoDashboard() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [vendorData, setVendorData] = useState(null);
  const [renewalPipeline, setRenewalPipeline] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [insights, setInsights] = useState(null);
  const [intelBrief, setIntelBrief] = useState(null);
  const [intelForecast, setIntelForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const periodParam = `?period=${encodeURIComponent(selectedPeriod)}`;

      const [
        overviewRes,
        healthRes,
        deptRes,
        vendorRes,
        renewalsRes,
        trendsRes,
        insightsRes,
        briefRes,
        forecastRes,
      ] = await Promise.all([
        fetch(`/api/ceo/overview${periodParam}`, { headers }),
        fetch(`/api/ceo/health-score${periodParam}`, { headers }),
        fetch(`/api/ceo/departments${periodParam}`, { headers }),
        fetch(`/api/ceo/vendors${periodParam}`, { headers }),
        fetch(`/api/ceo/renewals-command${periodParam}`, { headers }),
        fetch(`/api/ceo/trends`, { headers }),
        fetch(`/api/ceo/insights${periodParam}`, { headers }),
        fetch(`/api/ceo/intelligence/brief`, { headers }),
        fetch(`/api/ceo/intelligence/forecast`, { headers }),
      ]);

      if (overviewRes.ok) setOverview(await overviewRes.json());
      if (healthRes.ok) setHealthData(await healthRes.json());
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(Array.isArray(d) ? d : (d.departments || []));
      }
      if (vendorRes.ok) setVendorData(await vendorRes.json());
      if (renewalsRes.ok) setRenewalPipeline(await renewalsRes.json());
      if (trendsRes.ok) {
        const t = await trendsRes.json();
        setTrendData(t.quarters || t.trends || []);
      }
      if (insightsRes.ok) setInsights(await insightsRes.json());
      if (briefRes.ok) setIntelBrief(await briefRes.json());
      if (forecastRes.ok) setIntelForecast(await forecastRes.json());
    } catch (err) {
      console.error('Failed to fetch CEO dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedPeriod]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const kpis = overview?.kpis || {};
  const goingWell = intelBrief?.whatsGoingWell || insights?.positiveMilestones || insights?.goingWell || [];
  const attentionRequired = intelBrief?.leadershipAttention || insights?.leadershipAttention || insights?.attentionRequired || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── EXECUTIVE PAGE HEADER (With period context) ── */}
      <ExecutivePageHeader
        title="Executive Command Center"
        subtitle="Real-time operational health, multi-scenario predictive forecasts, and strategic dependency intelligence"
        backTo={null}
        comparisonText="vs Prior Quarter"
      />

      {/* ── SECTION 1: EXECUTIVE BRIEFING CARD ("What should I know today?") ── */}
      <ExecutiveBriefCard
        briefItems={intelBrief?.executiveBrief}
        attribution={intelBrief?.attribution}
        loading={loading}
      />

      {/* ── SECTION 2: GROUNDED NATURAL-LANGUAGE EXECUTIVE QUERY BAR ── */}
      <ExecutiveQueryBar />

      {/* ── SECTION 3: PRIMARY EXECUTIVE KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ExecutiveKpiCard
          title="Company Health Score"
          value={healthData?.overallScore || kpis.companyHealth?.value || 0}
          isScore
          scoreMax={100}
          change={kpis.companyHealth?.deltaPct}
          changeType={kpis.companyHealth?.deltaPct >= 0 ? 'positive' : 'negative'}
          changePeriod="vs prior period"
          contextNote={healthData?.status || 'Stable'}
          icon={Activity}
          badge={healthData?.status || 'Active'}
          badgeColor="emerald"
          loading={loading}
          onClick={() => navigate('/ceo/health')}
        />

        <ExecutiveKpiCard
          title="Products & Services"
          value={(kpis.activeProducts?.value || 0) + (kpis.activeServices?.value || 0)}
          subtitle={`${kpis.activeProducts?.value || 0} products · ${kpis.activeServices?.value || 0} services`}
          change={kpis.activeProducts?.deltaPct}
          changeType={kpis.activeProducts?.deltaPct >= 0 ? 'positive' : 'negative'}
          changePeriod="growth QoQ"
          icon={Package}
          loading={loading}
          onClick={() => navigate('/ceo/services')}
        />

        <ExecutiveKpiCard
          title="At-Risk Contracts"
          value={kpis.atRiskItems?.value || 0}
          subtitle="urgent retention"
          changeType={kpis.atRiskItems?.value > 0 ? 'negative' : 'positive'}
          contextNote={kpis.atRiskItems?.value > 0 ? 'Action required' : 'All clear'}
          icon={AlertOctagon}
          badge={kpis.atRiskItems?.value > 0 ? 'Attention' : 'Healthy'}
          badgeColor={kpis.atRiskItems?.value > 0 ? 'rose' : 'emerald'}
          loading={loading}
        />
      </div>

      {/* ── SECTION 4: COMPANY OUTLOOK & SCENARIO PROJECTIONS (Base, Optimistic, Conservative) ── */}
      <CompanyOutlookSection forecast={intelForecast} loading={loading} />

      {/* ── SECTION 5: COMPANY HEALTH GAUGE + MULTI-QUARTER TREND ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Company Health Score Breakdown (5 cols) */}
        <div className="lg:col-span-5">
          <CompanyHealthGauge healthData={healthData} loading={loading} />
        </div>

        {/* Quarterly Business Performance Trend (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                  Quarterly Business Trajectory
                </h3>
              </div>
              <p className="text-[11.5px] text-surface-400 mt-0.5">
                Contract revenue run-rate and gross margin evolution over time
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-mono">
              Q1 → Q4
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a559a5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a559a5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800/60" vertical={false} />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-surface-400 font-medium" />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-surface-400" tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-3 rounded-xl bg-surface-900 dark:bg-surface-950 text-white shadow-xl border border-surface-700 text-xs">
                          <p className="font-bold mb-1.5">{label}</p>
                          <p className="text-indigo-300 font-mono">
                            Revenue: {formatCurrency(payload[0]?.value || 0)}
                          </p>
                          <p className="text-emerald-400 font-mono">
                            Gross Profit: {formatCurrency(payload[1]?.value || 0)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#a559a5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProf)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-800/60 text-xs text-surface-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Revenue
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Gross Profit
              </span>
            </div>
            <span>Quarter-over-Quarter Trend</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: EXECUTIVE HEALTH DRIVERS & DIMENSION BREAKDOWN (Redesigned from vertical progress bars) ── */}
      <ExecutiveHealthDriversSection
        healthData={healthData}
        attribution={intelBrief?.attribution}
        loading={loading}
        showDeepDiveLink={true}
      />

      {/* ── SECTION 7: DEPARTMENT FORECAST MATRIX & PERFORMANCE ── */}
      <DepartmentForecastMatrix
        departmentForecasts={intelForecast?.departmentForecasts || []}
        loading={loading}
      />

      {/* ── SECTION 7: VENDOR RISK MATRIX + RENEWAL COMMAND CENTER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6">
          <VendorRiskMatrix
            vendors={vendorData?.vendors || []}
            matrix={vendorData?.matrix || null}
            loading={loading}
          />
        </div>
        <div className="lg:col-span-6">
          <RenewalTimelineBar
            pipeline={renewalPipeline?.timeline || renewalPipeline?.horizons || {}}
            atRiskRenewals={renewalPipeline?.atRiskRenewals || []}
            loading={loading}
          />
        </div>
      </div>

      {/* ── SECTION 8: EXECUTIVE INSIGHTS — WHAT'S GOING WELL VS LEADERSHIP ATTENTION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* What's Going Well (6 cols) */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                What's Going Well?
              </h3>
            </div>
            <p className="text-[11.5px] text-surface-400 mb-4">
              Verified operational strengths, top performing departments, and healthy vendor relationships
            </p>

            <div className="space-y-3">
              {goingWell.length > 0 ? (
                goingWell.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-surface-900 dark:text-white">
                            {item.title}
                          </h5>
                          {item.metric && (
                            <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {item.metric}
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-surface-600 dark:text-surface-300 mt-0.5 leading-relaxed">
                          {item.impact || item.message || item.description}
                        </p>
                      </div>
                    </div>

                    {item.evidence && (
                      <div className="pl-4 pt-1.5 border-t border-emerald-200/40 dark:border-emerald-800/30 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300/80 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Evidence: {item.evidence}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-surface-400 py-4 text-center italic">
                  Compiling performance strengths...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leadership Attention Required (6 cols) */}
        <div className="lg:col-span-6 p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                Leadership Attention Required
              </h3>
            </div>
            <p className="text-[11.5px] text-surface-400 mb-4">
              Prioritized by severity — imminent contract expirations, vendor concentration, or margin declines
            </p>

            <div className="space-y-3">
              {attentionRequired.length > 0 ? (
                attentionRequired.map((item, idx) => {
                  const sev = (item.severity || 'Medium').toLowerCase();
                  const isCritical = sev === 'critical';
                  const isHigh = sev === 'high';
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                        isCritical
                          ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50'
                          : isHigh
                          ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-800/50'
                          : 'bg-surface-50 dark:bg-surface-800/40 border-surface-200 dark:border-surface-700/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            isCritical
                              ? 'bg-rose-500 animate-ping'
                              : isHigh
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                                  isCritical
                                    ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/50 dark:text-rose-300'
                                    : isHigh
                                    ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300'
                                    : 'bg-surface-200 text-surface-700 border-surface-300'
                                }`}
                              >
                                {item.severity}
                              </span>
                              <h5 className="text-xs font-bold text-surface-900 dark:text-white truncate">
                                {item.title}
                              </h5>
                            </div>
                            {item.metric && (
                              <span className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                {item.metric}
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-surface-600 dark:text-surface-300 mt-1 leading-relaxed">
                            {item.impact || item.message || item.description}
                          </p>
                          {item.recommendation && (
                            <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-1 italic">
                              Rec: {item.recommendation}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.evidence && (
                        <div className="pl-4 pt-1.5 border-t border-surface-200/60 dark:border-surface-700/50 flex items-center gap-1.5 text-[11px] text-surface-500 dark:text-surface-400 font-mono">
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          <span>Evidence: {item.evidence}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-surface-400 py-4 text-center italic">
                  No critical anomalies requiring immediate leadership action.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
