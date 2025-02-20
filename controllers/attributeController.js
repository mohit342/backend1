const db = require('../config/database');

const attributeController = {
    // Create new attribute
    async create(req, res) {
        try {
            const { attributeName, attributeValue } = req.body;
            
            const [result] = await db.execute(
                'INSERT INTO attributes (category, value) VALUES (?, ?)',
                [attributeName, attributeValue]
            );

            res.status(201).json({
                success: true,
                message: 'Attribute created successfully',
                data: {
                    id: result.insertId,
                    category: attributeName,
                    value: attributeValue
                }
            });
        } catch (error) {
            console.error('Error creating attribute:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating attribute',
                error: error.message
            });
        }
    },

    // Get all attributes
    async getAll(req, res) {
        try {
            const [attributes] = await db.execute('SELECT * FROM attributes');
            res.status(200).json({
                success: true,
                data: attributes
            });
        } catch (error) {
            console.error('Error fetching attributes:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attributes',
                error: error.message
            });
        }
    },

    // Get single attribute
    async getById(req, res) {
        try {
            const [attribute] = await db.execute(
                'SELECT * FROM attributes WHERE id = ?',
                [req.params.id]
            );

            if (attribute.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Attribute not found'
                });
            }

            res.status(200).json({
                success: true,
                data: attribute[0]
            });
        } catch (error) {
            console.error('Error fetching attribute:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attribute',
                error: error.message
            });
        }
    },

    // Update attribute
    async update(req, res) {
        try {
            const { attributeName, attributeValue } = req.body;
            const attributeId = req.params.id;

            const [result] = await db.execute(
                'UPDATE attributes SET category = ?, value = ? WHERE id = ?',
                [attributeName, attributeValue, attributeId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Attribute not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Attribute updated successfully'
            });
        } catch (error) {
            console.error('Error updating attribute:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating attribute',
                error: error.message
            });
        }
    },

    // Delete attribute
    async delete(req, res) {
        try {
            const [result] = await db.execute(
                'DELETE FROM attributes WHERE id = ?',
                [req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Attribute not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Attribute deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting attribute:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting attribute',
                error: error.message
            });
        }
    }
};

module.exports = attributeController;