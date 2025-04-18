const db = require('../config/db');

// Generate random coupon code
const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Create a new coupon
exports.createCoupon = async (req, res) => {
  try {
    const { name, discount_percentage, valid_from, valid_until, max_uses } = req.body;

    // Validate inputs
    if (!name || !discount_percentage || !valid_from || !valid_until || !max_uses) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Generate unique coupon code
    let code;
    let isUnique = false;
    while (!isUnique) {
      code = generateCouponCode();
      const [rows] = await db.query('SELECT 1 FROM couponsall WHERE code = ?', [code]);
      if (rows.length === 0) {
        isUnique = true;
      }
    }

    // Insert coupon into database
    const [result] = await db.query(
      'INSERT INTO couponsall (name, code, discount_percentage, valid_from, valid_until, max_uses) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code, discount_percentage, valid_from, valid_until, max_uses]
    );

    // Fetch the created coupon
    const [rows] = await db.query('SELECT * FROM couponsall WHERE id = ?', [result.insertId]);
    const coupon = rows[0];

    res.status(201).json(coupon);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Fetch coupons for a user (compatible with existing endpoint)
exports.getUserCoupons = async (req, res) => {
  try {
    const userId = req.params.userId;
    // Fetch active coupons (you can add user-specific logic if needed)
    const [coupons] = await db.query(
      'SELECT * FROM couponsall WHERE name IS NOT NULL AND valid_from <= CURDATE() AND valid_until >= CURDATE() AND current_uses < max_uses'
    );
    res.status(200).json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
// exports.getSpecialCoupons = async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const [coupons] = await db.query(
//       'SELECT * FROM couponsall WHERE name IS NOT NULL AND valid_from <= CURDATE() AND valid_until >= CURDATE() AND current_uses < max_uses'
//     );
//     res.status(200).json(coupons);
//   } catch (error) {
//     console.error('Error fetching special coupons:', error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };