const router = require('express').Router();
const { getPending, createCheckin } = require('../controllers/checkinsController');
const auth = require('../middleware/auth');

router.get('/pending', auth, getPending);
router.post('/', auth, createCheckin);

module.exports = router;
