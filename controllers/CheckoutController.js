
const CheckoutModel = require('../models/CheckoutModel');
const db = require('../config/db');

class CheckoutController {
  static async getCartItems(req, res) {
    try {
      const cartItems = await CheckoutModel.getCartItems();
      res.json(cartItems);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async processCheckout(req, res) {
    let connection;
    try {
      const { userId, fullName, email, address, city, state, pincode, phone, total, couponCode, cartItems } = req.body;
      console.log('Processing checkout with:', { userId, couponCode, total, cartItemsLength: cartItems?.length });
      connection = await db.getConnection();
      await connection.beginTransaction();

      let discount = 0;
      let couponTable = null;
      let schoolId = null;
      let seId = null;
      let pointsAwarded = 0;

      const [userResult] = await connection.query('SELECT user_type FROM users WHERE id = ?', [userId]);
      if (userResult.length === 0) {
        throw new Error("User not found");
      }
      const userType = userResult[0].user_type;
      console.log("UserId:", userId, "UserType:", userType);

      if (userType === 'student') {
        const [studentResult] = await connection.query('SELECT school_id FROM students WHERE user_id = ?', [userId]);
        if (studentResult.length === 0 || !studentResult[0].school_id) {
          throw new Error(`No valid school_id found for student with userId: ${userId}`);
        }
        schoolId = studentResult[0].school_id;
        console.log("Student SchoolId:", schoolId);
      } else if (userType === 'school') {
        const [schoolResult] = await connection.query('SELECT id, employee_id FROM schools WHERE user_id = ?', [userId]);
        if (schoolResult.length === 0) {
          throw new Error(`No school record found for userId: ${userId}`);
        }
        schoolId = schoolResult[0].id;
        seId = schoolResult[0].employee_id;
        console.log("School SchoolId:", schoolId, "SE EmployeeId:", seId);
      } else if (userType === 'se') {
        console.log("SE user detected, skipping reward points calculation");
      } else {
        throw new Error(`Unsupported user type: ${userType} for reward points calculation`);
      }

      if (couponCode && userType !== 'se') {
        let couponValid = false;
        let couponData = null;

        console.log('Validating coupon:', couponCode);

        // Check student coupons
        if (userType === 'student' && couponCode.startsWith('STU-')) {
          const [couponResult] = await connection.query(
            `SELECT * FROM student_coupons 
             WHERE code = ? 
             AND school_id = ?
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode, schoolId]
          );
          console.log('Student coupon query result:', couponResult);
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = 'student';
          }
        }
        // Check school coupons
        else if (userType === 'school' && couponCode.startsWith('SE-')) {
          const [couponResult] = await connection.query(
            `SELECT * FROM coupons 
             WHERE code = ? 
             AND school_id = ?
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode, schoolId]
          );
          console.log('School coupon query result:', couponResult);
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = 'coupon';
          }
        }
        // Check universal coupons (couponsall)
        else {
          const [couponResult] = await connection.query(
            `SELECT * FROM couponsall 
             WHERE code = ? 
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode]
          );
          console.log('Couponsall query result:', couponResult);
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = 'universal';
          }
        }

        if (!couponValid) {
          throw new Error(`Invalid or expired coupon: ${couponCode}`);
        }

        discount = (total * couponData.discount_percentage) / 100;
        console.log('Coupon applied:', { code: couponCode, discount_percentage: couponData.discount_percentage, discount });

        if (userType === 'school' && seId) {
          const [previousUsage] = await connection.query(
            `SELECT COUNT(*) as usage_count 
             FROM coupon_usage_log 
             WHERE coupon_code = ? 
             AND user_id = ?`,
            [couponCode, userId]
          );
          console.log("Previous coupon usage count for userId", userId, "and coupon", couponCode, ":", previousUsage[0].usage_count);

          if (previousUsage[0].usage_count === 0) {
            pointsAwarded = Math.floor(total / 100);
            console.log("First coupon use detected, awarding points:", pointsAwarded, "to SE:", seId);

            const [seCheck] = await connection.query(
              'SELECT employee_id FROM se_employees WHERE employee_id = ?',
              [seId]
            );
            if (seCheck.length > 0) {
              const [updateSEResult] = await connection.query(
                'UPDATE se_employees SET redeem_points = redeem_points + ? WHERE employee_id = ?',
                [pointsAwarded, seId]
              );
              console.log("SE Redeem Points updated - EmployeeId:", seId, "Points Added:", pointsAwarded);
              if (updateSEResult.affectedRows === 0) {
                console.warn(`No rows updated for SE employeeId: ${seId} - Update failed`);
              }
            } else {
              console.warn(`SE with employee_id ${seId} not found in se_employees table`);
            }
          } else {
            console.log("Coupon already used by this school, no points awarded.");
            pointsAwarded = 0;
          }
        } else if (userType === 'student' && schoolId) {
          pointsAwarded = Math.floor(total / 100);
          const [updateSchoolResult] = await connection.query(
            'UPDATE schools SET reward_points = reward_points + ? WHERE id = ?',
            [pointsAwarded, schoolId]
          );
          if (updateSchoolResult.affectedRows === 0) {
            throw new Error(`Failed to update reward points for schoolId: ${schoolId}`);
          }
          console.log("School Reward Points updated - SchoolId:", schoolId, "Points Added:", pointsAwarded);
        }

        try {
          await connection.query(
            `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, points_awarded, coupon_table) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, couponCode, discount, total, pointsAwarded, couponTable]
          );
        } catch (insertError) {
          console.error('Error inserting into coupon_usage_log:', insertError, { userId, couponCode, couponTable });
          throw insertError;
        }

        await connection.query(
          `UPDATE ${couponTable === 'coupon' ? 'coupons' : couponTable === 'student' ? 'student_coupons' : 'couponsall'} 
           SET current_uses = current_uses + 1 WHERE id = ?`,
          [couponData.id]
        );
      }

