import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCeo } from '../../context/CeoContext';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Moon,
  Sun,
  LogOut,
  Calendar,
  ChevronDown,
  ShieldCheck,
  Building2,
  Sparkles,
  Bell,
} from 'lucide-react';

export default function CeoHeader({
  onOpenMobile,
  isDarkMode: externalDarkMode,
  onToggleDarkMode: externalToggleDarkMode,
}) {
  const { user, logout } = useAuth();
  const { selectedPeriod, setSelectedPeriod, availablePeriods } = useCeo();
  const navigate = useNavigate();

  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [internalDarkMode, setInternalDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const isDarkMode = externalDarkMode !== undefined ? externalDarkMode : internalDarkMode;

  const toggleDarkMode = () => {
    if (externalToggleDarkMode) {
      externalToggleDarkMode();
      return;
    }
    const nextDark = !isDarkMode;
    setInternalDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      try {
        localStorage.setItem('theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      try {
        localStorage.setItem('theme', 'light');
      } catch {}
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 px-5 flex items-center justify-between border-b border-surface-200/80 dark:border-surface-800/80 bg-white/70 dark:bg-[#0a0f1c]/70 backdrop-blur-xl sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-surface-950 dark:text-white">
              Executive Leadership
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800/50">
              <ShieldCheck className="w-3 h-3 text-brand-500" />
              Company Cockpit
            </span>
          </div>
          <p className="text-[11px] text-surface-400 hidden sm:block">
            MarsLab Enterprise Portfolio Intelligence
          </p>
        </div>
      </div>

      {/* Right: Global Period Filter & Profile Controls */}
      <div className="flex items-center gap-3">
        {/* Global Period Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsPeriodMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white/90 dark:bg-surface-800/90 text-xs font-bold text-surface-800 dark:text-surface-100 hover:border-brand-500 transition-colors shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-brand-500" />
            <span>{selectedPeriod}</span>
            <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
          </button>

          {isPeriodMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsPeriodMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-48 py-1.5 rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                  Select Business Period
                </div>
                {availablePeriods.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPeriod(p.id);
                      setIsPeriodMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors ${
                      selectedPeriod === p.id
                        ? 'text-brand-600 dark:text-brand-400 font-bold bg-brand-50/50 dark:bg-brand-950/30'
                        : 'text-surface-700 dark:text-surface-300'
                    }`}
                  >
                    <span>{p.label}</span>
                    {selectedPeriod === p.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notifications Button */}
        <button
          className="p-2 rounded-xl text-surface-500 hover:text-surface-800 dark:text-surface-400 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors relative"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
