import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, Sparkles, Send, Loader2, CheckCircle2, ChevronRight, X } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'How is the company doing?',
  'Which department is underperforming?',
  'What are our highest vendor risks?',
  'What is forecasted for next quarter?',
  'What renewals should I worry about?',
];

export default function ExecutiveQueryBar() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (textToSearch) => {
    const q = textToSearch || query;
    if (!q.trim() || !token) return;

    setLoading(true);
    setIsOpen(true);

    try {
      const res = await fetch('/api/ceo/intelligence/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data);
      }
    } catch (err) {
      console.error('Failed to resolve executive query:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (prompt) => {
    setQuery(prompt);
    handleSearch(prompt);
  };

  return (
    <div className="relative z-20">
      {/* Query Bar */}
      <div className="p-3 rounded-2xl bg-white/80 dark:bg-[#141124]/90 backdrop-blur-xl border border-surface-200/80 dark:border-surface-800 shadow-sm flex flex-col gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask executive intelligence (e.g. 'How is the company doing?', 'What are my biggest risks?')..."
            className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none px-2"
          />

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Ask</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
          <span className="text-surface-400 font-semibold shrink-0 pl-1">Suggested:</span>
          {SUGGESTED_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(p)}
              className="px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800/60 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-surface-600 dark:text-surface-300 hover:text-brand-600 dark:hover:text-brand-400 border border-surface-200/60 dark:border-surface-700/60 shrink-0 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Modal / Dropdown */}
      {isOpen && (
        <div className="mt-3 p-5 rounded-2xl bg-white dark:bg-[#151226] border border-brand-500/30 shadow-2xl animate-slide-up relative">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {loading ? (
            <div className="flex items-center gap-3 py-6 justify-center text-surface-500 text-xs font-semibold">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              <span>Grounded intelligence engine querying portfolio telemetry...</span>
            </div>
          ) : response ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                  {response.topic || 'Grounded Briefing'}
                </span>
                <span className="text-[11px] text-surface-400">Strictly verified from PostgreSQL database</span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-surface-950 dark:text-white leading-snug">
                {response.headline}
              </h3>

              <p className="text-surface-600 dark:text-surface-300 leading-relaxed">
                {response.summary}
              </p>

              {/* Verified Citations */}
              {response.citations && response.citations.length > 0 && (
                <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-900/60 border border-surface-200/70 dark:border-surface-800 space-y-2">
                  <span className="text-[10.5px] uppercase font-bold text-surface-400 tracking-wider block">
                    Grounded Metrics & Citations:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {response.citations.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-surface-900 dark:text-white">{c.metric}: </span>
                          <span className="text-surface-500 dark:text-surface-400 font-mono">{c.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Leadership Action */}
              {response.recommendedAction && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                  <span className="font-bold text-[11px] uppercase tracking-wider block mb-0.5">
                    Recommended Leadership Focus:
                  </span>
                  <p>{response.recommendedAction}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
