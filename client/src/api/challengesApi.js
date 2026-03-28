import api from './axiosClient.js';
export const getChallenges  = () => api.get('/challenges');
export const searchUser     = (username) => api.get(`/challenges/search?username=${encodeURIComponent(username)}`);
export const sendChallenge  = (body) => api.post('/challenges', body);
