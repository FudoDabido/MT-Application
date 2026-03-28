const router = require('express').Router();
const auth = require('../middleware/auth');
const { getStatus, generatePreview, setupProgram, getGrid, getToday, resetProgram, logDay } = require('../controllers/programController');

router.get('/status', auth, getStatus);
router.get('/generate', auth, generatePreview);
router.post('/setup', auth, setupProgram);
router.get('/grid', auth, getGrid);
router.get('/today', auth, getToday);
router.post('/reset', auth, resetProgram);
router.post('/log-day', auth, logDay);

module.exports = router;
