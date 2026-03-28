'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext.jsx';
import Card from '../../../design-system/Card.jsx';
import Badge from '../../../design-system/Badge.jsx';
import Progress from '../../../design-system/Progress.jsx';
import Avatar from '../../../design-system/Avatar.jsx';
import { getProfileStats, getUniversalScores } from '../../../api/usersApi.js';
import { getTodayPresence } from '../../../api/wakePresenceApi.js';
import { getTodayTraining } from '../../../api/trainingCheckinApi.js';
import { getTodayStretch } from '../../../api/stretchCheckinApi.js';
import { getScheduleDay } from '../../../api/scheduleApi.js';
import { getProgramStatus } from '../../../api/programApi.js';
import MuscleLoadCard from '../../../components/MuscleLoadCard.jsx';

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ScoreRing({ score = 0 }) {
  const r = 54, circ = 2 * Math.PI * r;
  const dash = Math.min(1, Math.max(0, score / 100)) * circ;
  return (
    <svg width="140" height="140" className="rotate-[-90deg]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--card-2)" strokeWidth="10" />
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--accent)" strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} className="transition-all duration-700" />
    </svg>
  );
}

function TaskPill({ icon, label, done, late }) {
  return (
    <Link href="/schedule">
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
        done
          ? late ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'
                 : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50'
          : 'bg-[var(--card-2)] text-[var(--text-3)] border border-[var(--border)]'
      }`}>
        {icon} {label} {done ? (late ? '⚠' : '✓') : ''}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [scores,  setScores]  = useState(null);
  const [tasks,   setTasks]   = useState({});
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  const now      = new Date();
  const dateStr  = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const today    = now.toISOString().split('T')[0];

  useEffect(() => {
    Promise.allSettled([
      getProfileStats(),
      getUniversalScores(),
      getTodayPresence(),
      getTodayTraining(),
      getTodayStretch(),
      getScheduleDay(today),
      getProgramStatus(),
    ]).then(([st, sc, pr, tr, str, sched, prog]) => {
      if (st.status   === 'fulfilled') setStats(st.value.data);
      if (sc.status   === 'fulfilled') setScores(sc.value.data);
      if (prog.status === 'fulfilled') setProgram(prog.value.data);

      const presence  = pr.status   === 'fulfilled' ? pr.value.data : null;
      const training  = tr.status   === 'fulfilled' ? tr.value.data : null;
      const stretch   = str.status  === 'fulfilled' ? str.value.data : null;
      const dayPlan   = sched.status === 'fulfilled' ? sched.value.data : null;

      setTasks({
        wake:   { done: !!presence?.record?.clocked_in_at,  late: !!presence?.record?.late_wakeup },
        plunge: { done: !!dayPlan?.cold_plunge_done_at },
        train:  { done: training?.checkin?.status === 'completed' || training?.checkin?.status === 'passed',
                  late: !!training?.checkin?.late_checkin },
        shower: { done: !!dayPlan?.shower_completed_at },
        stretch:{ done: stretch?.checkin?.status === 'completed' || stretch?.checkin?.status === 'passed' },
      });
      setLoading(false);
    });
  }, [today]);

  const s = v => (v && typeof v === 'object') ? (v.score ?? 0) : (v ?? 0);
  const overallScore = scores
    ? Math.round((s(scores.on_time) + s(scores.workout_completion) + s(scores.consistency)) / 3)
    : 0;
  const consistency = scores ? s(scores.consistency) : 0;
  const avatarSrc = user?.photo_path ? `/${user.photo_path}` : null;

  return (
    <div className="flex flex-col gap-4 px-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[var(--text-3)] text-xs">{dateStr}</p>
          <h1 className="text-xl font-bold text-white">{greeting()}, {user?.name?.split(' ')[0]}</h1>
        </div>
        <Link href="/profile">
          <Avatar src={avatarSrc} name={user?.name} size="md" />
        </Link>
      </div>

      {/* Score ring */}
      <Card className="flex flex-col items-center py-5 gap-3">
        <div className="relative">
          <ScoreRing score={overallScore} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{overallScore}%</span>
            <span className="text-[10px] text-[var(--text-2)] uppercase tracking-wide">Discipline</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Badge variant="success">🔥 {stats?.streak ?? 0} day streak</Badge>
          {program?.active && <Badge variant="neutral">Day {program.current_day ?? 1} / 60</Badge>}
        </div>
      </Card>

      {/* Today's task status */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Today's Progress</h2>
          <Link href="/schedule" className="text-xs text-[var(--accent)]">Go to Schedule →</Link>
        </div>
        <Card className="flex flex-wrap gap-2">
          <TaskPill icon="⏰" label="Wake"     done={tasks.wake?.done}   late={tasks.wake?.late} />
          <TaskPill icon="🧊" label="Plunge"   done={tasks.plunge?.done} />
          <TaskPill icon="💪" label="Training" done={tasks.train?.done}  late={tasks.train?.late} />
          <TaskPill icon="🚿" label="Shower"   done={tasks.shower?.done} />
          <TaskPill icon="🤸" label="Stretch"  done={tasks.stretch?.done} />
        </Card>
      </div>

      {/* Consistency */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">Monthly Consistency</span>
          <span className="text-sm font-bold text-[var(--accent)]">{consistency}%</span>
        </div>
        <Progress value={consistency} />
      </Card>

      {/* Muscle load */}
      <MuscleLoadCard />

      <div className="h-2" />
    </div>
  );
}
