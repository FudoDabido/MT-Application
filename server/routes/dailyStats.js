const router = require('express').Router();
const auth = require('../middleware/auth');
const { upsertDailyStats, getDailyStats } = require('../controllers/dailyStatsController');

router.get('/:date', auth, getDailyStats);
router.post('/', auth, upsertDailyStats);

module.exports = router;
