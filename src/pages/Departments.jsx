import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Building2,
  Plus,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  Tag,
  Users as UsersIcon,
  Power,
  ShieldCheck,
  Trash2,
  FilePlus,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Edit2,
  AlertCircle,
  RefreshCw,
  Layers,
  CheckCircle2,
  Shield,
  FolderPlus,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import RenewalForm from '../components/RenewalForm';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';
}

export default function Departments() {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Data states
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Department expand & active tab state
  const [expanded, setExpanded] = useState(null); // department id currently expanded
  const [deptTab, setDeptTab] = useState({}); // { [deptId]: 'services' | 'admins' }
  const [services, setServices] = useState({}); // { [departmentId]: [service, ...] }
  const [servicesLoading, setServicesLoading] = useState({});

  // Toolbar states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc' | 'name-desc' | 'services' | 'users' | 'created'

  // Context Menu state (uses Portal so it never clips under cards or overflow boundaries)
  const [menuAnchor, setMenuAnchor] = useState(null); // { dept, top, right } or null
  const menuRef = useRef(null);

  // Modals state
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);

  const [editDept, setEditDept] = useState(null); // dept object or null
  const [editDeptName, setEditDeptName] = useState('');
  const [submittingEditDept, setSubmittingEditDept] = useState(false);

  const [addServiceFor, setAddServiceFor] = useState(null); // department id or null
  const [serviceName, setServiceName] = useState('');
  const [submittingService, setSubmittingService] = useState(false);

  const [addAdminFor, setAddAdminFor] = useState(null); // department id or null
  const [addUserFor, setAddUserFor] = useState(null); // { departmentId, categoryId, categoryName } or null
  const [addRenewalFor, setAddRenewalFor] = useState(null); // { departmentId, categoryId } or null
  const [personForm, setPersonForm] = useState({ full_name: '', email: '' });
  const [submittingPerson, setSubmittingPerson] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  // Close context menu on click outside, scroll, or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (e.target.closest && e.target.closest('[data-actions-trigger]')) {
          return;
        }
        setMenuAnchor(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuAnchor(null);
      }
    };
    const handleScrollOrResize = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAnchor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load departments');
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      setError(err.message || 'Failed to load departments');
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch {
      toast.error('Failed to load users');
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, [fetchDepartments, fetchUsers]);

  // Map dept admins by department_id
  const deptAdminsByDept = useMemo(() => {
    const map = {};
    for (const u of allUsers) {
      if (u.role !== 'dept_admin' || !u.department_id) continue;
      (map[u.department_id] ||= []).push(u);
    }
    return map;
  }, [allUsers]);

  // Map users by category_id (service)
  const usersByCategory = useMemo(() => {
    const map = {};
    for (const u of allUsers) {
      if (u.role !== 'user' || !u.category_id) continue;
      (map[u.category_id] ||= []).push(u);
    }
    return map;
  }, [allUsers]);

  // Fetch services for a specific department
  const fetchServices = useCallback(async (departmentId) => {
    setServicesLoading(p => ({ ...p, [departmentId]: true }));
    try {
      const res = await fetch(`/api/departments/${departmentId}/services`, { headers: { Authorization: `Bearer ${token}` } });
      const data = res.ok ? await res.json() : [];
      setServices(p => ({ ...p, [departmentId]: data }));
    } catch {
      toast.error('Failed to load services');
    } finally {
      setServicesLoading(p => ({ ...p, [departmentId]: false }));
    }
  }, [token]);

  // Expand / collapse department row
  const toggleExpand = (dept) => {
    if (expanded === dept.id) {
      setExpanded(null);
      return;
    }
    setExpanded(dept.id);
    if (!deptTab[dept.id]) {
      setDeptTab(prev => ({ ...prev, [dept.id]: 'services' }));
    }
    if (!services[dept.id]) {
      fetchServices(dept.id);
    }
  };

  // Create department
  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSubmittingDept(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: deptName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create department');
        return;
      }
      toast.success(`Department "${data.name}" created`);
      setAddDeptOpen(false);
      setDeptName('');
      fetchDepartments();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingDept(false);
    }
  };

  // Edit (rename) department
  const handleEditDepartment = async (e) => {
    e.preventDefault();
    if (!editDeptName.trim() || !editDept) return;
    setSubmittingEditDept(true);
    try {
      const res = await fetch(`/api/departments/${editDept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editDeptName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update department');
        return;
      }
      toast.success(`Department renamed to "${data.name}"`);
      setEditDept(null);
      setEditDeptName('');
      fetchDepartments();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingEditDept(false);
    }
  };

  // Toggle department active status
  const handleToggleDeptActive = async (dept) => {
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !dept.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update department');
        return;
      }
      toast.success(`Department ${data.is_active ? 'activated' : 'deactivated'}`);
      setMenuAnchor(null);
      fetchDepartments();
    } catch {
      toast.error('Network error');
    }
  };

  // Create service
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!serviceName.trim() || !addServiceFor) return;
    setSubmittingService(true);
    try {
      const res = await fetch(`/api/departments/${addServiceFor}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: serviceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create service');
        return;
      }
      toast.success(`Service "${data.name}" created`);
      setAddServiceFor(null);
      setServiceName('');
      fetchServices(addServiceFor);
      fetchDepartments();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingService(false);
    }
  };

  // Toggle service active status
  const handleToggleServiceActive = async (departmentId, service) => {
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !service.is_active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update service');
        return;
      }
      toast.success(`Service ${data.is_active ? 'activated' : 'deactivated'}`);
      fetchServices(departmentId);
    } catch {
      toast.error('Network error');
    }
  };

  // Open modals
  const openAddAdmin = (departmentId) => {
    setPersonForm({ full_name: '', email: '' });
    setAddAdminFor(departmentId);
    setMenuAnchor(null);
  };

  const openAddUser = (departmentId, service) => {
    setPersonForm({ full_name: '', email: '' });
    setAddUserFor({ departmentId, categoryId: service.id, categoryName: service.name });
  };

  const openEditDept = (dept) => {
    setEditDept(dept);
    setEditDeptName(dept.name);
    setMenuAnchor(null);
  };

  // Add dept admin
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!personForm.full_name.trim() || !personForm.email.trim()) return;
    setSubmittingPerson(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...personForm, role: 'dept_admin', department_id: addAdminFor }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add admin');
        return;
      }
      toast.success(`${data.full_name} added as department admin`);
      setAddAdminFor(null);
      fetchUsers();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingPerson(false);
    }
  };

  // Add user to service
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!personForm.full_name.trim() || !personForm.email.trim() || !addUserFor) return;
    setSubmittingPerson(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...personForm,
          role: 'user',
          department_id: addUserFor.departmentId,
          category_id: addUserFor.categoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add user');
        return;
      }
      toast.success(`${data.full_name} added to ${addUserFor.categoryName}`);
      setAddUserFor(null);
      fetchUsers();
      fetchDepartments();
    } catch {
      toast.error('Network error');
    } finally {
      setSubmittingPerson(false);
    }
  };

  // Remove person
  const handleRemovePerson = async (u) => {
    if (u.id === user?.id) return;
    if (!window.confirm(`Remove ${u.full_name} from the system? This cannot be undone.`)) return;
    setRemovingUserId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove');
        return;
      }
      toast.success(`${u.full_name} removed`);
      fetchUsers();
      fetchDepartments();
    } catch {
      toast.error('Network error');
    } finally {
      setRemovingUserId(null);
    }
  };

  // Summary statistics calculations
  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const activeDepts = departments.filter(d => d.is_active).length;
    const totalServices = departments.reduce((acc, d) => acc + (parseInt(d.service_count, 10) || 0), 0);
    // Count unique users assigned to departments
    const assignedUsers = allUsers.filter(u => u.department_id != null);
    const totalUsers = assignedUsers.length;
    return {
      totalDepts,
      activeDepts,
      totalServices,
      totalUsers,
    };
  }, [departments, allUsers]);

  // Filtering & Sorting
  const filteredDepartments = useMemo(() => {
    let result = [...departments];

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter(d => d.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter(d => !d.is_active);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => {
        const nameMatch = d.name?.toLowerCase().includes(q);
        const adminList = deptAdminsByDept[d.id] || [];
        const adminMatch = adminList.some(a => a.full_name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q));
        const serviceList = services[d.id] || [];
        const serviceMatch = serviceList.some(s => s.name?.toLowerCase().includes(q));
        return nameMatch || adminMatch || serviceMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'services') {
        const sA = parseInt(a.service_count, 10) || 0;
        const sB = parseInt(b.service_count, 10) || 0;
        return sB - sA;
      }
      if (sortBy === 'users') {
        const uA = parseInt(a.user_count, 10) || 0;
        const uB = parseInt(b.user_count, 10) || 0;
        return uB - uA;
      }
      if (sortBy === 'created') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

    return result;
  }, [departments, statusFilter, searchQuery, sortBy, deptAdminsByDept, services]);

  // Full Skeleton Loader State
  if (loading) {
    return (
      <div className="space-y-6 w-full pb-16 animate-pulse">
        {/* Breadcrumbs & Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-32 bg-slate-200 dark:bg-white/10 rounded" />
            <div className="h-7 w-56 bg-slate-200 dark:bg-white/10 rounded-lg" />
            <div className="h-4 w-96 max-w-full bg-slate-200 dark:bg-white/10 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-48 bg-slate-200 dark:bg-white/10 rounded-xl" />
            <div className="h-9 w-36 bg-slate-200 dark:bg-white/10 rounded-xl" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-white/5 p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/10 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded" />
                <div className="h-6 w-12 bg-slate-200 dark:bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar Skeleton */}
        <div className="h-14 rounded-2xl bg-white/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-white/5 px-4 flex items-center justify-between gap-4">
          <div className="h-8 w-64 bg-slate-200 dark:bg-white/10 rounded-xl" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-slate-200 dark:bg-white/10 rounded-xl" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-white/10 rounded-xl" />
          </div>
        </div>

        {/* Department Rows Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/10 p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-5 h-5 rounded bg-slate-200 dark:bg-white/10" />
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-white/10 rounded" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-white/10 rounded" />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-6">
                <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded" />
                <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded" />
                <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && departments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-xl p-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Unable to load departments</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
            Something went wrong while retrieving department information. Check your network or permissions and try again.
          </p>
          <button
            onClick={() => { setLoading(true); fetchDepartments(); fetchUsers(); }}
            className="btn-primary px-5 py-2.5 flex items-center gap-2 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-16 animate-fade-in">
      {/* ── 1. Page Header with Primary Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Title & Subtitle */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              User Management
            </h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Enterprise Console
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            {isSuperAdmin
              ? 'Manage departments, administrators, services, and team members.'
              : 'Manage the services and team members in your department.'}
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap sm:flex-nowrap">
          {/* Quick Filter Search in Header */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search departments…"
              className="pl-8 pr-8 py-2 w-48 sm:w-60 text-xs rounded-xl border border-slate-200/80 dark:border-white/15 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Department CTA */}
          {isSuperAdmin && (
            <button
              onClick={() => setAddDeptOpen(true)}
              className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2 text-xs shadow-md shadow-brand-500/10 hover:shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Department</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Summary Statistics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Departments */}
        <div className="group rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Total Departments
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight mt-0.5">
              {stats.totalDepts}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              {stats.activeDepts} active
            </p>
          </div>
        </div>

        {/* Total Services */}
        <div className="group rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Total Services
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight mt-0.5">
              {stats.totalServices}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Across all units
            </p>
          </div>
        </div>

        {/* Total Users */}
        <div className="group rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex-shrink-0">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Total Users
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight mt-0.5">
              {stats.totalUsers}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Assigned team members
            </p>
          </div>
        </div>

        {/* Active Departments */}
        <div className="group rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              Active Departments
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight mt-0.5">
              {stats.activeDepts}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              {stats.totalDepts > 0 ? `${Math.round((stats.activeDepts / stats.totalDepts) * 100)}% operational` : 'No units'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Department Management Section Header & Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Departments
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {departments.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage department access, service hierarchy, and assigned staff.
            </p>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{filteredDepartments.length}</span> of {departments.length} departments
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by department name, admin, or service…"
              className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Filters & Sort */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-1 shadow-sm">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  statusFilter === 'inactive'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                }`}
              >
                Inactive
              </button>
            </div>

            {/* Sort Control */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="select-glass pl-3 pr-8 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 cursor-pointer shadow-sm"
              >
                <option value="name-asc">Name A → Z</option>
                <option value="name-desc">Name Z → A</option>
                <option value="services">Most Services</option>
                <option value="users">Most Users</option>
                <option value="created">Recently Created</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Department Rows List & Expanded Details ── */}
      {departments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-12 text-center">
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="Create your first department to start organizing services, administrators, and team members."
            action={
              isSuperAdmin && (
                <button
                  onClick={() => setAddDeptOpen(true)}
                  className="btn-primary mt-2 flex items-center gap-1.5 px-4 py-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Department</span>
                </button>
              )
            }
          />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-12 text-center">
          <EmptyState
            icon={Search}
            title="No matching departments"
            description="No departments match your current search and filter criteria. Try resetting your search or changing the status filter."
            action={
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="btn-secondary mt-2 text-xs px-4 py-2"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDepartments.map(dept => {
            const deptAdmins = deptAdminsByDept[dept.id] || [];
            const isExpanded = expanded === dept.id;
            const currentTab = deptTab[dept.id] || 'services';

            return (
              <div
                key={dept.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? 'border-brand-500/40 dark:border-brand-500/30 bg-white/90 dark:bg-slate-900/80 shadow-xl shadow-brand-500/5 ring-1 ring-brand-500/20'
                    : 'border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white/90 dark:hover:bg-slate-900/75 shadow-md shadow-black/[0.02]'
                }`}
              >
                {/* ── Compact Department Row Header ── */}
                <div
                  onClick={() => toggleExpand(dept)}
                  className="px-4 sm:px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  role="button"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(dept);
                    }
                  }}
                >
                  {/* Left Column: Chevron + Icon + Name + Status */}
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpand(dept);
                      }}
                      className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      aria-label={isExpanded ? 'Collapse department details' : 'Expand department details'}
                    >
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-90 text-brand-600 dark:text-brand-400' : ''
                        }`}
                      />
                    </button>

                    <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center flex-shrink-0 font-bold shadow-xs">
                      <Building2 className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
                          {dept.name}
                        </h3>
                        {dept.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center Column: Services Count + Users Count + Admin Info */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap md:flex-nowrap text-xs text-slate-600 dark:text-slate-300">
                    {/* Services Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 font-semibold text-slate-700 dark:text-slate-300">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>{dept.service_count || 0} service{dept.service_count === '1' ? '' : 's'}</span>
                    </div>

                    {/* Users Pill */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 font-semibold text-slate-700 dark:text-slate-300">
                      <UsersIcon className="w-3 h-3 text-slate-400" />
                      <span>{dept.user_count || 0} user{dept.user_count === '1' ? '' : 's'}</span>
                    </div>

                    {/* Admin Indicator */}
                    <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                      {deptAdmins.length > 0 ? (
                        <>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 shadow-xs ring-1 ring-white/20"
                            style={{ background: deptAdmins[0].avatar_color || '#4f91a8' }}
                          >
                            {getInitials(deptAdmins[0].full_name)}
                          </div>
                          <div className="truncate">
                            <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              {deptAdmins[0].full_name}
                            </p>
                            {deptAdmins.length > 1 && (
                              <p className="text-[10px] text-slate-400">+{deptAdmins.length - 1} more</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] italic">
                          <Shield className="w-3.5 h-3.5 opacity-60" />
                          <span>No admin</span>
                        </div>
                      )}
                    </div>

                    {/* Right Context Menu Button */}
                    <div className="relative ml-auto md:ml-0">
                      <button
                        type="button"
                        data-actions-trigger="true"
                        onClick={e => {
                          e.stopPropagation();
                          const btn = e.currentTarget;
                          setMenuAnchor(prev => {
                            if (prev?.dept?.id === dept.id) {
                              return null;
                            }
                            const rect = btn.getBoundingClientRect();
                            const menuHeight = 240;
                            const wouldOverflowBottom = rect.bottom + menuHeight > window.innerHeight;
                            return {
                              dept,
                              top: wouldOverflowBottom ? Math.max(10, rect.top - menuHeight) : rect.bottom + 6,
                              right: Math.max(10, window.innerWidth - rect.right),
                            };
                          });
                        }}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          menuAnchor?.dept?.id === dept.id
                            ? 'bg-slate-100 dark:bg-white/15 border-slate-300 dark:border-white/20 text-brand-600 dark:text-brand-400 shadow-xs'
                            : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400'
                        }`}
                        aria-label="Department actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── 5. Expandable Nested Department Details ── */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-4 border-t border-slate-200/70 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/30 space-y-4">
                    {/* Top Nested Action Bar with Navigation Tabs */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
                      {/* Tabs */}
                      <div className="flex items-center gap-1.5 p-1 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/60 dark:border-white/5 self-start shadow-xs">
                        <button
                          type="button"
                          onClick={() => setDeptTab(p => ({ ...p, [dept.id]: 'services' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            currentTab === 'services'
                              ? 'bg-brand-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>Services & Team</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            currentTab === 'services' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                          }`}>
                            {dept.service_count || 0}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeptTab(p => ({ ...p, [dept.id]: 'admins' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            currentTab === 'admins'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Department Admins</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            currentTab === 'admins' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'
                          }`}>
                            {deptAdmins.length}
                          </span>
                        </button>
                      </div>

                      {/* Quick CTA Buttons inside expanded header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAddRenewalFor({ departmentId: dept.id })}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-colors shadow-xs"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                          <span>New Renewal</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAddServiceFor(dept.id)}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 transition-colors shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Service</span>
                        </button>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => openAddAdmin(dept.id)}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-colors shadow-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Assign Admin</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tab 1: Services & Team Members */}
                    {currentTab === 'services' && (
                      <div>
                        {servicesLoading[dept.id] ? (
                          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-2" />
                            <p className="text-xs">Loading services…</p>
                          </div>
                        ) : (services[dept.id]?.length ?? 0) === 0 ? (
                          <div className="py-8 text-center bg-white/60 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-white/5 p-6">
                            <EmptyState
                              icon={Tag}
                              title="No services in this department"
                              description="Create services (such as AWS, Google Workspace, or Antivirus) to organize your renewals and staff."
                              compact
                              action={
                                <button
                                  type="button"
                                  onClick={() => setAddServiceFor(dept.id)}
                                  className="btn-primary text-xs px-3.5 py-1.5 mt-2 flex items-center gap-1.5 mx-auto"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add First Service</span>
                                </button>
                              }
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {services[dept.id].map(svc => {
                              const svcUsers = usersByCategory[svc.id] || [];
                              return (
                                <div
                                  key={svc.id}
                                  className="bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-xs flex flex-col justify-between"
                                >
                                  {/* Service Row Header */}
                                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200/60 dark:border-white/5">
                                    <div className="min-w-0 flex items-center gap-2">
                                      <Tag className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                            {svc.name}
                                          </p>
                                          {!svc.is_active && (
                                            <StatusBadge status="expired" label="Inactive" size="xs" />
                                          )}
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                          {svcUsers.length} assigned member{svcUsers.length === 1 ? '' : 's'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setAddRenewalFor({ departmentId: dept.id, categoryId: svc.id })}
                                        className="text-[10px] font-bold px-2 py-1 rounded-lg text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1"
                                        title={`Add renewal record for ${svc.name}`}
                                      >
                                        <FilePlus className="w-3 h-3" />
                                        <span className="hidden sm:inline">Add Record</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => openAddUser(dept.id, svc)}
                                        className="text-[10px] font-bold px-2 py-1 rounded-lg text-brand-600 dark:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-colors flex items-center gap-1"
                                        title={`Assign user to ${svc.name}`}
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span className="hidden sm:inline">Add User</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleServiceActive(dept.id, svc)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                                          svc.is_active
                                            ? 'border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                                            : 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                        }`}
                                        title={svc.is_active ? 'Deactivate service' : 'Activate service'}
                                      >
                                        {svc.is_active ? 'Deactivate' : 'Activate'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Assigned Users list */}
                                  <div className="p-2 space-y-1">
                                    {svcUsers.length === 0 ? (
                                      <p className="text-[11px] text-slate-400 italic px-2 py-2">
                                        No users assigned to this service yet.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-slate-100 dark:divide-white/5">
                                        {svcUsers.map(u => (
                                          <PersonRow
                                            key={u.id}
                                            person={u}
                                            onRemove={handleRemovePerson}
                                            removing={removingUserId === u.id}
                                            disableRemove={u.id === user?.id}
                                            badgeText="Staff"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Department Admins */}
                    {currentTab === 'admins' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                              Assigned Department Administrators
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Department admins have full administrative control over renewals, services, and users in this department.
                            </p>
                          </div>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => openAddAdmin(dept.id)}
                              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Assign New Admin</span>
                            </button>
                          )}
                        </div>

                        {deptAdmins.length === 0 ? (
                          <div className="p-6 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-white/5 text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              No department administrator currently assigned.
                            </p>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                onClick={() => openAddAdmin(dept.id)}
                                className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Assign an admin now</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
                            {deptAdmins.map(a => (
                              <PersonRow
                                key={a.id}
                                person={a}
                                onRemove={handleRemovePerson}
                                removing={removingUserId === a.id}
                                disableRemove={a.id === user?.id}
                                badgeText="Dept Admin"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Department Modal ── */}
      {addDeptOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddDeptOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">New Department</h3>
                  <p className="text-[11px] text-slate-400">Create a top-level department organization unit.</p>
                </div>
              </div>
              <button
                onClick={() => setAddDeptOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddDepartment} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  type="text"
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  placeholder="e.g. Cloud Renewals"
                  className="input-field"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Assign a department admin after creating this department.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddDeptOpen(false)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDept}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submittingDept && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingDept ? 'Creating…' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit (Rename) Department Modal ── */}
      {editDept && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditDept(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Rename Department</h3>
                  <p className="text-[11px] text-slate-400">Update the display name for this department.</p>
                </div>
              </div>
              <button
                onClick={() => setEditDept(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditDepartment} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  type="text"
                  value={editDeptName}
                  onChange={e => setEditDeptName(e.target.value)}
                  placeholder="e.g. Cloud Infrastructure"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditDept(null)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditDept}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submittingEditDept && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingEditDept ? 'Saving…' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── New Service Modal ── */}
      {addServiceFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddServiceFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">New Service</h3>
                  <p className="text-[11px] text-slate-400">Add a product or renewal category.</p>
                </div>
              </div>
              <button
                onClick={() => setAddServiceFor(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddService} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  placeholder="e.g. AWS Cloud, Microsoft 365, Seqrite"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddServiceFor(null)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingService}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submittingService && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingService ? 'Creating…' : 'Create Service'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Assign Department Admin Modal ── */}
      {addAdminFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddAdminFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Assign Department Admin</h3>
                  <p className="text-[11px] text-slate-400">Grant administrative control for this department.</p>
                </div>
              </div>
              <button
                onClick={() => setAddAdminFor(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={personForm.full_name}
                  onChange={e => setPersonForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Aditi Sharma"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={personForm.email}
                  onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="name@company.com"
                  className="input-field"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddAdminFor(null)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPerson}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submittingPerson && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingPerson ? 'Adding…' : 'Assign Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add User (into a service) Modal ── */}
      {addUserFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddUserFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <UsersIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Add Team Member</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assigning to <span className="font-bold text-brand-600 dark:text-brand-400">{addUserFor.categoryName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddUserFor(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={personForm.full_name}
                  onChange={e => setPersonForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Rohan Mehta"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={personForm.email}
                  onChange={e => setPersonForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="name@company.com"
                  className="input-field"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This user will only see renewals assigned to {addUserFor.categoryName}.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddUserFor(null)} className="btn-secondary flex-1 py-2.5">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPerson}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submittingPerson && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingPerson ? 'Adding…' : 'Add Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Context Menu Portal (never gets clipped by card overflow) ── */}
      {menuAnchor && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuAnchor.top}px`,
            right: `${menuAnchor.right}px`,
            zIndex: 99999,
          }}
          className="w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200/80 dark:border-white/15 py-1.5 animate-in fade-in-50 zoom-in-95 backdrop-blur-xl"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const targetDept = menuAnchor.dept;
              setMenuAnchor(null);
              toggleExpand(targetDept);
            }}
            className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 text-left transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span>{expanded === menuAnchor.dept.id ? 'Collapse Details' : 'View Details'}</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                const targetDept = menuAnchor.dept;
                setMenuAnchor(null);
                openEditDept(targetDept);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 text-left transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Rename Department</span>
            </button>
          )}

          {isSuperAdmin && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                const targetDeptId = menuAnchor.dept.id;
                setMenuAnchor(null);
                openAddAdmin(targetDeptId);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 flex items-center gap-2 text-left transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Assign Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const targetDeptId = menuAnchor.dept.id;
              setMenuAnchor(null);
              setAddServiceFor(targetDeptId);
            }}
            className="w-full px-3.5 py-2 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 flex items-center gap-2 text-left transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Service</span>
          </button>

          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const targetDeptId = menuAnchor.dept.id;
              setMenuAnchor(null);
              setAddRenewalFor({ departmentId: targetDeptId });
            }}
            className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2 text-left transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Add Renewal</span>
          </button>

          {isSuperAdmin && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-white/10" />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  const targetDept = menuAnchor.dept;
                  setMenuAnchor(null);
                  handleToggleDeptActive(targetDept);
                }}
                className={`w-full px-3.5 py-2 text-xs font-bold flex items-center gap-2 text-left transition-colors ${
                  menuAnchor.dept.is_active
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{menuAnchor.dept.is_active ? 'Deactivate Department' : 'Activate Department'}</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* ── Add Renewal Record modal ── */}
      {addRenewalFor && (
        <RenewalForm
          initialDepartmentId={addRenewalFor.departmentId}
          initialCategoryId={addRenewalFor.categoryId}
          onClose={() => setAddRenewalFor(null)}
          onSuccess={() => {
            setAddRenewalFor(null);
            toast.success('Renewal record added successfully.');
          }}
        />
      )}
    </div>
  );
}

// ── Reusable Compact Person Row Component ──
function PersonRow({ person, onRemove, removing, disableRemove, badgeText = null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors rounded-lg group">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-xs ring-1 ring-white/20"
          style={{ background: person.avatar_color || '#4f91a8' }}
        >
          {getInitials(person.full_name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {person.full_name}
            </p>
            {badgeText && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {badgeText}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
            {person.email}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(person)}
        disabled={removing || disableRemove}
        className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        title={disableRemove ? 'Cannot remove currently signed-in account' : `Remove ${person.full_name}`}
        aria-label={`Remove ${person.full_name}`}
      >
        {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
