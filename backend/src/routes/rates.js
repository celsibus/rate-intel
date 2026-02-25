const express = require('express');
const router = express.Router();
const db = require('../db');

// Get latest rates for all hotels of a user
router.get('/latest', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const checkIn = req.query.checkIn || new Date().toISOString().split('T')[0];
    
    const result = await db.query(`
      SELECT DISTINCT ON (h.id) 
        h.id as hotel_id,
        h.name as hotel_name,
        h.is_own_hotel,
        rs.price,
        rs.currency,
        rs.room_type,
        rs.scraped_at,
        rs.check_in
      FROM hotels h
      LEFT JOIN rate_snapshots rs ON h.id = rs.hotel_id AND rs.check_in = $2
      WHERE h.user_id = $1
      ORDER BY h.id, rs.scraped_at DESC
    `, [userId, checkIn]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rates:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get rate history for a hotel (last 30 days)
router.get('/history/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const result = await db.query(`
      SELECT 
        check_in,
        price,
        currency,
        room_type,
        scraped_at
      FROM rate_snapshots
      WHERE hotel_id = $1 
        AND scraped_at > NOW() - INTERVAL '${days} days'
      ORDER BY check_in, scraped_at
    `, [hotelId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rate history:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get competitive comparison
router.get('/compare', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const checkIn = req.query.checkIn || new Date().toISOString().split('T')[0];
    
    // Get own hotel rate
    const ownResult = await db.query(`
      SELECT h.name, rs.price
      FROM hotels h
      JOIN rate_snapshots rs ON h.id = rs.hotel_id
      WHERE h.user_id = $1 AND h.is_own_hotel = true AND rs.check_in = $2
      ORDER BY rs.scraped_at DESC
      LIMIT 1
    `, [userId, checkIn]);
    
    // Get competitor rates
    const compResult = await db.query(`
      SELECT h.name, rs.price
      FROM hotels h
      JOIN rate_snapshots rs ON h.id = rs.hotel_id
      WHERE h.user_id = $1 AND h.is_own_hotel = false AND rs.check_in = $2
      ORDER BY rs.scraped_at DESC
    `, [userId, checkIn]);
    
    const competitors = compResult.rows;
    const prices = competitors.map(c => parseFloat(c.price)).filter(p => p > 0);
    
    res.json({
      ownHotel: ownResult.rows[0] || null,
      competitors,
      stats: {
        avg: prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : null,
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null,
        count: prices.length
      }
    });
  } catch (err) {
    console.error('Error comparing rates:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Manual trigger scrape
router.post('/scrape', async (req, res) => {
  try {
    const { scrapeAllHotels } = require('../jobs/scrape');
    const results = await scrapeAllHotels();
    res.json({ success: true, results });
  } catch (err) {
    console.error('Error triggering scrape:', err);
    res.status(500).json({ error: 'Scrape failed' });
  }
});

module.exports = router;
