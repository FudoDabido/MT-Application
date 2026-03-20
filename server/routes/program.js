const router = require('express').Router();
const auth = require('../middleware/auth');
const { getStatus, generatePreview, setupProgram, getGrid, getToday, resetProgram } = require('../controllers/programController');

router.get('/status', auth, getStatus);
router.get('/generate', auth, generatePreview);
router.post('/setup', auth, setupProgram);
router.get('/grid', auth, getGrid);
router.get('/today', auth, getToday);
router.post('/reset', auth, resetProgram);

module.exports = router;
