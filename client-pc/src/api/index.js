import api from './client.js';

// Auth
export const login      = d => api.post('/auth/login', d);
export const getMe      = () => api.get('/auth/me');
export const listUsers  = () => api.get('/auth/users');
export const createUser = d => api.post('/auth/register', d);

// Users / Stats
export const getProfileStats      = () => api.get('/users/stats');
export const getUniversalScores   = () => api.get('/users/scores');
export const getWorkoutBreakdown  = () => api.get('/users/workout-breakdown');
export const getExerciseProgress  = () => api.get('/users/exercise-progress');
export const getMuscleVolume      = () => api.get('/users/muscle-volume');
export const getDailyScores       = ym => api.get(`/users/daily-scores/${ym}`);
export const getMonthlyReport     = ym => api.get(`/users/monthly-report?month=${ym}`);
export const getBadges            = () => api.get('/users/badges');

// Records
export const getRecords = () => api.get('/records');

// Logs
export const getLogs = (params={}) => api.get('/logs', { params });

// Program
export const getProgramStatus = () => api.get('/program/status');
export const getProgramGrid   = () => api.get('/program/grid');

// Presence / Training / Meditation / Stretch (today status)
export const getTodayPresence  = () => api.get('/wake-presence/today');
export const getTodayTraining  = () => api.get('/training-checkin/today');
export const getTodaySession   = () => api.get('/meditation/today');
export const getTodayStretch   = () => api.get('/stretch-checkin/today');

// Leaderboard + Challenges
export const getLeaderboard = (filter, sort) => api.get('/leaderboard', { params: { filter, sort } });
export const getChallenges  = () => api.get('/challenges');
export const searchUser     = q => api.get('/challenges/search', { params: { q } });
export const sendChallenge  = body => api.post('/challenges', body);

// Band / Health
export const getBandSummary      = ()          => api.get('/band/summary');
export const getSleepHistory     = (days=30)   => api.get(`/band/sleep?days=${days}`);
export const getHeartRateHistory = (days=30)   => api.get(`/band/heart-rate?days=${days}`);
export const getSpo2History      = (days=30)   => api.get(`/band/spo2?days=${days}`);
export const getStressHistory    = (days=30)   => api.get(`/band/stress?days=${days}`);
export const getActivityHistory  = (days=30)   => api.get(`/band/activity?days=${days}`);
export const getBandWorkouts     = (days=30)   => api.get(`/band/workouts?days=${days}`);
export const getFitnessMetrics   = (days=30)   => api.get(`/band/fitness?days=${days}`);
export const getBandSyncLog      = ()          => api.get('/band/sync-log');
export const importBandData      = body        => api.post('/band/import', body);
