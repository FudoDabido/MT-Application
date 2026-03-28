import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('mt_token');
    if (!token) { setLoading(false); return; }
    getMe().then(r => setUser(r.data)).catch(() => localStorage.removeItem('mt_token')).finally(() => setLoading(false));
  }, []);

  function logout() { localStorage.removeItem('mt_token'); setUser(null); }
  function setToken(token, userData) { localStorage.setItem('mt_token', token); setUser(userData); }

  return <AuthContext.Provider value={{ user, loading, logout, setToken }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
