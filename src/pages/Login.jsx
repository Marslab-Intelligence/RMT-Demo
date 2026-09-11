import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import TopologyField from '../components/ui/topology-field';
import { useAuth } from '../context/AuthContext';

// Guards the login page against any unforeseen failure in the decorative
// background — it should degrade to a plain black backdrop, never take the
// whole page down with it.
class BackgroundErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('[Login] Background render failed, falling back to plain background:', err);
  }
  render() {
    if (this.state.hasError) return <div className="absolute inset-0 bg-black" />;
    return this.props.children;
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [demoUsers, setDemoUsers] = useState([]);
  const [demoSwitching, setDemoSwitching] = useState(null);

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
    if (data.user?.role === 'ceo') {
      navigate('/ceo/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
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
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Full-bleed animated black-hole background */}
      <div className="absolute inset-0 z-0">
        <BackgroundErrorBoundary>
          <TopologyField mode="dark" />
        </BackgroundErrorBoundary>
      </div>

      {/* Foreground content — anchored to the left, background visible on the right */}
      <div className="relative z-10 min-h-screen flex items-center py-12 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <img src="/logo.png" alt="MarsLab Logo" className="h-16 w-auto object-contain invert" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-2 text-left text-sm font-medium text-surface-200"
          >
            Enterprise Renewal Management System
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 w-full space-y-6"
          >
          {/* Standard login form */}
          <div
            className="py-8 px-4 rounded-2xl sm:px-10 shadow-xl"
            style={{
              background: 'rgba(20,16,30,0.80)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-white">Sign in</h3>
              <p className="mt-1 text-xs text-surface-300">Use your email and password to access the portal.</p>
            </div>

            {errorMessage && (
              <div className="mb-4 bg-red-900/20 border border-red-800 text-red-400 text-xs p-3 rounded-lg text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@marslab.work"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-surface-700 bg-surface-900/60 text-sm text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-surface-700 bg-surface-900/60 text-sm text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-sm bg-white text-sm font-semibold text-surface-900 hover:bg-surface-100 transition-all duration-200 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 border-t border-surface-700 pt-4">
              <div className="text-xs text-center text-surface-300">
                Only authorized employees can access this portal.<br />
                If you don't have access, contact the administrator.
              </div>
            </div>
          </div>

          {/* Demo user switcher — only shown when the backend has DEMO_MODE enabled */}
          {demoUsers.length > 0 && (
            <div
              className="py-8 px-4 rounded-2xl sm:px-6 shadow-xl"
              style={{
                background: 'rgba(20,16,30,0.80)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <div className="text-center mb-5 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-brand-900/30 flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-brand-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Quick Demo Login</h3>
                <p className="mt-1 text-xs text-surface-300">Switch to any user instantly — no password needed.</p>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoSwitch(u.id)}
                    disabled={demoSwitching !== null}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-surface-700 bg-surface-900/50 hover:bg-surface-800 transition-colors text-left disabled:opacity-60"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ background: u.avatar_color || '#a559a5' }}
                    >
                      {u.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{u.full_name}</div>
                      <div className="text-xs text-surface-400 truncate">{u.email}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-1 rounded-full bg-surface-700 text-surface-300 shrink-0">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
