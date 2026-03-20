const router = require('express').Router();
const auth = require('../middleware/auth');
const { getScore } = require('../controllers/consistencyController');

router.get('/score', auth, getScore);

module.exports = router;
