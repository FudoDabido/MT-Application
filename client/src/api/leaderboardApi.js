import api from './axiosClient.js';
export const getLeaderboard = () => api.get('/leaderboard');
