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
      throw new Error("Error fetching reviews: " + error.message);
    }
  }

  static async getAllReviews() {
    try {
      const [rows] = await pool.query(
        "SELECT id, user_id, username, product_id, rating, comment, created_at FROM reviews ORDER BY created_at DESC"
      );
      return rows;
    } catch (error) {
      throw new Error("Error fetching all reviews: " + error.message);
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
      throw new Error("Error creating review: " + error.message);
    }
  }

  static async updateReview(id, rating, comment) {
    try {
      const [result] = await pool.query(
        "UPDATE reviews SET rating = ?, comment = ? WHERE id = ?",
        [rating, comment, id]
      );
      if (result.affectedRows === 0) {
        throw new Error("Review not found");
      }
      const [updated] = await pool.query(
        "SELECT id, user_id, username, product_id, rating, comment, created_at FROM reviews WHERE id = ?",
        [id]
      );
      return updated[0];
    } catch (error) {
      throw new Error("Error updating review: " + error.message);
    }
  }

  static async deleteReview(id) {
    try {
      const [result] = await pool.query("DELETE FROM reviews WHERE id = ?", [id]);
      if (result.affectedRows === 0) {
        throw new Error("Review not found");
      }
    } catch (error) {
      throw new Error("Error deleting review: " + error.message);
    }
  }
}

module.exports = ReviewModel;