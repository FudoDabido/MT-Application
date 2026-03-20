const router = require('express').Router();
const { createLog, getLogs, getTodaySummary, getWeeklySummary, getConsistency } = require('../controllers/logsController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', auth, upload.single('video'), createLog);
router.get('/', auth, getLogs);
router.get('/summary/today', auth, getTodaySummary);
router.get('/summary/weekly', auth, getWeeklySummary);
router.get('/consistency', auth, getConsistency);

module.exports = router;
