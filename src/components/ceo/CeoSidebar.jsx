import React from 'react';
import ChatGptSidebar from '../common/ChatGptSidebar';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  TrendingUp,
  Building2,
  Package,
  Store,
  Calendar,
  LineChart,
  AlertOctagon,
  FileBarChart,
} from 'lucide-react';

const ceoNavItems = [
  { name: 'Executive Overview', path: '/ceo/dashboard', icon: LayoutDashboard },
  { name: 'Company Performance', path: '/ceo/performance', icon: TrendingUp },
  { name: 'Departments', path: '/ceo/departments', icon: Building2 },
  { name: 'Products & Services', path: '/ceo/services', icon: Package },
  { name: 'Vendors', path: '/ceo/vendors', icon: Store },
  { name: 'Renewals', path: '/ceo/renewals', icon: Calendar },
  { name: 'Forecast & Outlook', path: '/ceo/forecast', icon: LineChart },
  { name: 'Risks & Attention', path: '/ceo/attention', icon: AlertOctagon },
  { name: 'Reports', path: '/ceo/reports', icon: FileBarChart },
];

export default function CeoSidebar({
  isMobileOpen,
  onCloseMobile,
  isPinned,
  onTogglePin,
  isDarkMode,
  onToggleDarkMode,
}) {
  const { user, logout } = useAuth();

  return (
    <ChatGptSidebar
      items={ceoNavItems}
      user={user || { name: 'Executive Leadership', role: 'CEO' }}
      roleBadge="CEO"
      appTitle="RMT"
      homePath="/ceo/dashboard"
      isPinned={isPinned}
      onTogglePin={onTogglePin}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
      onLogout={logout}
      isDarkMode={isDarkMode}
      onToggleDarkMode={onToggleDarkMode}
    />
  );
}
