import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Building2, Plus, X, Loader2, ChevronRight, Tag, Users as UsersIcon, Power, ShieldCheck, Trash2, FilePlus } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import RenewalForm from '../components/RenewalForm';

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
}

export default function Departments() {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // department id currently expanded
  const [services, setServices] = useState({}); // { [departmentId]: [service, ...] }
  const [servicesLoading, setServicesLoading] = useState({});

  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [submittingDept, setSubmittingDept] = useState(false);

  const [addServiceFor, setAddServiceFor] = useState(null); // department id or null
  const [serviceName, setServiceName] = useState('');
  const [submittingService, setSubmittingService] = useState(false);

  const [addAdminFor, setAddAdminFor] = useState(null); // department id or null
  const [addUserFor, setAddUserFor] = useState(null); // { departmentId, categoryId, categoryName } or null
  const [addRenewalFor, setAddRenewalFor] = useState(null); // { departmentId, categoryId } or null
  const [personForm, setPersonForm] = useState({ full_name: '', email: '' });
  const [submittingPerson, setSubmittingPerson] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDepartments(await res.json());
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAllUsers(await res.json());
    } catch {
      toast.error('Failed to load users');
    }
  }, [token]);

  useEffect(() => { fetchDepartments(); fetchUsers(); }, [fetchDepartments, fetchUsers]);

  const deptAdminsByDept = useMemo(() => {
    const map = {};
    for (const u of allUsers) {
      if (u.role !== 'dept_admin' || !u.department_id) continue;
      (map[u.department_id] ||= []).push(u);
    }
    return map;
  }, [allUsers]);

  const usersByCategory = useMemo(() => {
    const map = {};
    for (const u of allUsers) {
      if (u.role !== 'user' || !u.category_id) continue;
      (map[u.category_id] ||= []).push(u);
    }
    return map;
  }, [allUsers]);

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

  const toggleExpand = (dept) => {
    if (expanded === dept.id) {
      setExpanded(null);
      return;
    }
    setExpanded(dept.id);
    if (!services[dept.id]) fetchServices(dept.id);
  };

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
      if (!res.ok) { toast.error(data.error || 'Failed to create department'); return; }
      toast.success(`Department "${data.name}" created`);
      setAddDeptOpen(false);
      setDeptName('');
      fetchDepartments();
    } catch { toast.error('Network error'); }
    finally { setSubmittingDept(false); }
  };

  const handleToggleDeptActive = async (dept) => {
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !dept.is_active }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to update department'); return; }
      toast.success(`Department ${data.is_active ? 'activated' : 'deactivated'}`);
      fetchDepartments();
    } catch { toast.error('Network error'); }
  };

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
      if (!res.ok) { toast.error(data.error || 'Failed to create service'); return; }
      toast.success(`Service "${data.name}" created`);
      setAddServiceFor(null);
      setServiceName('');
      fetchServices(addServiceFor);
      fetchDepartments();
    } catch { toast.error('Network error'); }
    finally { setSubmittingService(false); }
  };

  const handleToggleServiceActive = async (departmentId, service) => {
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !service.is_active }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to update service'); return; }
      toast.success(`Service ${data.is_active ? 'activated' : 'deactivated'}`);
      fetchServices(departmentId);
    } catch { toast.error('Network error'); }
  };

  const openAddAdmin = (departmentId) => {
    setPersonForm({ full_name: '', email: '' });
    setAddAdminFor(departmentId);
  };

  const openAddUser = (departmentId, service) => {
    setPersonForm({ full_name: '', email: '' });
    setAddUserFor({ departmentId, categoryId: service.id, categoryName: service.name });
  };

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
      if (!res.ok) { toast.error(data.error || 'Failed to add admin'); return; }
      toast.success(`${data.full_name} added as department admin`);
      setAddAdminFor(null);
      fetchUsers();
    } catch { toast.error('Network error'); }
    finally { setSubmittingPerson(false); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!personForm.full_name.trim() || !personForm.email.trim() || !addUserFor) return;
    setSubmittingPerson(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...personForm, role: 'user', department_id: addUserFor.departmentId, category_id: addUserFor.categoryId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to add user'); return; }
      toast.success(`${data.full_name} added to ${addUserFor.categoryName}`);
      setAddUserFor(null);
      fetchUsers();
      fetchDepartments();
    } catch { toast.error('Network error'); }
    finally { setSubmittingPerson(false); }
  };

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
      if (!res.ok) { toast.error(data.error || 'Failed to remove'); return; }
      toast.success(`${u.full_name} removed`);
      fetchUsers();
      fetchDepartments();
    } catch { toast.error('Network error'); }
    finally { setRemovingUserId(null); }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">User Management</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isSuperAdmin
                ? 'Create departments, assign dept admins, and manage services & team members underneath them.'
                : 'Manage the services and team members in your department.'}
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setAddDeptOpen(true)}
            className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Department</span>
          </button>
        )}
      </div>

      {/* Departments list */}
      {departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Create your first department to get started." />
      ) : (
        <div className="space-y-4">
          {departments.map(dept => {
            const deptAdmins = deptAdminsByDept[dept.id] || [];
            return (
            <div
              key={dept.id}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(dept)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors text-left"
              >
                <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded === dept.id ? 'rotate-90' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">{dept.name}</h2>
                    {!dept.is_active && <StatusBadge status="expired" label="Inactive" size="xs" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{dept.service_count} service{dept.service_count === '1' ? '' : 's'}</span>
                    <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" />{dept.user_count} user{dept.user_count === '1' ? '' : 's'}</span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {deptAdmins.length > 0 ? deptAdmins.map(a => a.full_name).join(', ') : 'No admin assigned'}
                    </span>
                  </p>
                </div>
                {isSuperAdmin && (
                  <span
                    onClick={(e) => { e.stopPropagation(); handleToggleDeptActive(dept); }}
                    role="button"
                    className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                      dept.is_active
                        ? 'border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                        : 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    {dept.is_active ? 'Deactivate' : 'Activate'}
                  </span>
                )}
              </button>

              {expanded === dept.id && (
                <div className="px-5 pb-4 border-t border-slate-200/60 dark:border-white/10 pt-4 space-y-5">
                  
                  {/* Department Quick Actions */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Department Renewals</p>
                      <p className="text-[11px] text-slate-400">Add renewal records directly inside {dept.name}.</p>
                    </div>
                    <button
                      onClick={() => setAddRenewalFor({ departmentId: dept.id })}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/20 transition-colors"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      <span>Add Renewal</span>
                    </button>
                  </div>

                  {/* Department Admins — super_admin manages, dept_admin sees read-only */}
                  {isSuperAdmin && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Department Admin</h3>
                        <button
                          onClick={() => openAddAdmin(dept.id)}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Assign Admin
                        </button>
                      </div>
                      {deptAdmins.length === 0 ? (
                        <p className="text-[11px] text-slate-400 px-1">No admin assigned to this department yet.</p>
                      ) : (
                        <div className="bg-white/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-white/5 divide-y divide-slate-200/40 dark:divide-white/5 overflow-hidden">
                          {deptAdmins.map(a => (
                            <PersonRow key={a.id} person={a} onRemove={handleRemovePerson} removing={removingUserId === a.id} disableRemove={a.id === user?.id} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Services + their users */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">Services</h3>
                      <button
                        onClick={() => setAddServiceFor(dept.id)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Service
                      </button>
                    </div>
                    {servicesLoading[dept.id] ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                    ) : (services[dept.id]?.length ?? 0) === 0 ? (
                      <EmptyState icon={Tag} title="No services yet" description="Add a service to start assigning users." compact />
                    ) : (
                      <div className="space-y-3">
                        {services[dept.id].map(svc => {
                          const svcUsers = usersByCategory[svc.id] || [];
                          return (
                            <div key={svc.id} className="bg-white/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-white/5 overflow-hidden">
                              <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/60 dark:bg-white/[0.03]">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{svc.name}</p>
                                  <p className="text-[10px] text-slate-400">{svcUsers.length} user{svcUsers.length === 1 ? '' : 's'} assigned</p>
                                </div>
                                {!svc.is_active && <StatusBadge status="expired" label="Inactive" size="xs" />}
                                <button
                                  onClick={() => setAddRenewalFor({ departmentId: dept.id, categoryId: svc.id })}
                                  className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                  title={`Add Renewal Record in ${svc.name}`}
                                >
                                  <FilePlus className="w-3 h-3" /> Add Record
                                </button>
                                <button
                                  onClick={() => openAddUser(dept.id, svc)}
                                  className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
                                >
                                  <Plus className="w-3 h-3" /> Add User
                                </button>
                                <span
                                  onClick={() => handleToggleServiceActive(dept.id, svc)}
                                  role="button"
                                  className={`flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                                    svc.is_active
                                      ? 'border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                                      : 'border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                  }`}
                                >
                                  {svc.is_active ? 'Deactivate' : 'Activate'}
                                </span>
                              </div>
                              {svcUsers.length > 0 && (
                                <div className="divide-y divide-slate-200/40 dark:divide-white/5">
                                  {svcUsers.map(u => (
                                    <PersonRow key={u.id} person={u} onRemove={handleRemovePerson} removing={removingUserId === u.id} disableRemove={u.id === user?.id} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );})}
        </div>
      )}

      {/* New Department Modal */}
      {addDeptOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddDeptOpen(false)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <h3 className="text-base font-black text-slate-900 dark:text-white">New Department</h3>
              <button onClick={() => setAddDeptOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
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
                  Assign a dept admin after creating this department.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddDeptOpen(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={submittingDept} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {submittingDept && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingDept ? 'Creating…' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* New Service Modal */}
      {addServiceFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddServiceFor(null)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <h3 className="text-base font-black text-slate-900 dark:text-white">New Service</h3>
              <button onClick={() => setAddServiceFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
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
                  placeholder="e.g. AWS"
                  className="input-field"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddServiceFor(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={submittingService} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {submittingService && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingService ? 'Creating…' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Department Admin Modal */}
      {addAdminFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddAdminFor(null)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Assign Department Admin</h3>
              <button onClick={() => setAddAdminFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
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
                <button type="button" onClick={() => setAddAdminFor(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={submittingPerson} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {submittingPerson && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingPerson ? 'Adding…' : 'Assign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add User (into a service) Modal */}
      {addUserFor && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddUserFor(null)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Add User</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Assigning to <span className="font-bold text-brand-600 dark:text-brand-400">{addUserFor.categoryName}</span>
                </p>
              </div>
              <button onClick={() => setAddUserFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
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
                  This user will only ever see renewals assigned to {addUserFor.categoryName}.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddUserFor(null)} className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={submittingPerson} className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2">
                  {submittingPerson && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submittingPerson ? 'Adding…' : 'Add User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Renewal Record modal */}
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

function PersonRow({ person, onRemove, removing, disableRemove }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 shadow-md ring-2 ring-white/20"
        style={{ background: person.avatar_color || '#4f91a8' }}
      >
        {getInitials(person.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{person.full_name}</p>
        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{person.email}</p>
      </div>
      <button
        onClick={() => onRemove(person)}
        disabled={removing || disableRemove}
        className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>
    </div>
  );
}
