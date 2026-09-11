import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  Radio,
  X,
  Maximize2,
  Minimize2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

export default function ExecutiveBriefCard({ briefItems = [], attribution = null, loading = false }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);
  const [showAttribution, setShowAttribution] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [copied, setCopied] = useState(false);

  const safeBriefItems = Array.isArray(briefItems) ? briefItems : [];

  // Auto-rotating ticker for the compact newsflash bar
  useEffect(() => {
    if (safeBriefItems.length <= 1 || isPaused || isOpen) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % safeBriefItems.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [safeBriefItems.length, isPaused, isOpen]);

  if (loading) {
    return (
      <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900/40 border border-indigo-500/20 text-white shadow-md animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3 w-3/4">
          <div className="w-7 h-7 bg-white/20 rounded-lg shrink-0"></div>
          <div className="h-4 bg-white/20 rounded w-1/2"></div>
        </div>
        <div className="h-7 w-28 bg-white/20 rounded-lg shrink-0"></div>
      </div>
    );
  }

  if (safeBriefItems.length === 0) {
    return null;
  }

  const currentTickerItem = safeBriefItems[tickerIndex] || safeBriefItems[0];
  const criticalCount = safeBriefItems.filter((i) => i.priority === 'Critical').length;
  const highCount = safeBriefItems.filter((i) => i.priority === 'High').length;

  const filteredItems = safeBriefItems.filter((item) => {
    if (priorityFilter === 'ALL') return true;
    return item.priority?.toLowerCase() === priorityFilter.toLowerCase();
  });

  const getActionRoute = (title = '', summary = '') => {
    const text = `${title} ${summary}`.toLowerCase();
    if (text.includes('operating health') || text.includes('score')) return '/ceo/health';
    if (text.includes('overdue') || text.includes('renewal') || text.includes('contracts')) return '/ceo/renewals';
    if (text.includes('supplier') || text.includes('vendor') || text.includes('sophos')) return '/ceo/vendors';
    if (text.includes('profit') || text.includes('software renewals') || text.includes('hardware')) return '/ceo/departments';
    if (text.includes('outlook') || text.includes('forecast') || text.includes('trajectory')) return '/ceo/forecast';
    return null;
  };

  const toggleExpand = (id) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  const handleCopyBrief = (e) => {
    e.stopPropagation();
    const textSummary = safeBriefItems
      .map((item, idx) => `${idx + 1}. [${item.priority?.toUpperCase()}] ${item.title}: ${item.summary}`)
      .join('\n\n');
    navigator.clipboard.writeText(`EXECUTIVE MORNING BRIEF — WHAT TO KNOW TODAY\n\n${textSummary}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNextTicker = (e) => {
    e.stopPropagation();
    setTickerIndex((prev) => (prev + 1) % safeBriefItems.length);
  };

  const handlePrevTicker = (e) => {
    e.stopPropagation();
    setTickerIndex((prev) => (prev - 1 + safeBriefItems.length) % safeBriefItems.length);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: NEWS FLASH CONTENT (Shared between expanded card and modal)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderBriefBody = (inModal = false) => (
    <div className="space-y-4">
      {/* Priority Filters & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-b border-white/10 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Filter:</span>
          {['ALL', 'Critical', 'High', 'Medium'].map((p) => {
            const count =
              p === 'ALL'
                ? safeBriefItems.length
                : safeBriefItems.filter((i) => i.priority?.toLowerCase() === p.toLowerCase()).length;
            if (count === 0 && p !== 'ALL') return null;

            const isActive = priorityFilter === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                }`}
              >
                <span>{p}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/25' : 'bg-white/10'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {attribution && (
            <button
              type="button"
              onClick={() => setShowAttribution(!showAttribution)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Why did score change?</span>
              {showAttribution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyBrief}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            title="Copy Morning Brief summary to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Copy Brief'}</span>
          </button>
        </div>
      </div>

      {/* Score Attribution Drawer */}
      {showAttribution && attribution && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 animate-fade-in text-xs">
          <h4 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
            Operating Health Score Factor Attribution
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30">
              <span className="text-rose-300 font-bold">Primary Drag ({attribution.primaryContributor?.impact})</span>
              <p className="font-semibold text-white mt-1">{attribution.primaryContributor?.factor}</p>
              <p className="text-[11px] text-rose-200/80 mt-0.5">{attribution.primaryContributor?.detail}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30">
              <span className="text-amber-300 font-bold">Secondary Drag ({attribution.secondaryContributor?.impact})</span>
              <p className="font-semibold text-white mt-1">{attribution.secondaryContributor?.factor}</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">{attribution.secondaryContributor?.detail}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
              <span className="text-emerald-300 font-bold">Positive Stabilizer ({attribution.positiveOffset?.impact})</span>
              <p className="font-semibold text-white mt-1">{attribution.positiveOffset?.factor}</p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">{attribution.positiveOffset?.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* List of News Flash Items */}
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
        {filteredItems.map((item, idx) => {
          const isExpanded = expandedItem === item.id;
          const isCritical = item.priority === 'Critical';
          const isHigh = item.priority === 'High';
          const route = getActionRoute(item.title, item.summary);

          return (
            <div
              key={item.id || idx}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isCritical
                  ? 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-500/30'
                  : isHigh
                  ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-500/30'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/5'
              }`}
              onClick={() => toggleExpand(item.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 px-2 py-0.5 text-[10px] font-black uppercase rounded tracking-wider shrink-0 ${
                      isCritical
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-xs'
                        : isHigh
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                        : 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                    }`}
                  >
                    {item.priority}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-100 leading-snug">
                        {item.title}
                      </h3>
                      {route && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsModalOpen(false);
                            navigate(route);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-300 hover:text-brand-200 bg-brand-500/20 hover:bg-brand-500/30 px-2 py-0.5 rounded border border-brand-500/30 transition-all cursor-pointer"
                        >
                          <span>Investigate</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>

                <div className="text-slate-400 hover:text-white shrink-0 pt-0.5">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Supporting Evidence Drawer */}
              {isExpanded && item.evidence && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs animate-fade-in">
                  <span className="text-[10.5px] uppercase font-bold text-indigo-300 tracking-wider block mb-2">
                    Verified Statistical Evidence:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {item.evidence.map((ev, i) => (
                      <div key={i} className="p-2 rounded-lg bg-black/40 border border-white/5">
                        <span className="text-[10px] text-slate-400 block">{ev.label}</span>
                        <span className="text-xs font-mono font-bold text-white mt-0.5 block">{ev.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. COMPACT NEWS FLASH TICKER & "WHAT TO KNOW TODAY" BUTTON (COLLAPSED BY DEFAULT)
          ───────────────────────────────────────────────────────────────────────────── */}
      {!isOpen && (
        <div
          className="rounded-xl bg-gradient-to-r from-[#141228] via-[#1c163d] to-[#120f26] border border-indigo-500/30 text-white p-2.5 sm:px-4 sm:py-2.5 shadow-lg relative overflow-hidden transition-all group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Subtle ambient light */}
          <div className="absolute top-0 right-1/4 w-48 h-12 bg-brand-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative z-10">
            {/* Left: News Flash Badge + Live Rotating Headline Ticker */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-2xs">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-rose-400" />
                  <span>News Flash</span>
                </span>
              </div>

              {/* Cycling Headline */}
              <div
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 min-w-0 cursor-pointer overflow-hidden group/headline hover:text-brand-300 transition-colors"
                title="Click to expand full Executive Morning Brief"
              >
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 shrink-0">
                  {tickerIndex + 1}/{safeBriefItems.length}
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded shrink-0 ${
                    currentTickerItem.priority === 'Critical'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : currentTickerItem.priority === 'High'
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                      : 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                  }`}
                >
                  {currentTickerItem.priority}
                </span>
                <p className="text-xs font-semibold text-slate-200 group-hover/headline:text-white truncate">
                  {currentTickerItem.title}
                </p>
                <span className="text-[11px] text-slate-400 group-hover/headline:text-brand-300 hidden md:inline shrink-0">
                  — {currentTickerItem.summary}
                </span>
              </div>
            </div>

            {/* Right: Ticker cycle arrows + Primary "What to know today" Action Button */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {safeBriefItems.length > 1 && (
                <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={handlePrevTicker}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Previous update"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextTicker}
                    className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Next update"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* The Primary "What to know today" Button */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white shadow-sm hover:shadow-indigo-500/20 border border-brand-400/30 transition-all cursor-pointer group shrink-0"
                title="Expand full Executive Morning Brief"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 group-hover:rotate-12 transition-transform" />
                <span>What to know today</span>
                <span className="px-1.5 py-0.2 text-[10px] font-black bg-white/20 rounded-full">
                  {safeBriefItems.length}
                </span>
                <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
              </button>

              {/* Pop-up Modal Option */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Open in dedicated News Flash modal"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. EXPANDED EXECUTIVE MORNING BRIEF (CLEANLY ACCORDIONED WITH CLOSE BUTTON)
          ───────────────────────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div className="rounded-2xl bg-gradient-to-br from-[#131127] via-[#181335] to-[#120f24] text-white p-5 sm:p-6 border border-indigo-500/30 shadow-2xl relative overflow-hidden animate-fade-in">
          {/* Ambient lighting */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-400 via-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold tracking-tight">Executive Morning Brief</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30">
                    What to know today
                  </span>
                  {criticalCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {criticalCount} Critical
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Synthesized from active portfolio telemetry, contract runways, and supplier dependencies
                </p>
              </div>
            </div>

            {/* Right Action Controls: Pop-out Modal + Close/Collapse Button */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                title="Pop out into dedicated dialog"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Full Screen</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer group"
                title="Collapse Morning Brief"
              >
                <ChevronUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="mt-3 relative z-10">{renderBriefBody(false)}</div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. DEDICATED NEWS FLASH MODAL (FOCUSED POP-UP DIALOG VIA PORTAL)
          ───────────────────────────────────────────────────────────────────────────── */}
      {isModalOpen && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-3xl rounded-2xl bg-gradient-to-br from-[#131127] via-[#1a143a] to-[#120f26] border border-indigo-500/40 shadow-2xl p-6 text-white overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Ambient Lights */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-400 via-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
                    <Radio className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black tracking-tight">Executive News Flash</h2>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-brand-400/20 text-brand-300 border border-brand-400/30">
                        What To Know Today
                      </span>
                    </div>
                    <p className="text-xs text-slate-300/80 mt-0.5">
                      Live operational intelligence digest generated for the Chief Executive
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Close news flash"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="mt-4 flex-1 overflow-y-auto relative z-10 pr-1">{renderBriefBody(true)}</div>

              {/* Modal Footer */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0 relative z-10">
                <span>{safeBriefItems.length} verified telemetry intelligence alerts</span>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-white/15 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
