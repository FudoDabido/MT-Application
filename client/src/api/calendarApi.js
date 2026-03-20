import api from './axiosClient.js';
export const getCalendarMonth = (yearMonth) => api.get(`/calendar/${yearMonth}`);
export const getCalendarDay = (date) => api.get(`/calendar/day/${date}`);
export const upsertDailyStats = (data) => api.post('/daily-stats', data);
