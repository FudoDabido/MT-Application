const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/stretchCheckinController');

router.get('/today',    auth, ctrl.getToday);
router.post('/checkin', auth, ctrl.checkin);
router.post('/complete', auth, ctrl.completeStretch);
router.get('/stats',    auth, ctrl.getStats);

module.exports = router;
