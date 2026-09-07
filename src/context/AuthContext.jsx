import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Keep a ref of the token to use inside timers and callbacks without closures issues
  const tokenRef = useRef(null);
  tokenRef.current = token;

  // ─────────────────────────────────────────────
  // Decode JWT expiry without a library
  // ─────────────────────────────────────────────
  const getTokenExpiry = (t) => {
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.exp * 1000; // convert to ms
    } catch {
      return null;
    }
  };

  // ─────────────────────────────────────────────
  // Schedule a silent refresh 2 minutes before
  // the access token expires
  // ─────────────────────────────────────────────
  const scheduleRefresh = useCallback((t) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const expiry = getTokenExpiry(t);
    if (!expiry) return;

    const now = Date.now();
    const msUntilRefresh = expiry - now - 2 * 60 * 1000; // 2 minutes before expiry

    if (msUntilRefresh <= 0) {
      // Already close to expiry — refresh immediately
      silentRefresh();
      return;
    }

    console.log(`🔄 Access token refresh scheduled in ${Math.round(msUntilRefresh / 1000 / 60)} minutes`);
    refreshTimerRef.current = setTimeout(() => {
      silentRefresh();
    }, msUntilRefresh);
  }, []);

  // ─────────────────────────────────────────────
  // Silent refresh: call /api/auth/refresh
  // The HttpOnly cookie is sent automatically by the browser
  // ─────────────────────────────────────────────
  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // sends the HttpOnly cookie
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        scheduleRefresh(data.token);
        console.log('✅ Token silently refreshed');
        return data.token;
      } else {
        // Refresh token revoked or invalid (HTTP 401/403) — log out
        console.warn('⚠️ Silent refresh unauthorized — logging out');
        logout();
        return null;
      }
    } catch (err) {
      console.warn('⚠️ Silent refresh network error (preserving session):', err.message);
      return null;
    }
  }, [scheduleRefresh]);

  // ─────────────────────────────────────────────
  // Returns a valid access token, refreshing if needed
  // Used by all API calls in the app
  // ─────────────────────────────────────────────
  const getValidToken = useCallback(async () => {
    const activeToken = tokenRef.current;
    if (!activeToken) return null;

    const expiry = getTokenExpiry(activeToken);
    const isExpired = expiry && Date.now() >= expiry - 30 * 1000; // 30s buffer

    if (isExpired) {
      return await silentRefresh();
    }
    return activeToken;
  }, [silentRefresh]);

  // ─────────────────────────────────────────────
  // On mount: try to restore session via refresh cookie
  // ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Try silent refresh using the HttpOnly cookie — restores the
      // session on page reload without re-login.
      await silentRefresh();
      setLoading(false);
    };

    init();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────
  // Login: sets token/user from a successful
  // /api/auth/login or /api/auth/demo/login response
  // ─────────────────────────────────────────────
  const login = useCallback(({ token: newToken, user: newUser }) => {
    setToken(newToken);
    setUser(newUser);
    scheduleRefresh(newToken);
  }, [scheduleRefresh]);

  // ─────────────────────────────────────────────
  // Logout: revoke refresh token in DB + clear
  // ─────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      // Tell the server to revoke the refresh token in DB
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // sends the cookie so server can revoke it
      });
    } catch (err) {
      // Non-blocking — proceed with client-side logout regardless
      console.warn('Logout API call failed (non-blocking):', err.message);
    }
    setToken(null);
    setUser(null);
  }, []);

  // PERF: this object literal used to be re-created on every AuthProvider
  // render — since every consumer across the whole app calls useAuth(), a
  // provider re-render (which happens on every silent token refresh, roughly
  // every 13-58 min depending on JWT TTL) meant every consuming page/component
  // re-rendered too, regardless of whether the values they actually use
  // changed. Memoizing means consumers only re-render when user/token/loading
  // truly change.
  const value = useMemo(
    () => ({ user, token, loading, login, logout, getValidToken }),
    [user, token, loading, login, logout, getValidToken]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
