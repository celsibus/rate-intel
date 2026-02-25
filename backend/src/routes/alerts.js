const express = require('express');
const router = express.Router();
const db = require('../db');

// Get user's alerts
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const result = await db.query(`
      SELECT a.*, h.name as hotel_name
      FROM alerts a
      JOIN hotels h ON a.hotel_id = h.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create alert
router.post('/', async (req, res) => {
  try {
    const { userId, hotelId, thresholdPercent, notifyEmail, notifyWhatsapp, whatsappNumber } = req.body;
    const result = await db.query(`
      INSERT INTO alerts (user_id, hotel_id, threshold_percent, notify_email, notify_whatsapp, whatsapp_number)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [userId || 1, hotelId, thresholdPercent || 10, notifyEmail !== false, notifyWhatsapp || false, whatsappNumber]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating alert:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update alert
router.put('/:id', async (req, res) => {
  try {
    const { thresholdPercent, notifyEmail, notifyWhatsapp, whatsappNumber, isActive } = req.body;
    const result = await db.query(`
      UPDATE alerts SET
        threshold_percent = COALESCE($2, threshold_percent),
        notify_email = COALESCE($3, notify_email),
        notify_whatsapp = COALESCE($4, notify_whatsapp),
        whatsapp_number = COALESCE($5, whatsapp_number),
        is_active = COALESCE($6, is_active)
      WHERE id = $1 RETURNING *
    `, [req.params.id, thresholdPercent, notifyEmail, notifyWhatsapp, whatsappNumber, isActive]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating alert:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete alert
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM alerts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting alert:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get alert history
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const result = await db.query(`
      SELECT ah.*, h.name as hotel_name
      FROM alert_history ah
      JOIN alerts a ON ah.alert_id = a.id
      JOIN hotels h ON a.hotel_id = h.id
      WHERE a.user_id = $1
      ORDER BY ah.sent_at DESC
      LIMIT 50
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alert history:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
