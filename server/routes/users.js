const router = require('express').Router();
const {
  updateUser, uploadPhoto, getProfileStats, getUniversalScores, getWorkoutBreakdown,
  getExerciseProgress, getMuscleVolume, getDailyScores, getMonthlyReport,
  saveStreakReflection, getBadges, getUniversalScoresWithTrend,
  getRepsStats, getRunningStats,
} = require('../controllers/usersController');
const { getVapidPublicKey, savePushSubscription, deletePushSubscription } = require('../utils/pushNotifications');
const auth   = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/stats',                  auth, getProfileStats);
router.get('/scores',                 auth, getUniversalScoresWithTrend);
router.get('/workout-breakdown',      auth, getWorkoutBreakdown);
router.get('/exercise-progress',      auth, getExerciseProgress);
router.get('/muscle-volume',          auth, getMuscleVolume);
router.get('/daily-scores/:yearMonth', auth, getDailyScores);
router.get('/monthly-report',         auth, getMonthlyReport);
router.get('/badges',                 auth, getBadges);
router.post('/streak-reflection',     auth, saveStreakReflection);
router.get('/reps-stats',             auth, getRepsStats);
router.get('/running-stats',          auth, getRunningStats);
router.get('/vapid-public-key',       getVapidPublicKey);
router.post('/push-subscription',     auth, savePushSubscription);
router.delete('/push-subscription',   auth, deletePushSubscription);
router.patch('/:id',                  auth, updateUser);
router.post('/:id/photo',             auth, upload.single('photo'), uploadPhoto);

module.exports = router;
