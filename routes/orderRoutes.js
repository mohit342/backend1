const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Return-related routes (place them FIRST)
router.get("/returns", orderController.getReturnRequests); // <-- Moved up
router.put("/returns/:requestId", orderController.updateReturnRequestStatus); 
router.post("/return", orderController.createReturnRequest);

// Other routes (keep them after specific routes)
router.get("/", orderController.getAllOrders);
router.get("/:id", orderController.getOrderById);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.get("/email/:email", orderController.getOrdersByEmail);
router.delete("/:id", orderController.deleteOrder);

module.exports = router;