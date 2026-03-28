const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/bandController');

router.get('/summary',    auth, c.getSummary);
router.get('/sleep',      auth, c.getSleep);
router.get('/heart-rate', auth, c.getHeartRate);
router.get('/spo2',       auth, c.getSpo2);
router.get('/stress',     auth, c.getStress);
router.get('/activity',   auth, c.getActivity);
router.get('/workouts',   auth, c.getWorkouts);
router.get('/fitness',    auth, c.getFitness);
router.get('/sync-log',   auth, c.getSyncLog);
router.post('/import',    auth, c.importData);

module.exports = router;
