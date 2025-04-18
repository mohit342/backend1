const db = require('../config/database');

const productController = {
    // Create a new product
    async create(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            let { 
                name, 
                slug, 
                shortDescription, 
                description, 
                price, 
                stockQuantity, 
                categoryId, 
                subcategoryId, 
                subSubcategoryId, 
                selectedAttributes 
            } = req.body;

            // Generate slug if not provided
            const generateSlug = (text) =>
                text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

            const finalSlug = slug || generateSlug(name);

            const attributesArray = selectedAttributes ? JSON.parse(selectedAttributes) : [];
            const images = req.files.map(file => file.path); 

            const [productResult] = await connection.execute(
                `INSERT INTO products 
                 (name, slug, short_description, description, price, stock_quantity, 
                  category_id, subcategory_id, sub_subcategory_id, attribute, discount_percentage, is_trending) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name || null, finalSlug, shortDescription || null, description || null, 
                 price || 0, stockQuantity || 0, categoryId || null, subcategoryId || null, 
                 subSubcategoryId || null, selectedAttributes || null, req.body.discountPercentage || 0, false]
            );

            const productId = productResult.insertId;

            if (Array.isArray(selectedAttributes) && selectedAttributes.length > 0) {
                const [attributeRows] = await connection.query(
                    `SELECT id, value FROM attributes WHERE value IN (?)`,
                    [selectedAttributes]
                );

                const attributeMap = {};
                attributeRows.forEach(row => {
                    attributeMap[row.value] = row.id;
                });

                const attributeValues = selectedAttributes
                    .map(attrValue => attributeMap[attrValue])
                    .filter(attrId => attrId);

                if (attributeValues.length > 0) {
                    const attributeInsertValues = attributeValues.map(attrId => [productId, attrId]);
                    await connection.query(
                        'INSERT INTO product_attributes (product_id, attribute_id) VALUES ?',
                        [attributeInsertValues]
                    );
                }
            }

            if (images && images.length > 0) {
                const imageValues = images.map(imageUrl => [productId, imageUrl]);
                await connection.query(
                    'INSERT INTO product_images (product_id, image_url) VALUES ?',
                    [imageValues]
                );
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Product added successfully',
                data: { productId }
            });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error adding product:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding product',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    },

    // Get all products
    async getAll(req, res) {
        try {
            const [products] = await db.execute(`
                SELECT 
                    p.id, 
                    p.name, 
                    p.slug, 
                    p.short_description, 
                    p.description, 
                    p.price, 
                    p.stock_quantity, 
                    DATE(p.created_at) AS created_at,
                    p.category_id, 
                    p.subcategory_id, 
                    p.sub_subcategory_id,
                    p.discount_percentage,
                    p.is_trending, -- Include is_trending
                    c.name AS category, 
                    COALESCE(GROUP_CONCAT(pi.image_url), '') AS images
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
                GROUP BY p.id
            `);

            res.status(200).json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching products',
                error: error.message
            });
        }
    },

    // Get a single product by ID
    async getById(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            
            const productId = parseInt(req.params.id);
            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product ID'
                });
            }

            const [products] = await connection.execute(`
                SELECT 
                    p.*,
                    c.name AS category_name,
                    GROUP_CONCAT(pi.image_url) AS images
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.id = ?
                GROUP BY p.id
            `, [productId]);

            if (products.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            const productData = {
                ...products[0],
                images: products[0].images ? products[0].images.split(',') : [],
                price: parseFloat(products[0].price)
            };

            res.status(200).json({
                success: true,
                data: productData
            });

        } catch (error) {
            console.error('Error fetching product:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching product',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    },

    // Get top trending products
    async getTopTrending(req, res) {
        try {
            console.log("Fetching top trending products...");

            const [products] = await db.execute(`
                SELECT 
                    p.id, 
                    p.name, 
                    p.price, 
                    p.discount_percentage,
                    p.is_trending,
                    COALESCE(GROUP_CONCAT(pi.image_url), '') AS images, 
                    DATE(p.created_at) AS created_at
                FROM products p
                LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.is_trending = TRUE
                GROUP BY p.id
                ORDER BY p.created_at DESC
                LIMIT 5
            `);

            if (products.length === 0) {
                return res.status(404).json({ success: false, message: "No trending products found" });
            }

            const formattedProducts = products.map(product => {
                let imageArray = [];
                if (product.images) {
                    imageArray = product.images.split(',').map(imagePath => {
                        if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
                            return `http://localhost:5000/${imagePath}`;
                        }
                        return imagePath;
                    });
                }

                return {
                    ...product,
                    images: imageArray,
                    price: parseFloat(product.price),
                    discount_percentage: parseInt(product.discount_percentage) || 0
                };
            });

            res.status(200).json({ success: true, data: formattedProducts });
        } catch (error) {
            console.error("Error fetching trending products:", error);
            res.status(500).json({ success: false, message: "Error fetching trending products", error: error.message });
        }
    },

    async deleteProduct(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            const productId = parseInt(req.params.id);

            if (isNaN(productId)) {
                return res.status(400).json({ success: false, message: 'Invalid product ID' });
            }

            await connection.beginTransaction();

            await connection.execute('DELETE FROM product_images WHERE product_id = ?', [productId]);
            await connection.execute('DELETE FROM product_attributes WHERE product_id = ?', [productId]);
            const [result] = await connection.execute('DELETE FROM products WHERE id = ?', [productId]);

            if (result.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            await connection.commit();
            res.status(200).json({ success: true, message: 'Product deleted successfully' });
        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error deleting product:', error);
            res.status(500).json({ success: false, message: 'Error deleting product', error: error.message });
        } finally {
            if (connection) connection.release();
        }
    },

    async updateProduct(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            const productId = parseInt(req.params.id);

            if (isNaN(productId)) {
                return res.status(400).json({ success: false, message: 'Invalid product ID' });
            }

            const {
                name, slug, shortDescription, description, price, stockQuantity
            } = req.body;

            await connection.beginTransaction();

            const generateSlug = (text) =>
                text
                    .toLowerCase()
                    .trim()
                    .replace(/\s+/g, '-')
                    .replace(/[^\w\-]+/g, '')
                    .replace(/\-\-+/g, '-');
            
            const finalSlug = slug ?? generateSlug(name);

            await connection.execute(
                `UPDATE products SET name=?, slug=?, short_description=?, description=?, price=?, stock_quantity=?, is_trending=? WHERE id=?`,
                [
                    name ?? null,
                    finalSlug,
                    shortDescription ?? null,
                    description ?? null,
                    price ?? 0,
                    stockQuantity ?? 0,
                    req.body.is_trending ?? false, // Default to false if not provided
                    productId
                ]
            );

            if (req.files && req.files.length > 0) {
                await connection.execute('DELETE FROM product_images WHERE product_id = ?', [productId]);
                const imageValues = req.files.map(file => [productId, file.path]);
                await connection.query('INSERT INTO product_images (product_id, image_url) VALUES ?', [imageValues]);
            }

            await connection.commit();
            res.status(200).json({ success: true, message: 'Product updated successfully' });
        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error updating product:', error);
            res.status(500).json({ success: false, message: 'Error updating product', error: error.message });
        } finally {
            if (connection) connection.release();
        }
    },

    // Get a single product by Slug
    async getBySlug(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            const slug = req.params.slug;

            const [products] = await connection.execute(`
                SELECT 
                    p.*,
                    c.name AS category_name,
                    GROUP_CONCAT(pi.image_url) AS images
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN product_images pi ON p.id = pi.product_id
                WHERE p.slug = ?
                GROUP BY p.id
            `, [slug]);

            if (products.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            const productData = {
                ...products[0],
                images: products[0].images ? products[0].images.split(',') : [],
                price: parseFloat(products[0].price)
            };

            res.status(200).json({
                success: true,
                data: productData
            });

        } catch (error) {
            console.error('Error fetching product:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching product',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    },

    // Update trending status
    async updateTrendingStatus(req, res) {
        let connection;
        try {
            connection = await db.getConnection();
            const productId = parseInt(req.params.id);

            if (isNaN(productId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid product ID'
                });
            }

            const { isTrending } = req.body;

            await connection.beginTransaction();
            const [result] = await connection.execute(
                'UPDATE products SET is_trending = ? WHERE id = ?',
                [isTrending, productId]
            );

            if (result.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Product not found'
                });
            }

            await connection.commit();

            const [updatedProduct] = await connection.execute(
                'SELECT * FROM products WHERE id = ?',
                [productId]
            );

            res.status(200).json({
                success: true,
                message: 'Trending status updated successfully',
                data: updatedProduct[0]
            });

        } catch (error) {
            if (connection) await connection.rollback();
            console.error('Error updating trending status:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating trending status',
                error: error.message
            });
        } finally {
            if (connection) connection.release();
        }
    }
};

module.exports = productController;