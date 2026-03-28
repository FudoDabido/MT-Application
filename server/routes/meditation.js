const router = require('express').Router();
const auth = require('../middleware/auth');
const { getToday, startSession, confirmPresence, failSession, getMode, setMode } = require('../controllers/meditationController');

router.get('/today',   auth, getToday);
router.post('/start',  auth, startSession);
router.post('/confirm', auth, confirmPresence);
router.post('/fail',   auth, failSession);
router.get('/mode',    auth, getMode);
router.put('/mode',    auth, setMode);

module.exports = router;
