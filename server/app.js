const express = require('express');
const cors = require('cors');
const path = require('path');
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
const consistencyRoutes = require('./routes/consistency');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

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
app.use('/api/consistency', consistencyRoutes);

// ── Production: serve built React client ──────────────────────────────────────
if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(errorHandler);

module.exports = app;
