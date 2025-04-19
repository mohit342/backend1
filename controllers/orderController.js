const Order = require("../models/orderModel");
const db = require("../config/db"); // Ensure db is imported for raw queries

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.getAllOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrdersByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const orders = await Order.getOrdersByEmail(email);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const orderId = await Order.createOrder(req.body);
    res.status(201).json({ message: "Order created successfully", orderId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const affectedRows = await Order.updateOrder(req.params.id, req.body);
    if (affectedRows === 0)
      return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const affectedRows = await Order.deleteOrder(req.params.id);
    if (affectedRows === 0)
      return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createReturnRequest = async (req, res) => {
  try {
    const { orderId, userId, reason } = req.body;
    if (!orderId || !userId || !reason) {
      return res
        .status(400)
        .json({ message: "Order ID, user ID, and reason are required" });
    }
    const requestId = await Order.createReturnRequest(orderId, userId, reason);
    res
      .status(201)
      .json({ message: "Return request created successfully", requestId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReturnRequests = async (req, res) => {
  try {
    const { order_id } = req.query;
    if (order_id) {
      const [rows] = await db.execute(
        "SELECT * FROM return_requests WHERE order_id = ?",
        [order_id]
      );
      // Return a consistent response even if no return request exists
      if (rows.length === 0) {
        return res.status(200).json({ status: null }); // No return request found
      }
      return res.status(200).json({ status: rows[0].status }); // Return the status of the first return request
    } else {
      const [rows] = await db.execute(
        "SELECT rr.*, o.email, o.full_name AS fullName, o.total, o.items FROM return_requests rr JOIN orders o ON rr.order_id = o.id"
      );
      // In getReturnRequests controller function
      // In the getReturnRequests controller
      // In the getReturnRequests controller
      const requests = rows.map((row) => {
        try {
          return {
            ...row,
            items: row.items ? JSON.parse(row.items) : [],
            total: Number(row.total), // Convert total to a number
          };
        } catch (error) {
          console.error("Error parsing data:", error);
          return { ...row, items: [], total: 0 };
        }
      });
      return res.status(200).json(requests);
    }
  } catch (error) {
    console.error("Error fetching return requests:", error);
    res.status(500).json({ message: "Failed to fetch return requests" });
  }
};

exports.updateReturnRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const affectedRows = await Order.updateReturnRequestStatus(
      requestId,
      status
    );
    if (affectedRows === 0)
      return res.status(404).json({ message: "Return request not found" });
    res.json({ message: `Return request ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
