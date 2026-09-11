import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDateTime, formatTimeAgo } from '../utils/formatters';
import VersionNotifier from './VersionNotifier';
import AgentDrawer from './AgentDrawer';
import ChatGptSidebar from './common/ChatGptSidebar';
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
  ShieldCheck,
  ShieldAlert,
  Moon,
  Sun,
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
  CheckCircle2,
  Info,
  TrendingUp,
  BookOpen,
  ChevronRight
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

const getNotificationIcon = (type) => {
  switch (type) {
    case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    case 'error': return <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />;
    default: return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
};


export default function Layout({ children }) {
  const { user, logout, token, getValidToken } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const navSections = React.useMemo(() => {
    if (user?.role === 'super_admin') {
      return [
        {
          label: 'Platform Control',
          items: [
            { name: 'Control Center', path: '/', icon: LayoutDashboard },
            { name: 'Master Renewals', path: '/renewals', icon: FileText },
            { name: 'Pricing Calculator', path: '/pricing', icon: Tag },
          ],
        },
        {
          label: 'Governance & Security',
          items: [
            { name: 'User Management', path: '/admin/users', icon: Users },
            { name: 'Platform Audit Logs', path: '/activity-logs', icon: History },
            { name: 'Trash Recovery', path: '/trash', icon: Trash2 },
          ],
        },
        {
          label: 'Operations & Alerts',
          items: [
            { name: 'Email Automation', path: '/automation', icon: Mail },
            { name: 'Notifications', path: '/notifications', icon: Bell },
          ],
        },
        {
          label: 'Analytics',
          items: [
            { name: 'Platform Reports', path: '/reports', icon: BarChart3 },
            { name: 'Team Performance', path: '/analytics', icon: TrendingUp },
            { name: 'Visit Tracking', path: '/visits', icon: MapPin },
          ],
        },
      ];
    }

    if (user?.role === 'dept_admin') {
      return [
        {
          label: 'Operations',
          items: [
            { name: 'Operations Center', path: '/', icon: LayoutDashboard },
            { name: 'Renewals Work Queue', path: '/renewals', icon: FileText },
            { name: 'Pricing Calculator', path: '/pricing', icon: Tag },
          ],
        },
        {
          label: 'Management & Review',
          items: [
            { name: 'Specialists Roster', path: '/admin/users', icon: Users },
            { name: 'Team Performance', path: '/analytics', icon: TrendingUp },
            { name: 'Client Visits', path: '/visits', icon: MapPin },
          ],
        },
        {
          label: 'Reporting & Alerts',
          items: [
            { name: 'Department Reports', path: '/reports', icon: BarChart3 },
            { name: 'Email Automation', path: '/automation', icon: Mail },
            { name: 'Notifications', path: '/notifications', icon: Bell },
          ],
        },
      ];
    }

    // Default 'user' (Specialist)
    return [
      {
        label: 'My Workspace',
        items: [
          { name: 'My Dashboard', path: '/', icon: LayoutDashboard },
          { name: 'My Renewals', path: '/renewals', icon: FileText },
          { name: 'Pricing Calculator', path: '/pricing', icon: Tag },
        ],
      },
      {
        label: 'Field & Alerts',
        items: [
          { name: 'My Client Visits', path: '/visits', icon: MapPin },
          { name: 'Notifications', path: '/notifications', icon: Bell },
        ],
      },
    ];
  }, [user?.role]);

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  /* Hover detection zone on the left edge of the viewport (for desktop only) */
  return (
    <div className="flex h-screen relative overflow-hidden selection:bg-indigo-500/30">
      {/* Dynamic Version Update Notification Banner */}
      <VersionNotifier />
      {/* Floating AI Agent Assistant */}
      <AgentDrawer />

      {/* Seamless Single Background Layer — Elegant Dark / Minimal Light */}
      <div 
        className="fixed inset-0 pointer-events-none transition-colors duration-300 ease-in-out z-0" 
        style={{ 
          backgroundColor: 'var(--app-bg)', 
          backgroundImage: 'var(--app-bg-image)', 
          backgroundAttachment: 'fixed' 
        }} 
      />

      {/* Decorative blobs — brand/violet/cyan ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-300/30 dark:bg-brand-700/15 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute top-1/2 right-0 w-80 h-80 rounded-full bg-violet-300/25 dark:bg-violet-800/10 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-cyan-300/25 dark:bg-cyan-800/10 blur-3xl transition-colors duration-300 ease-in-out" />
        <div className="absolute top-1/4 left-1/2 w-64 h-64 rounded-full bg-brand-200/20 dark:bg-brand-900/10 blur-3xl transition-colors duration-300 ease-in-out" />
      </div>

      {/* ChatGPT-style Universal Sidebar for Super Admin, Dept Admin, and User */}
      <ChatGptSidebar
        sections={navSections}
        user={user}
        roleBadge={getRoleLabel(user?.role)}
        appTitle="RMT"
        homePath="/"
        isPinned={isSidebarPinned}
        onTogglePin={(pinned) => {
          setIsSidebarPinned(pinned);
          localStorage.setItem('sidebar_pinned', String(pinned));
        }}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => {
          const nextDark = !isDarkMode;
          setIsDarkMode(nextDark);
          if (nextDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
          }
        }}
        automationStatus={automationStatus}
        onToggleAutomationAction={(action) => {
          setAutomationAction(action);
          setAutomationNote('');
          setIsAutomationModalOpen(true);
        }}
      />

      {/* ── Main Layout Column ── */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSidebarPinned ? 'lg:pl-[260px]' : 'lg:pl-14'
        }`}
      >
        {/* Floating Top-Right Notification Button */}
        <div className="fixed top-3.5 right-4 sm:right-6 z-40">
          <div ref={notificationsRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="dropdown-btn-glass flex items-center justify-center relative h-9 w-9 !px-0 rounded-xl shadow-xs"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-surface-900 rounded-full" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 dropdown-menu-glass z-50 shadow-2xl">
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
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden fixed top-3.5 left-4 z-40 p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 dropdown-btn-glass flex items-center justify-center h-9 w-9 shadow-xs"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <main className="flex-1 overflow-y-auto p-4 pt-14 sm:p-6 sm:pr-16 custom-scrollbar relative">
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
