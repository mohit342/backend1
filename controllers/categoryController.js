// categoryController.js
const pool = require('../config/database');

const addCategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const { name, subcategories } = req.body;

        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category name'
            });
        }

        // Use prepared statement to prevent SQL injection
        const [existing] = await connection.execute(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Category already exists'
            });
        }

        // Insert main category with trimmed name
        const [result] = await connection.execute(
            'INSERT INTO categories (name) VALUES (?)',
            [name.trim()]
        );

        const categoryId = result.insertId;

        // Batch insert subcategories if provided
        if (subcategories && Array.isArray(subcategories)) {
            const subValues = subcategories.map(sub => [categoryId, sub.name.trim()]);
            if (subValues.length > 0) {
                const [subResults] = await connection.query(
                    'INSERT INTO subcategories (category_id, name) VALUES ?',
                    [subValues]
                );

                // Batch insert sub-subcategories
                const subSubValues = [];
                subcategories.forEach((sub, index) => {
                    const subcategoryId = subResults.insertId + index;
                    if (sub.subSubcategories && Array.isArray(sub.subSubcategories)) {
                        sub.subSubcategories.forEach(subSub => {
                            subSubValues.push([subcategoryId, subSub.trim()]);
                        });
                    }
                });

                if (subSubValues.length > 0) {
                    await connection.query(
                        'INSERT INTO sub_subcategories (subcategory_id, name) VALUES ?',
                        [subSubValues]
                    );
                }
            }
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Category added successfully',
            data: { id: categoryId, name, subcategories }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error adding category:', error);
        res.status(500).json({
            success: false,
            error: error.code === 'ER_DUP_ENTRY' ? 'Duplicate entry found' : 'Failed to add category'
        });
    } finally {
        if (connection) connection.release();
    }
};

const addSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId } = req.params;
        const { name } = req.body;

        // Validate category exists
        const [category] = await connection.execute(
            'SELECT id FROM categories WHERE id = ?',
            [categoryId]
        );

        if (category.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Category not found'
            });
        }

        // Check if subcategory name already exists in this category
        const [existing] = await connection.execute(
            'SELECT id FROM subcategories WHERE category_id = ? AND name = ?',
            [categoryId, name]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Subcategory already exists in this category'
            });
        }

        // Insert subcategory
        const [result] = await connection.execute(
            'INSERT INTO subcategories (category_id, name) VALUES (?, ?)',
            [categoryId, name]
        );

        res.status(201).json({
            success: true,
            message: 'Subcategory added successfully',
            data: { id: result.insertId, name }
        });

    } catch (error) {
        console.error('Error adding subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};

const addSubSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId, subcategoryId } = req.params;
        const { name } = req.body;

        // Validate subcategory exists and belongs to the category
        const [subcategory] = await connection.execute(
            'SELECT id FROM subcategories WHERE id = ? AND category_id = ?',
            [subcategoryId, categoryId]
        );

        if (subcategory.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subcategory not found or does not belong to the specified category'
            });
        }

        // Check if sub-subcategory name already exists in this subcategory
        const [existing] = await connection.execute(
            'SELECT id FROM sub_subcategories WHERE subcategory_id = ? AND name = ?',
            [subcategoryId, name]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Sub-subcategory already exists in this subcategory'
            });
        }

        // Insert sub-subcategory
        const [result] = await connection.execute(
            'INSERT INTO sub_subcategories (subcategory_id, name) VALUES (?, ?)',
            [subcategoryId, name]
        );

        res.status(201).json({
            success: true,
            message: 'Sub-subcategory added successfully',
            data: { id: result.insertId, name }
        });

    } catch (error) {
        console.error('Error adding sub-subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add sub-subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};

const deleteSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId, subcategoryId } = req.params;

        // Verify subcategory belongs to category
        const [subcategory] = await connection.execute(
            'SELECT id FROM subcategories WHERE id = ? AND category_id = ?',
            [subcategoryId, categoryId]
        );

        if (subcategory.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subcategory not found or does not belong to the specified category'
            });
        }

        await connection.execute(
            'DELETE FROM subcategories WHERE id = ?',
            [subcategoryId]
        );

        res.status(200).json({
            success: true,
            message: 'Subcategory deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};

const deleteSubSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId, subcategoryId, subSubcategoryId } = req.params;

        // Verify the hierarchy
        const [valid] = await connection.execute(
            `SELECT ss.id 
             FROM sub_subcategories ss
             JOIN subcategories s ON ss.subcategory_id = s.id
             WHERE ss.id = ? AND s.id = ? AND s.category_id = ?`,
            [subSubcategoryId, subcategoryId, categoryId]
        );

        if (valid.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Sub-subcategory not found or invalid hierarchy'
            });
        }

        await connection.execute(
            'DELETE FROM sub_subcategories WHERE id = ?',
            [subSubcategoryId]
        );

        res.status(200).json({
            success: true,
            message: 'Sub-subcategory deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting sub-subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete sub-subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};


const getCategories = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Single query to get all data with proper joins
        const [results] = await connection.execute(`
            SELECT 
                c.id as category_id, 
                c.name as category_name,
                s.id as subcategory_id,
                s.name as subcategory_name,
                ss.id as sub_subcategory_id,
                ss.name as sub_subcategory_name
            FROM categories c
            LEFT JOIN subcategories s ON c.id = s.category_id
            LEFT JOIN sub_subcategories ss ON s.id = ss.subcategory_id
            ORDER BY c.name, s.name, ss.name
        `);

        // Transform results into nested structure
        const categories = results.reduce((acc, row) => {
            // Initialize category if not exists
            if (!acc[row.category_id]) {
                acc[row.category_id] = {
                    id: row.category_id,
                    name: row.category_name,
                    subcategories: {}
                };
            }

            // Add subcategory if exists
            if (row.subcategory_id) {
                if (!acc[row.category_id].subcategories[row.subcategory_id]) {
                    acc[row.category_id].subcategories[row.subcategory_id] = {
                        id: row.subcategory_id,
                        name: row.subcategory_name,
                        subSubcategories: []
                    };
                }

                // Add sub-subcategory if exists
                if (row.sub_subcategory_id) {
                    acc[row.category_id].subcategories[row.subcategory_id].subSubcategories.push({
                        id: row.sub_subcategory_id,
                        name: row.sub_subcategory_name
                    });
                }
            }
            return acc;
        }, {});

        // Convert to array and nested subcategories to array
        const formattedCategories = Object.values(categories).map(category => ({
            ...category,
            subcategories: Object.values(category.subcategories)
        }));

        res.status(200).json({
            success: true,
            data: formattedCategories
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    } finally {
        if (connection) connection.release();
    }
};

const updateCategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id } = req.params;
        const { name } = req.body;

        // Check if new name already exists for different category
        const [existing] = await connection.execute(
            'SELECT id FROM categories WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Category name already exists'
            });
        }

        await connection.execute(
            'UPDATE categories SET name = ? WHERE id = ?',
            [name, id]
        );

        res.status(200).json({
            success: true,
            message: 'Category updated successfully'
        });

    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update category'
        });
    } finally {
        if (connection) connection.release();
    }
};

const deleteCategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { id } = req.params;

        await connection.execute(
            'DELETE FROM categories WHERE id = ?',
            [id]
        );

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete category'
        });
    } finally {
        if (connection) connection.release();
    }
};

const updateSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId, subcategoryId } = req.params;
        const { name } = req.body;

        // Verify subcategory belongs to category
        const [subcategory] = await connection.execute(
            'SELECT id FROM subcategories WHERE id = ? AND category_id = ?',
            [subcategoryId, categoryId]
        );

        if (subcategory.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subcategory not found or does not belong to the specified category'
            });
        }

        // Check if new name already exists in this category
        const [existing] = await connection.execute(
            'SELECT id FROM subcategories WHERE name = ? AND category_id = ? AND id != ?',
            [name, categoryId, subcategoryId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Subcategory name already exists in this category'
            });
        }

        await connection.execute(
            'UPDATE subcategories SET name = ? WHERE id = ?',
            [name, subcategoryId]
        );

        res.status(200).json({
            success: true,
            message: 'Subcategory updated successfully'
        });

    } catch (error) {
        console.error('Error updating subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};

// Add this function to your categoryController.js
const updateSubSubcategory = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const { categoryId, subcategoryId, subSubcategoryId } = req.params;
        const { name } = req.body;

        // Verify the hierarchy
        const [valid] = await connection.execute(
            `SELECT ss.id 
             FROM sub_subcategories ss
             JOIN subcategories s ON ss.subcategory_id = s.id
             WHERE ss.id = ? AND s.id = ? AND s.category_id = ?`,
            [subSubcategoryId, subcategoryId, categoryId]
        );

        if (valid.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Sub-subcategory not found or invalid hierarchy'
            });
        }

        // Check if new name already exists in this subcategory
        const [existing] = await connection.execute(
            'SELECT id FROM sub_subcategories WHERE name = ? AND subcategory_id = ? AND id != ?',
            [name, subcategoryId, subSubcategoryId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Sub-subcategory name already exists in this subcategory'
            });
        }

        await connection.execute(
            'UPDATE sub_subcategories SET name = ? WHERE id = ?',
            [name, subSubcategoryId]
        );

        res.status(200).json({
            success: true,
            message: 'Sub-subcategory updated successfully'
        });

    } catch (error) {
        console.error('Error updating sub-subcategory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update sub-subcategory'
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    addCategory,
    getCategories,
    updateCategory,
    deleteCategory,
    addSubcategory,
    addSubSubcategory,
    deleteSubcategory,
    deleteSubSubcategory,
    updateSubcategory,
    updateSubSubcategory
};