const CategoryModel = require('../models/categoryModel1');
const upload = require('../config/multerConfig');
const db=require("../config/db");
class CategoryController1 {
    static async getAllCategories(req, res) {
        try {
            const categories = await CategoryModel.getAllCategories();
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static createCategory(req, res) {
        upload.single('image')(req, res, async (err) => {
            if (err) return res.status(400).json({ error: err.message });
    
            try {
                const { categoryId, subcategoryId } = req.body;
                if (!req.file) return res.status(400).json({ error: "Image required" });
    
                // Validate subcategory belongs to category
                const [validSubcategory] = await db.query(
                    "SELECT 1 FROM subcategories WHERE id = ? AND category_id = ?",
                    [subcategoryId, categoryId]
                );
    
                if (!validSubcategory.length) {
                    return res.status(400).json({ 
                        error: "Subcategory does not belong to category" 
                    });
                }
    
                // Fetch subcategory name
                const [subcategory] = await db.query(
                    "SELECT name FROM subcategories WHERE id = ?",
                    [subcategoryId]
                );
                if (!subcategory.length) {
                    return res.status(400).json({ error: "Subcategory not found" });
                }
                const name = subcategory[0].name;
    
                const imagePath = `uploads/${req.file.filename}`;
                const id = await CategoryModel.createCategory(categoryId, subcategoryId, name, imagePath);
                res.status(201).json({ id, categoryId, subcategoryId, name, imagePath });
    
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    static async deleteCategory(req, res) {
        try {
            const { id } = req.params;
            await CategoryModel.deleteCategory(id);
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
}

module.exports = CategoryController1;
