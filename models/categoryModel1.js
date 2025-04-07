const pool = require('../config/db');

class CategoryModel1 {
    static async getAllCategories() {
        const [rows] = await pool.query('SELECT * FROM featured_categories');
        return rows;
    }

    static async createCategory(categoryId, subcategoryId, name, imagePath) {
        const [result] = await pool.query(
            'INSERT INTO featured_categories (category_id, subcategory_id, name, image_path) VALUES (?, ?, ?, ?)',
            [categoryId, subcategoryId, name, imagePath]
        );
        return result.insertId;
    } 
    static async deleteCategory(id) {
        await pool.query('DELETE FROM featured_categories WHERE id = ?', [id]);
    }
}
module.exports = CategoryModel1;
