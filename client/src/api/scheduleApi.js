import api from './axiosClient.js';

export const getScheduleDay  = (date) => api.get(`/schedule/${date}`);
export const upsertScheduleDay = (date, body) => api.put(`/schedule/${date}`, body);
export const deleteScheduleDay = (date) => api.delete(`/schedule/${date}`);

export const coldPlungeDone = () => api.post('/schedule/cold-plunge/done');
export const showerStart    = () => api.post('/schedule/shower/start');
export const showerComplete = () => api.post('/schedule/shower/complete');
export const workStart      = () => api.post('/schedule/work/start');
export const workPause      = () => api.post('/schedule/work/pause');
export const workResume     = () => api.post('/schedule/work/resume');
export const workCheckout   = () => api.post('/schedule/work/checkout');
export const homeArrive     = () => api.post('/schedule/home/arrive');

export const createTodo  = (body) => api.post('/schedule/todos', body);
export const updateTodo  = (id, body) => api.put(`/schedule/todos/${id}`, body);
export const deleteTodo  = (id) => api.delete(`/schedule/todos/${id}`);
