const db = require('../config/db');

const Cart = {
    getCartItems: (callback) => {
        db.query("SELECT id, name, price, quantity, image FROM cart_items", callback);
      },
      
  
  addToCart: (item, callback) => {
    const { id, name, price, quantity, image } = item;
    
    // Check if item already exists in cart
    db.query("SELECT * FROM cart_items WHERE id = ?", [id], (err, results) => {
      if (err) return callback(err);
      
      if (results.length > 0) {
        // Update quantity if item exists
        db.query(
          "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
          [quantity, id],
          callback
        );
      } else {
        // Add new item if it doesn't exist
        db.query(
          "INSERT INTO cart_items (id, name, price, quantity, image) VALUES (?, ?, ?, ?, ?)",
          [id, name, price, quantity, image],
          callback
        );
      }
    });
  },
  
  updateCartItem: (id, quantity, callback) => {
    db.query(
      "UPDATE cart_items SET quantity = ? WHERE id = ?",
      [quantity, id],
      callback
    );
  },
  
  removeCartItem: (id, callback) => {
    db.query("DELETE FROM cart_items WHERE id = ?", [id], callback);
  }
};

module.exports = Cart;