import api from './axiosClient.js';

export const listEntries  = ()           => api.get('/diary/entries');
export const getEntry     = (date)       => api.get(`/diary/entries/${date}`);
export const upsertEntry  = (date, body) => api.put(`/diary/entries/${date}`, body);
export const lockEntry    = (date)       => api.post(`/diary/entries/${date}/lock`);
export const getLessons   = (q = '')     => api.get('/diary/lessons', { params: q ? { q } : {} });
export const createLesson = (body)       => api.post('/diary/lessons', body);
