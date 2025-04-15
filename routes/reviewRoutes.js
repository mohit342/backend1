const express = require("express");
const ReviewController = require("../controllers/reviewController");

const router = express.Router();

router.get("/product/:productId", ReviewController.getReviews);
router.post("/", ReviewController.createReview);

module.exports = router;