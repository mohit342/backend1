const express = require('express');
const router = express.Router();
const hotDealController = require('../controllers/hotDealController');

router.get('/hotdeals', hotDealController.getHotDeals);
router.put('/hotdeals/:id', hotDealController.upload.single('image'), hotDealController.updateHotDeal);
router.post('/hotdeals', hotDealController.upload.single('image'), hotDealController.createHotDeal);
router.delete('/hotdeals/:id', hotDealController.deleteHotDeal);

module.exports = router;