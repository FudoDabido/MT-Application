import api from './axiosClient.js';

export const logWorkSession = (data) => api.post('/work-sessions', data);
export const getWorkSessions = (date) => api.get('/work-sessions' + (date ? '?date=' + date : ''));
