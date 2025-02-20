// rewardController.js

const db = require('../config/db');

// Track reward when coupon is used
const trackReward = async (req, res) => {
  const { 
    se_employee_id, 
    coupon_code, 
    school_id, 
    discount_percentage, 
    discount_amount,
    order_id 
  } = req.body;

  try {
    await db.promise().query(`
      INSERT INTO reward_tracking (
        se_employee_id,
        coupon_code,
        school_id,
        discount_percentage,
        discount_amount,
        order_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [se_employee_id, coupon_code, school_id, discount_percentage, discount_amount, order_id]);

    // Update coupon usage count
    await db.promise().query(`
      UPDATE coupons 
      SET current_uses = current_uses + 1
      WHERE code = ?
    `, [coupon_code]);

    res.status(200).json({ message: 'Reward tracked successfully' });
  } catch (error) {
    console.error('Error tracking reward:', error);
    res.status(500).json({ error: 'Failed to track reward' });
  }
};

// Get rewards summary for SE
const getSeRewards = async (req, res) => {
  const { se_employee_id } = req.params;

  try {
    const [rewards] = await db.promise().query(`
      SELECT 
        rt.*,
        s.school_name,
        DATE_FORMAT(rt.created_at, '%Y-%m-%d') as date
      FROM reward_tracking rt
      JOIN schools s ON rt.school_id = s.id
      WHERE rt.se_employee_id = ?
      ORDER BY rt.created_at DESC
    `, [se_employee_id]);

    // Calculate summary statistics
    const [summary] = await db.promise().query(`
      SELECT 
        COUNT(DISTINCT school_id) as total_schools,
        COUNT(*) as total_orders,
        SUM(discount_amount) as total_discount_amount,
        AVG(discount_percentage) as avg_discount_percentage
      FROM reward_tracking
      WHERE se_employee_id = ?
    `, [se_employee_id]);

    res.status(200).json({
      rewards,
      summary: summary[0]
    });
  } catch (error) {
    console.error('Error fetching SE rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
};

module.exports = {
  trackReward,
  getSeRewards
};