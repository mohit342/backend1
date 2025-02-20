const db = require('../config/db');

const applyCoupon = async (req, res) => {
  const { couponCode, orderAmount } = req.body;

  if (!couponCode || !orderAmount) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'Both couponCode and orderAmount are required'
    });
  }

  try {
    // Get coupon details and validate
    const [couponResults] = await db.promise().query(`
      SELECT 
        c.*,
        COUNT(cu.coupon_id) as times_used
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      WHERE c.coupon_code = ?
      GROUP BY c.id
    `, [couponCode.toUpperCase()]);

    if (!couponResults || couponResults.length === 0) {
      return res.status(404).json({
        error: 'Invalid coupon code',
        details: 'The coupon code entered does not exist'
      });
    }

    const coupon = couponResults[0];

    // Validate coupon
    const validationError = await validateCouponDetails(coupon, orderAmount);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    // Calculate discount
    const discountAmount = (orderAmount * coupon.discount_percentage) / 100;
    const finalPrice = orderAmount - discountAmount;

    // Record coupon usage
    await recordCouponUsage(coupon.id, req.user?.id); // Assuming you have user authentication

    res.status(200).json({
      message: 'Coupon applied successfully',
      discountPercentage: coupon.discount_percentage,
      originalPrice: orderAmount,
      discountedPrice: finalPrice,
      savings: discountAmount
    });

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({
      error: 'Failed to apply coupon',
      details: error.message
    });
  }
};

const validateCouponDetails = async (coupon, orderAmount) => {
  const currentDate = new Date();
  const validFrom = new Date(coupon.valid_from);
  const validUntil = new Date(coupon.valid_until);

  // Check if coupon is active
  if (currentDate < validFrom) {
    return {
      error: 'Coupon not yet active',
      details: `This coupon will be valid from ${validFrom.toLocaleDateString()}`
    };
  }

  if (currentDate > validUntil) {
    return {
      error: 'Coupon expired',
      details: `This coupon expired on ${validUntil.toLocaleDateString()}`
    };
  }

  // Check usage limit
  if (coupon.times_used >= coupon.max_uses) {
    return {
      error: 'Coupon usage limit reached',
      details: 'This coupon has reached its maximum number of uses'
    };
  }

  // Add minimum order amount check if needed
  if (coupon.minimum_order && orderAmount < coupon.minimum_order) {
    return {
      error: 'Order amount too low',
      details: `Minimum order amount for this coupon is $${coupon.minimum_order}`
    };
  }

  return null;
};

const recordCouponUsage = async (couponId, userId) => {
  try {
    await db.promise().query(`
      INSERT INTO coupon_usage (
        coupon_id,
        user_id,
        used_at
      ) VALUES (?, ?, NOW())
    `, [couponId, userId]);
  } catch (error) {
    console.error('Error recording coupon usage:', error);
    throw new Error('Failed to record coupon usage');
  }
};

const validateCoupon = async (req, res) => {
  const { code } = req.params;

  try {
    const [couponResults] = await db.promise().query(`
      SELECT 
        c.*,
        COUNT(cu.coupon_id) as times_used
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      WHERE c.coupon_code = ?
      GROUP BY c.id
    `, [code.toUpperCase()]);

    if (!couponResults || couponResults.length === 0) {
      return res.status(404).json({
        error: 'Coupon not found',
        details: 'The provided coupon code does not exist'
      });
    }

    const coupon = couponResults[0];
    const validationError = await validateCouponDetails(coupon, 0);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    res.status(200).json({
      valid: true,
      discountPercentage: coupon.discount_percentage,
      validUntil: coupon.valid_until,
      minimumOrder: coupon.minimum_order || 0
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      error: 'Failed to validate coupon',
      details: error.message
    });
  }
};

module.exports = {
  applyCoupon,
  validateCoupon
};