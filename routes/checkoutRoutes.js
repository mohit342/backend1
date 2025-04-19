const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');
const couponController = require('../controllers/couponController');
const userController = require('../controllers/userController');
const db = require('../config/db');
const axios = require('axios');

// Existing routes
router.post('/orders', CheckoutController.processCheckout);
router.post("/validate-coupon", couponController.validateCoupon);
router.get('/student-school-points/:userId', userController.getStudentSchoolPoints);

router.get('/schools/user/:userId/points', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log('Fetching points for userId:', userId);
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
      
      const formattedResults = results.map(result => ({
          school_name: result.school_name,
          purchase_amount: Number(result.purchase_amount) || 0,
          points_awarded: Number(result.points_awarded) || 0,
          latest_order_date: result.latest_order_date ? result.latest_order_date : null
      }));
      
      console.log("Formatted school rewards for SE", seId, ":", formattedResults);
      res.json(formattedResults);
  } catch (error) {
      console.error('Error fetching SE school rewards:', error);
      res.status(500).json({ error: 'Failed to fetch school rewards data' });
  }
});

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

    const formattedResults = results.map((result) => ({
      student_name: result.student_name || 'Unknown',
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

router.get('/validate-pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Invalid PIN code. Must be 6 digits.' });
    }

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

router.get('/se/:seId/points', async (req, res) => {
  try {
    const { seId } = req.params;
    const [result] = await db.query('SELECT redeem_points FROM se_employees WHERE employee_id = ?', [seId]);
    if (result.length === 0) {
      return res.status(404).json({ error: 'SE not found' });
    }
    res.json({ redeem_points: Number(result[0].redeem_points) || 0 });
  } catch (error) {
    console.error('Error fetching SE points:', error);
    res.status(500).json({ error: 'Failed to fetch SE points' });
  }
});

router.post('/redeem-request', async (req, res) => {
  try {
    const { seId, points } = req.body;

    if (!seId || !points) {
      return res.status(400).json({ error: 'SE ID and points are required' });
    }

    const [seResult] = await db.query('SELECT redeem_points FROM se_employees WHERE employee_id = ?', [seId]);
    if (seResult.length === 0) {
      return res.status(404).json({ error: 'SE not found' });
    }

    const currentPoints = Number(seResult[0].redeem_points) || 0;
    if (points > currentPoints) {
      return res.status(400).json({ error: 'Requested points exceed available balance' });
    }

    await db.query(
      'INSERT INTO redeem_requests (se_id, points, status) VALUES (?, ?, ?)',
      [seId, points, 'pending']
    );

    res.status(200).json({ message: 'Redeem request submitted successfully' });
  } catch (error) {
    console.error('Error submitting redeem request:', error);
    res.status(500).json({ error: 'Failed to submit redeem request' });
  }
});

// New route for school redeem request
router.post('/redeem-request-school', async (req, res) => {
  try {
    const { schoolId, points } = req.body;

    if (!schoolId || !points) {
      return res.status(400).json({ error: 'School ID and points are required' });
    }

    const [schoolResult] = await db.query('SELECT reward_points FROM schools WHERE user_id = ?', [schoolId]);
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const currentPoints = Number(schoolResult[0].reward_points) || 0;
    if (points > currentPoints) {
      return res.status(400).json({ error: 'Requested points exceed available balance' });
    }

    await db.query(
      'INSERT INTO school_redeem_requests (school_id, points, status) VALUES (?, ?, ?)',
      [schoolId, points, 'pending']
    );

    res.status(200).json({ message: 'Redeem request submitted successfully' });
  } catch (error) {
    console.error('Error submitting school redeem request:', error);
    res.status(500).json({ error: 'Failed to submit redeem request' });
  }
});

// New route for admin to fetch all school redeem requests
router.get('/school-redeem-requests', async (req, res) => {
  try {
    const query = `
      SELECT sr.id, sr.school_id, sr.points, sr.status, sr.created_at, sr.updated_at, s.school_name
      FROM school_redeem_requests sr
      JOIN schools s ON sr.school_id = s.user_id
      ORDER BY sr.created_at DESC
    `;
    const [results] = await db.query(query);

    const formattedResults = results.map(result => ({
      id: result.id,
      school_id: result.school_id,
      school_name: result.school_name,
      points: Number(result.points).toFixed(2),
      status: result.status,
      created_at: result.created_at.toISOString(),
      updated_at: result.updated_at.toISOString(),
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching school redeem requests:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch school redeem requests', details: error.message });
  }
});

// New route for admin to approve/reject school redeem requests
router.post('/school-redeem-request/:id/approve', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [request] = await connection.query('SELECT school_id, points, status FROM school_redeem_requests WHERE id = ?', [id]);
    if (request.length === 0) {
      throw new Error('Redeem request not found');
    }

    if (request[0].status !== 'pending') {
      throw new Error('Request has already been processed');
    }

    if (status === 'approved') {
      const [schoolResult] = await connection.query('SELECT reward_points FROM schools WHERE user_id = ?', [request[0].school_id]);
      if (schoolResult.length === 0) {
        throw new Error('School not found');
      }

      const currentPoints = Number(schoolResult[0].reward_points) || 0;
      if (request[0].points > currentPoints) {
        throw new Error('Insufficient points balance');
      }

      await connection.query(
        'UPDATE schools SET reward_points = reward_points - ? WHERE user_id = ?',
        [request[0].points, request[0].school_id]
      );
    }

    await connection.query('UPDATE school_redeem_requests SET status = ? WHERE id = ?', [status, id]);

    await connection.commit();
    res.json({ message: `Redeem request ${status} successfully` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`Error processing school redeem request ${id}:`, error);
    res.status(500).json({ error: `Failed to process redeem request: ${error.message}` });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/redeem-requests', async (req, res) => {
  try {
    const query = `
      SELECT rr.id, rr.se_id, rr.points, rr.status, rr.created_at, rr.updated_at
      FROM redeem_requests rr
      JOIN se_employees se ON rr.se_id = se.employee_id
      ORDER BY rr.created_at DESC
    `;
    const [results] = await db.query(query);

    const formattedResults = results.map(result => ({
      id: result.id,
      se_id: result.se_id,
      se_name: result.se_id,
      points: Number(result.points).toFixed(2),
      status: result.status,
      created_at: result.created_at.toISOString(),
      updated_at: result.updated_at.toISOString(),
    }));

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching redeem requests:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch redeem requests', details: error.message });
  }
});

router.post('/redeem-request/:id/approve', async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [request] = await connection.query('SELECT se_id, points, status FROM redeem_requests WHERE id = ?', [id]);
    if (request.length === 0) {
      throw new Error('Redeem request not found');
    }

    if (request[0].status !== 'pending') {
      throw new Error('Request has already been processed');
    }

    if (status === 'approved') {
      const [seResult] = await connection.query('SELECT redeem_points FROM se_employees WHERE employee_id = ?', [request[0].se_id]);
      if (seResult.length === 0) {
        throw new Error('SE not found');
      }

      const currentPoints = Number(seResult[0].redeem_points) || 0;
      if (request[0].points > currentPoints) {
        throw new Error('Insufficient points balance');
      }

      await connection.query(
        'UPDATE se_employees SET redeem_points = redeem_points - ? WHERE employee_id = ?',
        [request[0].points, request[0].se_id]
      );
    }

    await connection.query('UPDATE redeem_requests SET status = ? WHERE id = ?', [status, id]);

    await connection.commit();
    res.json({ message: `Redeem request ${status} successfully` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`Error processing redeem request ${id}:`, error);
    res.status(500).json({ error: `Failed to process redeem request: ${error.message}` });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;