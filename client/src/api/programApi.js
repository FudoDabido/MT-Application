import api from './axiosClient.js';
export const getProgramStatus = () => api.get('/program/status');
export const generatePreview = () => api.get('/program/generate');
export const setupProgram = (data) => api.post('/program/setup', data);
export const getProgramGrid = () => api.get('/program/grid');
export const getTodayPlan = () => api.get('/program/today');
export const resetProgram = () => api.post('/program/reset');
export const logDayWorkout = (data) => api.post('/program/log-day', data);
