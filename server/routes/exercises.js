const router = require('express').Router();
const { listExercises, createExercise } = require('../controllers/exercisesController');
const auth = require('../middleware/auth');

router.get('/', auth, listExercises);
router.post('/', auth, createExercise);

module.exports = router;
