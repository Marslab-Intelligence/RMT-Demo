import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import ExecutiveKpiCard from '../../components/ceo/ExecutiveKpiCard';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function CeoTrends() {
  const { token } = useAuth();
  const { selectedPeriod } = useCeo();

  const [trends, setTrends] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/ceo/trends`, { headers }),
      fetch(`/api/ceo/insights?period=${encodeURIComponent(selectedPeriod)}`, { headers }),
    ])
      .then(async ([tRes, iRes]) => {
        if (tRes.ok) {
          const t = await tRes.json();
          setTrends(t.trends || []);
        }
        if (iRes.ok) {
          setInsights(await iRes.json());
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [token, selectedPeriod]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-extrabold text-surface-950 dark:text-white">
            Quarterly Business Trends & Analytical Insights
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
            Multi-Quarter Trajectory
          </span>
        </div>
        <p className="text-xs text-surface-500 mt-1">
          Quarter-over-quarter expansion in portfolio contract value, gross margin retention, and active service lines
        </p>
      </div>

      {/* Primary Multi-Quarter Trajectory Chart */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Revenue Run-Rate & Gross Margin Evolution
            </h3>
            <p className="text-[11.5px] text-surface-400 mt-0.5">
              Historical tracking across verified calendar quarters
            </p>
          </div>
          <span className="text-xs font-semibold text-surface-400 font-mono">
            {trends.length} Recorded Quarters
          </span>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a559a5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a559a5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendProf" x1="0" y1="0" x2="0" y2="1">
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
                        <p className="font-bold mb-1">{label}</p>
                        <p className="text-indigo-300 font-mono">
                          Revenue: {formatCurrency(payload[0]?.value || 0)}
                        </p>
                        <p className="text-emerald-400 font-mono">
                          Profit: {formatCurrency(payload[1]?.value || 0)}
                        </p>
                        <p className="text-slate-300 font-mono">
                          Renewals: {payload[0]?.payload?.renewalCount || 0} contracts
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#a559a5" strokeWidth={2.5} fillOpacity={1} fill="url(#trendRev)" name="Contract Revenue" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#trendProf)" name="Gross Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Contract Volume Trend by Quarter */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm">
        <h3 className="text-sm font-bold text-surface-950 dark:text-white mb-1">
          Quarterly Renewal Volume Distribution
        </h3>
        <p className="text-[11.5px] text-surface-400 mb-4">
          Contract density maturing across consecutive business periods
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {trends.map((t) => (
            <div
              key={t.quarter}
              className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-800"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-surface-400">
                {t.quarter}
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black font-mono text-surface-900 dark:text-white">
                  {t.renewalCount}
                </span>
                <span className="text-[11px] text-surface-400 font-medium">maturing</span>
              </div>
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                {formatCurrency(t.revenue)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
