import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import {
  Package,
  Server,
  TrendingUp,
  Building2,
  ChevronRight,
  ShieldCheck,
  Award,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  Layers,
  DollarSign,
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

export default function CeoServices() {
  const { token } = useAuth();
  const { selectedPeriod, openDrawer } = useCeo();

  const [serviceData, setServiceData] = useState(null);
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'services', 'products'

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const fetchServices = fetch(`/api/ceo/services?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => (res.ok ? res.json() : null));

    const fetchProducts = fetch(`/api/ceo/products?period=${encodeURIComponent(selectedPeriod)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => (res.ok ? res.json() : null));

    Promise.all([fetchServices, fetchProducts])
      .then(([svcRes, prodRes]) => {
        setServiceData(svcRes);
        setProductData(prodRes);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  // Service data
  const services = serviceData?.services || [];
  const topServices = serviceData?.topServices || [];
  const attentionServices = serviceData?.attentionServices || [];

  // Product data
  const products = (productData?.products || []).map((p, idx) => ({
    id: p.id || `prod-${idx}`,
    name: p.name || p.productName,
    department: p.department || p.departmentName,
    contractCount: p.contractCount || p.renewalsCount || 0,
    revenue: p.revenue || 0,
    profit: p.profit || 0,
    marginPct: p.marginPct || 0,
    vendor: p.vendor || '',
    type: 'product',
  }));
  const topProducts = productData?.topProducts || [];
  const deptDist = productData?.deptDistribution || [];

  // Combined KPIs
  const totalServiceLines = serviceData?.totalServices || 0;
  const totalDistinctProducts = productData?.totalActiveProducts || products.length;
  const totalDeployments = products.reduce((sum, p) => sum + (p.contractCount || 0), 0) +
    services.reduce((sum, s) => sum + (s.renewalCount || s.renewalsCount || 0), 0);
  const totalRevenue = services.reduce((sum, s) => sum + (s.revenue || 0), 0) +
    products.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const totalProfit = services.reduce((sum, s) => sum + (s.profit || 0), 0) +
    products.reduce((sum, p) => sum + (p.profit || 0), 0);
  const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0;

  // Build unified table rows
  const serviceRows = services.map((svc) => ({
    id: svc.id,
    name: svc.name || svc.serviceName,
    department: svc.departmentName,
    deployments: svc.renewalCount || svc.renewalsCount || 0,
    revenue: svc.revenue || 0,
    profit: svc.profit || 0,
    marginPct: svc.marginPct || 0,
    type: 'service',
    drawerType: 'service',
    drawerId: svc.id,
    drawerLabel: svc.name || svc.serviceName,
  }));

  const productRows = products.map((p) => ({
    id: p.id,
    name: p.name,
    department: p.department,
    deployments: p.contractCount,
    revenue: p.revenue,
    profit: p.profit,
    marginPct: p.marginPct,
    type: 'product',
    drawerType: 'product',
    drawerId: p.name,
    drawerLabel: p.name,
  }));

  let allRows = activeTab === 'services'
    ? serviceRows
    : activeTab === 'products'
      ? productRows
      : [...serviceRows, ...productRows];

  // Sort by revenue descending
  allRows.sort((a, b) => b.revenue - a.revenue);

  // Apply search filter
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    allRows = allRows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q)
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header */}
      <ExecutivePageHeader
        title="Products & Services Portfolio"
        subtitle="Unified catalog adoption, service performance, revenue contribution, gross margin rankings, and departmental allocation"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Products & Services']}
      />

      {/* Combined KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExecutiveKpiCard
          title="Service Lines"
          value={totalServiceLines}
          subtitle="active categories"
          icon={Server}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Distinct Products"
          value={totalDistinctProducts}
          subtitle="catalog items"
          icon={Package}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle={`${overallMargin}% gross margin`}
          icon={DollarSign}
          loading={loading}
        />
        <ExecutiveKpiCard
          title="Top Concentration"
          value={topProducts[0]?.productName || topProducts[0]?.name || topServices[0]?.name || 'N/A'}
          subtitle={`${topProducts[0]?.renewalsCount || topServices[0]?.renewalsCount || 0} contracts`}
          icon={Award}
          badge="Market Leader"
          badgeColor="emerald"
          loading={loading}
          onClick={() => {
            if (topProducts[0]) {
              openDrawer('product', topProducts[0].productName, topProducts[0].productName);
            } else if (topServices[0]) {
              openDrawer('service', topServices[0].id, topServices[0].name || topServices[0].serviceName);
            }
          }}
        />
      </div>

      {/* Top & Attention Service Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topServices[0] && (
          <div
            onClick={() => openDrawer('service', topServices[0].id, topServices[0].serviceName || topServices[0].name)}
            className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 shadow-sm cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Top Performing Service Line
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                Margin: {topServices[0].marginPct}%
              </span>
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-emerald-600 transition-colors">
              {topServices[0].serviceName || topServices[0].name}
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">
              Generating {formatCurrency(topServices[0].revenue)} across {topServices[0].renewalsCount || topServices[0].renewalCount || 0} contracts in {topServices[0].departmentName}.
            </p>
          </div>
        )}

        {attentionServices[0] && (
          <div
            onClick={() => openDrawer('service', attentionServices[0].id, attentionServices[0].serviceName || attentionServices[0].name)}
            className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 shadow-sm cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Service Requiring Attention
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                Margin: {attentionServices[0].marginPct}%
              </span>
            </div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white group-hover:text-amber-600 transition-colors">
              {attentionServices[0].serviceName || attentionServices[0].name}
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">
              Currently yielding lower gross margins compared to enterprise baseline.
            </p>
          </div>
        )}
      </div>

      {/* Product Deployment Distribution Chart */}
      {deptDist.length > 0 && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-surface-950 dark:text-white">
                Deployment Distribution by Department
              </h3>
              <p className="text-[11.5px] text-surface-400 mt-0.5">
                Breakdown of total product & service installations across business divisions
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
                            Deployments: {payload[0]?.value || 0}
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
      )}

      {/* Unified Products & Services Table */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        {/* Header with tabs and search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Products & Services Portfolio
            </h3>
            <p className="text-[11.5px] text-surface-400 mt-0.5">
              Complete catalog with revenue, profit margins, and drill-down access
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab filter pills */}
            <div className="flex items-center bg-surface-100 dark:bg-surface-800/60 rounded-lg p-0.5">
              {[
                { key: 'all', label: 'All', icon: Layers },
                { key: 'services', label: 'Services', icon: Server },
                { key: 'products', label: 'Products', icon: Package },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-surface-700 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                  }`}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search toggle */}
            <button
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchTerm(''); }}
              className={`p-1.5 rounded-lg transition-all ${
                showSearch
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600'
                  : 'text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products, services, or departments..."
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Name</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Department</th>
                <th className="pb-3 text-right">Deployments</th>
                <th className="pb-3 text-right">Revenue</th>
                <th className="pb-3 text-right">Gross Profit</th>
                <th className="pb-3 text-right">Margin %</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {allRows.map((row, idx) => (
                <tr key={`${row.type}-${row.id}-${idx}`} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 pl-2 font-bold text-surface-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-surface-400">#{idx + 1}</span>
                      {row.type === 'service' ? (
                        <Server className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      ) : (
                        <Package className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      row.type === 'service'
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3 text-surface-600 dark:text-surface-300">
                    {row.department}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {row.deployments}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-900 dark:text-white">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(row.profit)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {row.marginPct}%
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button
                      onClick={() => openDrawer(row.drawerType, row.drawerId, row.drawerLabel)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700"
                    >
                      <span>Drill down</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {allRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-surface-400 text-xs">
                    {searchTerm ? 'No matching products or services found.' : 'No data available for this period.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
