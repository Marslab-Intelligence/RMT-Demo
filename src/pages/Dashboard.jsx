import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import SuperAdminDashboard from './superadmin/SuperAdminDashboard';
import AdminDashboard from './admin/AdminDashboard';
import UserDashboard from './user/UserDashboard';

/**
 * Intelligent Role-Based Dashboard Dispatcher.
 * Dispatches each role to their dedicated work environment:
 * - CEO -> /ceo/dashboard (Handled by router)
 * - super_admin -> SuperAdminDashboard (Platform Control Center)
 * - dept_admin  -> AdminDashboard (Operations Management Center)
 * - user        -> UserDashboard (Personal Productivity Workspace)
 */
export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'ceo') {
    return <Navigate to="/ceo/dashboard" replace />;
  }

  if (user.role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  if (user.role === 'dept_admin') {
    return <AdminDashboard />;
  }

  // Default 'user' (Specialist)
  return <UserDashboard />;
}
