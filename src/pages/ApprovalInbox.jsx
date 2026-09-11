import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';

export default function ApprovalInbox() {
  const { getValidToken } = useAuth();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      // See AgentDrawer.jsx — the access token lives in AuthContext's React
      // state, never in localStorage, so localStorage.getItem('token') here
      // always returned null and every fetch silently 403'd.
      const authToken = await getValidToken();
      const res = await fetch(`/api/agent/episodes?status=${filter}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data);
      } else {
        // Without this, a 403/500 left episodes as [] and the UI rendered
        // "Inbox Clean" — a failed fetch looked identical to a genuinely
        // empty inbox.
        toast.error('Failed to load approval inbox — showing no data, not a clean inbox.');
      }
    } catch (err) {
      toast.error('Failed to load approval inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [filter]);

  const handleVerdict = async (id, verdict) => {
    try {
      const authToken = await getValidToken();
      const res = await fetch(`/api/agent/episodes/${id}/verdict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ verdict })
      });
      if (res.ok) {
        toast.success(`Item marked as ${verdict}`);
        fetchEpisodes();
      } else {
        toast.error('Failed to update item verdict');
      }
    } catch (err) {
      toast.error('Error submitting verdict');
    }
  };

  return (
    <div className="space-y-6 w-full pb-28">
      {/* Standard Enterprise Page Header */}
      <PageHeader
        title="AI Agent & Manager Approval Inbox"
        subtitle="Review, sign-off, and approve agent-authored client communications, special pricing exceptions, and proposed workflow actions"
        backTo="/"
        backLabel="Back to Dashboard"
        breadcrumbs={['Operations', 'Approval Inbox']}
        badge="Manager Review"
        badgeColor="amber"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-amber-500/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-rose-500 rounded-xl text-white shadow-md shadow-amber-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Review Decisions Filter</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter queue by resolution status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'pending' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            Pending Approval ({episodes.length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'approved' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
          >
            Approved
          </button>
          <button
            onClick={fetchEpisodes}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs">Loading inbox items...</p>
        </div>
      ) : episodes.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-lg p-6">
          <EmptyState
            icon={CheckCircle2}
            title="Inbox Clean"
            description="No items currently requiring human approval."
            actionText="Refresh Inbox"
            onAction={fetchEpisodes}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {episodes.map((item) => {
            const proposed = item.proposed_action || {};
            const context = item.context_snapshot || {};
            return (
              <div key={item.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-amber-500/20 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {item.action}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.client_name || 'Client'} ({item.unique_id || 'N/A'})
                    </span>
                    {context.risk?.tier && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${context.risk.tier === 'CRITICAL' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        Risk: {context.risk.tier} ({context.risk.score}/100)
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                    <div className="flex items-center gap-1.5 font-sans font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      <Mail className="w-3.5 h-3.5" /> Proposed Draft Content:
                    </div>
                    {proposed.message || 'No draft text'}
                  </div>

                  {proposed.gateResult && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="font-semibold">Safety Gate Status:</span>
                      {proposed.gateResult.passed ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Passed
                        </span>
                      ) : (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Vetoed ({proposed.gateResult.vetoes?.[0]?.reason})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {filter === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => handleVerdict(item.id, 'approved')}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Send
                    </button>
                    <button
                      onClick={() => handleVerdict(item.id, 'rejected')}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
