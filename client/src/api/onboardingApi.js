import api from './axiosClient.js';
export const getOnboardingStatus = () => api.get('/onboarding/status');
export const getEquipmentList = () => api.get('/onboarding/equipment');
export const getUserEquipment = () => api.get('/onboarding/my-equipment');
export const completeOnboarding = (data) => api.post('/onboarding/complete', data);
