const BulkOrder = require('../models/BulkOrder');

class BulkOrderController {
    static async submitOrder(req, res) {
        try {
            const orderData = req.body;

            // Basic validation
            if (!orderData.name || !orderData.email || !orderData.phone || 
                !orderData.product || !orderData.quantity) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const pool = req.app.get('mysqlPool');
            const orderId = await BulkOrder.create(pool, orderData);

            res.status(201).json({
                success: true,
                message: 'Order submitted successfully',
                orderId: orderId
            });
        } catch (error) {
            console.error('Error submitting order:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error' 
            });
        }
        
    }

    static async getAllOrders(req, res) {
        try {
            const pool = req.app.get('mysqlPool');
            const orders = await BulkOrder.getAll(pool);
            res.status(200).json(orders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = BulkOrderController;