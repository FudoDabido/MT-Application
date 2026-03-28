const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getMonth, getDay, getEvents, createEvent, updateEvent, deleteEvent, cancelEvent } = require('../controllers/calendarController');

router.get('/events/:yearMonth', auth, getEvents);
router.post('/events',           auth, createEvent);
router.put('/events/:id',        auth, updateEvent);
router.delete('/events/:id',     auth, deleteEvent);
router.patch('/events/:id/cancel', auth, cancelEvent);
router.get('/:yearMonth',        auth, getMonth);
router.get('/day/:date',         auth, getDay);

module.exports = router;
