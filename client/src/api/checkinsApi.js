import api from './axiosClient.js';
export const getPending = () => api.get('/checkins/pending');
export const createCheckin = (data) => api.post('/checkins', data);
