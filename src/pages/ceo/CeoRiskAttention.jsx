import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import {
  AlertOctagon,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function CeoRiskAttention() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [insights, setInsights] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const periodParam = `?period=${encodeURIComponent(selectedPeriod)}`;

    Promise.all([
      fetch(`/api/ceo/insights${periodParam}`, { headers }),
      fetch(`/api/ceo/renewals-command${periodParam}`, { headers }),
    ])
      .then(async ([iRes, pRes]) => {
        if (iRes.ok) setInsights(await iRes.json());
        if (pRes.ok) setPipeline(await pRes.json());
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const attentionItems = insights?.attentionRequired || [];
  const atRiskContracts = pipeline?.atRisk || [];
  const expiredContracts = pipeline?.horizons?.expired?.items || [];

  const criticalCount = attentionItems.filter((i) => i.severity === 'Critical').length + expiredContracts.length;
  const highCount = attentionItems.filter((i) => i.severity === 'High').length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Leadership Attention & Risk Register"
        subtitle="Measurable anomalies, expired contracts, high-dependency suppliers, and performance variance requiring executive oversight"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Risk & Attention']}
      />

      {/* Top Risk KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ExecutiveKpiCard
          title="Critical Severity Issues"
          value={criticalCount}
          subtitle="urgent intervention"
          changeType={criticalCount > 0 ? 'negative' : 'positive'}
          badge={criticalCount > 0 ? 'Action Required' : 'Zero Critical'}
          badgeColor={criticalCount > 0 ? 'rose' : 'emerald'}
          icon={AlertOctagon}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="High Concern Indicators"
          value={highCount}
          subtitle="strategic watchlist"
          changeType={highCount > 0 ? 'negative' : 'neutral'}
          badge={highCount > 0 ? 'Review Needed' : 'Normal'}
          badgeColor="amber"
          icon={AlertTriangle}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Unresolved Expired Accounts"
          value={expiredContracts.length}
          subtitle="contracts past due"
          changeType={expiredContracts.length > 0 ? 'negative' : 'positive'}
          badge={expiredContracts.length > 0 ? 'Delinquent' : 'Compliant'}
          badgeColor={expiredContracts.length > 0 ? 'rose' : 'emerald'}
          icon={ShieldAlert}
          loading={loading}
        />
      </div>

      {/* Primary Leadership Attention List */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Identified Operational & Commercial Risks
            </h3>
            <p className="text-[11.5px] text-surface-400 mt-0.5">
              Ranked dynamically by enterprise severity impact
            </p>
          </div>
          <span className="text-xs font-semibold text-surface-400 font-mono">
            {attentionItems.length} Identified Flags
          </span>
        </div>

        <div className="space-y-3">
          {attentionItems.map((item, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border transition-all ${
                item.severity === 'Critical'
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                  : item.severity === 'High'
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                  : 'bg-surface-50 dark:bg-surface-800/40 border-surface-200 dark:border-surface-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                      item.severity === 'Critical'
                        ? 'bg-rose-500 animate-ping'
                        : item.severity === 'High'
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10.5px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                          item.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200'
                            : item.severity === 'High'
                            ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-surface-200 text-surface-700 border-surface-300'
                        }`}
                      >
                        {item.severity} Severity
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-surface-950 dark:text-white">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-surface-600 dark:text-surface-300 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expired Contracts Audit Roster */}
      {expiredContracts.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-rose-200/80 dark:border-rose-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">
                Overdue Contracts Requiring Extension or Closure ({expiredContracts.length})
              </h3>
              <p className="text-[11.5px] text-surface-400 mt-0.5">
                Past expiration date with client services in indeterminate status
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {expiredContracts.map((c) => (
              <div
                key={c.id}
                onClick={() => openDrawer('renewal', c.id, `${c.client_name} - ${c.product_name}`)}
                className="p-3 rounded-xl border border-rose-200/70 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/70 transition-colors flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <h5 className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-rose-600">
                    {c.client_name}
                  </h5>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400">
                    {c.product_name} • Expired on: {c.expiry_date}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                    {formatCurrency(c.renewal_cost)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-rose-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
