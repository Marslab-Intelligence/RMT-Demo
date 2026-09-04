import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import LiquidEther from '../components/LiquidEther';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [demoUsers, setDemoUsers] = useState([]);
  const [demoSwitching, setDemoSwitching] = useState(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setErrorMessage(err);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Demo mode: fetch the switchable user list. If the endpoint isn't
  // enabled (DEMO_MODE off), this silently returns nothing and the
  // switcher panel just doesn't render.
  useEffect(() => {
    fetch('/api/auth/demo/users')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDemoUsers(Array.isArray(data) ? data : []))
      .catch(() => setDemoUsers([]));
  }, []);

  const handleLoginSuccess = (data) => {
    login(data);
    navigate('/', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Login failed. Please try again.');
        return;
      }
      handleLoginSuccess(data);
    } catch (err) {
      setErrorMessage('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSwitch = async (userId) => {
    setErrorMessage('');
    setDemoSwitching(userId);
    try {
      const res = await fetch('/api/auth/demo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not switch user.');
        return;
      }
      handleLoginSuccess(data);
    } catch (err) {
      toast.error('Could not reach the server.');
    } finally {
      setDemoSwitching(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 dark:from-stone-900 dark:via-slate-900 dark:to-rose-950">
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <LiquidEther
          colors={isDark ? ['#5227FF', '#9b59b6', '#1a0533'] : ['#f59e0b', '#fb923c', '#e11d48']}
          mouseForce={20}
          cursorSize={120}
          isViscous
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.4}
          isBounce={false}
          autoDemo
          autoSpeed={0.4}
          autoIntensity={2.0}
          takeoverDuration={0.25}
          autoResumeDelay={2000}
          autoRampDuration={0.8}
        />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <img src="/logo.png" alt="MarsLab Logo" className="h-16 w-auto object-contain dark:invert dark:hue-rotate-180" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-center text-sm font-medium text-surface-700 dark:text-surface-200"
        >
          Enterprise Renewal Management System
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`mt-8 sm:mx-auto sm:w-full relative z-10 ${demoUsers.length > 0 ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
      >
        <div className={`grid gap-6 ${demoUsers.length > 0 ? 'sm:grid-cols-2' : ''}`}>
          {/* Standard login form */}
          <div
            className="py-8 px-4 sm:rounded-2xl sm:px-10 shadow-xl"
            style={{
              background: isDark ? 'rgba(20,16,30,0.80)' : 'rgba(255,248,240,0.70)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Sign in</h3>
              <p className="mt-1 text-xs text-surface-600 dark:text-surface-300">Use your email and password to access the portal.</p>
            </div>

            {errorMessage && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs p-3 rounded-lg text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@marslab.work"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/70 dark:bg-surface-900/60 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/70 dark:bg-surface-900/60 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-sm bg-surface-900 dark:bg-white text-sm font-semibold text-white dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-100 transition-all duration-200 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 border-t border-surface-200 dark:border-surface-700 pt-4">
              <div className="text-xs text-center text-surface-500 dark:text-surface-300">
                Only authorized employees can access this portal.<br />
                If you don't have access, contact the administrator.
              </div>
            </div>
          </div>

          {/* Demo user switcher — only shown when the backend has DEMO_MODE enabled */}
          {demoUsers.length > 0 && (
            <div
              className="py-8 px-4 sm:rounded-2xl sm:px-6 shadow-xl"
              style={{
                background: isDark ? 'rgba(20,16,30,0.80)' : 'rgba(255,248,240,0.70)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <div className="text-center mb-5 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Quick Demo Login</h3>
                <p className="mt-1 text-xs text-surface-600 dark:text-surface-300">Switch to any user instantly — no password needed.</p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoSwitch(u.id)}
                    disabled={demoSwitching !== null}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white/60 dark:bg-surface-900/50 hover:bg-white dark:hover:bg-surface-800 transition-colors text-left disabled:opacity-60"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ background: u.avatar_color || '#6366f1' }}
                    >
                      {u.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-surface-900 dark:text-white truncate">{u.full_name}</div>
                      <div className="text-xs text-surface-500 dark:text-surface-400 truncate">{u.email}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 shrink-0">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
