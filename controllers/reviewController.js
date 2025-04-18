const ReviewModel = require("../models/reviewModel");

class ReviewController {
  static async getReviews(req, res) {
    try {
      const { productId } = req.params;
      const reviews = await ReviewModel.getReviewsByProductId(productId);
      res.status(200).json({ data: reviews });
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getAllReviews(req, res) {
    try {
      const reviews = await ReviewModel.getAllReviews();
      res.status(200).json({ data: reviews });
    } catch (error) {
      console.error("Get all reviews error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createReview(req, res) {
    try {
      const { userId, username, productId, rating, comment } = req.body;
      if (!userId || !username || !productId || !rating || !comment) {
        return res.status(400).json({ error: "All fields are required" });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const review = await ReviewModel.createReview(userId, username, productId, rating, comment);
      res.status(201).json({ message: "Review created", data: review });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async updateReview(req, res) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      if (!rating || !comment) {
        return res.status(400).json({ error: "Rating and comment are required" });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const review = await ReviewModel.updateReview(id, rating, comment);
      res.status(200).json({ message: "Review updated", data: review });
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteReview(req, res) {
    try {
      const { id } = req.params;
      await ReviewModel.deleteReview(id);
      res.status(200).json({ message: "Review deleted" });
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReviewController;