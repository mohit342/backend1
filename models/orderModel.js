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
  
  
}

module.exports = Order;
