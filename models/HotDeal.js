const db = require('../config/db');

class HotDeal {
    static async getAll(limit = null, onlyVisible = false) {
        try {
            let query = 'SELECT id, title, image_path, price, offer_text, is_visible, subcategory_id FROM hot_deals';
            const params = [];
            if (onlyVisible) {
                query += ' WHERE is_visible = TRUE';
            }
            if (limit) {
                query += ' LIMIT ?';
                params.push(limit);
            }
            const [rows] = await db.query(query, params);
            return rows;
        } catch (err) {
            throw err;
        }
    }

    static async update(id, data) {
        try {
            const [result] = await db.query(
                'UPDATE hot_deals SET title = ?, image_path = ?, price = ?, offer_text = ?, is_visible = ?, subcategory_id = ? WHERE id = ?',
                [data.title, data.image_path, data.price, data.offer_text, data.is_visible, data.subcategory_id, id]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    static async create(data) {
        try {
            const [result] = await db.query(
                'INSERT INTO hot_deals (title, image_path, price, offer_text, is_visible, subcategory_id) VALUES (?, ?, ?, ?, ?, ?)',
                [data.title, data.image_path, data.price, data.offer_text, data.is_visible || false, data.subcategory_id]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    static async delete(id) {
        try {
            const [result] = await db.query('DELETE FROM hot_deals WHERE id = ?', [id]);
            return result;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = HotDeal;