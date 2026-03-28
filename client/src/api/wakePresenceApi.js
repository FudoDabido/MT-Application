import api from './axiosClient.js';

export const getTodayPresence = () => api.get('/wake-presence/today');
export const clockInPresence  = () => api.post('/wake-presence/clock-in');
export const clockOutPresence = () => api.post('/wake-presence/clock-out');
export const getPresenceStats = () => api.get('/wake-presence/stats');
