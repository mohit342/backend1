// categoryRoutes.js
const express = require('express');
const router = express.Router();
const {
    addCategory,
    getCategories,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    addSubSubcategory,
    updateSubSubcategory,
    deleteSubcategory,
    deleteSubSubcategory,
    getSubcategories
} = require('../controllers/categoryController');

// Category routes
router.post('/categories', addCategory);
router.get('/categories', getCategories);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Subcategory routes
router.get('/categories/:categoryId/subcategories', getSubcategories);

router.post('/categories/:categoryId/subcategories', addSubcategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId', updateSubcategory);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', deleteSubcategory);

// Sub-subcategory routes
router.post('/categories/:categoryId/subcategories/:subcategoryId/subsubcategories', addSubSubcategory);
router.put('/categories/:categoryId/subcategories/:subcategoryId/subsubcategories/:subSubcategoryId', updateSubSubcategory);
router.delete('/categories/:categoryId/subcategories/:subcategoryId/subsubcategories/:subSubcategoryId', deleteSubSubcategory);

module.exports = router;