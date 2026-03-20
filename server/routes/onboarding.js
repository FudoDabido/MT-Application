const router = require('express').Router();
const auth = require('../middleware/auth');
const { getStatus, getEquipment, completeOnboarding, getUserEquipment } = require('../controllers/onboardingController');

router.get('/status', auth, getStatus);
router.get('/equipment', auth, getEquipment);
router.get('/my-equipment', auth, getUserEquipment);
router.post('/complete', auth, completeOnboarding);

module.exports = router;
