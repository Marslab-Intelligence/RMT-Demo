import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/formatters';
import VersionNotifier from './VersionNotifier';
import AgentDrawer from './AgentDrawer';
import { APP_VERSION } from '../version';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  Search,
  ShieldCheck,
  ShieldAlert,
  Moon,
  Sun,
  Home,
  History,
  Trash2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  Users,
  Mail,
  Pin,
  Tag,
  Plus
} from 'lucide-react';

const getRoleLabel = (role) => {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'dept_admin') return 'Dept Admin';
  if (role === 'user') return 'User';
  return '';
};

const getRoleBadgeStyle = (role) => {
  if (role === 'super_admin' || role === 'dept_admin') return 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/50';
  if (role === 'user') return 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50';
  return '';
};

export default function Layout({ children }) {
  const { user, logout, token, getValidToken } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHoveredSidebar, setIsHoveredSidebar] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(() => localStorage.getItem('sidebar_pinned') === 'true');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const sidebarRef = useRef(null);
  const notificationsRef = useRef(null);
  const leaveTimeoutRef = useRef(null);
  const toastedIdsRef = useRef(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);
  const [headerSearch, setHeaderSearch] = useState('');

  const handleHeaderSearch = (e) => {
    e.preventDefault();
    const q = headerSearch.trim();
    navigate(q ? `/renewals?search=${encodeURIComponent(q)}` : '/renewals');
  };

  const [expiredNoReason, setExpiredNoReason] = useState([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [expiryReasons, setExpiryReasons] = useState({});
  const [submittingExpiry, setSubmittingExpiry] = useState({});
  const remindLaterUntilRef = useRef(null);

  const [automationStatus, setAutomationStatus] = useState('start');
  const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
  const [automationAction, setAutomationAction] = useState(null);
  const [automationNote, setAutomationNote] = useState('');
  const [automationSubmitting, setAutomationSubmitting] = useState(false);

  const fetchAutomationStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/automation/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAutomationStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch automation status in layout:', err);
    }
  }, [token]);

  const handleToggleAutomation = async (e) => {
    e.preventDefault();
    if (!automationNote.trim()) {
      toast.error('A note explaining the reason is required.');
      return;
    }
    setAutomationSubmitting(true);
    try {
      const res = await fetch('/api/automation/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: automationAction, note: automationNote })
      });
      if (res.ok) {
        const data = await res.json();
        setAutomationStatus(data.status);
        toast.success(`Email automation successfully ${automationAction === 'start' ? 'started' : 'stopped'}`);
        setIsAutomationModalOpen(false);
        window.dispatchEvent(new CustomEvent('rmt_automation_toggled', { detail: data }));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update email automation status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    } finally {
      setAutomationSubmitting(false);
    }
  };

  const fetchExpiredNoReason = useCallback(async () => {
    if (!token || user?.role !== 'user') return;
    // If snoozed, don't auto-open but still fetch
    try {
      const res = await fetch('/api/renewals/expired-no-reason', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const prev = expiredNoReason.length;
        setExpiredNoReason(data);
        if (data.length === 0) {
          setIsWidgetOpen(false);
        } else if (data.length > 0) {
          // Auto-open only if not snoozed
          const snoozedUntil = remindLaterUntilRef.current;
          if (!snoozedUntil || Date.now() >= snoozedUntil) {
            remindLaterUntilRef.current = null;
            setIsWidgetOpen(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch expired renewals requiring reason:', err);
    }
  }, [token, user]);

  useEffect(() => {
    fetchExpiredNoReason();
    const interval = setInterval(fetchExpiredNoReason, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, [fetchExpiredNoReason]);

  useEffect(() => {
    fetchAutomationStatus();
    const interval = setInterval(fetchAutomationStatus, 15000); // poll every 15s to keep it in sync
    return () => clearInterval(interval);
  }, [fetchAutomationStatus]);

  // 1-hour snooze re-trigger
  useEffect(() => {
    if (!remindLaterUntilRef.current) return;
    const delay = remindLaterUntilRef.current - Date.now();
    if (delay <= 0) return;
    const t = setTimeout(() => {
      if (expiredNoReason.length > 0) setIsWidgetOpen(true);
    }, delay);
    return () => clearTimeout(t);
  }, [remindLaterUntilRef.current]);

  const handleRemindLater = () => {
    remindLaterUntilRef.current = Date.now() + 60 * 60 * 1000; // 1 hour
    setIsWidgetOpen(false);
    toast('⏰ We\'ll remind you in 1 hour.', { duration: 3000 });
    // schedule re-open
    setTimeout(() => {
      if (expiredNoReason.length > 0) setIsWidgetOpen(true);
    }, 60 * 60 * 1000);
  };


  // Dark mode toggle
  useEffect(() => {
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const willBeDark = !isDarkMode;

    const performThemeChange = () => {
      if (willBeDark) {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
        setIsDarkMode(true);
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
        setIsDarkMode(false);
      }
    };

    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        performThemeChange();
      });
    } else {
      performThemeChange();
    }
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setShowNotifications(false);
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  const isFirstLoadRef = useRef(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unread);

        // If the user is admin or sales, show toast popups for new unread notifications
        if ((user?.role === 'super_admin' || user?.role === 'dept_admin') || user?.role === 'user') {
          data.notifications.forEach(notif => {
            if (notif.read === 0 && !toastedIdsRef.current.has(notif.id)) {
              // If it's not the first load, trigger the toast popup!
              if (!isFirstLoadRef.current) {
                toast.custom((t) => {
                  const isDark = document.documentElement.classList.contains('dark');
                  return (
                    <div
                      className={`${
                        t.visible ? 'animate-enter' : 'animate-leave'
                      } max-w-md w-full shadow-2xl rounded-xl pointer-events-auto flex border transition-all duration-200`}
                      style={{
                        background: isDark ? '#27272a' : '#ffffff',
                        borderColor: isDark ? '#3f3f46' : '#e4e4e7',
                      }}
                    >
                      <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 pt-0.5">
                            <Bell className="h-5 w-5 text-brand-500 animate-bounce" />
                          </div>
                          <div className="ml-3 flex-1">
                            <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-surface-900'}`}>
                              {notif.title}
                            </p>
                            <p className={`mt-1 text-xs ${isDark ? 'text-surface-300' : 'text-surface-500'}`}>
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`flex border-l ${isDark ? 'border-surface-700' : 'border-surface-200'}`}>
                        <button
                          onClick={() => toast.dismiss(t.id)}
                          className={`w-full border border-transparent rounded-none rounded-r-xl px-4 py-2 flex items-center justify-center text-xs font-semibold transition-colors focus:outline-none ${
                            isDark ? 'text-brand-400 hover:bg-surface-900/50' : 'text-brand-600 hover:bg-surface-50'
                          }`}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                }, { duration: 6000, id: `notif-${notif.id}` });
              }
              // Mark as seen in toastedIds set
              toastedIdsRef.current.add(notif.id);
            }
          });
        }

        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [token, user]);

  useEffect(() => {
    isFirstLoadRef.current = true;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s background poll (realtime updates handled by SSE)
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const fetchNotificationsRef = useRef(fetchNotifications);
  const fetchExpiredNoReasonRef = useRef(fetchExpiredNoReason);

  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
    fetchExpiredNoReasonRef.current = fetchExpiredNoReason;
  }, [fetchNotifications, fetchExpiredNoReason]);

  // Real-Time Event Stream Connection (SSE) with robust reconnection and token refresh
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;
    let active = true;

    const connectSSE = async () => {
      if (!active) return;

      try {
        // Get a valid/fresh token (refreshes silently if expired)
        const currentToken = await getValidToken();
        if (!currentToken || !active) return;

        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        console.log('📡 SSE: Connecting to real-time events...');
        eventSource = new EventSource(`/api/renewals/events?token=${encodeURIComponent(currentToken)}`);

        eventSource.onopen = () => {
          console.log('📡 SSE: Connected successfully.');
        };

        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'connected') {
              // Connected acknowledgment
            } else if (payload.type === 'renewals_updated') {
              console.log('📡 SSE: Real-time update received: renewals_updated');
              window.dispatchEvent(new CustomEvent('rmt_renewals_updated', { detail: payload.data }));
              if (fetchNotificationsRef.current) fetchNotificationsRef.current();
              if (fetchExpiredNoReasonRef.current) fetchExpiredNoReasonRef.current();
            } else if (['visit_started', 'visit_checked_in', 'visit_completed', 'location_updated'].includes(payload.type)) {
              console.log(`📡 SSE: Real-time visit update received: ${payload.type}`);
              window.dispatchEvent(new CustomEvent('rmt_visit_event', { detail: payload }));
            }
          } catch (err) {
            // Suppress errors for keep-alive pings
          }
        };

        eventSource.onerror = (err) => {
          // Only force re-creation if EventSource is completely closed
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            console.log('📡 SSE: Connection closed, reconnecting in 5s...');
            eventSource.close();
            eventSource = null;
            if (active) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(connectSSE, 5000);
            }
          }
        };
      } catch (err) {
        if (active) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      active = false;
      clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [token, getValidToken]);

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`/api/dashboard/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch('/api/dashboard/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const extractClientFromNotification = (notif) => {
    if (notif.link) return notif.link;

    const msg = notif.message;
    if (!msg) return null;

    // 1. Edit Access Requested: "CST team requested edit access for [client]"
    if (msg.includes('CST team requested edit access for ')) {
      return '/renewals?search=' + encodeURIComponent(msg.split('CST team requested edit access for ')[1].trim());
    }
    
    // 2. Edit Approved: "Edit approved for [client]"
    if (msg.includes('Edit approved for ')) {
      return '/renewals?search=' + encodeURIComponent(msg.split('Edit approved for ')[1].trim());
    }

    // 3. New renewal created: "New renewal created for [client] ([service])..."
    if (msg.includes('New renewal created for ')) {
      const after = msg.split('New renewal created for ')[1];
      const client = after.split(' (')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    // 4. Follow-Up Required: "Please meet [client] regarding [service]..."
    if (msg.includes('Please meet ')) {
      const after = msg.split('Please meet ')[1];
      const client = after.split(' regarding')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    // 5. Email Sent: "[N]-day reminder sent for [client] ([service])."
    if (msg.includes(' reminder sent for ')) {
      const after = msg.split(' reminder sent for ')[1];
      const client = after.split(' (')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    // 6. Renewal Expired: "[client]'s [service] renewal has expired."
    if (msg.includes("'s ") && msg.includes(" renewal has expired")) {
      const client = msg.split("'s ")[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    // 7. Client Renewed: "Renewal processed for [client]."
    if (msg.includes('Renewal processed for ')) {
      const after = msg.split('Renewal processed for ')[1];
      const client = after.split('.')[0];
      return '/renewals?search=' + encodeURIComponent(client.trim());
    }

    return null;
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    const path = extractClientFromNotification(notif);
    if (path) {
      navigate(path);
      setShowNotifications(false);
      setIsNotificationsModalOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = [
    {
      label: null, // No label for primary section
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Renewals', path: '/renewals', icon: FileText },
        { name: 'Pricing', path: '/pricing', icon: Tag },
      ],
    },
    {
      label: 'Communication',
      items: [
        { name: 'Notifications', path: '/notifications', icon: Bell },
        { name: 'Approval Inbox', path: '/approval-inbox', icon: ShieldCheck },
        { name: 'Email Automation', path: '/automation', icon: Mail },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { name: (user?.role === 'super_admin' || user?.role === 'dept_admin') ? 'Reports & Logs' : 'Reports', path: '/reports', icon: BarChart3 },
        { name: 'Record Details', path: '/edits-history', icon: History },
        { name: 'Visit Tracking', path: '/visits', icon: MapPin },
      ],
    },
    ...((user?.role === 'super_admin' || user?.role === 'dept_admin') ? [{
      label: 'Administration',
      items: [
        { name: 'Guardian Health', path: '/agent-health', icon: ShieldAlert },
        { name: 'User Management', path: '/admin/users', icon: Users },
        { name: 'Trash Data', path: '/trash', icon: Trash2 },
      ],
    }] : []),
  ];

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const hoverTimeoutRef = useRef(null);

  const handleSidebarMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoveredSidebar(true);
  };

  const handleSidebarMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoveredSidebar(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  /* Hover detection zone on the left edge of the viewport (for desktop only) */
  return (
    <div className="flex h-screen relative overflow-hidden selection:bg-indigo-500/30">
      {/* Dynamic Version Update Notification Banner */}
      <VersionNotifier />
      {/* Floating AI Agent Assistant */}
      <AgentDrawer />

      {/* Seamless Single Background Layer */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-amber-100/90 via-orange-50/90 to-rose-100/90 dark:from-[#0c0a12] dark:via-[#0e111a] dark:to-[#170c14] transition-colors duration-300 ease-in-out z-0" />

      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-300/30 dark:bg-amber-700/15 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute top-1/2 right-0 w-80 h-80 rounded-full bg-orange-300/25 dark:bg-orange-800/10 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-rose-300/25 dark:bg-rose-800/10 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute top-1/4 left-1/2 w-64 h-64 rounded-full bg-amber-200/20 dark:bg-amber-900/10 blur-3xl transition-colors duration-300 ease-in-out" />
      </div>

      {/* Mobile sidebar backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Hover detection zone on the left edge of the viewport (for desktop only) */}
      <div 
        className={`fixed inset-y-0 left-0 w-4 z-20 hidden lg:block ${isSidebarPinned ? 'pointer-events-none' : ''}`}
        onMouseEnter={handleSidebarMouseEnter} 
      />
 
      <div
        ref={sidebarRef}
        className={`flex flex-col w-[268px] flex-shrink-0 fixed inset-y-0 left-0 z-30 transform-gpu transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarPinned || isHoveredSidebar || isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        style={{
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* ── Sidebar Header / Logo ── */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0"
          style={{
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="RMT Dashboard"
          >
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white transition-transform duration-300 group-hover:scale-105">
              RMT
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const newVal = !isSidebarPinned;
                setIsSidebarPinned(newVal);
                localStorage.setItem('sidebar_pinned', String(newVal));
              }}
              title={isSidebarPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
              className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-250 border cursor-pointer ${
                isSidebarPinned
                  ? 'sidebar-pin-active'
                  : 'sidebar-pin-inactive'
              }`}
            >
              <Pin 
                className={`w-3.5 h-3.5 transition-transform duration-200 ${isSidebarPinned ? 'rotate-45' : '-rotate-45'}`} 
              />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1.5 sidebar-scroll">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className={sIdx > 0 ? 'mt-2.5' : ''}>
              {section.label && (
                <div className="px-2 mb-1 flex items-center gap-2">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-stone-400/80 dark:text-gray-500">
                    {section.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-stone-300/40 to-transparent dark:from-white/10 dark:to-transparent" />
                </div>
              )}
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      className={({ isActive }) =>
                        `sidebar-nav-item group ${isActive ? 'sidebar-nav-active' : 'sidebar-nav-inactive'}`
                      }
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active accent bar */}
                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-300 ${
                            isActive ? 'h-4 bg-brand-500 dark:bg-brand-400 shadow-[0_0_8px_rgba(var(--brand-rgb),0.4)]' : 'h-0 bg-transparent'
                          }`} />
                          <div className={`sidebar-nav-icon ${isActive ? 'sidebar-nav-icon-active' : ''}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[12.5px] font-medium transition-colors duration-200 ${
                            isActive ? 'text-gray-900 dark:text-white' : 'text-stone-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'
                          }`}>
                            {item.name}
                          </span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* ── Sidebar Footer ── */}
        <div className="sidebar-footer">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400 dark:text-gray-500">
              System
            </span>
            <span className="sidebar-version-badge">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 flex flex-col min-w-0 overflow-hidden transform-gpu transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${(isSidebarPinned || isHoveredSidebar) ? 'lg:pl-[268px]' : 'lg:pl-0'}`} 
        style={{ position: 'relative' }}
      >
        {/* Top Header */}
        <header
          className="h-14 flex items-center justify-between px-5 z-20 sticky top-0 backdrop-blur-xl bg-[#f8f0e6]/60 dark:bg-[#14101e]/60 transition-colors duration-300"
          style={{
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          {/* ── LEFT: Home + Role Badge ── */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span
              className={`text-base font-bold tracking-tight text-gray-900 dark:text-white cursor-pointer mr-1 ${(isSidebarPinned || isHoveredSidebar) ? 'lg:hidden' : ''}`}
              onClick={() => navigate('/')}
              title="Go to Dashboard"
            >
              RMT
            </span>
            <button
              onClick={() => navigate('/')}
              title="Go to Dashboard"
              className="dropdown-btn-glass h-8 px-2.5 text-xs"
            >
              <Home className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span className="hidden sm:inline font-semibold">Home</span>
            </button>
          </div>

          {/* ── CENTER: Global Search (hidden on the Dashboard — it has its own controls) ── */}
          {location.pathname !== '/' && (
            <div className="hidden md:flex flex-1 justify-center px-4">
              <form onSubmit={handleHeaderSearch} className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 dark:text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder="Search renewals and clients"
                  className="input-field w-full h-9 pl-9 pr-3 text-xs"
                />
              </form>
            </div>
          )}

          {/* ── RIGHT: Create + Role Badge + Theme + Bell + Profile ── */}
          <div className="flex items-center gap-2.5">

            {/* Quick Create (hidden on the Dashboard — it has its own Create Renewal button) */}
            {location.pathname !== '/' && ((user?.role === 'super_admin' || user?.role === 'dept_admin') || user?.role === 'user') && (
              <button
                onClick={() => navigate('/renewals?create=1')}
                className="btn-primary hidden sm:flex items-center gap-1.5 h-9 px-3 text-xs whitespace-nowrap"
                title="Create a new renewal"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            )}

            {/* Scope Indicator — what this account is actually scoped to */}
            {(user?.departmentName || user?.categoryName) && (
              <span
                className="hidden md:inline-flex items-center h-8 px-2.5 rounded-xl text-[11px] font-semibold tracking-wide bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-slate-600 dark:text-slate-300 whitespace-nowrap"
                title="Your account's visibility scope"
              >
                Viewing: {user?.departmentName || 'All Departments'}{user?.categoryName ? ` → ${user.categoryName}` : ''}
              </span>
            )}

            {/* Role Badge */}
            <span className={`hidden sm:inline-flex items-center h-8 px-2.5 rounded-xl text-[11px] font-semibold tracking-wide ${getRoleBadgeStyle(user?.role)}`}>
              {getRoleLabel(user?.role)}
            </span>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
              title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              <div className="relative w-4 h-4 flex items-center justify-center">
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 rotate-0 scale-100" />
                )}
              </div>
            </button>

            {/* Notifications */}
            <div ref={notificationsRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="dropdown-btn-glass flex items-center justify-center relative h-9 w-9 !px-0 rounded-xl"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-surface-900 rounded-full" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 dropdown-menu-glass z-50">
                  <div className="px-4 py-3 flex justify-between items-center border-b border-black/[0.06] dark:border-white/[0.08]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No notifications right now.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer transition-colors ${
                            !notif.read ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''
                          }`}
                        >
                          <div className="flex gap-3 items-start">
                            <div className="mt-0.5">
                              {getNotificationIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs ${!notif.read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                                {notif.message}
                              </p>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block">
                                {formatTimeAgo(notif.created_at)}
                              </span>
                            </div>
                            {!notif.read && (
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                    <button
                      onClick={() => { navigate('/notifications'); setShowNotifications(false); }}
                      className="w-full text-center text-xs font-medium text-red-500 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div ref={profileDropdownRef} className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="dropdown-btn-glass h-9 pl-1.5 pr-3 rounded-xl"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                  style={{
                    background: (user?.role === 'super_admin' || user?.role === 'dept_admin')
                      ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                      : 'linear-gradient(135deg,#10b981,#047857)',
                  }}
                >
                  {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none ml-2">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">
                    {user?.fullName}
                  </span>
                  <span className="text-[10px] mt-0.5 truncate max-w-[110px] text-gray-500 dark:text-gray-400">
                    {user?.email || `${getRoleLabel(user?.role)?.toLowerCase()}@marslab...`}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3 h-3 hidden sm:block ml-2 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                    showProfileDropdown ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              {showProfileDropdown && (
                <div
                  className="absolute right-0 mt-2 w-60 dropdown-menu-glass z-50"
                >
                  <div className="px-4 py-3.5 flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                      style={{
                        background: (user?.role === 'super_admin' || user?.role === 'dept_admin')
                          ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                          : 'linear-gradient(135deg,#10b981,#047857)',
                      }}
                    >
                      {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex flex-col leading-snug overflow-hidden">
                      <span className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                        {user?.fullName}
                      </span>
                      <span className="text-xs truncate mt-0.5 text-gray-500 dark:text-gray-400">
                        {user?.email || 'marslab.in'}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 self-start ${getRoleBadgeStyle(user?.role)}`}>
                        {getRoleLabel(user?.role)}
                      </span>
                    </div>
                  </div>
                  {(user?.role === 'super_admin' || user?.role === 'dept_admin') && (
                    <div className="px-3 py-2.5 flex flex-col gap-2 border-b border-black/[0.06] dark:border-white/[0.08]">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Email Automation
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${automationStatus === 'start' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="text-[10px] font-semibold" style={{ color: automationStatus === 'start' ? '#10b981' : '#ef4444' }}>
                            {automationStatus === 'start' ? 'Active' : 'Stopped'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setAutomationAction(automationStatus === 'start' ? 'stop' : 'start');
                          setAutomationNote('');
                          setIsAutomationModalOpen(true);
                        }}
                        className={`flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          automationStatus === 'start'
                            ? 'bg-rose-50/50 hover:bg-rose-100/60 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
                            : 'bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {automationStatus === 'start' ? 'Stop Scheduler' : 'Start Scheduler'}
                      </button>
                    </div>
                  )}
                  <div className="p-2">
                    <button
                      onClick={() => { setShowProfileDropdown(false); handleLogout(); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Watermark credit (fixed, every page) ── */}
      <div className="fixed bottom-2 left-2 z-10 pointer-events-none select-none text-[11px] text-stone-400/70 dark:text-stone-500/50 tracking-wide">
        Built by @marslab
      </div>

      {/* ── Floating Expiry Reason Widget (Sales/CST only) ── */}
      {user?.role === 'user' && expiredNoReason.length > 0 && createPortal(
        <div
          id="expiry-widget"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '8px',
          }}
        >
          {/* Expanded Panel */}
          {isWidgetOpen && (
            <div
              style={{
                width: '360px',
                maxHeight: '520px',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                border: '1px solid rgba(239,68,68,0.30)',
                background: isDarkMode
                  ? 'rgba(24,20,20,0.92)'
                  : 'rgba(255,252,252,0.96)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                animation: 'slideUpFade 0.25s ease-out',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: isDarkMode ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(239,68,68,0.15)',
                background: isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(255,241,241,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{
                      position: 'absolute', display: 'inline-flex', height: '100%', width: '100%',
                      borderRadius: '50%', background: '#f87171', opacity: 0.6,
                      animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite'
                    }} />
                    <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '10px', width: '10px', background: '#ef4444' }} />
                  </span>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: isDarkMode ? '#fca5a5' : '#dc2626', margin: 0 }}>
                      Action Required
                    </p>
                    <p style={{ fontSize: '10px', color: isDarkMode ? '#a1a1aa' : '#71717a', margin: 0 }}>
                      {expiredNoReason.length} expired renewal{expiredNoReason.length > 1 ? 's' : ''} need a reason
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWidgetOpen(false)}
                  title="Minimise"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                    color: isDarkMode ? '#a1a1aa' : '#9f9f9f',
                    borderRadius: '6px',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {/* Renewals List */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {expiredNoReason.map((renewal) => (
                  <div
                    key={renewal.id}
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <button
                          onClick={() => navigate(`/renewals?search=${encodeURIComponent(renewal.unique_id)}`)}
                          title="View record details"
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, margin: 0,
                            color: isDarkMode ? '#93c5fd' : '#2563eb',
                            textDecoration: 'underline', textUnderlineOffset: '3px',
                            textDecorationStyle: 'dashed',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = isDarkMode ? '#bfdbfe' : '#1d4ed8'}
                          onMouseLeave={e => e.currentTarget.style.color = isDarkMode ? '#93c5fd' : '#2563eb'}
                        >
                          {renewal.client_name}
                        </button>
                        <p style={{ fontSize: '11px', color: isDarkMode ? '#71717a' : '#a1a1aa', margin: '2px 0 0 0' }}>
                          {renewal.service} · <span style={{ fontFamily: 'monospace' }}>{renewal.unique_id}</span>
                        </p>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: '#ef4444',
                        background: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        padding: '2px 8px', borderRadius: '99px',
                      }}>
                        Expired {new Date(renewal.renewal_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Reason: budget issue / migration / client request…"
                      value={expiryReasons[renewal.id] || ''}
                      onChange={(e) => setExpiryReasons(prev => ({ ...prev, [renewal.id]: e.target.value }))}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        fontSize: '12px', padding: '8px 10px',
                        borderRadius: '8px', resize: 'vertical',
                        outline: 'none',
                        border: isDarkMode ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(239,68,68,0.25)',
                        background: isDarkMode ? 'rgba(0,0,0,0.3)' : '#fff',
                        color: isDarkMode ? '#f4f4f5' : '#18181b',
                        fontFamily: 'inherit',
                        lineHeight: 1.5,
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        disabled={submittingExpiry[renewal.id] || !(expiryReasons[renewal.id] || '').trim()}
                        onClick={async () => {
                          const reason = expiryReasons[renewal.id];
                          if (!reason?.trim()) return;
                          setSubmittingExpiry(prev => ({ ...prev, [renewal.id]: true }));
                          try {
                            const response = await fetch(`/api/renewals/${renewal.id}/expiry-reason`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ expiry_reason: reason })
                            });
                            if (response.ok) {
                              toast.success(`Reason saved for ${renewal.client_name}`);
                              setExpiredNoReason(prev => {
                                const updated = prev.filter(r => r.id !== renewal.id);
                                if (updated.length === 0) setIsWidgetOpen(false);
                                return updated;
                              });
                              setExpiryReasons(prev => { const c = { ...prev }; delete c[renewal.id]; return c; });
                            } else {
                              const err = await response.json();
                              toast.error(err.error || 'Failed to save reason');
                            }
                          } catch { toast.error('Network error'); }
                          finally { setSubmittingExpiry(prev => ({ ...prev, [renewal.id]: false })); }
                        }}
                        style={{
                          padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                          borderRadius: '7px', border: 'none', cursor: 'pointer',
                          background: (submittingExpiry[renewal.id] || !(expiryReasons[renewal.id] || '').trim())
                            ? (isDarkMode ? '#3f3f46' : '#e4e4e7')
                            : '#ef4444',
                          color: (submittingExpiry[renewal.id] || !(expiryReasons[renewal.id] || '').trim())
                            ? (isDarkMode ? '#71717a' : '#a1a1aa')
                            : '#fff',
                          transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        {submittingExpiry[renewal.id]
                          ? <><span style={{ display:'inline-block', width:10, height:10, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.6s linear infinite' }} /> Saving…</>
                          : 'Submit Reason'
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px',
                borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                display: 'flex', justifyContent: 'flex-end',
                background: isDarkMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
              }}>
                <button
                  onClick={handleRemindLater}
                  style={{
                    padding: '6px 14px', fontSize: '11px', fontWeight: 600,
                    borderRadius: '7px', cursor: 'pointer',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
                    background: 'transparent',
                    color: isDarkMode ? '#a1a1aa' : '#71717a',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    transition: 'all 0.15s',
                  }}
                >
                  <Clock size={12} /> Remind Me in 1 Hour
                </button>
              </div>
            </div>
          )}

          {/* Minimised FAB */}
          <button
            id="expiry-widget-fab"
            onClick={() => setIsWidgetOpen(v => !v)}
            title={isWidgetOpen ? 'Minimise' : 'Expired renewals need attention'}
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(239,68,68,0.55)',
              position: 'relative',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {/* Ping ring */}
            {!isWidgetOpen && (
              <span style={{
                position:'absolute', inset:0, borderRadius:'50%',
                border: '2px solid rgba(239,68,68,0.7)',
                animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
              }} />
            )}
            <AlertTriangle size={20} color="#fff" />
            {/* Badge */}
            <span style={{
              position:'absolute', top:-4, right:-4,
              background:'#18181b', color:'#ef4444',
              fontSize:'10px', fontWeight:700,
              borderRadius:'99px', padding:'1px 5px',
              border:'1.5px solid #ef4444',
              minWidth:'16px', textAlign:'center',
            }}>
              {expiredNoReason.length}
            </span>
          </button>

          {/* CSS animations injected once */}
          <style>{`
            @keyframes slideUpFade {
              from { opacity:0; transform:translateY(16px) scale(0.97); }
              to   { opacity:1; transform:translateY(0) scale(1); }
            }
            @keyframes ping {
              75%, 100% { transform: scale(2); opacity: 0; }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>,
        document.body
      )}

      {/* ── Email Automation Controller Modal ── */}
      {isAutomationModalOpen && createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-surface-200/80 dark:border-surface-800 overflow-hidden transform scale-100 transition-all duration-300">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                  Confirm Automation Update
                </h3>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                Are you sure you want to <strong className={automationAction === 'start' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {automationAction === 'start' ? 'START / RESUME' : 'STOP / PAUSE'}
                </strong> the outbound email scheduler?
              </p>
              
              <form onSubmit={handleToggleAutomation} className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-semibold text-surface-500 mb-1.5 uppercase tracking-wider">
                    Reason / Note for this action
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={automationNote}
                    onChange={(e) => setAutomationNote(e.target.value)}
                    placeholder="e.g. Starting automatic reminders after staging, pausing for server maintenance..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/40 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
                
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAutomationModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={automationSubmitting}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md ${
                      automationAction === 'start'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10'
                    }`}
                  >
                    {automationSubmitting ? 'Updating...' : 'Submit & Acknowledge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
