const express = require("express");
const ReviewController = require("../controllers/reviewController");

const router = express.Router();

router.get("/product/:productId", ReviewController.getReviews);
router.get("/all", ReviewController.getAllReviews);
router.post("/", ReviewController.createReview);
router.put("/:id", ReviewController.updateReview);
router.delete("/:id", ReviewController.deleteReview);

module.exports = router;