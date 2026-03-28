import api from './axiosClient.js';
export const getCalendarMonth  = (yearMonth) => api.get(`/calendar/${yearMonth}`);
export const getCalendarDay    = (date)       => api.get(`/calendar/day/${date}`);
export const getEvents         = (yearMonth)  => api.get(`/calendar/events/${yearMonth}`);
export const createEvent       = (data)       => api.post('/calendar/events', data);
export const updateEvent       = (id, data)   => api.put(`/calendar/events/${id}`, data);
export const deleteEvent       = (id)         => api.delete(`/calendar/events/${id}`);
export const cancelEvent       = (id)         => api.patch(`/calendar/events/${id}/cancel`);
