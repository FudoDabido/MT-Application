const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getDay, upsertDay, deleteDay, createTodo, updateTodo, deleteTodo,
  coldPlungeDone, showerStart, showerComplete,
  workStart, workPause, workResume, workCheckout, homeArrive,
} = require('../controllers/scheduleController');

router.post('/cold-plunge/done', auth, coldPlungeDone);
router.post('/shower/start',    auth, showerStart);
router.post('/shower/complete', auth, showerComplete);
router.post('/work/start',      auth, workStart);
router.post('/work/pause',      auth, workPause);
router.post('/work/resume',     auth, workResume);
router.post('/work/checkout',   auth, workCheckout);
router.post('/home/arrive',     auth, homeArrive);

router.post('/todos',       auth, createTodo);
router.put('/todos/:id',    auth, updateTodo);
router.delete('/todos/:id', auth, deleteTodo);

router.get('/:date',    auth, getDay);
router.put('/:date',    auth, upsertDay);
router.delete('/:date', auth, deleteDay);

module.exports = router;
