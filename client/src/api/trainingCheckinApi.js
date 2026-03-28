import api from './axiosClient.js';

export const getTodayTraining    = () => api.get('/training-checkin/today');
export const failTraining        = () => api.post('/training-checkin/fail');
export const checkinTraining     = (data = {}) => api.post('/training-checkin/checkin', data);
export const logExercise         = (formData) => api.post('/training-checkin/log-exercise', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const completeTraining    = () => api.post('/training-checkin/complete');
export const getTrainingStats    = () => api.get('/training-checkin/stats');
export const getTomorrowTraining = () => api.get('/training-checkin/tomorrow');
export const getAlternatives     = (slot, date) => api.get(`/training-checkin/alternatives?slot=${slot}&date=${date}`);
export const createOverride      = (body) => api.post('/training-checkin/override', body);
export const deleteOverride      = (body) => api.delete('/training-checkin/override', { data: body });
export const adminStartTraining  = () => api.post('/training-checkin/admin-start');
export const adminResetTimer     = () => api.post('/training-checkin/admin-reset-timer');

export const getStretchRecommendations = (date) => api.get('/training-checkin/stretch-recommendations' + (date ? '?date=' + date : ''));
export const getMuscleRecovery = (date) => api.get('/training-checkin/muscle-recovery' + (date ? '?date=' + date : ''));
export const logRun = (data) => api.post('/training-checkin/log-run', data);
