const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');
const couponController=require('../controllers/couponController');
const userController=require('../controllers/userController');
const db = require('../config/db'); // Add this line if not already present
// router.get('/cart', CheckoutController.getCartItems);
// router.post('/checkout', CheckoutController.processCheckout);

router.post('/orders', CheckoutController.processCheckout);
router.post("/validate-coupon", couponController.validateCoupon);
// router.get('/cart/:userId', CheckoutController.getUserCartItems);
// router.post('/cart/add', CheckoutController.addToCart);
router.get('/student-school-points/:userId', userController.getStudentSchoolPoints);


// New endpoint for fetching school reward points
router.get('/schools/user/:userId/points', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log('Fetching points for userId:', userId); // Debug log
      const [result] = await db.query('SELECT reward_points FROM schools WHERE user_id = ?', [userId]);
      if (result.length === 0) {
        return res.status(404).json({ error: 'School not found for this user' });
      }
      res.json({ reward_points: result[0].reward_points });
    } catch (error) {
      console.error('Error fetching reward points:', error);
      res.status(500).json({ error: 'Failed to fetch reward points' });
    }
  });
  router.get('/orders/email/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const [rows] = await db.query('SELECT * FROM orders WHERE email = ?', [email]);
      const ordersWithItems = rows.map(order => ({
        ...order,
        items: JSON.parse(order.items).map(item => ({
          ...item,
          image: item.image || `default/image.jpg` // Ensure image field
        }))
      }));
      res.json(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });
module.exports = router;