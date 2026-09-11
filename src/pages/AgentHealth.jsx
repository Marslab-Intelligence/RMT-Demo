import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';

export default function AgentHealth() {
  const { getValidToken } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      // See AgentDrawer.jsx — the access token lives in AuthContext's React
      // state, never in localStorage, so localStorage.getItem('token') here
      // always returned null and every scan silently 403'd.
      const authToken = await getValidToken();
      const res = await fetch('/api/agent/guardian-health', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      } else {
        // Without this, a 403/500 left healthData null and the UI rendered
        // "All Systems Clean" — a failed scan looked identical to a clean one.
        toast.error('Guardian scan failed — showing no data, not a clean result.');
      }
    } catch (err) {
      toast.error('Failed to perform Guardian integrity scan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6 w-full pb-28">
      <div className="flex items-center justify-between glass-card p-6 rounded-2xl border border-rose-500/20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-rose-500 to-amber-500 rounded-xl text-white shadow-lg shadow-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Guardian Anomaly Watch & Health</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              System data integrity scanner & security anomaly monitoring
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold px-4 py-2 rounded-xl transition-all border border-rose-500/20 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Run Diagnostic Scan
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-rose-500 border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs">Scanning database integrity...</p>
        </div>
      ) : !healthData || healthData.findings.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-lg p-6">
          <EmptyState
            icon={CheckCircle2}
            title="All Systems Clean"
            description="Zero data integrity anomalies or security violations detected."
            actionText="Run Diagnostic Scan"
            onAction={fetchHealth}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {healthData.findings.map((f, idx) => (
            <div key={idx} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-rose-500/20 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${f.severity === 'HIGH' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                    {f.severity} Severity
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    {f.category} — {f.clientName} ({f.uniqueId})
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {f.description}
              </p>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>💡 <strong className="text-slate-700 dark:text-slate-300">Suggested Action:</strong> {f.suggestedFix}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
