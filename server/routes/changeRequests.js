const router = require('express').Router();
const auth   = require('../middleware/auth');
const { createRequest, getRequests } = require('../controllers/changeRequestsController');

router.post('/',  auth, createRequest);
router.get('/',   auth, getRequests);

module.exports = router;
