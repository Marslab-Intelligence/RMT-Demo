import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Safe lazy import wrapper that automatically retries and refreshes the page on chunk load failures after app deployments
const safeLazy = (importFn) => {
  return lazy(() => 
    importFn().catch((err) => {
      console.warn('Chunk loading failed for route module. Reloading page to fetch updated deployment...', err);
      const lastReload = sessionStorage.getItem('chunk_last_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('chunk_last_reload', now.toString());
        window.location.reload();
      }
      return new Promise(() => {}); // Hold until page reloads
    })
  );
};

// Lazy-loaded pages for optimized bundle splitting
const Login = safeLazy(() => import('./pages/Login'));
const Dashboard = safeLazy(() => import('./pages/Dashboard'));
const RenewalsList = safeLazy(() => import('./pages/RenewalsList'));
const Reports = safeLazy(() => import('./pages/Reports'));
const Settings = safeLazy(() => import('./pages/Settings'));
const EditsHistory = safeLazy(() => import('./pages/EditsHistory'));
const Trash = safeLazy(() => import('./pages/Trash'));
const Notifications = safeLazy(() => import('./pages/Notifications'));
const ActivityLogs = safeLazy(() => import('./pages/ActivityLogs'));
const Visits = safeLazy(() => import('./pages/Visits'));
const EmailAutomation = safeLazy(() => import('./pages/EmailAutomation'));
const ClientDetails = safeLazy(() => import('./pages/ClientDetails'));
const Pricing = safeLazy(() => import('./pages/Pricing'));
const ApprovalInbox = safeLazy(() => import('./pages/ApprovalInbox'));
const AgentHealth = safeLazy(() => import('./pages/AgentHealth'));
const Departments = safeLazy(() => import('./pages/Departments'));
const DepartmentAnalytics = safeLazy(() => import('./pages/DepartmentAnalytics'));

// CEO Executive Pages
const CeoLayout = safeLazy(() => import('./components/ceo/CeoLayout'));
const CeoDashboard = safeLazy(() => import('./pages/ceo/CeoDashboard'));
const CeoCompanyPerformance = safeLazy(() => import('./pages/ceo/CeoCompanyPerformance'));
const CeoDepartments = safeLazy(() => import('./pages/ceo/CeoDepartments'));

const CeoServices = safeLazy(() => import('./pages/ceo/CeoServices'));
const CeoVendors = safeLazy(() => import('./pages/ceo/CeoVendors'));
const CeoRenewals = safeLazy(() => import('./pages/ceo/CeoRenewals'));
const CeoTrends = safeLazy(() => import('./pages/ceo/CeoTrends'));
const CeoForecastOutlook = safeLazy(() => import('./pages/ceo/CeoForecastOutlook'));
const CeoRiskAttention = safeLazy(() => import('./pages/ceo/CeoRiskAttention'));
const CeoReports = safeLazy(() => import('./pages/ceo/CeoReports'));
const CeoHealthDetail = safeLazy(() => import('./pages/ceo/CeoHealthDetail'));

const PageLoader = () => (
  <div className="min-h-[60vh] w-full flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
      <span className="text-xs font-medium text-surface-400">Loading...</span>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-surface-50 dark:bg-surface-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ceo') return <Navigate to="/ceo/dashboard" replace />;
  return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-surface-50 dark:bg-surface-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ceo') return <Navigate to="/ceo/dashboard" replace />;
  if (user.role !== 'super_admin' && user.role !== 'dept_admin') return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

const CeoRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-surface-50 dark:bg-surface-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ceo' && user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <CeoLayout>{children}</CeoLayout>;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* CEO Executive Intelligence Cockpit Routes */}
          <Route path="/ceo" element={<Navigate to="/ceo/dashboard" replace />} />
          <Route path="/ceo/dashboard" element={<CeoRoute><CeoDashboard /></CeoRoute>} />
          <Route path="/ceo/performance" element={<CeoRoute><CeoCompanyPerformance /></CeoRoute>} />
          <Route path="/ceo/departments" element={<CeoRoute><CeoDepartments /></CeoRoute>} />
          <Route path="/ceo/products" element={<Navigate to="/ceo/services" replace />} />
          <Route path="/ceo/services" element={<CeoRoute><CeoServices /></CeoRoute>} />
          <Route path="/ceo/vendors" element={<CeoRoute><CeoVendors /></CeoRoute>} />
          <Route path="/ceo/renewals" element={<CeoRoute><CeoRenewals /></CeoRoute>} />
          <Route path="/ceo/trends" element={<CeoRoute><CeoTrends /></CeoRoute>} />
          <Route path="/ceo/forecast" element={<CeoRoute><CeoForecastOutlook /></CeoRoute>} />
          <Route path="/ceo/attention" element={<CeoRoute><CeoRiskAttention /></CeoRoute>} />
          <Route path="/ceo/reports" element={<CeoRoute><CeoReports /></CeoRoute>} />
          <Route path="/ceo/health" element={<CeoRoute><CeoHealthDetail /></CeoRoute>} />

          {/* Operational Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/renewals" element={<ProtectedRoute><RenewalsList /></ProtectedRoute>} />
          <Route path="/renewals/:id" element={<ProtectedRoute><ClientDetails /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/edits-history" element={<ProtectedRoute><EditsHistory /></ProtectedRoute>} />
          <Route path="/trash" element={<AdminRoute><Trash /></AdminRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/activity-logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
          <Route path="/visits" element={<ProtectedRoute><Visits /></ProtectedRoute>} />
          <Route path="/automation" element={<ProtectedRoute><EmailAutomation /></ProtectedRoute>} />
          <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
          <Route path="/approval-inbox" element={<Navigate to="/" replace />} />
          <Route path="/agent-health" element={<Navigate to="/" replace />} />
          
          <Route path="/analytics" element={<AdminRoute><DepartmentAnalytics /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><Departments /></AdminRoute>} />
          <Route path="/admin/departments" element={<Navigate to="/admin/users" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
