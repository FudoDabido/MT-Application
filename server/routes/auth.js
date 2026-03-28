const router = require('express').Router();
const { register, login, me, listUsers } = require('../controllers/authController');
const auth = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

router.post('/register', auth, requireAdmin, register);
router.post('/login', login);
router.get('/me', auth, me);
router.get('/users', auth, requireAdmin, listUsers);

module.exports = router;
