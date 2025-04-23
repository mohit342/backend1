const HotDeal = require('../models/HotDeal');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `deal-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

exports.getHotDeals = async (req, res) => {
    try {
        const isAdmin = req.query.admin === 'true';
        const results = await HotDeal.getAll(isAdmin ? null : 4, !isAdmin);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateHotDeal = async (req, res) => {
    const { id } = req.params;
    const { title, price, offer_text, is_visible, subcategory_id } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const currentDeals = await HotDeal.getAll(null, false);
        if (!Array.isArray(currentDeals)) {
            throw new Error('Expected an array of deals from HotDeal.getAll');
        }

        const dealToUpdate = currentDeals.find(d => d.id === parseInt(id));
        if (!dealToUpdate) return res.status(404).json({ error: 'Deal not found' });

        const willBeVisible = is_visible === 'true';
        const visibleCount = currentDeals.filter(d => d.is_visible).length;
        if (willBeVisible && !dealToUpdate.is_visible && visibleCount >= 4) {
            return res.status(400).json({ error: 'Cannot exceed 4 visible deals' });
        }

        const updatedData = {
            title: title || dealToUpdate.title,
            image_path: image_path || dealToUpdate.image_path,
            price: price || dealToUpdate.price,
            offer_text: offer_text !== undefined ? offer_text : dealToUpdate.offer_text, // Allow empty or null
            is_visible: willBeVisible,
            subcategory_id: subcategory_id || dealToUpdate.subcategory_id
        };

        await HotDeal.update(id, updatedData);
        res.json({ message: 'Hot Deal updated successfully' });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createHotDeal = async (req, res) => {
    const { title, price, offer_text, is_visible, subcategory_id } = req.body;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        await HotDeal.create({ 
            title, 
            image_path, 
            price, 
            offer_text: offer_text || null, // Allow null or empty
            is_visible: is_visible === 'true' || is_visible === true,
            subcategory_id
        });
        res.json({ message: 'Hot Deal created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteHotDeal = async (req, res) => {
    const { id } = req.params;
    try {
        await HotDeal.delete(id);
        res.json({ message: 'Hot Deal deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    upload,
    getHotDeals: exports.getHotDeals,
    updateHotDeal: exports.updateHotDeal,
    createHotDeal: exports.createHotDeal,
    deleteHotDeal: exports.deleteHotDeal
};