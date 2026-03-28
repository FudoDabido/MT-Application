const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getEntry, listEntries, upsertEntry, lockEntry, getLessons, createLesson } = require('../controllers/diaryController');

router.get('/entries',            auth, listEntries);
router.get('/entries/:date',      auth, getEntry);
router.put('/entries/:date',      auth, upsertEntry);
router.post('/entries/:date/lock',auth, lockEntry);
router.get('/lessons',            auth, getLessons);
router.post('/lessons',           auth, createLesson);

module.exports = router;
