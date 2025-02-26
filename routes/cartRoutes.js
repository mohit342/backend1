// routes/cartRoutes.js
const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Add item to cart
router.post("/add", async (req, res) => {
  const { userId, productId, quantity, sessionCartId  } = req.body;

  try {
    // Check if the product exists
    const [product] = await db.query("SELECT * FROM products WHERE id = ?", [productId]);
    if (product.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Find or create a cart for the user
    let cartId;

    if (userId) {
      // Logged-in user: Retrieve or create a cart
      let [cart] = await db.query("SELECT * FROM carts WHERE userId = ?", [userId]);
      if (cart.length === 0) {
        const [result] = await db.query("INSERT INTO carts (userId) VALUES (?)", [userId]);
        cartId = result.insertId;
      } else {
        cartId = cart[0].id;
      }
    } else {
      // Guest user: Use sessionCartId
      cartId = sessionCartId || `guest_${Date.now()}`;
    }

    // Check if item exists in the cart
    const [cartItem] = await db.query(
      "SELECT * FROM cart_items WHERE cartId = ? AND productId = ?",
      [cartId, productId]
    );

    if (cartItem.length > 0) {
      await db.query(
        "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
        [quantity, cartItem[0].id]
      );
    } else {
      await db.query(
        "INSERT INTO cart_items (cartId, productId, quantity) VALUES (?, ?, ?)",
        [cartId, productId, quantity]
      );
    }

    res.json({ success: true, message: "Item added to cart", cartId });
  } catch (err) {
    console.error("Error adding to cart:", err);
    res.status(500).json({ success: false, message: "Error adding to cart" });
  }
});

// Remove item from cart
router.post("/remove", async (req, res) => {
  const { userId, productId } = req.body;

  try {
    // Find the user's cart
    const [cart] = await db.query("SELECT * FROM carts WHERE userId = ?", [userId]);
    if (cart.length === 0) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Remove the item from the cart
    await db.query(
      "DELETE FROM cart_items WHERE cartId = ? AND productId = ?",
      [cart[0].id, productId]
    );

    res.json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("Error removing from cart:", err);
    res.status(500).json({ success: false, message: "Error removing from cart" });
  }
});

router.put("/update", async (req, res) => {
  const { userId, productId, quantity } = req.body;
  try {
    const [cart] = await db.query("SELECT * FROM carts WHERE userId = ?", [userId]);
    if (cart.length === 0) return res.status(404).json({ error: "Cart not found" });
    
    await db.query(
      "UPDATE cart_items SET quantity = ? WHERE cartId = ? AND productId = ?",
      [quantity, cart[0].id, productId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error updating quantity" });
  }
});

// Get cart items
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user's cart
    const [cart] = await db.query("SELECT * FROM carts WHERE userId = ?", [userId]);
    if (cart.length === 0) {
      return res.json({ success: true, data: { items: [] } });
    }

    // Get cart items with product details
    const [items] = await db.query(
        `SELECT ci.quantity, p.id, p.name, p.price, pi.image_url 
         FROM cart_items ci 
         JOIN products p ON ci.productId = p.id 
         LEFT JOIN product_images pi ON p.id = pi.product_id 
         WHERE ci.cartId = ?`,
        [cart[0].id]
      );
      

    // Group images by product
    const itemMap = {};
    items.forEach((row) => {
      if (!itemMap[row.id]) {
        itemMap[row.id] = {
          id: row.id,
          name: row.name,
          price: row.price,
          quantity: row.quantity,
          images: [],
        };
      }
      if (row.image_url) {
        itemMap[row.id].images.push(row.image_url.replace(/\\/g, "/"));

      }
    });

    const formattedItems = Object.values(itemMap);
    res.json({ success: true, data: { items: formattedItems } });
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ success: false, message: "Error fetching cart" });
  }
});

module.exports = router;