const Cart = require("../models/cartModel");

// Get all cart items
const getCart = (req, res) => {
  Cart.getCartItems((err, results) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json({ success: true, data: results });
  });
};

// Add item to cart
const addCartItem = (req, res) => {
  const { id, name, price, quantity, image } = req.body;
  if (!id || !name || !price || !quantity || !image) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  Cart.addToCart(req.body, (err) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json({ success: true, message: "Item added to cart" });
  });
};

// Update quantity
const updateCartItem = (req, res) => {
  const { quantity } = req.body;
  if (!quantity) return res.status(400).json({ success: false, message: "Quantity is required" });

  Cart.updateCartItem(req.params.id, quantity, (err) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json({ success: true, message: "Cart updated successfully" });
  });
};

// Remove item
const removeCartItem = (req, res) => {
  Cart.removeCartItem(req.params.id, (err) => {
    if (err) return res.status(500).json({ success: false, error: err });
    res.json({ success: true, message: "Item removed from cart" });
  });
};

module.exports = { getCart, addCartItem, updateCartItem, removeCartItem };
