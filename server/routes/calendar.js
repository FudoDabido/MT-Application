const router = require('express').Router();
const auth = require('../middleware/auth');
const { getMonth, getDay } = require('../controllers/calendarController');

router.get('/:yearMonth', auth, getMonth);
router.get('/day/:date', auth, getDay);

module.exports = router;
