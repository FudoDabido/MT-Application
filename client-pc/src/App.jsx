import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Training from './pages/Training.jsx';
import Health from './pages/Health.jsx';
import Records from './pages/Records.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';

function Shell({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/pc/login" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/pc/login" element={<Login />} />
          <Route path="/pc/overview"    element={<Shell><Overview /></Shell>} />
          <Route path="/pc/training"    element={<Shell><Training /></Shell>} />
          <Route path="/pc/health"      element={<Shell><Health /></Shell>} />
          <Route path="/pc/records"     element={<Shell><Records /></Shell>} />
          <Route path="/pc/leaderboard" element={<Shell><Leaderboard /></Shell>} />
          <Route path="/pc/admin/users" element={<Shell><AdminUsers /></Shell>} />
          <Route path="/pc" element={<Navigate to="/pc/overview" replace />} />
          <Route path="*"  element={<Navigate to="/pc/overview" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
