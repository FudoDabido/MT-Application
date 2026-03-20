const router = require('express').Router();
const { getRecords } = require('../controllers/recordsController');
const auth = require('../middleware/auth');

router.get('/', auth, getRecords);

module.exports = router;
