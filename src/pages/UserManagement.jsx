import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Plus, X, Loader2, Trash2 } from 'lucide-react';
import GlassSelect from '../components/GlassSelect';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';

const GROUPS = [
  {
    role: 'sales',
    label: 'CST / Sales',
    description: 'Customer Success Team / Sales — creates & manages records',
    accent: '#3b82f6',
    lightBg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-400 dark:border-blue-600',
    badgeBg: 'bg-blue-500',
    pillBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  {
    role: 'admin',
    label: 'Admin',
    description: 'Administrators — full read/write access to all fields',
    accent: '#f59e0b',
    lightBg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-400 dark:border-amber-600',
    badgeBg: 'bg-amber-500',
    pillBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
];

const ROLE_LABELS = { sales: 'CST / Sales', admin: 'Admin' };

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
}

export default function UserManagement() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null); // role string or null
  const [form, setForm] = useState({ email: '', full_name: '', role: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [changingRole, setChangingRole] = useState({});
  const [removing, setRemoving] = useState({});

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/', { replace: true });
  }, [user, navigate]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, fetchUsers]);

  const openAddModal = (role) => {
    setForm({ email: '', full_name: '', role });
    setAddModal(role);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.full_name.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to add user'); return; }
      toast.success(`${data.full_name} added to ${ROLE_LABELS[data.role]}`);
      setAddModal(null);
      fetchUsers();
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    setChangingRole(p => ({ ...p, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to update role'); return; }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`${userName} moved to ${ROLE_LABELS[newRole]}`);
    } catch { toast.error('Network error'); }
    finally { setChangingRole(p => ({ ...p, [userId]: false })); }
  };

  const handleRemove = (userId, userName) => {
    setDeleteConfirm({ id: userId, name: userName });
  };

  const handlePermanentDelete = async () => {
    if (!deleteConfirm) return;
    const { id, name } = deleteConfirm;
    setDeleteConfirm(null);
    setRemoving(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to delete user'); return; }
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`${name} permanently deleted`);
    } catch { toast.error('Network error'); }
    finally { setRemoving(p => ({ ...p, [id]: false })); }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const activeByRole = (role) => users.filter(u => u.role === role);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">User Groups & Roles</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Manage role-based access controls and team members across your organization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {GROUPS.map((group) => {
          const active = activeByRole(group.role);

          return (
            <div
              key={group.role}
              className="group/card relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all duration-300 hover:shadow-2xl"
            >
              {/* Top Accent Bar */}
              <div className="h-1 w-full" style={{ background: group.accent }} />

              {/* Group Header */}
              <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-200/60 dark:border-white/10">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span style={{ color: group.accent }}>{group.label}</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{group.description}</p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <StatusBadge status={group.role} label={`${active.length} Active`} size="xs" />
                  <button
                    onClick={() => openAddModal(group.role)}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all hover:scale-105 active:scale-95 shadow-sm"
                    style={{ background: group.accent }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Active Users */}
              <div className="p-4 flex-1">
                <div className="bg-white/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-white/5 divide-y divide-slate-200/40 dark:divide-white/5 overflow-hidden">
                  {active.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No active users"
                      description="No users currently assigned to this role group."
                      compact={true}
                    />
                  ) : (
                    active.map(u => (
                      <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-md ring-2 ring-white/20"
                          style={{ background: u.avatar_color || '#4f91a8' }}
                        >
                          {getInitials(u.full_name)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.full_name}</p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                        </div>
                        {/* Role Select */}
                        <div className="relative flex-shrink-0">
                          {changingRole[u.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <GlassSelect
                              value={u.role}
                              onChange={(e, val) => handleRoleChange(u.id, val !== undefined ? val : e.target.value, u.full_name)}
                              disabled={u.id === user?.id}
                              size="xs"
                              options={[
                                { value: 'sales', label: 'CST / Sales' },
                                { value: 'admin', label: 'Admin' },
                              ]}
                            />
                          )}
                        </div>
                        {/* Remove */}
                        <button
                          onClick={() => handleRemove(u.id, u.full_name)}
                          disabled={removing[u.id] || u.id === user?.id}
                          className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {removing[u.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-rose-500/30 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-200/60 dark:border-white/10">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Delete User</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This action cannot be undone</p>
              </div>
              <button onClick={() => setDeleteConfirm(null)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2">
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Are you sure you want to permanently delete <span className="font-bold text-slate-900 dark:text-white">{deleteConfirm.name}</span>?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                This will completely remove the user record and revoke active session access.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                className="btn-danger flex-1 py-2 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add User Modal */}
      {addModal && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAddModal(null)} />
          <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Add New Team Member</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Assigning to <span className="font-bold text-brand-600 dark:text-brand-400">{ROLE_LABELS[addModal]}</span>
                </p>
              </div>
              <button onClick={() => setAddModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddUser} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Sameerul Rahman"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="name@company.com"
                  className="input-field"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The user will log in with this email and their initial password.
                </p>
              </div>
              <div>
                <label className="label">Role / Group</label>
                <GlassSelect
                  value={form.role}
                  onChange={(e, val) => setForm(p => ({ ...p, role: val !== undefined ? val : e.target.value }))}
                  size="md"
                  options={[
                    { value: 'sales', label: 'CST / Sales' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  className="w-full"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModal(null)}
                  className="btn-secondary flex-1 py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Adding…' : 'Add User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
