const ReviewModel = require("../models/reviewModel");

class ReviewController {
  static async getReviews(req, res) {
    try {
      const { productId } = req.params;
      const reviews = await ReviewModel.getReviewsByProductId(productId);
      console.log("Sending reviews:", reviews); // Debug log
      res.status(200).json({ data: reviews });
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async createReview(req, res) {
    try {
      const { userId, username, productId, rating, comment } = req.body;
      console.log("Received review data:", { userId, username, productId, rating, comment }); // Debug log

      // Validation
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }
      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      if (!comment) {
        return res.status(400).json({ error: "Comment is required" });
      }

      const review = await ReviewModel.createReview(userId, username, productId, rating, comment);
      res.status(201).json({ message: "Review added", data: review });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = ReviewController;