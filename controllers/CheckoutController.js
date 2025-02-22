const CheckoutModel = require('../models/checkoutModel');

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
            const { fullName, email, address, city, state, pincode, phone, total, couponCode } = req.body;
    
            let discount = 0;
        if (couponCode) {
            const coupon = await CheckoutModel.validateCoupon(couponCode);
            if (coupon) {
                discount = coupon.discount; // Ensure `discount` is a valid number
            }
        }

        const finalTotal = Math.max(0, total - discount); // Ensure total doesn't go negative

        const result = await CheckoutModel.saveOrder({
            fullName,
            email,
            address,
            city,
            state,
            pincode,
            phone,
            total: finalTotal
        });
    
        res.json({ message: 'Order placed successfully', orderId: result.insertId, discount });
    } catch (error) {
        console.error("Error processing order:", error); // Log the error for debugging
        res.status(500).json({ error: "Failed to process order" });
    }
}
    static async validateCoupon(req, res) {
        try {
            const { code } = req.body;
            const coupon = await CheckoutModel.validateCoupon(code);
    
            if (!coupon) {
                return res.status(400).json({ error: "Invalid or expired coupon" });
            }
    
            res.json({ discount_percentage: coupon.discount });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    
}

module.exports = CheckoutController;