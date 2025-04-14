const CheckoutModel = require('../models/checkoutModel');
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
          connection = await db.getConnection();
          await connection.beginTransaction();
      
          let discount = 0;
          let couponTable = null;
          let schoolId = null;
          let seId = null;
          let pointsAwarded = 0; // Points for the school
      
          const [userResult] = await connection.query('SELECT user_type FROM users WHERE id = ?', [userId]);
          if (userResult.length === 0) {
            throw new Error("User not found");
          }
          const userType = userResult[0].user_type;
          console.log("UserId:", userId, "UserType:", userType);
      
          // Fetch school_id based on user type
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
            seId = schoolResult[0].employee_id; // SE's employee_id linked to this school
            console.log("School SchoolId:", schoolId);
          } else {
            throw new Error(`Unsupported user type: ${userType} for reward points calculation`);
          }
      
          if (couponCode) {
            let couponValid = false;
            let couponData = null;
      
            if (userType === 'student' && couponCode.startsWith('STU-')) {
              const [couponResult] = await connection.query(
                `SELECT * FROM student_coupons 
                 WHERE code = ? 
                 AND school_id = ?
                 AND valid_from <= NOW() 
                 AND valid_until >= NOW() 
                 AND current_uses < max_uses`,
                [couponCode, schoolId]
              );
              if (couponResult.length === 0) {
                throw new Error(`Invalid or expired student coupon: ${couponCode} for schoolId: ${schoolId}`);
              }
              couponValid = true;
              couponData = couponResult[0];
              couponTable = 'student_coupons';
            } else if (userType === 'school' && couponCode.startsWith('SE-')) {
              const [couponResult] = await connection.query(
                `SELECT * FROM coupons 
                 WHERE code = ? 
                 AND school_id = ?
                 AND valid_from <= NOW() 
                 AND valid_until >= NOW() 
                 AND current_uses < max_uses`,
                [couponCode, schoolId]
              );
              if (couponResult.length === 0) {
                throw new Error(`Invalid or expired school coupon: ${couponCode} for schoolId: ${schoolId}`);
              }
              couponValid = true;
              couponData = couponResult[0];
              couponTable = 'coupons';
            }
      
            if (!couponValid) {
              throw new Error(`Invalid or expired coupon: ${couponCode}`);
            }
      
            discount = (total * couponData.discount_percentage) / 100;
            pointsAwarded = Math.floor(total / 100); // Points for the school
            console.log("Coupon applied - SchoolId:", schoolId, "Points Awarded:", pointsAwarded);
      
            if (userType === 'school' && seId) {
              // School applies coupon: Increase SE redeem_points
              const [updateSEResult] = await connection.query(
                'UPDATE se_employees SET redeem_points = redeem_points + ? WHERE employee_id = ?',
                [pointsAwarded, seId]
              );
              if (updateSEResult.affectedRows === 0) {
                throw new Error(`Failed to update redeem points for SE employeeId: ${seId} - SE not found`);
              }
              console.log("SE Redeem Points updated - EmployeeId:", seId, "Points Added:", pointsAwarded);
            } else if (userType === 'student' && schoolId) {
              // Student applies coupon: Increase school reward_points
              const [updateSchoolResult] = await connection.query(
                'UPDATE schools SET reward_points = reward_points + ? WHERE id = ?',
                [pointsAwarded, schoolId]
              );
              if (updateSchoolResult.affectedRows === 0) {
                throw new Error(`Failed to update reward points for schoolId: ${schoolId}`);
              }
              console.log("School Reward Points updated - SchoolId:", schoolId, "Points Added:", pointsAwarded);
            }
    
            // Log coupon usage
            await connection.query(
              `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, points_awarded, coupon_table) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [userId, couponCode, discount, total, pointsAwarded, couponTable]
            );
    
            // Increment coupon usage
            await connection.query(
              `UPDATE ${couponTable} SET current_uses = current_uses + 1 WHERE id = ?`,
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
      
          await connection.commit();
          res.json({ 
            message: 'Order placed successfully', 
            orderId: result.insertId, 
            discount,
            pointsAwarded: userType === 'student' ? pointsAwarded : 0, // School points for student
          sePointsAwarded: userType === 'school' ? pointsAwarded : 0, // SE points for school
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

            if (!code) {
                return res.status(400).json({ error: "Coupon code is required" });
            }

            if (!userId) {
                return res.status(400).json({ error: "User authentication required to use coupons" });
            }

            if (!userType) {
                return res.status(400).json({ error: "User type is required" });
            }

            // Initial validation based on coupon prefix and user type
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

            let couponQuery, params;

            // More detailed validation logic based on coupon prefix
            if (code.startsWith('SE-')) {
                // School coupon validation
                const [schoolResult] = await db.query(
                    `SELECT id FROM schools WHERE user_id = ?`,
                    [userId]
                );

                if (schoolResult.length === 0) {
                    return res.status(403).json({ error: "No school profile found for this user" });
                }

                const schoolId = schoolResult[0].id;

                couponQuery = `
                    SELECT * FROM coupons 
                    WHERE code = ? 
                    AND school_id = ? 
                    AND valid_from <= NOW() 
                    AND valid_until >= NOW() 
                    AND current_uses < max_uses
                `;
                params = [code, schoolId];

            } else if (code.startsWith('STU-')) {
                // Student coupon validation
                const [studentResult] = await db.query(
                    `SELECT school_id FROM students WHERE user_id = ?`,
                    [userId]
                );

                if (studentResult.length === 0) {
                    return res.status(403).json({ error: "No student profile found for this user" });
                }

                const schoolId = studentResult[0].school_id;

                couponQuery = `
                    SELECT * FROM student_coupons 
                    WHERE code = ? 
                    AND school_id = ? 
                    AND valid_from <= NOW() 
                    AND valid_until >= NOW() 
                    AND current_uses < max_uses
                `;
                params = [code, schoolId];

            } else {
                // Generic coupon check
                couponQuery = `
                    SELECT * FROM generic_coupons 
                    WHERE code = ? 
                    AND valid_from <= NOW() 
                    AND valid_until >= NOW() 
                    AND current_uses < max_uses
                `;
                params = [code];
            }

            const [couponResult] = await db.query(couponQuery, params);

            if (couponResult.length === 0) {
                return res.status(400).json({
                    error: "Invalid or expired coupon. This coupon may not be valid for your account."
                });
            }

            res.json({
                discount_percentage: couponResult[0].discount_percentage,
                message: "Coupon applied successfully"
            });

        } catch (error) {
            console.error("Error validating coupon:", error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = CheckoutController;