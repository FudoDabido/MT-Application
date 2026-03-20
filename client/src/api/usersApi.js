import api from './axiosClient.js';
export const updateUser = (id, data) => api.patch(`/users/${id}`, data);
export const uploadPhoto = (id, formData) => api.post(`/users/${id}/photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
