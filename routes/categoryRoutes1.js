const express = require('express');
const CategoryController1 = require('../controllers/categoryController1');

const router1 = express.Router();

router1.get('/', CategoryController1.getAllCategories);
router1.post('/', CategoryController1.createCategory);
router1.delete('/:id', CategoryController1.deleteCategory);


module.exports = router1;
