'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import BottomNav from './BottomNav.jsx';
import CheckinModal from '../CheckinModal.jsx';
import OnboardingWizard from '../onboarding/OnboardingWizard.jsx';
import { getPending } from '../../api/checkinsApi.js';
import { getOnboardingStatus } from '../../api/onboardingApi.js';
import { getProgramStatus } from '../../api/programApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

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
  const router = useRouter();
  const [phase, setPhase] = useState(null);
  const [countdown, setCountdown] = useState(60);
  const countdownRef = useRef(null);
  const dismissedRef = useRef(false);
  const bedMins = timeToMins(bedtime);

  const check = useCallback(() => {
    if (!bedMins || dismissedRef.current) return;
    const diff = bedMins - nowMins();
    if (diff <= 0 && phase !== 'modal') {
      setPhase('modal');
      setCountdown(60);
    } else if (diff > 0 && diff <= 10 && phase === null) {
      setPhase('warning');
    }
  }, [bedMins, phase]);

  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  useEffect(() => {
    if (phase !== 'modal') {
      clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          logout();
          router.push('/login');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [phase, logout, router]);

  function handleLogout() {
    clearInterval(countdownRef.current);
    logout();
    router.push('/login');
  }

  if (!phase) return null;

  if (phase === 'warning') {
    const diff = bedMins - nowMins();
    return (
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-yellow-900/90 border-t border-yellow-700 px-5 py-3 flex items-center justify-between gap-3">
        <span className="text-yellow-200 text-sm">
          🌙 Bedtime in <strong>{diff} min</strong>
        </span>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { dismissedRef.current = true; setPhase(null); }}
            className="text-xs text-yellow-300 border border-yellow-700 rounded-lg px-3 py-1.5">
            Dismiss
          </button>
          <button onClick={handleLogout}
            className="text-xs bg-yellow-600 text-black font-bold rounded-lg px-3 py-1.5">
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5">
      <div className="bg-[var(--card)] rounded-3xl p-8 w-full max-w-sm text-center border border-[var(--border)]">
        <div className="text-5xl mb-4">🌙</div>
        <h2 className="text-2xl font-black text-white mb-2">Bedtime</h2>
        <p className="text-[var(--text-2)] text-sm mb-6">
          Logging out in <span className="text-[var(--danger)] font-bold text-lg">{countdown}s</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { clearInterval(countdownRef.current); dismissedRef.current = true; setPhase(null); }}
            className="flex-1 py-3 bg-[var(--card-2)] text-white rounded-xl text-sm font-medium border border-[var(--border)]">
            Stay
          </button>
          <button onClick={handleLogout}
            className="flex-1 py-3 bg-[var(--accent)] text-black rounded-xl text-sm font-bold">
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user } = useAuth();
  const [checkinPending, setCheckinPending] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [bedtime, setBedtime] = useState(null);

  useEffect(() => {
    getOnboardingStatus()
      .then(res => setNeedsOnboarding(!res.data.completed))
      .catch(() => setNeedsOnboarding(false))
      .finally(() => setOnboardingLoaded(true));

    getPending().then(res => setCheckinPending(res.data.pending)).catch(() => {});

    getProgramStatus()
      .then(res => {
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
    <div className="flex flex-col h-dvh bg-[var(--bg)]">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--card-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      <BottomNav />
      {checkinPending && <CheckinModal onClose={() => setCheckinPending(false)} />}
      {bedtime && <BedtimeGuard bedtime={bedtime} />}
    </div>
  );
}
