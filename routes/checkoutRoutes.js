const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');
const couponController=require('../controllers/couponController');
const userController=require('../controllers/userController');
const db = require('../config/db'); // Add this line if not already present
const axios = require('axios'); // Add axios for API calls
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

  // In your router file
// In your router file
// In your router file (e.g., checkout.js or rewards.js)

// In your router file (e.g., checkout.js or rewards.js)
router.get('/se/:seId/school-rewards', async (req, res) => {
  try {
      const { seId } = req.params;
      
      const query = `
          SELECT 
              s.school_name,
              CAST(COALESCE(SUM(o.total), 0) AS DECIMAL(10,2)) AS purchase_amount,
              CAST(COALESCE(SUM(cul.points_awarded), 0) AS DECIMAL(10,2)) AS points_awarded,
              MAX(o.created_at) AS latest_order_date
          FROM schools s
          LEFT JOIN orders o ON o.user_id = s.user_id
          LEFT JOIN coupon_usage_log cul ON cul.user_id = s.user_id 
              AND cul.order_total = o.total
              AND cul.created_at = o.created_at
          WHERE s.employee_id = ?
          GROUP BY s.id, s.school_name
          ORDER BY s.school_name
      `;
      
      const [results] = await db.query(query, [seId]);
      
      // Format results
      const formattedResults = results.map(result => ({
          school_name: result.school_name,
          purchase_amount: Number(result.purchase_amount) || 0,
          points_awarded: Number(result.points_awarded) || 0,
          latest_order_date: result.latest_order_date ? result.latest_order_date : null
      }));
      
      console.log("Formatted school rewards for SE", seId, ":", formattedResults); // Debug log
      res.json(formattedResults);
  } catch (error) {
      console.error('Error fetching SE school rewards:', error);
      res.status(500).json({ error: 'Failed to fetch school rewards data' });
  }
});


// In routes/checkout.js
// In routes/checkout.js
router.get('/schools/:schoolId/student-rewards', async (req, res) => {
  try {
    const { schoolId } = req.params;

    const query = `
      SELECT 
        CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS student_name,
        o.total AS order_amount,
        COALESCE(cul.points_awarded, 0) AS points_awarded,
        o.created_at AS purchase_date
      FROM orders o
      INNER JOIN students st ON o.user_id = st.user_id
      INNER JOIN users u ON o.user_id = u.id
      LEFT JOIN coupon_usage_log cul ON o.id = cul.order_id
      WHERE st.school_id = ?
      ORDER BY o.created_at DESC
    `;

    const [results] = await db.query(query, [schoolId]);

    // Format the results
    const formattedResults = results.map((result) => ({
      student_name: result.student_name || 'Unknown', // Fallback if name is incomplete
      order_amount: Number(result.order_amount).toFixed(2),
      points_awarded: Number(result.points_awarded).toFixed(2),
      purchase_date: result.purchase_date.toISOString().split('T')[0],
    }));

    console.log("Student rewards query results for schoolId", schoolId, ":", formattedResults);
    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching student rewards:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch student rewards data', details: error.message });
  }
});

// New endpoint for PIN code validation
router.get('/validate-pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Invalid PIN code. Must be 6 digits.' });
    }

    // Call external PIN code API
    const response = await axios.get(`http://www.postalpincode.in/api/pincode/${pincode}`);
    const data = response.data;

    if (data.Status !== 'Success') {
      return res.status(404).json({ error: 'PIN code not found.' });
    }

    const postOffice = data.PostOffice && data.PostOffice[0];
    if (!postOffice) {
      return res.status(404).json({ error: 'No data found for this PIN code.' });
    }

    res.json({
      city: postOffice.Taluk || postOffice.District,
      state: postOffice.State,
      pincode: pincode,
    });
  } catch (error) {
    console.error('Error validating PIN code:', error.message);
    res.status(500).json({ error: 'Failed to validate PIN code.' });
  }
});

module.exports = router;