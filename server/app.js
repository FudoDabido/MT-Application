const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const errorHandler = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth');
const usersRoutes     = require('./routes/users');
const exercisesRoutes = require('./routes/exercises');
const logsRoutes      = require('./routes/logs');
const checkinsRoutes  = require('./routes/checkins');
const recordsRoutes   = require('./routes/records');
const leaderboardRoutes = require('./routes/leaderboard');
const onboardingRoutes  = require('./routes/onboarding');
const programRoutes     = require('./routes/program');
const calendarRoutes    = require('./routes/calendar');
const dailyStatsRoutes  = require('./routes/dailyStats');
const meditationRoutes  = require('./routes/meditation');
const consistencyRoutes  = require('./routes/consistency');
const wakePresenceRoutes    = require('./routes/wakePresence');
const trainingCheckinRoutes = require('./routes/trainingCheckin');
const stretchCheckinRoutes  = require('./routes/stretchCheckin');
const scheduleRoutes        = require('./routes/schedule');
const changeRequestsRoutes  = require('./routes/changeRequests');
const diaryRoutes           = require('./routes/diary');
const challengesRoutes      = require('./routes/challenges');
const bandRoutes            = require('./routes/band');
const workSessionRoutes     = require('./routes/workSession');
const tasksRoutes           = require('./routes/tasks');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(compression());
app.use(cors({
  origin: isProd ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',        authRoutes);
app.use('/api/users',       usersRoutes);
app.use('/api/exercises',   exercisesRoutes);
app.use('/api/logs',        logsRoutes);
app.use('/api/checkins',    checkinsRoutes);
app.use('/api/records',     recordsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/onboarding',  onboardingRoutes);
app.use('/api/program',     programRoutes);
app.use('/api/calendar',    calendarRoutes);
app.use('/api/daily-stats', dailyStatsRoutes);
app.use('/api/meditation',  meditationRoutes);
app.use('/api/consistency',    consistencyRoutes);
app.use('/api/wake-presence',     wakePresenceRoutes);
app.use('/api/training-checkin', trainingCheckinRoutes);
app.use('/api/stretch-checkin',  stretchCheckinRoutes);
app.use('/api/schedule',         scheduleRoutes);
app.use('/api/change-requests',  changeRequestsRoutes);
app.use('/api/diary',            diaryRoutes);
app.use('/api/challenges',       challengesRoutes);
app.use('/api/band',             bandRoutes);
app.use('/api/work-sessions',     workSessionRoutes);
app.use('/api/tasks',             tasksRoutes);

// ── Production: serve built React client ──────────────────────────────────────
if (isProd) {
  // PC dashboard (Vite SPA) served at /pc/*
  const pcDist = path.join(__dirname, '../client-pc/dist');
  app.use('/pc', express.static(pcDist));
  app.get('/pc', (req, res) => res.sendFile(path.join(pcDist, 'index.html')));
  app.get('/pc/*', (req, res) => res.sendFile(path.join(pcDist, 'index.html')));

  // Mobile app (Next.js static export) — catch-all
  const clientDist = path.join(__dirname, '../client/out');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
