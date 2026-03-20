const router = require('express').Router();
const { updateUser } = require('../controllers/usersController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.patch('/:id', auth, updateUser);
router.post('/:id/photo', auth, upload.single('photo'), require('../controllers/usersController').uploadPhoto);

module.exports = router;
