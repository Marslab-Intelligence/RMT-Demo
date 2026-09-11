import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import RenewalTimelineBar from '../../components/ceo/RenewalTimelineBar';
import {
  Calendar,
  AlertTriangle,
  Clock,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  AlertOctagon,
  Package,
} from 'lucide-react';

import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';

export default function CeoRenewals() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/ceo/renewals-command?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => setPipeline(resData))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const horizons = pipeline?.horizons || pipeline?.timeline || {};
  const atRisk = pipeline?.atRiskRenewals || pipeline?.atRisk || [];
  const highValue = pipeline?.highValueRenewals || pipeline?.highValue || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Renewal Command Center & Expiration Runway"
        subtitle="Horizon-based renewal runway, portfolio retention risk, and high-value contract exposure"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Renewals']}
      />

      {/* Top Renewal KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ExecutiveKpiCard
          title="Near-Term Expirations (90d)"
          value={(horizons.d90?.count || 0) + (horizons.expired?.count || 0)}
          subtitle="contracts"
          changeType={horizons.d90?.count > 5 ? 'negative' : 'neutral'}
          contextNote="Retention focus window"
          icon={Calendar}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Revenue at 90d Horizon"
          value={formatCurrency((horizons.d90?.value || 0) + (horizons.expired?.value || 0))}
          subtitle="portfolio exposure"
          icon={DollarSign}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Immediate Overdue / Expired"
          value={horizons.expired?.count || 0}
          subtitle="unresolved accounts"
          changeType={horizons.expired?.count > 0 ? 'negative' : 'positive'}
          badge={horizons.expired?.count > 0 ? 'Urgent Action' : 'Clean'}
          badgeColor={horizons.expired?.count > 0 ? 'rose' : 'emerald'}
          icon={AlertOctagon}
          loading={loading}
        />
      </div>

      {/* Timeline Command Center Component */}
      <RenewalTimelineBar pipeline={horizons} loading={loading} />

      {/* High Value Renewals vs At-Risk Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* High Value Renewals */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                Top Value Contract Deployments
              </h3>
            </div>
            <p className="text-[11.5px] text-surface-400 mb-4">
              Largest client accounts representing high revenue concentration
            </p>

            <div className="space-y-2">
              {highValue.map((ren) => (
                <div
                  key={ren.id}
                  onClick={() => openDrawer('renewal', ren.id, `${ren.client_name} - ${ren.product_name}`)}
                  className="p-3 rounded-xl border border-surface-200/80 dark:border-surface-800/80 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer flex items-center justify-between group transition-colors"
                >
                  <div>
                    <h5 className="text-xs font-bold text-surface-900 dark:text-white group-hover:text-brand-500">
                      {ren.client_name}
                    </h5>
                    <span className="text-[11px] text-surface-400">
                      {ren.product_name} • Expiry: {ren.expiry_date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-surface-900 dark:text-white">
                      {formatCurrency(ren.renewal_cost)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-surface-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* At-Risk Queue */}
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                At-Risk Contracts Requiring Intervention
              </h3>
            </div>
            <p className="text-[11.5px] text-surface-400 mb-4">
              Expired or overdue renewals with zero logged extension justification
            </p>

            <div className="space-y-2">
              {atRisk.length > 0 ? (
                atRisk.map((ren) => (
                  <div
                    key={ren.id}
                    onClick={() => openDrawer('renewal', ren.id, `${ren.client_name} - ${ren.product_name}`)}
                    className="p-3 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60 cursor-pointer flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-rose-900 dark:text-rose-200 group-hover:text-rose-600">
                        {ren.client_name}
                      </h5>
                      <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                        {ren.product_name} • Overdue: {ren.expiry_date}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                        {formatCurrency(ren.renewal_cost)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-rose-400" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-surface-400 py-6 text-center italic">
                  All near-term renewals are on track.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