      const finalTotal = Math.max(0, total - discount);
      const result = await CheckoutModel.saveOrder({
        userId,
        fullName,
        email,
        address,
        city,
        state,
        pincode,
        phone,
        total: finalTotal,
        couponCode: couponCode || null,
        discountAmount: discount,
        items: cartItems
      });

      // Clear the user's cart
      const [cart] = await connection.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
      if (cart.length > 0) {
        await connection.query('DELETE FROM cart_items WHERE cartId = ?', [cart[0].id]);
        console.log(`Cleared cart items for userId: ${userId}, cartId: ${cart[0].id}`);
      } else {
        console.log(`No cart found for userId: ${userId}, nothing to clear`);
      }

      await connection.commit();
      res.json({ 
        message: 'Order placed successfully', 
        orderId: result.insertId, 
        discount,
        pointsAwarded: userType === 'student' ? pointsAwarded : 0,
        sePointsAwarded: userType === 'school' ? pointsAwarded : 0,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Error processing order:", error);
      res.status(500).json({ error: "Failed to process order: " + error.message });
    } finally {
      if (connection) connection.release();
    }
  }

  static async validateCoupon(req, res) {
    try {
      const { code, userId, userType } = req.body;

      console.log('Validating coupon in validateCoupon:', { code, userId, userType });

      if (!code) {
        return res.status(400).json({ error: "Coupon code is required" });
      }

      if (!userId) {
        return res.status(400).json({ error: "User authentication required to use coupons" });
      }

      if (!userType) {
        return res.status(400).json({ error: "User type is required" });
      }

      if (code.startsWith('SE-') && userType !== 'school') {
        return res.status(403).json({
          error: "This coupon can only be used by schools"
        });
      }

      if (code.startsWith('STU-') && userType !== 'student') {
        return res.status(403).json({
          error: "This coupon can only be used by students"
        });
      }

      let couponQuery, params, couponTable;

      if (code.startsWith('SE-')) {
        const [schoolResult] = await db.query(
          `SELECT id FROM schools WHERE user_id = ?`,
          [userId]
        );

        if (schoolResult.length === 0) {
          return res.status(403).json({ error: "No school profile found for this user" });
        }

        const schoolId = schoolResult[0].id;

        couponQuery = `
          SELECT *, 'coupon' AS coupon_table FROM coupons 
          WHERE code = ? 
          AND school_id = ? 
          AND valid_from <= CURRENT_TIMESTAMP 
          AND valid_until >= CURRENT_TIMESTAMP 
          AND COALESCE(current_uses, 0) < max_uses
        `;
        params = [code, schoolId];
        couponTable = 'coupon';

      } else if (code.startsWith('STU-')) {
        const [studentResult] = await db.query(
          `SELECT school_id FROM students WHERE user_id = ?`,
          [userId]
        );

        if (studentResult.length === 0) {
          return res.status(403).json({ error: "No student profile found for this user" });
        }

        const schoolId = studentResult[0].school_id;

        couponQuery = `
          SELECT *, 'student' AS coupon_table FROM student_coupons 
          WHERE code = ? 
          AND school_id = ? 
          AND valid_from <= CURRENT_TIMESTAMP 
          AND valid_until >= CURRENT_TIMESTAMP 
          AND COALESCE(current_uses, 0) < max_uses
        `;
        params = [code, schoolId];
        couponTable = 'student';

      } else {
        couponQuery = `
          SELECT *, 'universal' AS coupon_table FROM couponsall 
          WHERE code = ? 
          AND valid_from <= CURRENT_TIMESTAMP 
          AND valid_until >= CURRENT_TIMESTAMP 
          AND COALESCE(current_uses, 0) < max_uses
        `;
        params = [code];
        couponTable = 'universal';
      }

      const [couponResult] = await db.query(couponQuery, params);
      console.log('ValidateCoupon query result:', couponResult);

      if (couponResult.length === 0) {
        return res.status(400).json({
          error: "Invalid or expired coupon. This coupon may not be valid for your account."
        });
      }

      res.json({
        discount_percentage: couponResult[0].discount_percentage,
        coupon_table: couponTable,
        message: "Coupon applied successfully"
      });

    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CheckoutController;