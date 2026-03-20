const router = require('express').Router();
const { getLeaderboard } = require('../controllers/leaderboardController');
const auth = require('../middleware/auth');

router.get('/', auth, getLeaderboard);

module.exports = router;
