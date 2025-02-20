const express = require('express');
const router = express.Router();
const { trackReward, getSeRewards} = require('../controllers/rewardController');
router.post('/rewards/track', trackReward);
router.get('/rewards/se/:se_employee_id', getSeRewards);
module.exports = router;