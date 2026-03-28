import api from './axiosClient.js';
export const getTodaySession   = ()                  => api.get('/meditation/today');
export const startSession      = (slot)              => api.post('/meditation/start', slot ? { slot } : {});
export const confirmPresence   = (session_id)        => api.post('/meditation/confirm', { session_id });
export const failSession       = (session_id)        => api.post('/meditation/fail',    { session_id });
export const getMeditationMode = ()                  => api.get('/meditation/mode');
export const setMeditationMode = (meditation_mode)   => api.put('/meditation/mode', { meditation_mode });
