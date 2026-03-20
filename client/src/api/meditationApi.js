import api from './axiosClient.js';
export const getTodaySession   = ()           => api.get('/meditation/today');
export const startSession      = ()           => api.post('/meditation/start');
export const confirmPresence   = (session_id) => api.post('/meditation/confirm', { session_id });
export const failSession       = (session_id) => api.post('/meditation/fail',    { session_id });
