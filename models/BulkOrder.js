class BulkOrder {
    constructor(name, email, phone, company, product, quantity, message) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.company = company;
        this.product = product;
        this.quantity = quantity;
        this.message = message;
    }

    static async create(pool, orderData) {
        if (!pool || typeof pool.query !== 'function') {
            throw new Error('Database pool is not initialized');
        }

        const sql = `INSERT INTO bulk_orders (name, email, phone, company, product, quantity, message)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            orderData.name,
            orderData.email,
            orderData.phone,
            orderData.company,
            orderData.product,
            orderData.quantity,
            orderData.message
        ];

        try {
            const [result] = await pool.query(sql, values);
            return result.insertId;
        } catch (error) {
            throw error;
        }
    }
    static async getAll(pool) {
        try {
            const [rows] = await pool.query('SELECT * FROM bulk_orders ORDER BY created_at DESC');
            return rows;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = BulkOrder;