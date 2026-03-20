import api from './axiosClient.js';
export const getExercises = () => api.get('/exercises');
export const createExercise = (data) => api.post('/exercises', data);
