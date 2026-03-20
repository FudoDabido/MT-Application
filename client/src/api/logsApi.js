import api from './axiosClient.js';
export const createLog = (formData) => api.post('/logs', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getLogs = (params) => api.get('/logs', { params });
export const getTodaySummary = () => api.get('/logs/summary/today');
export const getWeeklySummary = () => api.get('/logs/summary/weekly');
export const getConsistency = () => api.get('/logs/consistency');
