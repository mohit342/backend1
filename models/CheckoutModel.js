const db = require('../config/database');

class CheckoutModel {
  static async getCartItems() {
    try {
      const [rows] = await db.query('SELECT * FROM cart_items');
      // Convert price to number for each item
      return rows.map(item => ({
        ...item,
        price: Number(item.price)
      }));
    } catch (error) {
      throw error;
    }
  }

  static async saveOrder(orderData) {
    try {
      const [result] = await db.query(
        'INSERT INTO orders (full_name, email, address, city, state, pincode, phone, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          orderData.fullName,
          orderData.email,
          orderData.address,
          orderData.city,
          orderData.state,
          orderData.pincode,
          orderData.phone,
          orderData.total
        ]
      );
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async validateCoupon(code) {
    try {
      const [rows] = await db.query(
        "SELECT * FROM coupons WHERE code = ? AND is_active = 1",
        [code]
      );
  
      if (rows.length === 0) {
        return null; // No valid coupon found
      }
  
      const coupon = rows[0];
      return { discount: Number(coupon.discount_percentage) }; // Return 'discount' instead // Ensure it's a number
    } catch (error) {
      throw error;
    }
  }




}

module.exports = CheckoutModel;