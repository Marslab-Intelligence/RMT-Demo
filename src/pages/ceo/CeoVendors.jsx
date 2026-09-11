import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import VendorRiskMatrix from '../../components/ceo/VendorRiskMatrix';
import {
  Store,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  PieChart,
  Activity,
} from 'lucide-react';

import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';

export default function CeoVendors() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/ceo/vendors?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => setData(resData))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const vendors = data?.vendors || [];
  const matrix = data?.matrix || null;
  const topVendor = vendors[0];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Vendor Ecosystem Intelligence & Concentration"
        subtitle="Strategic supplier reliance, third-party dependency concentration, and renewal risk posture"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Vendors']}
      />

      {/* Top Vendor KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ExecutiveKpiCard
          title="Active Suppliers"
          value={vendors.length}
          subtitle="contract partners"
          icon={Store}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Top Supplier Footprint"
          value={topVendor?.name || 'N/A'}
          subtitle={`${topVendor?.contractCount || 0} contracts supported`}
          icon={PieChart}
          badge="High Dep"
          badgeColor="indigo"
          loading={loading}
          onClick={() => topVendor && openDrawer('vendor', topVendor.name, topVendor.name)}
        />
        <ExecutiveKpiCard
          title="Critical Vendor Exposure"
          value={matrix?.critical?.length || 0}
          subtitle="suppliers in red zone"
          changeType={matrix?.critical?.length > 0 ? 'negative' : 'positive'}
          badge={matrix?.critical?.length > 0 ? 'Review Needed' : 'Safe'}
          badgeColor={matrix?.critical?.length > 0 ? 'rose' : 'emerald'}
          icon={AlertTriangle}
          loading={loading}
        />
      </div>

      {/* 4-Quadrant Vendor Dependency Matrix */}
      <VendorRiskMatrix vendors={vendors} matrix={matrix} loading={loading} />

      {/* Complete Vendor Roster Table */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <h3 className="text-sm font-bold text-surface-950 dark:text-white mb-3">
          Vendor Operational Roster & Deployment Density
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Vendor Partner</th>
                <th className="pb-3 text-right">Contracts Supported</th>
                <th className="pb-3 text-right">Dependency Tier</th>
                <th className="pb-3 text-right">Expiration Exposure</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {vendors.map((v) => (
                <tr key={v.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 pl-2 font-bold text-surface-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-brand-500" />
                      <span>{v.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {v.contractCount}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      v.isHighDep
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'bg-surface-100 text-surface-600 border-surface-200 dark:bg-surface-800 dark:text-surface-400'
                    }`}>
                      {v.isHighDep ? 'High Dependency' : 'Standard'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      v.isHighRisk
                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}>
                      {v.isHighRisk ? 'Expiring Soon' : 'Stable Runway'}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button
                      onClick={() => openDrawer('vendor', v.name, v.name)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700"
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
  );
}
