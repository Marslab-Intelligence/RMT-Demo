import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PanelLeft, X, LogOut, Sun, Moon, Mail } from 'lucide-react';

/**
 * ChatGPT-style Universal Sidebar for RMT Enterprise Platform
 * Supports all 4 profiles: Super Admin, Dept Admin, User, and CEO.
 *
 * Requirements Met:
 * 1. Collapsed rail (w-14 / 56px) with MarsLab logo (/Marslab_RLogo_Alpha_BG.svg) at top.
 * 2. Hovering the logo morphs it to PanelLeft [| ] icon in rounded container and shows floating "Open sidebar" pill (Image 2).
 * 3. Clicking "Open sidebar" expands and pins the sidebar (Image 3) — it will not close until the close sidebar button is clicked again.
 * 4. Expanded header shows App Title ("RMT") + MarsLab logo on left, Close Sidebar button [| ] on right (NO search button!).
 * 5. Hover peek: Moving cursor over the rail expands the sidebar, leaving collapses it back (when not pinned).
 * 6. Bottom circular avatar in brand gradient with user initials (Image 1).
 * 7. Content space dynamically adjusts with smooth transitions across all 4 profiles.
 */
export default function ChatGptSidebar({
  sections = [],
  items = [],
  user,
  roleBadge = '',
  appTitle = 'RMT',
  homePath = '/',
  isPinned,
  onTogglePin,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
  automationStatus = null,
  onToggleAutomationAction = null,
}) {
  const navigate = useNavigate();
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);

  const normalizedSections = React.useMemo(() => {
    if (sections && sections.length > 0) return sections;
    if (items && items.length > 0) return [{ label: '', items }];
    return [];
  }, [sections, items]);

  const allItems = React.useMemo(() => {
    return normalizedSections.flatMap((s) => s.items || []);
  }, [normalizedSections]);

  const isExpanded = !!isPinned;

  const handleOpenAndPin = () => {
    onTogglePin(true);
  };

  const handleCloseSidebar = () => {
    onTogglePin(false);
  };

  const getInitials = (str) => {
    if (!str) return 'RM';
    const parts = str.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const canManageAutomation =
    automationStatus &&
    onToggleAutomationAction &&
    (user?.role === 'super_admin' || user?.role === 'dept_admin');

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {!isExpanded && hoveredTooltip && (
        <div
          style={{ top: `${hoveredTooltip.top}px` }}
          className="fixed left-16 z-50 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1e1e1e] text-white border border-white/10 shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-xs font-semibold leading-tight">{hoveredTooltip.text}</div>
          {hoveredTooltip.subtext && (
            <div className="text-[10.5px] text-stone-400 capitalize leading-tight mt-0.5">
              {hoveredTooltip.subtext}
            </div>
          )}
        </div>
      )}

      <aside
        onMouseLeave={() => {
          setIsLogoHovered(false);
          setHoveredTooltip(null);
        }}
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col sidebar-glass text-[var(--text-primary)] border-r border-[var(--glass-border)] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none ${
          isExpanded ? 'w-[260px]' : 'w-14'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-3 border-b border-[var(--glass-border)] flex-shrink-0">
          {!isExpanded ? (
            <div className="w-full flex items-center justify-center relative">
              <button
                type="button"
                onClick={handleOpenAndPin}
                onMouseEnter={(e) => {
                  setIsLogoHovered(true);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    text: 'Open sidebar',
                    top: rect.top + rect.height / 2,
                  });
                }}
                onMouseLeave={() => {
                  setIsLogoHovered(false);
                  setHoveredTooltip(null);
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 group relative cursor-pointer"
              >
                {isLogoHovered ? (
                  <PanelLeft className="w-5 h-5 text-[var(--text-primary)]" />
                ) : (
                  <img src="/Marslab_RLogo_Alpha_BG.svg" alt="MarsLab" className="w-6 h-6 object-contain" />
                )}
              </button>
            </div>
          ) : (
            <>
              <div onClick={() => navigate(homePath)} className="flex items-center gap-2.5 cursor-pointer group">
                <img src="/Marslab_RLogo_Alpha_BG.svg" alt="MarsLab" className="w-6 h-6 object-contain" />
                <span className="font-bold text-base text-[var(--text-primary)]">{appTitle}</span>
              </div>
              <button type="button" onClick={handleCloseSidebar} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10">
                <PanelLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
          {normalizedSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {isExpanded && section.label && (
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{section.label}</div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={iIdx}
                      to={item.path}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredTooltip({
                            text: item.name,
                            top: rect.top + rect.height / 2,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (!isExpanded) setHoveredTooltip(null);
                      }}
                      className={({ isActive }) =>
                        `group flex items-center rounded-xl transition-all ${
                          isExpanded ? 'px-3 py-2 gap-3 text-xs' : 'w-10 h-10 mx-auto justify-center'
                        } ${
                          isActive
                            ? 'bg-[var(--brand)]/15 text-[var(--brand)] font-semibold border border-[var(--brand)]/30'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {isExpanded && <span className="truncate">{item.name}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── EMAIL AUTOMATION / STOP EMAIL SCHEDULER ── */}
        {canManageAutomation && (
          <div className="px-2 pb-2">
            {!isExpanded ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onToggleAutomationAction(automationStatus === 'start' ? 'stop' : 'start')}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredTooltip({
                      text: automationStatus === 'start' ? 'Email Automation: Active' : 'Email Automation: Stopped',
                      subtext: automationStatus === 'start' ? 'Click to Stop Email' : 'Click to Start Email',
                      top: rect.top + rect.height / 2,
                    });
                  }}
                  onMouseLeave={() => setHoveredTooltip(null)}
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Email Automation"
                >
                  <Mail className="w-4 h-4" />
                  <span
                    className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-[var(--glass-border)] ${
                      automationStatus === 'start' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                </button>
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[var(--glass-border)] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      automationStatus === 'start' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <div className="truncate">
                    <div className="text-[11px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                      Email Automation
                    </div>
                    <div
                      className={`text-[9.5px] font-bold uppercase tracking-wider leading-tight ${
                        automationStatus === 'start' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {automationStatus === 'start' ? 'Active' : 'Stopped'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAutomationAction(automationStatus === 'start' ? 'stop' : 'start')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    automationStatus === 'start'
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/30'
                  }`}
                  title={automationStatus === 'start' ? 'Stop email scheduler' : 'Start email scheduler'}
                >
                  <Mail className="w-3 h-3" />
                  <span>{automationStatus === 'start' ? 'Stop Email' : 'Start Email'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER: USER AVATAR & EMAIL ── */}
        <div className="p-2 border-t border-[var(--glass-border)]">
          {!isExpanded ? (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-violet-500 text-xs font-bold flex items-center justify-center cursor-pointer shadow-md text-white"
                onClick={handleOpenAndPin}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTooltip({
                    text: user?.fullName || user?.name || (user?.email ? user.email.split('@')[0] : 'User Profile'),
                    subtext: user?.email || user?.role?.replace('_', ' ') || roleBadge,
                    top: rect.top + rect.height / 2,
                  });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
                aria-label="User Profile"
              >
                {getInitials(user?.fullName || user?.name || user?.email)}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--glass-border)]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-violet-500 text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-md text-white">
                  {getInitials(user?.fullName || user?.name || user?.email)}
                </div>
                <div className="truncate min-w-0 text-left">
                  <div
                    className="text-xs font-semibold text-[var(--text-primary)] truncate"
                    title={user?.fullName || user?.name || 'User'}
                  >
                    {user?.fullName || user?.name || (user?.email ? user.email.split('@')[0] : 'User')}
                  </div>
                  <div
                    className="text-[10px] text-[var(--text-muted)] truncate"
                    title={user?.email || roleBadge}
                  >
                    {user?.email || user?.role?.replace('_', ' ') || roleBadge || 'Member'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onToggleDarkMode && (
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Sign out"
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
