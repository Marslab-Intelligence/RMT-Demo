import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, AlertCircle, ShieldCheck, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// There is no multi-turn conversation memory here — every message goes to
// the backend as an independent request with no history, so "the 1st
// client" was being searched for literally as a client name. Sending the
// full chat history to Gemini on every call would fix this properly, but
// costs real requests against a 20/day cap for something resolvable for
// free: every numbered list the agent renders already prints "(RMT-###)"
// next to each row, in order, so an ordinal reference can be resolved
// against the text already on screen — no model call needed, and it works
// even while the daily limit is exhausted.
const ORDINAL_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

function extractOrdinalPosition(text) {
  const lower = text.toLowerCase();
  const numMatch = lower.match(/#\s?(\d+)\b|\b(\d+)(?:st|nd|rd|th)\b/);
  if (numMatch) return parseInt(numMatch[1] || numMatch[2], 10);
  for (const [word, num] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return num;
  }
  return null;
}

// Resolves "the 1st client" / "#2" / "the third one" against the most
// recent agent message that actually rendered a numbered (RMT-###) list —
// not necessarily the immediately previous message, since that could be an
// unrelated error or a non-list answer further from the list itself.
function resolveOrdinalReference(userMessage, priorMessages) {
  if (/RMT-\d+/i.test(userMessage)) return userMessage; // already explicit, nothing to resolve

  const position = extractOrdinalPosition(userMessage);
  if (!position) return userMessage;

  for (let i = priorMessages.length - 1; i >= 0; i--) {
    const m = priorMessages[i];
    if (m.sender !== 'agent') continue;
    const ids = [...m.text.matchAll(/\(RMT-\d+\)/gi)].map(x => x[0].replace(/[()]/g, ''));
    if (ids.length === 0) continue;
    if (position > ids.length) return userMessage; // found a list, but not that many items — don't guess
    return `${userMessage} (referring to ${ids[position - 1]})`;
  }
  return userMessage; // no prior list to resolve against
}

// resetsAt is a server estimate (UTC midnight), not a guarantee from Google —
// rendered as a rounded "in about Xh" rather than a false-precise countdown.
function formatResetTime(resetsAtIso) {
  if (!resetsAtIso) return 'soon';
  const msLeft = new Date(resetsAtIso).getTime() - Date.now();
  if (msLeft <= 0) return 'shortly';
  const hours = Math.floor(msLeft / (1000 * 60 * 60));
  const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `in ${minutes}m`;
  return `in ${hours}h ${minutes}m`;
}

export default function AgentDrawer() {
  const { getValidToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'agent',
      text: 'Hello! I am your AI Renewal Agent. How can I help you manage renewals, check contract risks, or make data updates today?'
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingMutation, setPendingMutation] = useState(null);
  const [usage, setUsage] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // The Gemini free-tier key has a hard 20 requests/day cap. Without this,
  // that showed up as intermittent, seemingly-random "temporarily
  // unavailable" answers with no way to tell why. Fetching and displaying
  // it makes the limit visible instead of mysterious, and refreshing after
  // every action keeps the count honest as it's used up.
  const fetchUsage = async () => {
    try {
      const authToken = await getValidToken();
      const res = await fetch('/api/agent/usage', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) setUsage(await res.json());
    } catch (err) {
      // Non-critical — the usage bar just stays at its last known value.
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsage();
  }, [isOpen]);

  // parseNaturalLanguageMutation can only ever resolve a target by an exact
  // RMT-### id — anything else always returns "could not resolve target"
  // regardless of what the message actually asks for. Trying that endpoint
  // first for every message (the previous behavior) meant a plain question
  // like "total records in the rmt" showed that error and never reached the
  // real query path at all. Only attempt edit-parsing when the message
  // actually references a record.
  const RMT_ID_PATTERN = /\bRMT-\d+\b/i;

  // agent_jobs run in the background and only ever broadcast their result
  // over SSE — nothing in this component listened for that, so a query
  // enqueued fine and then no answer ever appeared. Poll the job instead
  // until it completes, fails, or times out.
  const pollJobResult = async (jobId, authToken) => {
    const start = Date.now();
    const timeoutMs = 25000;
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1200));
      const res = await fetch(`/api/agent/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) continue;
      const job = await res.json();
      if (job.status === 'completed') {
        return { ok: true, text: job.result?.finalResult || 'Done, but the job returned no summary text.' };
      }
      if (job.status === 'failed') {
        return { ok: false, text: `⚠️ Agent job failed: ${job.error || 'unknown error'}` };
      }
      // still pending/running — keep polling
    }
    return { ok: false, text: '⚠️ The agent is taking longer than expected. Check the Approval Inbox or try again shortly.' };
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || isProcessing) return;

    const userMessage = prompt.trim();
    // Resolve against messages as it stands *before* this turn is appended —
    // display keeps the user's original wording; only the text actually
    // sent to the backend gets the resolved RMT ID appended.
    const resolvedMessage = resolveOrdinalReference(userMessage, messages);
    setPrompt('');
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsProcessing(true);

    try {
      // The access token lives only in AuthContext's React state (refreshed
      // via an HttpOnly cookie) — it is never written to localStorage, so a
      // plain localStorage.getItem('token') read here always returns null
      // and every call below would silently 403 as "Bearer null".
      const authToken = await getValidToken();

      // Only attempt edit parsing if user explicitly requests a field update/change
      const EDIT_KEYWORDS_PATTERN = /(?:update|change|set|edit|modify|make|mark|replace)\b/i;
      const RMT_ID_PATTERN = /(?:RMT|rmt)[-\s]?\d+/i;

      if (EDIT_KEYWORDS_PATTERN.test(resolvedMessage) && RMT_ID_PATTERN.test(resolvedMessage)) {
        const parseRes = await fetch('/api/agent/nl-edit/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ utterance: resolvedMessage })
        });

        if (parseRes.ok) {
          const mutation = await parseRes.json();
          if (mutation.changes && mutation.changes.length > 0) {
            setPendingMutation(mutation);
            setMessages(prev => [
              ...prev,
              {
                sender: 'agent',
                text: `I parsed a request to edit ${mutation.target?.clientName} (${mutation.target?.uniqueId}). Please confirm the diff below to execute the change:`,
                isMutationPreview: true
              }
            ]);
            setIsProcessing(false);
            return;
          }
        }
      }

      // General question, analysis, or record lookup — route through background job runner
      const queryRes = await fetch('/api/agent/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ prompt: resolvedMessage })
      });

      if (queryRes.ok) {
        const { jobId } = await queryRes.json();
        const outcome = await pollJobResult(jobId, authToken);
        setMessages(prev => [...prev, { sender: 'agent', text: outcome.text }]);
      } else {
        setMessages(prev => [...prev, { sender: 'agent', text: 'Error enqueuing agent job. Please try again.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'agent', text: 'Connection error while communicating with AI agent.' }]);
    } finally {
      setIsProcessing(false);
      fetchUsage();
    }
  };

  // These two dedicated endpoints existed on the backend but nothing in the
  // UI ever called them — the quick-action chips just pre-filled the chat
  // input with matching text, which then went through the generic
  // classifier and got misrouted to an unrelated tool (e.g. "Run catch-up
  // daily sweep" resolved to get_expiring_renewals, not an actual sweep).
  // Calling the real endpoints directly instead of routing through chat.
  const handleDailySweep = async () => {
    if (isProcessing) return;
    setMessages(prev => [...prev, { sender: 'user', text: 'Run catch-up daily sweep' }]);
    setIsProcessing(true);
    try {
      const authToken = await getValidToken();
      const res = await fetch('/api/agent/daily-sweep', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const { summary } = await res.json();
        setMessages(prev => [...prev, {
          sender: 'agent',
          text: `⚡ Daily sweep complete. Scanned ${summary.totalScanned} renewals — ${summary.criticalCount} critical, ${summary.highCount} high risk, ${summary.queuedForApproval} drafts queued for approval, ${summary.skippedCount} already up to date. Check the Approval Inbox to review.`
        }]);
      } else {
        setMessages(prev => [...prev, { sender: 'agent', text: '⚠️ Daily sweep failed to run. Please try again.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'agent', text: 'Connection error while running the daily sweep.' }]);
    } finally {
      setIsProcessing(false);
      fetchUsage();
    }
  };

  const handleGuardianHealth = async () => {
    if (isProcessing) return;
    setMessages(prev => [...prev, { sender: 'user', text: 'Check Guardian health anomalies' }]);
    setIsProcessing(true);
    try {
      const authToken = await getValidToken();
      const res = await fetch('/api/agent/guardian-health', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const { findings } = await res.json();
        const text = findings.length === 0
          ? '🛡️ Guardian scan complete — no data integrity or security anomalies found.'
          : `🛡️ Guardian scan found ${findings.length} anomal${findings.length === 1 ? 'y' : 'ies'}: ${findings.slice(0, 3).map(f => `${f.category} (${f.clientName || f.uniqueId})`).join(', ')}${findings.length > 3 ? `, +${findings.length - 3} more` : ''}. See the Guardian Health page for details.`;
        setMessages(prev => [...prev, { sender: 'agent', text }]);
      } else {
        setMessages(prev => [...prev, { sender: 'agent', text: '⚠️ Guardian scan failed to run. Please try again.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'agent', text: 'Connection error while running the Guardian scan.' }]);
    } finally {
      setIsProcessing(false);
      fetchUsage();
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    setIsProcessing(true);
    try {
      const authToken = await getValidToken();
      const res = await fetch('/api/agent/nl-edit/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ mutation: pendingMutation })
      });

      if (res.ok) {
        toast.success('Mutation applied successfully');
        setMessages(prev => [
          ...prev,
          {
            sender: 'agent',
            text: `✅ Successfully updated record for ${pendingMutation.target?.clientName}. Audit log recorded.`
          }
        ]);
        setPendingMutation(null);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to apply mutation');
      }
    } catch (e) {
      toast.error('Error applying edit mutation');
    } finally {
      setIsProcessing(false);
      fetchUsage();
    }
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 group"
        style={{
          background: 'linear-gradient(135deg, rgba(var(--brand-rgb), 0.9), rgba(var(--brand-rgb), 0.7))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '18px',
          padding: '14px 20px',
          boxShadow: '0 8px 32px rgba(var(--brand-rgb), 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#fff',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(var(--brand-rgb), 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(var(--brand-rgb), 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)'; }}
      >
        <Bot className="w-5 h-5" />
        <span className="text-[11px] tracking-wider uppercase font-bold hidden sm:inline">AI Agent</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9989] bg-black/20 dark:bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Drawer */}
      {isOpen && (
        <div
          className="fixed inset-y-0 right-0 z-[9990] w-full max-w-[420px] flex flex-col"
          style={{
            background: 'var(--sidebar-bg)',
            backdropFilter: 'blur(50px) saturate(190%)',
            WebkitBackdropFilter: 'blur(50px) saturate(190%)',
            borderLeft: '1px solid var(--sidebar-border)',
            boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.08)',
            animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* ── Drawer Header ── */}
          <div
            className="relative overflow-hidden flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--brand-rgb), 0.15) 0%, rgba(var(--brand-rgb), 0.05) 100%)',
              borderBottom: '1px solid var(--sidebar-border)',
            }}
          >
            {/* Decorative gradient orb */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(var(--brand-rgb), 0.4), transparent 70%)' }}
            />
            <div className="relative p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{
                    background: 'rgba(var(--brand-rgb), 0.15)',
                    border: '1px solid rgba(var(--brand-rgb), 0.25)',
                    boxShadow: '0 0 16px rgba(var(--brand-rgb), 0.1)',
                  }}
                >
                  <Bot className="w-5 h-5" style={{ color: 'rgb(var(--brand-rgb))' }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white tracking-tight">
                    RenewalPro AI
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-gray-500">
                      Online • Autonomous
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer"
                style={{
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              >
                <X className="w-4 h-4 text-stone-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* ── AI Usage Indicator ── */}
          {usage && (
            <div
              className="px-4 py-2.5 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--sidebar-border)' }}
            >
              {usage.limitReached ? (
                <div className="flex items-center gap-2 text-[11px]">
                  <div className="flex items-center justify-center w-5 h-5 rounded-md bg-rose-500/10 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                  </div>
                  <span className="text-rose-600 dark:text-rose-400 font-medium leading-snug">
                    Daily limit reached ({usage.requestsToday}/{usage.dailyRequestLimit}) — resumes ~{formatResetTime(usage.resetsAt)}.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-semibold text-stone-400 dark:text-gray-500 whitespace-nowrap uppercase tracking-wider">
                    Usage
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(0,0,0,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (usage.requestsToday / usage.dailyRequestLimit) * 100)}%`,
                        background: usage.requestsToday / usage.dailyRequestLimit >= 0.7
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : `linear-gradient(90deg, rgb(var(--brand-rgb)), rgba(var(--brand-rgb), 0.7))`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 dark:text-gray-400 tabular-nums">
                    {usage.requestsToday}/{usage.dailyRequestLimit}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Quick Actions ── */}
          <div
            className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--sidebar-border)' }}
          >
            <button
              onClick={handleDailySweep}
              disabled={isProcessing}
              className="agent-chip"
              style={{
                background: 'rgba(var(--brand-rgb), 0.08)',
                border: '1px solid rgba(var(--brand-rgb), 0.15)',
                color: 'rgb(var(--brand-rgb))',
              }}
            >
              <Sparkles className="w-3 h-3" />
              <span>Daily Sweep</span>
            </button>
          </div>

          {/* ── Chat Messages ── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 sidebar-scroll">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] text-[13px] leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'agent-bubble-user'
                      : 'agent-bubble-agent'
                  }`}
                >
                  {m.text}

                  {m.isMutationPreview && pendingMutation && (
                    <div className="mt-3 p-3 rounded-xl text-[11px] space-y-2"
                      style={{
                        background: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(var(--brand-rgb), 0.2)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <div className="font-bold" style={{ color: 'rgb(var(--brand-rgb))' }}>
                        Proposed Field Diff:
                      </div>
                      {pendingMutation.changes.map((c, i) => (
                        <div key={i} className="font-mono p-1.5 rounded-lg text-gray-800 dark:text-gray-200"
                          style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
                        >
                          <span className="font-bold" style={{ color: 'rgb(var(--brand-rgb))' }}>{c.field}:</span> {c.from || '(empty)'} ➔ <strong className="text-emerald-600">{c.to}</strong>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleConfirmMutation}
                          className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        >
                          Confirm & Apply
                        </button>
                        <button
                          onClick={() => setPendingMutation(null)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer text-stone-600 dark:text-gray-300"
                          style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex items-start">
                <div className="agent-bubble-agent flex items-center gap-1.5 !py-3 !px-4">
                  <span className="agent-typing-dot" style={{ animationDelay: '0ms' }} />
                  <span className="agent-typing-dot" style={{ animationDelay: '150ms' }} />
                  <span className="agent-typing-dot" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Chat Input Footer ── */}
          <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
            <div
              className="flex items-center gap-2 p-1.5 rounded-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.03)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}
            >
              <input
                type="text"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask the AI agent anything..."
                className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-stone-400 dark:placeholder-gray-500 px-3 py-2 text-[13px] focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={isProcessing || !prompt.trim()}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer disabled:opacity-30"
                style={{
                  background: `linear-gradient(135deg, rgb(var(--brand-rgb)), rgba(var(--brand-rgb), 0.8))`,
                  boxShadow: '0 2px 8px rgba(var(--brand-rgb), 0.3)',
                  color: '#fff',
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
