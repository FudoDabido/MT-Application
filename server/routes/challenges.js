const router = require('express').Router();
const auth   = require('../middleware/auth');
const { searchUser, sendChallenge, getChallenges } = require('../controllers/challengesController');

router.get('/search', auth, searchUser);
router.get('/',       auth, getChallenges);
router.post('/',      auth, sendChallenge);

module.exports = router;
