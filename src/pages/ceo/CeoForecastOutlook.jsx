import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { formatCurrency } from '../../utils/formatters';
import CompanyOutlookSection from '../../components/ceo/CompanyOutlookSection';
import DepartmentForecastMatrix from '../../components/ceo/DepartmentForecastMatrix';
import ForecastModelRegistryModal from '../../components/ceo/ForecastModelRegistryModal';
import ExecutivePageHeader from '../../components/ceo/ExecutivePageHeader';
import {
  TrendingUp,
  Cpu,
  Database,
  BarChart3,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function CeoForecastOutlook() {
  const { token, getValidToken } = useAuth();
  const { selectedPeriod } = useCeo();

  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRegistryOpen, setIsRegistryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadForecast = async () => {
      setLoading(true);
      try {
        const authToken = token || (getValidToken ? await getValidToken() : null);
        if (!authToken) return;
        const res = await fetch('/api/ceo/intelligence/forecast', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok && active) {
          const data = await res.json();
          setForecast(data);
        }
      } catch (err) {
        if (active) console.error('Failed to load forecast:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadForecast();
    return () => { active = false; };
  }, [token, selectedPeriod, getValidToken]);

  const history = forecast?.historicalBaseline || [];
  const baseForecast = forecast?.scenarios?.baseCase;
  const optForecast = forecast?.scenarios?.optimisticCase;
  const consForecast = forecast?.scenarios?.conservativeCase;

  // Build combined chart series: Historical Quarters + Projected Quarters
  const chartData = [
    ...history.map((h) => ({
      quarter: h.quarter,
      actualRevenue: h.revenue,
      actualProfit: h.profit,
      forecastBase: null,
      forecastOptimistic: null,
      forecastConservative: null,
    })),
  ];

  if (history.length > 0 && baseForecast) {
    const lastHist = history[history.length - 1];
    // Connect anchor
    chartData[chartData.length - 1].forecastBase = lastHist.revenue;
    chartData[chartData.length - 1].forecastOptimistic = lastHist.revenue;
    chartData[chartData.length - 1].forecastConservative = lastHist.revenue;

    // Add forecast point
    chartData.push({
      quarter: forecast?.horizonSummary?.targetQuarter || '2026-Q4 (F)',
      actualRevenue: null,
      actualProfit: null,
      forecastBase: baseForecast.revenue,
      forecastOptimistic: optForecast?.revenue || baseForecast.revenue,
      forecastConservative: consForecast?.revenue || baseForecast.revenue,
    });
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Executive Page Header with Explicit Back Navigation & Breadcrumbs */}
      <ExecutivePageHeader
        title="Forecast & Corporate Outlook Command"
        subtitle="Statistical projection models, multi-scenario planning, and department trajectory matrices"
        backTo="/ceo/dashboard"
        backLabel="Back to Executive Overview"
        breadcrumbs={['Executive Overview', 'Forecast & Outlook']}
        actions={
          <button
            onClick={() => setIsRegistryOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-100 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Cpu className="w-3.5 h-3.5 text-brand-500" />
            <span>Model Registry & Backtesting</span>
          </button>
        }
      />

      {/* Main Outlook Component */}
      <CompanyOutlookSection forecast={forecast} loading={loading} />

      {/* Statistical Projection Curve (Historical Actuals + Forecast Cone) */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#131b2b]/80 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-surface-950 dark:text-white">
              Revenue Evolution & Forecast Cone
            </h3>
            <p className="text-[11.5px] text-surface-400 mt-0.5">
              Historical performance transitioning into statistical scenario boundaries
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <span className="text-surface-600 dark:text-surface-300">Historical Actuals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
              <span className="text-surface-600 dark:text-surface-300">Base Forecast</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-surface-600 dark:text-surface-300">Optimistic</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a559a5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a559a5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastOptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastBaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
              <XAxis dataKey="quarter" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
              />
              <Tooltip
                formatter={(val) => (val ? formatCurrency(val) : 'N/A')}
                contentStyle={{
                  backgroundColor: '#18132b',
                  borderColor: '#2e2550',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Area type="monotone" dataKey="actualRevenue" stroke="#a559a5" strokeWidth={2.5} fill="url(#histGrad)" name="Actual Revenue" />
              <Area type="monotone" dataKey="forecastOptimistic" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" fill="url(#forecastOptGrad)" name="Optimistic Scenario" />
              <Area type="monotone" dataKey="forecastBase" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" fill="url(#forecastBaseGrad)" name="Base Forecast" />
              <Area type="monotone" dataKey="forecastConservative" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" fill="none" name="Conservative Floor" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Forecast Matrix */}
      <DepartmentForecastMatrix
        departmentForecasts={forecast?.departmentForecasts}
        loading={loading}
      />

      {/* Model Transparency Modal */}
      {isRegistryOpen && (
        <ForecastModelRegistryModal
          isOpen={isRegistryOpen}
          onClose={() => setIsRegistryOpen(false)}
          registry={forecast?.modelRegistry}
          dataQuality={forecast?.dataQuality}
        />
      )}
    </div>
  );
}
