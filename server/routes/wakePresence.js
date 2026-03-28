const router = require('express').Router();
const auth = require('../middleware/auth');
const { getToday, clockIn, clockOut, getStats } = require('../controllers/wakePresenceController');

router.get('/today',      auth, getToday);
router.post('/clock-in',  auth, clockIn);
router.post('/clock-out', auth, clockOut);
router.get('/stats',      auth, getStats);

module.exports = router;
