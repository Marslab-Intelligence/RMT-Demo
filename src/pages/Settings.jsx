import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Save, User, Shield, Bell, Settings as SettingsIcon, KeyRound, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../components/common/StatusBadge';

export default function Settings() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [passData, setPassData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passData.newPassword !== passData.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passData.currentPassword, newPassword: passData.newPassword })
      });
      if (res.ok) {
        toast.success('Password updated successfully');
        setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update password');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const triggerScheduler = async () => {
    setSchedulerLoading(true);
    try {
      const res = await fetch('/api/dashboard/trigger-scheduler', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Scheduler triggered. Emails will process in background.');
      } else {
        toast.error('Failed to trigger scheduler');
      }
    } catch (err) {
      toast.error('Failed to trigger scheduler');
    } finally {
      setSchedulerLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="max-w-5xl space-y-8 animate-fade-in pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-xl border border-brand-500/20 shadow-sm">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Account & System Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Manage your credentials, security preferences, and system administrative tools.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar Tabs */}
        <div className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all border text-left ${
              activeTab === 'profile'
                ? 'bg-white/80 dark:bg-slate-900/80 text-brand-600 dark:text-brand-400 border-brand-500/30 shadow-md backdrop-blur-xl'
                : 'bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white/60 dark:hover:bg-white/10'
            }`}
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile & Security</span>
          </button>

          {(user?.role === 'super_admin' || user?.role === 'dept_admin') && (
            <button
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs transition-all border text-left ${
                activeTab === 'system'
                  ? 'bg-white/80 dark:bg-slate-900/80 text-brand-600 dark:text-brand-400 border-brand-500/30 shadow-md backdrop-blur-xl'
                  : 'bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent hover:bg-white/60 dark:hover:bg-white/10'
              }`}
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              <span>System Utilities</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <>
              {/* Profile Card */}
              <div className="card p-6 border-slate-200/80 dark:border-white/10 shadow-xl">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200/60 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-brand-500" />
                    <h2 className="text-base font-black text-slate-900 dark:text-white">Account Details</h2>
                  </div>
                  <StatusBadge status={user?.role || 'user'} size="xs" />
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar */}
                  <div className="relative group">
                    <div 
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xl ring-4 ring-brand-500/20"
                      style={{ backgroundColor: user?.avatarColor || '#4f91a8' }}
                    >
                      {getInitials(user?.fullName)}
                    </div>
                  </div>

                  {/* Info Details */}
                  <div className="space-y-3 flex-1 text-center sm:text-left">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">{user?.fullName || 'User'}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{user?.email}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Username</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.username || '—'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Assigned Role</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">{user?.role === 'user' ? 'CST / Sales' : (user?.role || 'User')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="card p-6 border-slate-200/80 dark:border-white/10 shadow-xl">
                <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-200/60 dark:border-white/10">
                  <KeyRound className="w-5 h-5 text-brand-500" />
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">Change Password</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Update your login security credentials.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="label">Current Password</label>
                    <input 
                      type="password" 
                      required 
                      value={passData.currentPassword} 
                      onChange={e => setPassData({ ...passData, currentPassword: e.target.value })} 
                      className="input-field" 
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="label">New Password</label>
                    <input 
                      type="password" 
                      required 
                      minLength="6" 
                      value={passData.newPassword} 
                      onChange={e => setPassData({ ...passData, newPassword: e.target.value })} 
                      className="input-field" 
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div>
                    <label className="label">Confirm New Password</label>
                    <input 
                      type="password" 
                      required 
                      minLength="6" 
                      value={passData.confirmPassword} 
                      onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })} 
                      className="input-field" 
                      placeholder="Re-enter new password"
                    />
                  </div>
                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="btn-primary w-full sm:w-auto"
                    >
                      <Save className="w-4 h-4" />
                      <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {activeTab === 'system' && (user?.role === 'super_admin' || user?.role === 'dept_admin') && (
            <div className="card p-6 border-amber-500/25 bg-amber-500/5 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-amber-500/20">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Admin System Tools & Overrides</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Manual operational triggers for system maintenance.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trigger Email & AI Sweep Scheduler</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Instantly forces a background scan of due renewals and outbound email dispatches.
                  </p>
                </div>
                <button 
                  onClick={triggerScheduler} 
                  disabled={schedulerLoading}
                  className="btn-primary whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20"
                >
                  <Zap className={`w-4 h-4 ${schedulerLoading ? 'animate-spin' : ''}`} />
                  <span>{schedulerLoading ? 'Running...' : 'Force Run Scheduler'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
