import api from './axiosClient.js';
export const getConsistencyScore = () => api.get('/consistency/score');
