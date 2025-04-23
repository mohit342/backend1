const CheckoutModel = require("../models/CheckoutModel");
const db = require("../config/db");

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
      const {
        userId,
        fullName,
        email,
        address,
        city,
        state,
        pincode,
        phone,
        total,
        couponCode,
        cartItems,
      } = req.body;
      console.log("Processing checkout with:", {
        userId,
        couponCode,
        total,
        cartItemsLength: cartItems?.length,
      });
  
      // Validate cartItems
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error("Cart items are required and must be a non-empty array");
      }
  
      connection = await db.getConnection();
      await connection.beginTransaction();
  
      let discount = 0;
      let couponTable = null;
      let schoolId = null;
      let seId = null;
      let schoolPointsAwarded = 0;
      let sePointsAwarded = 0;
      let seRole = null;
  
      const [userResult] = await connection.query(
        "SELECT user_type FROM users WHERE id = ?",
        [userId]
      );
      if (userResult.length === 0) {
        throw new Error("User not found");
      }
      const userType = userResult[0].user_type;
      console.log("UserId:", userId, "UserType:", userType);
  
      if (userType === "student") {
        const [studentResult] = await connection.query(
          "SELECT school_id FROM students WHERE user_id = ?",
          [userId]
        );
        if (studentResult.length === 0 || !studentResult[0].school_id) {
          throw new Error(
            `No valid school_id found for student with userId: ${userId}`
          );
        }
        schoolId = studentResult[0].school_id;
        console.log("Student SchoolId:", schoolId);
      } else if (userType === "school") {
        const [schoolResult] = await connection.query(
          "SELECT id, employee_id FROM schools WHERE user_id = ?",
          [userId]
        );
        if (schoolResult.length === 0) {
          throw new Error(`No school record found for userId: ${userId}`);
        }
        schoolId = schoolResult[0].id;
        seId = schoolResult[0].employee_id;
        console.log("School SchoolId:", schoolId, "SE EmployeeId:", seId);
      } else if (userType === "se") {
        console.log("SE user detected, skipping reward points calculation");
      } else {
        throw new Error(
          `Unsupported user type: ${userType} for reward points calculation`
        );
      }
  
      // Coupon handling logic
      if (couponCode && userType !== "se") {
        let couponValid = false;
        let couponData = null;
  
        console.log("Validating coupon:", couponCode);
  
        if (userType === "student" && couponCode.startsWith("STU-")) {
          const [couponResult] = await connection.query(
            `SELECT * FROM student_coupons 
             WHERE code = ? 
             AND school_id = ?
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode, schoolId]
          );
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = "student";
          }
        } else if (userType === "school" && couponCode.startsWith("SE-")) {
          const [couponResult] = await connection.query(
            `SELECT * FROM coupons 
             WHERE code = ? 
             AND school_id = ?
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode, schoolId]
          );
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = "coupon";
          }
        } else {
          const [couponResult] = await connection.query(
            `SELECT * FROM couponsall 
             WHERE code = ? 
             AND valid_from <= CURRENT_TIMESTAMP 
             AND valid_until >= CURRENT_TIMESTAMP 
             AND COALESCE(current_uses, 0) < max_uses`,
            [couponCode]
          );
          if (couponResult.length > 0) {
            couponValid = true;
            couponData = couponResult[0];
            couponTable = "universal";
          }
        }
  
        if (!couponValid) {
          throw new Error(`Invalid or expired coupon: ${couponCode}`);
        }
  
        discount = (total * couponData.discount_percentage) / 100;
        console.log("Coupon applied:", {
          code: couponCode,
          discount_percentage: couponData.discount_percentage,
          discount,
        });
  
        // Coupon usage logging
        if (userType === "student") {
          await connection.query(
            `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, coupon_table) 
             VALUES (?, ?, ?, ?, ?)`,
            [userId, couponCode, discount, total, couponTable]
          );
        } else if (userType === "school") {
          await connection.query(
            `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, points_awarded, coupon_table) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, couponCode, discount, total, schoolPointsAwarded, couponTable]
          );
        }
  
        await connection.query(
          `UPDATE ${
            couponTable === "coupon"
              ? "coupons"
              : couponTable === "student"
              ? "student_coupons"
              : "couponsall"
          } 
           SET current_uses = current_uses + 1 WHERE id = ?`,
          [couponData.id]
        );
      }
  
      const finalTotal = Math.max(0, total - discount);
  
      // Validate stock availability for each cart item
      for (const item of cartItems) {
        const productId = item.productId || item.id;
        const quantity = parseInt(item.quantity, 10);
  
        if (!productId || isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid product ID or quantity for item: ${JSON.stringify(item)}`);
        }
  
        const [productResult] = await connection.query(
          "SELECT stock_quantity FROM products WHERE id = ?",
          [productId]
        );
  
        if (productResult.length === 0) {
          throw new Error(`Product with ID ${productId} not found`);
        }
  
        const currentStock = parseInt(productResult[0].stock_quantity, 10);
        if (currentStock < quantity) {
          throw new Error(
            `Insufficient stock for product ID ${productId}. Available: ${currentStock}, Requested: ${quantity}`
          );
        }
      }
  
      // School reward calculation for student purchases
      if (userType === "student" && couponCode && schoolId) {
        try {
          console.log("Calculating rewards for school from student purchase, userId:", userId, "schoolId:", schoolId, "finalTotal:", finalTotal);
          const schoolRewardPointsPer100 = 2;
          schoolPointsAwarded = Math.floor(finalTotal / 100) * schoolRewardPointsPer100;
          if (schoolPointsAwarded <= 0) {
            console.warn(`No points awarded for school ${schoolId} (finalTotal: ${finalTotal})`);
          } else {
            console.log(`Updating school ${schoolId} with ${schoolPointsAwarded} points`);
            const [updateResult] = await connection.query(
              "UPDATE schools SET reward_points = reward_points + ? WHERE id = ?",
              [schoolPointsAwarded, schoolId]
            );
            console.log("Update result:", updateResult.affectedRows, "rows affected");
            if (updateResult.affectedRows === 0) {
              console.error("No rows updated for schoolId:", schoolId);
            }
  
            // Log the school points in coupon_usage_log for dashboard visibility
            await connection.query(
              `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, points_awarded, coupon_table, school_id) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [userId, couponCode, discount, finalTotal, schoolPointsAwarded, couponTable, schoolId]
            );
          }
        } catch (error) {
          console.error(`Error processing school rewards for school ${schoolId}:`, error.message, error.stack);
        }
      } else if (userType === "student" && !couponCode) {
        console.log(`No coupon applied for student purchase (userId: ${userId}). Skipping school points for school ${schoolId}.`);
      }
  
      // School reward calculation for school purchases
      if (userType === "school" && couponCode && schoolId) {
        try {
          console.log("Calculating rewards for school purchase, userId:", userId, "schoolId:", schoolId, "finalTotal:", finalTotal);
          const schoolRewardPointsPer100 = 2;
          schoolPointsAwarded = Math.floor(finalTotal / 100) * schoolRewardPointsPer100;
          if (serverPointsAwarded <= 0) {
            console.warn(`No points awarded for school ${schoolId} (finalTotal: ${finalTotal})`);
          } else {
            console.log(`Updating school ${schoolId} with ${schoolPointsAwarded} points`);
            const [updateResult] = await connection.query(
              "UPDATE schools SET reward_points = reward_points + ? WHERE id = ?",
              [schoolPointsAwarded, schoolId]
            );
            console.log("Update result:", updateResult.affectedRows, "rows affected");
            if (updateResult.affectedRows === 0) {
              console.error("No rows updated for schoolId:", schoolId);
            }
  
            // Update coupon_usage_log with points awarded
            await connection.query(
              `UPDATE coupon_usage_log 
               SET points_awarded = ? 
               WHERE user_id = ? AND coupon_code = ? AND order_total = ?`,
              [schoolPointsAwarded, userId, couponCode, finalTotal]
            );
          }
        } catch (error) {
          console.error(`Error processing school rewards for school ${schoolId}:`, error.message, error.stack);
        }
      } else if (userType === "school" && !couponCode) {
        console.log(`No coupon applied for school purchase (userId: ${userId}). Skipping school points for school ${schoolId}.`);
      }
  
      // SE reward calculation
      if (userType === "school" && seId && couponCode && couponTable) {
        try {
          if (!seId) {
            console.warn(`No valid SE ID found for school purchase (userId: ${userId})`);
          } else {
            const [seResult] = await connection.query(
              "SELECT role, redeem_points FROM se_employees WHERE employee_id = ?",
              [seId]
            );
  
            if (seResult.length === 0) {
              console.warn(`No SE found for employee_id: ${seId}`);
            } else {
              seRole = seResult[0].role;
              if (!seRole) {
                console.warn(`SE ${seId} has no role assigned`);
              } else {
                const rewardPointsPer100 = {
                  "Calling SE": 5,
                  "Field SE": 10,
                };
  
                const rewardPoints = rewardPointsPer100[seRole];
                if (!rewardPoints) {
                  console.warn(`Invalid SE role for ${seId}: ${seRole}`);
                } else {
                  sePointsAwarded = Math.floor(finalTotal / 100) * rewardPoints;
                  if (sePointsAwarded <= 0) {
                    console.warn(
                      `No points awarded for SE ${seId} (finalTotal: ${finalTotal}, role: ${seRole})`
                    );
                  } else {
                    await connection.query(
                      "UPDATE se_employees SET redeem_points = redeem_points + ? WHERE employee_id = ?",
                      [sePointsAwarded, seId]
                    );
                    console.log(
                      `Awarded ${sePointsAwarded} points to SE ${seId} (Role: ${seRole}, Final Total: ${finalTotal}, Coupon: ${couponCode})`
                    );
  
                    await connection.query(
                      `INSERT INTO coupon_usage_log 
                       (user_id, coupon_code, discount_amount, order_total, points_awarded, coupon_table, se_id, se_role) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        userId,
                        couponCode,
                        discount,
                        finalTotal,
                        sePointsAwarded,
                        couponTable,
                        seId,
                        seRole,
                      ]
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing SE rewards for SE ${seId}:`, error.message);
        }
      } else if (userType === "school" && seId && !couponCode) {
        console.log(`No coupon applied for school purchase (userId: ${userId}). Skipping SE points for SE ${seId}.`);
      }
  
      // Save order
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
        items: cartItems,
      });
  
      // Update stock quantities for each product
      for (const item of cartItems) {
        const productId = item.productId || item.id;
        const quantity = parseInt(item.quantity, 10);
  
        await connection.query(
          "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
          [quantity, productId]
        );
        console.log(`Reduced stock for product ID ${productId} by ${quantity}`);
      }
  
      // Log SE points in se_reward_log
      if (userType === "school" && seId && sePointsAwarded > 0) {
        try {
          await connection.query(
            `INSERT INTO se_reward_log (se_id, school_id, order_id, points_awarded, se_role, order_total) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [seId, schoolId, result.insertId, sePointsAwarded, seRole, finalTotal]
          );
        } catch (error) {
          console.error(`Error logging SE rewards for SE ${seId}:`, error.message);
        }
      }
  
      // Clear cart
      const [cart] = await connection.query(
        "SELECT id FROM carts WHERE user_id = ?",
        [userId]
      );
      if (cart.length > 0) {
        await connection.query("DELETE FROM cart_items WHERE cartId = ?", [
          cart[0].id,
        ]);
        console.log(
          `Cleared cart items for userId: ${userId}, cartId: ${cart[0].id}`
        );
      }
  
      await connection.commit();
      res.json({
        message: "Order placed successfully",
        orderId: result.insertId,
        discount,
        schoolPointsAwarded: couponCode ? schoolPointsAwarded : 0,
        sePointsAwarded: userType === "school" && couponCode ? sePointsAwarded : 0,
      });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Error processing order:", error.message, error.stack);
      res
        .status(500)
        .json({ error: "Failed to process order: " + error.message });
    } finally {
      if (connection) connection.release();
    }
  }
}

module.exports = CheckoutController;