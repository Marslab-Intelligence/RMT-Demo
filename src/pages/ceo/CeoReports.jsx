import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Building2,
  Package,
  Store,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CeoReports() {
  const { token } = useAuth();
  const { selectedPeriod } = useCeo();

  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    const periodParam = `?period=${encodeURIComponent(selectedPeriod)}`;

    Promise.all([
      fetch(`/api/ceo/overview${periodParam}`, { headers }),
      fetch(`/api/ceo/departments${periodParam}`, { headers }),
      fetch(`/api/ceo/vendors${periodParam}`, { headers }),
    ])
      .then(async ([ovRes, deptRes, vRes]) => {
        if (ovRes.ok) setOverview(await ovRes.json());
        if (deptRes.ok) {
          const d = await deptRes.json();
          setDepartments(Array.isArray(d) ? d : (d.departments || []));
        }
        if (vRes.ok) {
          const vData = await vRes.json();
          setVendors(vData.vendors || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  const handleExportExecutiveSummary = () => {
    const lines = [
      `MARSLAB ENTERPRISE LEADERSHIP SUMMARY - ${selectedPeriod}`,
      `Generated At: ${new Date().toLocaleString()}`,
      '',
      'KEY PORTFOLIO METRICS',
      `Total Portfolio Revenue: ${overview?.kpis?.revenue?.value || 0}`,
      `Gross Operating Profit: ${overview?.kpis?.profit?.value || 0}`,
      `Active Products: ${overview?.kpis?.activeProducts?.value || 0}`,
      `Active Services: ${overview?.kpis?.activeServices?.value || 0}`,
      `Active Suppliers: ${overview?.kpis?.activeVendors?.value || 0}`,
      '',
      'DEPARTMENTAL PERFORMANCE SCORECARD',
      'Department,Active Contracts,Revenue,Gross Profit,Margin %,Health Score,Risk Level',
      ...departments.map(
        (d) =>
          `"${d.name}",${d.activeCount},${d.revenue},${d.profit},${d.marginPct}%,${d.healthScore}/100,${d.riskLevel}`
      ),
      '',
      'SUPPLIER DEPENDENCY MATRIX',
      'Supplier Partner,Contracts Supported,Dependency Tier,Risk Posture',
      ...vendors.map(
        (v) =>
          `"${v.name}",${v.contractCount},${v.isHighDep ? 'High Dependency' : 'Standard'},${v.isHighRisk ? 'Critical Expiry' : 'Stable'}`
      ),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `executive-summary-${selectedPeriod.replace(/\s+/g, '-').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Executive briefing report downloaded');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation, Breadcrumbs & Report Actions */}
      <ExecutivePageHeader
        title="Executive Reports & Audit Statements"
        subtitle="Formal leadership briefings, cross-department comparative scorecards, and audit-ready governance statements"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Reports']}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs font-bold text-surface-700 dark:text-surface-200 hover:bg-surface-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print View</span>
            </button>
            <button
              onClick={handleExportExecutiveSummary}
              className="px-4 py-1.5 rounded-xl bg-surface-900 dark:bg-white text-white dark:text-surface-900 text-xs font-bold hover:bg-surface-800 dark:hover:bg-surface-100 transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Download Summary Report</span>
            </button>
          </div>
        }
      />

      {/* Report 1: Departmental Comparative Scorecard */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-bold text-surface-950 dark:text-white">
            Departmental Comparative Scorecard
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Department</th>
                <th className="pb-3 text-right">Active Contracts</th>
                <th className="pb-3 text-right">Revenue Run-Rate</th>
                <th className="pb-3 text-right">Gross Profit</th>
                <th className="pb-3 text-right">Margin %</th>
                <th className="pb-3 text-right">Health Score</th>
                <th className="pb-3 text-right pr-2">Governance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {departments.map((d) => (
                <tr key={d.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 pl-2 font-bold text-surface-900 dark:text-white">{d.name}</td>
                  <td className="py-3 text-right font-mono text-surface-600 dark:text-surface-300">{d.activeCount}</td>
                  <td className="py-3 text-right font-mono font-bold text-surface-900 dark:text-white">
                    {formatCurrency(d.revenue)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(d.profit)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {d.marginPct}%
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {d.healthScore} / 100
                  </td>
                  <td className="py-3 text-right pr-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        d.riskLevel === 'Low'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400'
                      }`}
                    >
                      {d.riskLevel === 'Low' ? 'Compliant' : 'Review Required'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report 2: Strategic Supplier Reliance Ledger */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Store className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-bold text-surface-950 dark:text-white">
            Strategic Supplier Reliance & Continuity Ledger
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">Supplier Partner</th>
                <th className="pb-3 text-right">Supported Client Deployments</th>
                <th className="pb-3 text-right">Dependency Tier</th>
                <th className="pb-3 text-right pr-2">Continuity Posture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-medium">
              {vendors.map((v) => (
                <tr key={v.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                  <td className="py-3 pl-2 font-bold text-surface-900 dark:text-white">{v.name}</td>
                  <td className="py-3 text-right font-mono font-bold text-surface-800 dark:text-surface-200">
                    {v.contractCount}
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
                      {v.isHighDep ? 'Tier 1 Critical Supplier' : 'Tier 2 Secondary'}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        v.isHighRisk
                          ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }`}
                    >
                      {v.isHighRisk ? 'Near-Term Expiry Exposure' : 'Normal Runway'}
                    </span>
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
