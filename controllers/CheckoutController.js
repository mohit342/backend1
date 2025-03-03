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
                couponCode 
            } = req.body;
    
            let discount = 0;
            
            // Verify coupon belongs to this user if a coupon is provided
            if (couponCode) {
                try {
                    // Get user type first to determine which coupon table to check
                    const [userResult] = await db.promise().query(
                        'SELECT user_type FROM users WHERE id = ?',
                        [userId]
                    );

                    if (userResult.length === 0) {
                        return res.status(400).json({ error: "User not found" });
                    }

                    const userType = userResult[0].user_type;
                    let couponValid = false;
                    let couponTable = '';
                    let couponData = null;
                    
                    // Validate coupon based on prefix and user type
                    if (couponCode.startsWith('SE-') && userType === 'school') {
                        // Check school coupon
                        const [schoolResult] = await db.promise().query(
                            'SELECT id FROM schools WHERE user_id = ?',
                            [userId]
                        );
                        
                        if (schoolResult.length > 0) {
                            const schoolId = schoolResult[0].id;
                            
                            const [couponResult] = await db.promise().query(
                                `SELECT * FROM coupons 
                                WHERE code = ? 
                                AND school_id = ?
                                AND valid_from <= NOW() 
                                AND valid_until >= NOW() 
                                AND current_uses < max_uses`,
                                [couponCode, schoolId]
                            );
                            
                            if (couponResult.length > 0) {
                                couponValid = true;
                                couponData = couponResult[0];
                                couponTable = 'coupons';
                            }
                        }
                    } else if (couponCode.startsWith('STU-') && userType === 'student') {
                        // Check student coupon
                        const [studentResult] = await db.promise().query(
                            'SELECT school_id FROM students WHERE user_id = ?',
                            [userId]
                        );
                        
                        if (studentResult.length > 0) {
                            const schoolId = studentResult[0].school_id;
                            
                            const [couponResult] = await db.promise().query(
                                `SELECT * FROM student_coupons 
                                WHERE code = ? 
                                AND school_id = ?
                                AND valid_from <= NOW() 
                                AND valid_until >= NOW() 
                                AND current_uses < max_uses`,
                                [couponCode, schoolId]
                            );
                            
                            if (couponResult.length > 0) {
                                couponValid = true;
                                couponData = couponResult[0];
                                couponTable = 'student_coupons';
                            }
                        }
                    } else if (!couponCode.startsWith('SE-') && !couponCode.startsWith('STU-')) {
                        // Check generic coupons (for all user types)
                        const [couponResult] = await db.promise().query(
                            `SELECT * FROM generic_coupons 
                            WHERE code = ? 
                            AND valid_from <= NOW() 
                            AND valid_until >= NOW() 
                            AND current_uses < max_uses`,
                            [couponCode]
                        );
                        
                        if (couponResult.length > 0) {
                            couponValid = true;
                            couponData = couponResult[0];
                            couponTable = 'generic_coupons';
                        }
                    } else {
                        // Coupon prefix doesn't match user type
                        return res.status(400).json({ 
                            error: "This coupon is not applicable for your account type"
                        });
                    }
                    
                    if (!couponValid) {
                        return res.status(400).json({ 
                            error: "Invalid or expired coupon, or this coupon is not applicable to your account" 
                        });
                    }
                    
                    // Calculate discount
                    discount = (total * couponData.discount_percentage) / 100;
                    
                    // Update coupon usage
                    await db.promise().query(
                        `UPDATE ${couponTable} SET current_uses = current_uses + 1 WHERE id = ?`,
                        [couponData.id]
                    );
                    
                    // Log coupon usage
                    await db.promise().query(
                        `INSERT INTO coupon_usage_log (user_id, coupon_code, discount_amount, order_total, coupon_table) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [userId, couponCode, discount, total, couponTable]
                    );
                } catch (error) {
                    console.error("Error validating coupon during checkout:", error);
                    return res.status(500).json({ error: "Error validating coupon" });
                }
            }

            const finalTotal = Math.max(0, total - discount); // Ensure total doesn't go negative

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
                discountAmount: discount
            });
    
            res.json({ 
                message: 'Order placed successfully', 
                orderId: result.insertId, 
                discount 
            });
        } catch (error) {
            console.error("Error processing order:", error);
            res.status(500).json({ error: "Failed to process order" });
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
                const [schoolResult] = await db.promise().query(
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
                const [studentResult] = await db.promise().query(
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
            
            const [couponResult] = await db.promise().query(couponQuery, params);
            
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