import api from "./axiosClient.js";
export const getLeaderboard = () => api.get("/leaderboard");
export const getUserStats = (userId) => api.get(`/leaderboard/user/${userId}`);
