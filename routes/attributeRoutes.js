const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');

router.post('/attributes', attributeController.create);
router.get('/attributes', attributeController.getAll);
router.get('/attributes/:id', attributeController.getById);
router.put('/attributes/:id', attributeController.update);
router.delete('/attributes/:id', attributeController.delete);


// Attribute routes with proper error handling
router.get('/attributes', async (req, res) => {
    try {
        const [attributes] = await db.execute('SELECT * FROM attributes ORDER BY category');
        res.json({
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
});

router.post('/attributes', async (req, res) => {
    try {
        const { category, value } = req.body;
        
        if (!category || !value) {
            return res.status(400).json({
                success: false,
                message: 'Category and value are required'
            });
        }

        const [result] = await db.execute(
            'INSERT INTO attributes (category, value) VALUES (?, ?)',
            [category, value]
        );

        res.status(201).json({
            success: true,
            message: 'Attribute created successfully',
            data: {
                id: result.insertId,
                category,
                value
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
});



module.exports = router;