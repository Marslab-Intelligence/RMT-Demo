import React, { useState, useRef, useEffect } from 'react';
import { CeoProvider } from '../../context/CeoContext';
import CeoSidebar from './CeoSidebar';
import CeoHeader from './CeoHeader';
import ExecutiveDetailDrawer from './ExecutiveDetailDrawer';
import { BookOpen, ChevronRight } from 'lucide-react';

export default function CeoLayout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('ceo_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return (
        localStorage.getItem('theme') === 'dark' ||
        localStorage.theme === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch {
      return true;
    }
  });

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
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

  const handleTogglePin = (val) => {
    const next = typeof val === 'boolean' ? val : !isPinned;
    setIsPinned(next);
    try {
      localStorage.setItem('ceo_sidebar_pinned', String(next));
    } catch {}
  };

  return (
    <CeoProvider>
      <div className="min-h-screen flex bg-surface-50 dark:bg-[#060a13] text-surface-900 dark:text-surface-100 antialiased selection:bg-brand-500/30 relative overflow-x-hidden">
        {/* Dedicated CEO Sidebar */}
        <CeoSidebar
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        {/* Executive Viewport - Dynamically adjusts space beside the sidebar */}
        <div
          className={`flex-1 flex flex-col min-w-0 overflow-x-hidden transform-gpu transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isPinned ? 'lg:pl-[260px]' : 'lg:pl-14'
          }`}
        >
          {/* Executive Header with Period Selector */}
          <CeoHeader
            onOpenMobile={() => setIsMobileMenuOpen(true)}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />

          {/* Main Dashboard Space - Full-Width Executive Workspace */}
          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
            {children}
          </main>
        </div>

        {/* Global Executive Drill-Down Drawer */}
        <ExecutiveDetailDrawer />
      </div>
    </CeoProvider>
  );
}
