'use strict';
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { logSession, getSessions } = require('../controllers/workSessionController');

router.post('/',  auth, logSession);
router.get('/',   auth, getSessions);

module.exports = router;
