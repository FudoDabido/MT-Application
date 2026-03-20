const router = require('express').Router();
const auth = require('../middleware/auth');
const { getToday, startSession, confirmPresence, failSession } = require('../controllers/meditationController');

router.get('/today', auth, getToday);
router.post('/start', auth, startSession);
router.post('/confirm', auth, confirmPresence);
router.post('/fail', auth, failSession);

module.exports = router;
