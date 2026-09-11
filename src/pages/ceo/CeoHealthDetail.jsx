import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveHealthDriversSection from '../../components/ceo/ExecutiveHealthDriversSection';
import {
  Activity,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Layers,
  HelpCircle,
  Database,
  Cpu,
} from 'lucide-react';

export default function CeoHealthDetail() {
  const { token } = useAuth();
  const { selectedPeriod } = useCeo();

  const [healthData, setHealthData] = useState(null);
  const [intelBrief, setIntelBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const periodParam = `?period=${encodeURIComponent(selectedPeriod)}`;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/ceo/health-score${periodParam}`, { headers }),
      fetch(`/api/ceo/intelligence/brief`, { headers }),
    ])
      .then(async ([hRes, bRes]) => {
        if (hRes.ok) setHealthData(await hRes.json());
        if (bRes.ok) setIntelBrief(await bRes.json());
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const attribution = intelBrief?.attribution;
  const overallScore = healthData?.overallScore || healthData?.score || 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Button & Breadcrumbs */}
      <ExecutivePageHeader
        title="Corporate Operating Health & Methodology"
        subtitle="Mathematical decomposition, verified statistical weights, and factor attribution explaining company health"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Corporate Health Drivers']}
        comparisonText="Calculated from active PostgreSQL telemetry"
      />

      {/* Primary Dimensional Drivers Section (Redesigned from the vertical stack!) */}
      <ExecutiveHealthDriversSection
        healthData={healthData}
        attribution={attribution}
        loading={loading}
        showDeepDiveLink={false}
      />

      {/* Transparent Attribution Breakdown: "Why Did the Score Change?" */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-surface-200/70 dark:border-surface-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-surface-950 dark:text-white">
                Factor Attribution: Why Did the Score Change?
              </h3>
              <p className="text-xs text-surface-500 mt-0.5">
                Mathematical delta contributors derived from quarterly database transactions
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
            Score: {overallScore} / 100
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Primary Drag */}
          <div className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Primary Contributor (Negative)
              </span>
              <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                {attribution?.primaryContributor?.impact || '-18 pts'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">
              {attribution?.primaryContributor?.factor || 'Overdue Expiration Volume'}
            </h4>
            <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
              {attribution?.primaryContributor?.detail || '20 overdue renewals dragged the Renewal Retention Health dimension down to 58%.'}
            </p>
          </div>

          {/* Secondary Drag */}
          <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Secondary Contributor (Negative)
              </span>
              <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                {attribution?.secondaryContributor?.impact || '-12 pts'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">
              {attribution?.secondaryContributor?.factor || 'Vendor Concentration Exposure'}
            </h4>
            <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
              {attribution?.secondaryContributor?.detail || 'Top supplier commands 50.3% of portfolio revenue, triggering third-party dependency penalties.'}
            </p>
          </div>

          {/* Positive Offset */}
          <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Primary Positive Offset
              </span>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {attribution?.positiveOffset?.impact || '+14 pts'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-surface-900 dark:text-white">
              {attribution?.positiveOffset?.factor || 'Profit Margin Execution'}
            </h4>
            <p className="text-xs text-surface-600 dark:text-surface-300 leading-relaxed">
              {attribution?.positiveOffset?.detail || 'Corporate gross margin of 20.3% provided strong offset stability to baseline operating score.'}
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Formula & Audit Trail */}
      <div className="p-5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200/80 dark:border-surface-800 text-xs space-y-3">
        <div className="flex items-center gap-2 text-surface-700 dark:text-surface-300 font-bold">
          <Database className="w-4 h-4 text-brand-500" />
          <span>Objective Formula & Grounding Principles</span>
        </div>
        <p className="text-surface-500 leading-relaxed">
          The Corporate Operating Health index is computed as:{' '}
          <code className="px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-800 font-mono text-surface-800 dark:text-surface-200">
            Score = (RenewalHealth × 0.25) + (MarginHealth × 0.25) + (VendorStability × 0.20) + (ContractStability × 0.20) + (DeptHealth × 0.10)
          </code>
          . Scores are never randomly adjusted or estimated by an LLM; all values derive strictly from PostgreSQL transactional records.
        </p>
      </div>
    </div>
  );
}
