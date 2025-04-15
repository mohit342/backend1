const pool = require("../config/database");

class ReviewModel {
  static async getReviewsByProductId(productId) {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, username, product_id, rating, comment, created_at FROM reviews WHERE product_id = ?",
        [productId]
      );
      return rows;
    } catch (error) {
      console.error("Error fetching reviews from DB:", error);
      throw new Error("Error fetching reviews: " + error.message);
    }
  }

  static async createReview(userId, username, productId, rating, comment) {
    try {
      const [result] = await pool.query(
        "INSERT INTO reviews (user_id, username, product_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
        [userId, username, productId, rating, comment]
      );
      return { id: result.insertId, user_id: userId, username, product_id: productId, rating, comment };
    } catch (error) {
      console.error("Error creating review in DB:", error);
      throw new Error("Error creating review: " + error.message);
    }
  }
}

module.exports = ReviewModel;