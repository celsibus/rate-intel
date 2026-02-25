const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all hotels for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || 1; // TODO: auth
    const result = await db.query(
      'SELECT * FROM hotels WHERE user_id = $1 ORDER BY is_own_hotel DESC, name',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add a hotel
router.post('/', async (req, res) => {
  try {
    const { userId, name, city, country, bookingUrl, isOwnHotel } = req.body;
    const result = await db.query(
      `INSERT INTO hotels (user_id, name, city, country, booking_url, is_own_hotel)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId || 1, name, city, country || 'Colombia', bookingUrl, isOwnHotel || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding hotel:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete a hotel
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM hotels WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting hotel:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
