import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import {
  Package,
  TrendingUp,
  Building2,
  Store,
  ChevronRight,
  ShieldCheck,
  Award,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function CeoProducts() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/ceo/products?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => setData(resData))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const products = data?.products || [];
  const topProducts = data?.topProducts || [];
  const deptDist = data?.deptDistribution || [];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Product Intelligence & Portfolio Health"
        subtitle="Catalog adoption, client contract distribution, gross margin rankings, and departmental allocation"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Products']}
      />

      {/* Top Product KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ExecutiveKpiCard
          title="Total Distinct Products"
          value={data?.totalProducts || 0}
          subtitle="catalog items"
          icon={Package}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Active Deployments"
          value={data?.activeDeployments || 0}
          subtitle="client licenses"
          icon={TrendingUp}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Top Product Concentration"
          value={topProducts[0]?.name || 'N/A'}
          subtitle={`${topProducts[0]?.contractCount || 0} contracts`}
          icon={Award}
          badge="Market Leader"
          badgeColor="emerald"
          loading={loading}
          onClick={() => topProducts[0] && openDrawer('product', topProducts[0].name, topProducts[0].name)}
        />
      </div>

      {/* Product Distribution Chart */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Product Deployment Distribution by Department
            </h3>
            <p className="text-[11.5px] text-surface-400 mt-0.5">
              Breakdown of total client installations across business divisions
            </p>
          </div>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptDist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-surface-200 dark:text-surface-800/60" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-surface-400 font-medium" />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-surface-400" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 rounded-xl bg-surface-900 dark:bg-surface-950 text-white shadow-xl border border-surface-700 text-xs">
                        <p className="font-bold mb-1">{label}</p>
                        <p className="text-indigo-300 font-mono">
                          Products: {payload[0]?.value || 0} deployments
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="productCount" fill="#a559a5" radius={[4, 4, 0, 0]} name="Deployments" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Ranking List */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <h3 className="text-sm font-bold text-surface-950 dark:text-white mb-3">
          Product Adoption & Revenue Contribution Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Product Name</th>
                <th className="pb-3">Department</th>
                <th className="pb-3 text-right">Deployments</th>
                <th className="pb-3 text-right">Revenue</th>
                <th className="pb-3 text-right">Gross Profit</th>
                <th className="pb-3 text-right">Margin %</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {products.map((p, idx) => (
                <tr key={p.id ? `prod-${p.id}` : `${p.name || 'prod'}-${p.department || ''}-${idx}`} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 pl-2 font-bold text-surface-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-surface-400">#{idx + 1}</span>
                      <Package className="w-4 h-4 text-indigo-500" />
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-surface-600 dark:text-surface-300">
                    {p.department}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {p.contractCount}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-900 dark:text-white">
                    {formatCurrency(p.revenue)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(p.profit)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {p.marginPct}%
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button
                      onClick={() => openDrawer('product', p.name, p.name)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700"
                    >
                      <span>Drill down</span>
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
