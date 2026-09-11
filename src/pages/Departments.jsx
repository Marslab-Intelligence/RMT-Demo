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
  ChevronUp,
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
  UserCheck,
  LayoutGrid,
  Columns,
  List,
  Sparkles,
  TrendingUp,
  Activity,
  Mail,
  SlidersHorizontal,
  ExternalLink,
  Crown
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

  // View Mode: 'grid' (Bento Matrix) | 'split' (Command Console) | 'table' (Density List)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('rmt_dept_view_mode') || 'grid';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('rmt_dept_view_mode', mode);
  };

  // Selected department for Split Console mode
  const [selectedDeptId, setSelectedDeptId] = useState(null);

  // Department expand & active tab state for Grid / List mode
  const [expanded, setExpanded] = useState(null);
  const [deptTab, setDeptTab] = useState({}); // { [deptId]: 'services' | 'admins' }
  const [services, setServices] = useState({}); // { [departmentId]: [service, ...] }
  const [servicesLoading, setServicesLoading] = useState({});

  // Split Console Services scroll & expand state (limiting to 2-3 rows)
  const servicesScrollRef = useRef(null);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);

  const scrollServices = (direction) => {
    if (!servicesScrollRef.current) return;
    const scrollAmount = direction === 'down' ? 240 : -240;
    servicesScrollRef.current.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  };

  // Toolbar states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy] = useState('name-asc');

  // Context Menu state
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuRef = useRef(null);

  // Modals state
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);

  const [editDept, setEditDept] = useState(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [submittingEditDept, setSubmittingEditDept] = useState(false);

  const [addServiceFor, setAddServiceFor] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [submittingService, setSubmittingService] = useState(false);

  const [addAdminFor, setAddAdminFor] = useState(null);
  const [addUserFor, setAddUserFor] = useState(null);
  const [addRenewalFor, setAddRenewalFor] = useState(null);
  const [personForm, setPersonForm] = useState({ full_name: '', email: '' });
  const [submittingPerson, setSubmittingPerson] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (e.target.closest && e.target.closest('[data-actions-trigger]')) return;
        setMenuAnchor(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuAnchor(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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

  // Map users by department_id
  const usersByDept = useMemo(() => {
    const map = {};
    for (const u of allUsers) {
      if (!u.department_id) continue;
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
    if (!departmentId) return;
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

  // Expand / collapse department
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

  // Open modal triggers
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

  // Summary statistics
  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const activeDepts = departments.filter(d => d.is_active).length;
    const totalServices = departments.reduce((acc, d) => acc + (parseInt(d.service_count, 10) || 0), 0);
    const assignedUsers = allUsers.filter(u => u.department_id != null);
    const totalUsers = assignedUsers.length;
    const healthPercent = totalDepts > 0 ? Math.round((activeDepts / totalDepts) * 100) : 100;
    return {
      totalDepts,
      activeDepts,
      totalServices,
      totalUsers,
      healthPercent
    };
  }, [departments, allUsers]);

  // Filtering & Sorting
  const filteredDepartments = useMemo(() => {
    let result = [...departments];

    if (statusFilter === 'active') {
      result = result.filter(d => d.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter(d => !d.is_active);
    }

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

  // Keep selected department valid for split console
  useEffect(() => {
    if (filteredDepartments.length > 0) {
      if (!selectedDeptId || !filteredDepartments.some(d => d.id === selectedDeptId)) {
        setSelectedDeptId(filteredDepartments[0].id);
      }
    }
  }, [filteredDepartments, selectedDeptId]);

  // Load services for currently selected split-mode department
  useEffect(() => {
    if (viewMode === 'split' && selectedDeptId && !services[selectedDeptId]) {
      fetchServices(selectedDeptId);
    }
  }, [viewMode, selectedDeptId, services, fetchServices]);

  const activeSelectedDept = useMemo(() => {
    return departments.find(d => d.id === selectedDeptId) || filteredDepartments[0] || null;
  }, [departments, selectedDeptId, filteredDepartments]);

  // Full Skeleton Loader State
  if (loading) {
    return (
      <div className="space-y-6 w-full pb-16 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-56 bg-slate-200 dark:bg-white/10 rounded-xl" />
            <div className="h-3.5 w-80 bg-slate-200 dark:bg-white/10 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-40 bg-slate-200 dark:bg-white/10 rounded-xl" />
            <div className="h-10 w-36 bg-slate-200 dark:bg-white/10 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-white/5 p-4 flex items-center gap-3.5" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/10 p-5" />
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && departments.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 backdrop-blur-2xl p-8 text-center flex flex-col items-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20 shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Unable to Load Fleet Units</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1.5 mb-6 leading-relaxed">
            Could not retrieve department hierarchies and team member rosters. Please verify your connection or administrative token.
          </p>
          <button
            onClick={() => { setLoading(true); fetchDepartments(); fetchUsers(); }}
            className="btn-primary px-6 py-2.5 flex items-center gap-2 text-xs shadow-lg shadow-brand-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reconnect System</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-20 animate-fade-in">
      {/* ── 1. Hero Command Deck Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/10 bg-gradient-to-br from-white/90 via-slate-50/80 to-brand-50/30 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-brand-950/20 backdrop-blur-2xl p-6 sm:p-7 shadow-sm">
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 w-80 h-80 rounded-full bg-brand-500/10 dark:bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-purple-500/10 dark:bg-purple-500/15 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/10 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30 shadow-xs">
                <Sparkles className="w-3 h-3 text-brand-500" />
                Enterprise Fleet Command
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Role-Based Access Active
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
              Department & Team Hub
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Orchestrate department divisions, service assignment matrices, and team access credentials across all operational units.
            </p>
          </div>

          {/* Primary Action Button */}
          {isSuperAdmin && (
            <div className="flex items-center gap-3 self-start lg:self-center flex-shrink-0">
              <button
                onClick={() => setAddDeptOpen(true)}
                className="btn-primary flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Department</span>
              </button>
            </div>
          )}
        </div>

        {/* ── 2. Interactive Executive KPI Metric Deck ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5 mt-6 pt-6 border-t border-slate-200/60 dark:border-white/10">
          {/* Total Departments */}
          <div
            onClick={() => setStatusFilter('all')}
            className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-brand-500/10 border-brand-500/40 dark:bg-brand-500/15 shadow-md shadow-brand-500/10'
                : 'bg-white/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-white/10 hover:border-brand-500/30 hover:bg-white/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Fleet Units</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {stats.totalDepts}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {stats.activeDepts} operational departments
              </p>
            </div>
          </div>

          {/* Total Services */}
          <div className="group relative overflow-hidden rounded-2xl border p-4 bg-white/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-white/10 hover:border-emerald-500/30 hover:bg-white/90 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Services</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {stats.totalServices}
              </div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Across all departments
              </p>
            </div>
          </div>

          {/* Total Assigned Team Members */}
          <div className="group relative overflow-hidden rounded-2xl border p-4 bg-white/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-white/10 hover:border-purple-500/30 hover:bg-white/90 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Team Force</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <UsersIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {stats.totalUsers}
              </div>
              <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                Active credentialed members
              </p>
            </div>
          </div>

          {/* Operational Health */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                : 'bg-white/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-white/10 hover:border-emerald-500/30 hover:bg-white/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Health Index</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {stats.healthPercent}%
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {stats.activeDepts}/{stats.totalDepts} active units
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. High-Tech Toolbar: View Switcher, Search & Filters ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
        {/* Left: Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by department name, admin lead, or service…"
            className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Status Filters, Sort, and Dual-View Mode Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between md:justify-end">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-slate-950/60 p-1 shadow-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({departments.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="select-glass pl-3 pr-8 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="services">Most Services</option>
            <option value="users">Most Users</option>
            <option value="created">Recently Created</option>
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-slate-950/60 p-1 shadow-xs">
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Bento Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Bento</span>
            </button>

            <button
              onClick={() => handleSetViewMode('split')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'split'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Command Console View"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Console</span>
            </button>

            <button
              onClick={() => handleSetViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-brand-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Density Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Main Views (Grid, Split Console, Table) ── */}
      {departments.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-12 text-center shadow-sm">
          <EmptyState
            icon={Building2}
            title="No departments initialized"
            description="Create your first department division to begin deploying services and assigning credentialed operators."
            action={
              isSuperAdmin && (
                <button
                  onClick={() => setAddDeptOpen(true)}
                  className="btn-primary mt-3 flex items-center gap-2 px-5 py-2.5 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Department</span>
                </button>
              )
            }
          />
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl p-12 text-center shadow-sm">
          <EmptyState
            icon={Search}
            title="No matching departments found"
            description="No departments meet your current search query or filter constraints."
            action={
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="btn-secondary mt-3 text-xs px-4 py-2 mx-auto"
              >
                Reset Search Filters
              </button>
            }
          />
        </div>
      ) : viewMode === 'grid' ? (
        /* ── VIEW 1: BENTO MATRIX (Modular Spatial Cards) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDepartments.map(dept => {
            const deptAdmins = deptAdminsByDept[dept.id] || [];
            const deptUsers = usersByDept[dept.id] || [];
            const deptServices = services[dept.id] || [];
            const isExpanded = expanded === dept.id;

            return (
              <div
                key={dept.id}
                className={`group relative overflow-hidden rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
                  dept.is_active
                    ? 'border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-500/5'
                    : 'border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/40 opacity-80'
                } backdrop-blur-xl`}
              >
                {/* Top Status Ambient Gradient Line */}
                <div
                  className={`h-1.5 w-full bg-gradient-to-r ${
                    dept.is_active
                      ? 'from-brand-500 via-emerald-500 to-teal-400'
                      : 'from-slate-400 to-slate-600 dark:from-slate-700 dark:to-slate-800'
                  }`}
                />

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Card Header: Icon + Name + Status + Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500/15 to-purple-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/25 flex items-center justify-center font-black text-sm shadow-inner flex-shrink-0">
                        {dept.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {dept.name}
                          </h3>
                          {isSuperAdmin && (
                            <button
                              onClick={() => openEditDept(dept)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-brand-600 transition-all"
                              title="Rename Department"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Unit #{dept.id}</span>
                          <span>•</span>
                          <span>{dept.service_count || 0} services registered</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Active Status Toggle Pill */}
                      <button
                        onClick={() => isSuperAdmin && handleToggleDeptActive(dept)}
                        disabled={!isSuperAdmin}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                          dept.is_active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        } ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                        title={isSuperAdmin ? 'Click to toggle status' : undefined}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dept.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </button>

                      {/* Context Menu Button */}
                      <button
                        type="button"
                        data-actions-trigger="true"
                        onClick={e => {
                          e.stopPropagation();
                          const btn = e.currentTarget;
                          setMenuAnchor(prev => {
                            if (prev?.dept?.id === dept.id) return null;
                            const rect = btn.getBoundingClientRect();
                            return {
                              dept,
                              top: rect.bottom + 6,
                              right: Math.max(10, window.innerWidth - rect.right),
                            };
                          });
                        }}
                        className="p-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Department Leadership Banner */}
                  <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {deptAdmins.length > 0 ? (
                        <>
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-xs ring-2 ring-white dark:ring-slate-900"
                            style={{ background: deptAdmins[0].avatar_color || '#4f91a8' }}
                          >
                            {getInitials(deptAdmins[0].full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {deptAdmins[0].full_name}
                              </p>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              Department Admin {deptAdmins.length > 1 ? `(+${deptAdmins.length - 1})` : ''}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs">
                          <Shield className="w-4 h-4 text-slate-400 opacity-60" />
                          <span className="italic text-[11px]">No assigned admin</span>
                        </div>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <button
                        onClick={() => openAddAdmin(dept.id)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-brand-500 text-slate-700 dark:text-slate-300 hover:text-brand-600 transition-colors flex-shrink-0"
                      >
                        {deptAdmins.length > 0 ? '+ Add Admin' : '+ Assign'}
                      </button>
                    )}
                  </div>

                  {/* Team Avatars Cluster & Capacity Meter */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-2 overflow-hidden py-1">
                        {deptUsers.slice(0, 4).map(u => (
                          <div
                            key={u.id}
                            title={`${u.full_name} (${u.role})`}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 shadow-xs"
                            style={{ background: u.avatar_color || '#3b82f6' }}
                          >
                            {getInitials(u.full_name)}
                          </div>
                        ))}
                        {deptUsers.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                            +{deptUsers.length - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1.5">
                        {deptUsers.length} member{deptUsers.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg bg-slate-100/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-brand-500" />
                      <span>{dept.service_count || 0} Service Units</span>
                    </div>
                  </div>

                  {/* Expandable Services Drawer */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Service Ecosystem</span>
                        <button
                          onClick={() => setAddServiceFor(dept.id)}
                          className="text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Service
                        </button>
                      </div>

                      {servicesLoading[dept.id] ? (
                        <div className="flex items-center justify-center py-4 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          <span className="text-xs">Loading services…</span>
                        </div>
                      ) : (services[dept.id]?.length ?? 0) === 0 ? (
                        <div className="text-center py-4 bg-slate-100/50 dark:bg-slate-950/30 rounded-xl p-3">
                          <p className="text-xs text-slate-400">No services configured yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {services[dept.id].map(svc => {
                            const svcUsers = usersByCategory[svc.id] || [];
                            return (
                              <div
                                key={svc.id}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2 shadow-xs"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{svc.name}</p>
                                  <p className="text-[10px] text-slate-400">{svcUsers.length} assigned member{svcUsers.length === 1 ? '' : 's'}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setAddRenewalFor({ departmentId: dept.id, categoryId: svc.id })}
                                    className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold flex items-center gap-1 px-2"
                                    title="Add Renewal Record"
                                  >
                                    <FilePlus className="w-3 h-3" /> Record
                                  </button>
                                  <button
                                    onClick={() => openAddUser(dept.id, svc)}
                                    className="p-1 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 text-[10px] font-bold flex items-center gap-1 px-2"
                                    title="Add Member"
                                  >
                                    <Plus className="w-3 h-3" /> Member
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Bar */}
                <div className="px-5 py-3 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3">
                  <button
                    onClick={() => toggleExpand(dept)}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Ecosystem' : 'Inspect Ecosystem'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedDeptId(dept.id);
                      handleSetViewMode('split');
                    }}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-200/60 dark:bg-white/10 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 transition-all flex items-center gap-1"
                  >
                    <span>Command Deck</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'split' ? (
        /* ── VIEW 2: COMMAND CONSOLE (Master-Detail Split Pane) ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Department Fleet Navigator (4 Cols) */}
          <div className="lg:col-span-4 rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-4 shadow-sm space-y-2.5 max-h-[750px] overflow-y-auto custom-scrollbar">
            <div className="px-2 py-1 flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Fleet Units ({filteredDepartments.length})</span>
              <span className="text-[10px] text-brand-500 font-bold">Select to Inspect</span>
            </div>

            {filteredDepartments.map(dept => {
              const isSelected = activeSelectedDept?.id === dept.id;
              const deptAdmins = deptAdminsByDept[dept.id] || [];

              return (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/40 shadow-md shadow-brand-500/10 ring-1 ring-brand-500/30'
                      : 'border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-slate-950/30 hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dept.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{dept.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {dept.service_count || 0} services • {dept.user_count || 0} users
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full ${dept.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-brand-500' : 'text-slate-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Department Detail Deck (8 Cols) */}
          <div className="lg:col-span-8 space-y-5">
            {activeSelectedDept ? (
              <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-sm space-y-6">
                {/* Active Dept Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/60 dark:border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-brand-500/25">
                      {activeSelectedDept.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {activeSelectedDept.name}
                        </h2>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          activeSelectedDept.is_active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${activeSelectedDept.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {activeSelectedDept.is_active ? 'Active Unit' : 'Inactive Unit'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Division ID #{activeSelectedDept.id} • Created {new Date(activeSelectedDept.created_at || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setAddServiceFor(activeSelectedDept.id)}
                      className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Service</span>
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => openAddAdmin(activeSelectedDept.id)}
                        className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                        <span>Assign Admin</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-tabs: Services vs Admins */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-white/5">
                      <button
                        onClick={() => setDeptTab(p => ({ ...p, [activeSelectedDept.id]: 'services' }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                          (deptTab[activeSelectedDept.id] || 'services') === 'services'
                            ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5 text-brand-500" />
                        <span>Services & Products</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-white/10">
                          {activeSelectedDept.service_count || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => setDeptTab(p => ({ ...p, [activeSelectedDept.id]: 'admins' }))}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                          deptTab[activeSelectedDept.id] === 'admins'
                            ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                        <span>Leadership & Admins</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-white/10">
                          {(deptAdminsByDept[activeSelectedDept.id] || []).length}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Services Navigation / Scroll Controls */}
                      {(deptTab[activeSelectedDept.id] || 'services') === 'services' && (services[activeSelectedDept.id]?.length || 0) > 4 && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => scrollServices('up')}
                            className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Scroll services up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollServices('down')}
                            className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Scroll services down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsServicesExpanded(p => !p)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border-l border-slate-200 dark:border-white/10 ml-0.5 pl-2"
                            title={isServicesExpanded ? "Lock to 2-3 rows scrollable" : "Expand all rows"}
                          >
                            {isServicesExpanded ? 'Compact (3 Rows)' : 'Expand All'}
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => setAddRenewalFor({ departmentId: activeSelectedDept.id })}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <FilePlus className="w-3.5 h-3.5" />
                        <span>Create Renewal</span>
                      </button>
                    </div>
                  </div>

                  {/* Tab 1 Content: Services Grid */}
                  {(deptTab[activeSelectedDept.id] || 'services') === 'services' && (
                    <div>
                      {servicesLoading[activeSelectedDept.id] ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin text-brand-500 mb-2" />
                          <p className="text-xs font-semibold">Retrieving service hierarchy…</p>
                        </div>
                      ) : (services[activeSelectedDept.id]?.length ?? 0) === 0 ? (
                        <div className="py-12 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/60 dark:border-white/5 p-6">
                          <EmptyState
                            icon={Tag}
                            title="No services in this department"
                            description="Add service offerings to organize renewal timelines and team permissions."
                            compact
                            action={
                              <button
                                onClick={() => setAddServiceFor(activeSelectedDept.id)}
                                className="btn-primary text-xs px-4 py-2 mt-3 flex items-center gap-1.5 mx-auto"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add Service</span>
                              </button>
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div
                            ref={servicesScrollRef}
                            className={`rounded-2xl transition-all ${
                              isServicesExpanded
                                ? 'max-h-none'
                                : 'max-h-[390px] overflow-y-auto custom-scrollbar pr-1.5'
                            }`}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {services[activeSelectedDept.id].map(svc => {
                                const svcUsers = usersByCategory[svc.id] || [];
                                return (
                                  <div
                                    key={svc.id}
                                    className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/40 p-4 flex flex-col justify-between space-y-3 shadow-xs hover:border-brand-500/30 transition-all"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Tag className="w-4 h-4 text-brand-500 flex-shrink-0" />
                                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{svc.name}</h4>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                          {svcUsers.length} assigned member{svcUsers.length === 1 ? '' : 's'}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setAddRenewalFor({ departmentId: activeSelectedDept.id, categoryId: svc.id })}
                                          className="p-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold px-2 flex items-center gap-1"
                                          title="New Renewal"
                                        >
                                          <FilePlus className="w-3 h-3" /> Record
                                        </button>
                                        <button
                                          onClick={() => openAddUser(activeSelectedDept.id, svc)}
                                          className="p-1 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 text-[10px] font-bold px-2 flex items-center gap-1"
                                          title="Add Member"
                                        >
                                          <Plus className="w-3 h-3" /> User
                                        </button>
                                      </div>
                                    </div>

                                    {/* Assigned Users List */}
                                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1.5">
                                      {svcUsers.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 italic">No operators assigned to this category.</p>
                                      ) : (
                                        svcUsers.map(u => (
                                          <PersonRow
                                            key={u.id}
                                            person={u}
                                            onRemove={handleRemovePerson}
                                            removing={removingUserId === u.id}
                                            disableRemove={u.id === user?.id}
                                          />
                                        ))
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Footer hint & scroll actions when more than 4 services */}
                          {(services[activeSelectedDept.id]?.length || 0) > 4 && !isServicesExpanded && (
                            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                                <span className="text-[11px] font-medium">
                                  Showing 2–3 rows of {services[activeSelectedDept.id].length} services • Scroll container to view all
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => scrollServices('up')}
                                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-2xs"
                                  title="Scroll Up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => scrollServices('down')}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 border border-slate-200/60 dark:border-white/5"
                                  title="Scroll down"
                                >
                                  <span>Scroll More</span>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2 Content: Leadership & Admins */}
                  {deptTab[activeSelectedDept.id] === 'admins' && (
                    <div className="space-y-3">
                      {(deptAdminsByDept[activeSelectedDept.id] || []).length === 0 ? (
                        <div className="text-center py-10 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/60 dark:border-white/5 p-6">
                          <p className="text-xs text-slate-500 dark:text-slate-400">No designated administrators assigned to this department yet.</p>
                          {isSuperAdmin && (
                            <button
                              onClick={() => openAddAdmin(activeSelectedDept.id)}
                              className="btn-primary text-xs px-4 py-2 mt-3 flex items-center gap-1.5 mx-auto"
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>Assign Department Admin</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="max-h-[390px] overflow-y-auto custom-scrollbar pr-1.5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {deptAdminsByDept[activeSelectedDept.id].map(adm => (
                              <div
                                key={adm.id}
                                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/40 flex items-center justify-between gap-3 shadow-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-xs ring-2 ring-white dark:ring-slate-900 shadow-xs flex-shrink-0"
                                    style={{ background: adm.avatar_color || '#d97706' }}
                                  >
                                    {getInitials(adm.full_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{adm.full_name}</p>
                                    <p className="text-[11px] text-slate-400 font-mono truncate">{adm.email}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleRemovePerson(adm)}
                                  disabled={adm.id === user?.id || removingUserId === adm.id}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                                  title="Remove Admin"
                                >
                                  {removingUserId === adm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* ── VIEW 3: DENSITY TABLE VIEW ── */
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/60 dark:border-white/5">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Services</th>
                <th className="py-3 px-4">Team Force</th>
                <th className="py-3 px-4">Lead Admin</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredDepartments.map(dept => {
                const deptAdmins = deptAdminsByDept[dept.id] || [];
                return (
                  <tr key={dept.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">{dept.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 font-black flex items-center justify-center text-[10px]">
                          {dept.name.charAt(0)}
                        </div>
                        <span>{dept.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        dept.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dept.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {dept.service_count || 0} services
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {dept.user_count || 0} members
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {deptAdmins.length > 0 ? deptAdmins[0].full_name : <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedDeptId(dept.id);
                          handleSetViewMode('split');
                        }}
                        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Manage</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODALS (Polished Glassmorphism) ── */}

      {/* Add Department Modal */}
      {addDeptOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddDeptOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Create Department</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Establish a new divisional fleet unit.</p>
                </div>
              </div>
              <button onClick={() => setAddDeptOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddDepartment} className="p-6 space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  type="text"
                  value={deptName}
                  onChange={e => setDeptName(e.target.value)}
                  placeholder="e.g. Cloud Infrastructure"
                  className="input-field mt-1"
                  autoFocus
                  required
                />
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
                  <span>{submittingDept ? 'Creating…' : 'Create Unit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Department Modal */}
      {editDept && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditDept(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Rename Department</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Modify unit identification.</p>
                </div>
              </div>
              <button onClick={() => setEditDept(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditDepartment} className="p-6 space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  type="text"
                  value={editDeptName}
                  onChange={e => setEditDeptName(e.target.value)}
                  className="input-field mt-1"
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

      {/* Add Service Modal */}
      {addServiceFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddServiceFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Add Service Offering</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Register a renewed product or service.</p>
                </div>
              </div>
              <button onClick={() => setAddServiceFor(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddService} className="p-6 space-y-4">
              <div>
                <label className="label">Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  placeholder="e.g. AWS Cloud, Microsoft 365"
                  className="input-field mt-1"
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
                  <span>{submittingService ? 'Creating…' : 'Add Service'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Department Admin Modal */}
      {addAdminFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddAdminFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Assign Department Admin</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Delegate divisional leadership permissions.</p>
                </div>
              </div>
              <button onClick={() => setAddAdminFor(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddAdmin} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={personForm.full_name}
                  onChange={e => setPersonForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Aditi Sharma"
                  className="input-field mt-1"
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
                  className="input-field mt-1"
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
                  <span>{submittingPerson ? 'Assigning…' : 'Assign Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add User Modal */}
      {addUserFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddUserFor(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                  <UsersIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Add Team Member</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Assigning to <span className="font-bold text-brand-600 dark:text-brand-400">{addUserFor.categoryName}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setAddUserFor(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={personForm.full_name}
                  onChange={e => setPersonForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Rohan Mehta"
                  className="input-field mt-1"
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
                  className="input-field mt-1"
                  required
                />
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

      {/* Context Menu Portal */}
      {menuAnchor && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuAnchor.top}px`,
            right: `${menuAnchor.right}px`,
            zIndex: 99999,
          }}
          className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 py-1.5 animate-in fade-in-50 zoom-in-95"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              const targetDept = menuAnchor.dept;
              setMenuAnchor(null);
              setSelectedDeptId(targetDept.id);
              handleSetViewMode('split');
            }}
            className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 text-left transition-colors"
          >
            <Columns className="w-4 h-4 text-brand-500" />
            <span>Open Command Console</span>
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
              className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 text-left transition-colors"
            >
              <Edit2 className="w-4 h-4 text-slate-400" />
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
              className="w-full px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 flex items-center gap-2 text-left transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
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
            className="w-full px-4 py-2.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 flex items-center gap-2 text-left transition-colors"
          >
            <Plus className="w-4 h-4" />
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
            className="w-full px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2 text-left transition-colors"
          >
            <FilePlus className="w-4 h-4" />
            <span>Add Renewal Record</span>
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
                className={`w-full px-4 py-2.5 text-xs font-bold flex items-center gap-2 text-left transition-colors ${
                  menuAnchor.dept.is_active
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{menuAnchor.dept.is_active ? 'Deactivate Department' : 'Activate Department'}</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Renewal Form Modal */}
      {addRenewalFor && (
        <RenewalForm
          initialDepartmentId={addRenewalFor.departmentId}
          initialCategoryId={addRenewalFor.categoryId}
          onClose={() => setAddRenewalFor(null)}
          onSuccess={() => {
            setAddRenewalFor(null);
            toast.success('Renewal record registered.');
          }}
        />
      )}
    </div>
  );
}

// Reusable Person Row Component
function PersonRow({ person, onRemove, removing, disableRemove, badgeText = null }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors rounded-xl group border border-transparent hover:border-slate-200/50 dark:hover:border-white/5">
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
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
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
