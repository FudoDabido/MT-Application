const router = require('express').Router();
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl   = require('../controllers/trainingCheckinController');

router.get('/today',        auth, ctrl.getToday);
router.post('/checkin',     auth, ctrl.checkin);
router.post('/log-exercise', auth, upload.single('video'), ctrl.logExercise);
router.post('/complete',    auth, ctrl.completeTraining);
router.get('/stats',        auth, ctrl.getStats);
router.get('/tomorrow',     auth, ctrl.getTomorrow);
router.get('/alternatives', auth, ctrl.getAlternatives);
router.post('/override',    auth, ctrl.createOverride);
router.delete('/override',  auth, ctrl.deleteOverride);
router.post('/fail',              auth, ctrl.failTraining);
router.post('/admin-start',       auth, ctrl.adminStart);
router.post('/admin-reset-timer', auth, ctrl.adminResetTimer);

router.get("/stretch-recommendations", auth, ctrl.getStretchRecommendations);
router.post("/log-run", auth, ctrl.logRun);
router.get("/muscle-recovery", auth, ctrl.getMuscleRecovery);

module.exports = router;
