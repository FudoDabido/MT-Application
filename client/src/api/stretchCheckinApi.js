import api from './axiosClient.js';

export const getTodayStretch = () => api.get('/stretch-checkin/today');
export const checkinStretch  = () => api.post('/stretch-checkin/checkin');
export const completeStretch = () => api.post('/stretch-checkin/complete');
export const getStretchStats = () => api.get('/stretch-checkin/stats');
