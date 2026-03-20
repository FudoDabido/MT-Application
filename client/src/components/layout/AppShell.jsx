import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import CheckinModal from '../CheckinModal.jsx';
import OnboardingWizard from '../onboarding/OnboardingWizard.jsx';
import { getPending } from '../../api/checkinsApi.js';
import { getOnboardingStatus } from '../../api/onboardingApi.js';
import { getProgramStatus } from '../../api/programApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

// ── Bedtime Guard ─────────────────────────────────────────────────────────────
// Watches the clock against the user's scheduled bedtime.
// 10 min before → warning banner.
// At bedtime → modal with 60s auto-logout countdown.

function timeToMins(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function nowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function BedtimeGuard({ bedtime }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(null); // null | 'warning' | 'modal'
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef(null);
  const bedMins = timeToMins(bedtime);

  const check = useCallback(() => {
    if (!bedMins) return;
    const diff = bedMins - nowMins(); // negative = past bedtime
    if (diff <= 0 && phase !== 'modal') {
      setPhase('modal');
      setCountdown(60);
    } else if (diff > 0 && diff <= 10 && phase === null) {
      setPhase('warning');
    }
  }, [bedMins, phase]);

  // Check every 30 seconds
  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  // Countdown when modal is showing
  useEffect(() => {
    if (phase !== 'modal') {
      clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          // Auto-logout — late!
          logout();
          navigate('/login');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [phase, logout, navigate]);

  function handleLogout() {
    clearInterval(countdownRef.current);
    logout();
    navigate('/login');
  }

  if (!phase) return null;

  // Warning banner (10 min before)
  if (phase === 'warning') {
    const diff = bedMins - nowMins();
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-yellow-900/90 border-t border-yellow-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 text-lg">🌙</span>
          <span className="text-yellow-200 text-sm font-medium">
            Bedtime in <strong>{diff} minutes</strong>. Start wrapping up and log out on time.
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs px-4 py-1.5 rounded-lg transition-colors"
        >
          Log Out Now
        </button>
      </div>
    );
  }

  // Bedtime modal — must log out
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-gray-700">
        <div className="text-5xl mb-4">🌙</div>
        <h2 className="text-2xl font-black text-white mb-2">Bedtime</h2>
        <p className="text-gray-400 text-sm mb-6">
          It's time to rest. You will be logged out automatically in{' '}
          <span className="text-red-400 font-bold text-lg">{countdown}s</span>.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors"
        >
          Log Out & Rest Well
        </button>
        <p className="text-xs text-gray-600 mt-3">Staying consistent earns you a higher score. Good night.</p>
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const [checkinPending, setCheckinPending]   = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [bedtime, setBedtime] = useState(null);

  useEffect(() => {
    getOnboardingStatus()
      .then((res) => setNeedsOnboarding(!res.data.completed))
      .catch(() => setNeedsOnboarding(false))
      .finally(() => setOnboardingLoaded(true));

    getPending().then((res) => setCheckinPending(res.data.pending)).catch(() => {});

    // Fetch bedtime from active program schedule
    getProgramStatus()
      .then((res) => {
        const sched = res.data?.schedule;
        if (sched?.bedtime) setBedtime(sched.bedtime);
      })
      .catch(() => {});
  }, []);

  if (!onboardingLoaded) return null;

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {checkinPending && <CheckinModal onClose={() => setCheckinPending(false)} />}
      {bedtime && <BedtimeGuard bedtime={bedtime} />}
    </div>
  );
}
