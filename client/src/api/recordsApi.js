import api from './axiosClient.js';
export const getRecords = () => api.get('/records');
