const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { list, create, update, remove } = require('../controllers/tasksController');

router.get('/',     auth, list);
router.post('/',    auth, create);
router.put('/:id',  auth, update);
router.delete('/:id', auth, remove);

module.exports = router;
