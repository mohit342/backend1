const db = require("../config/db");

class Order {
  static async getAllOrders() {
    const [rows] = await db.execute("SELECT * FROM orders");
    return rows;
  }

  static async getOrderById(id) {
    const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [id]);
    return rows[0];
  }

  static async createOrder(orderData) {
    const { userId, fullName, email, address, city, state, pincode, phone, couponCode, items } = orderData;
    const total = parseFloat(orderData.total); // Ensure total is a number
  
    const [result] = await db.execute(
      "INSERT INTO orders (userId, fullName, email, address, city, state, pincode, phone, total, couponCode, items, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [userId, fullName, email, address, city, state, pincode, phone, total, couponCode, JSON.stringify(items)]
    );
    return result.insertId;
  }
  
  static async updateOrder(id, orderData) {
    const { address, city, state, pincode, phone, couponCode, items } = orderData;
    const total = parseFloat(orderData.total); // Ensure total is a number
  
    const [result] = await db.execute(
      "UPDATE orders SET address = ?, city = ?, state = ?, pincode = ?, phone = ?, total = ?, couponCode = ?, items = ? WHERE id = ?",
      [address, city, state, pincode, phone, total, couponCode, JSON.stringify(items), id]
    );
    return result.affectedRows;
  }
  
  static async deleteOrder(id) {
    const [result] = await db.execute("DELETE FROM orders WHERE id = ?", [id]);
    return result.affectedRows;
  }

  static async getOrdersByEmail(email) {
    const [rows] = await db.execute("SELECT * FROM orders WHERE email = ?", [email]);
    return rows;
  }

  static async createReturnRequest(orderId, userId, reason) {
    const [result] = await db.execute(
      "INSERT INTO return_requests (order_id, user_id, reason, status, created_at) VALUES (?, ?, ?, 'pending', NOW())",
      [orderId, userId, reason]
    );
    return result.insertId;
  }

  static async getReturnRequests() {
    const [rows] = await db.execute(
      `SELECT rr.id, rr.order_id, rr.user_id, rr.reason, rr.status, rr.created_at, rr.updated_at,
              o.email, o.fullName, o.total, o.items
       FROM return_requests rr
       JOIN orders o ON rr.order_id = o.id`
    );
    return rows.map(row => ({
      ...row,
      items: JSON.parse(row.items)
    }));
  }

  static async updateReturnRequestStatus(requestId, status) {
    const [result] = await db.execute(
      "UPDATE return_requests SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, requestId]
    );
    return result.affectedRows;
  }

  static async getReturnRequestByOrderId(orderId) {
    const [rows] = await db.execute(
      "SELECT * FROM return_requests WHERE order_id = ?",
      [orderId]
    );
    return rows[0];
  }
}

module.exports = Order;