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

// Get portfolio summary (all own hotels with metrics)
router.get('/portfolio', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const checkIn = req.query.checkIn || new Date().toISOString().split('T')[0];
    
    // Get all own hotels with their latest rates
    const ownHotels = await db.query(`
      SELECT DISTINCT ON (h.id) 
        h.id,
        h.name,
        h.city,
        h.country,
        rs.price as current_price,
        rs.currency,
        rs.scraped_at
      FROM hotels h
      LEFT JOIN rate_snapshots rs ON h.id = rs.hotel_id AND rs.check_in = $2
      WHERE h.user_id = $1 AND h.is_own_hotel = true
      ORDER BY h.id, rs.scraped_at DESC
    `, [userId, checkIn]);
    
    // For each own hotel, get competitor metrics (same city)
    const portfolio = await Promise.all(ownHotels.rows.map(async (hotel) => {
      const compResult = await db.query(`
        SELECT 
          AVG(rs.price) as avg_price,
          MIN(rs.price) as min_price,
          MAX(rs.price) as max_price,
          COUNT(DISTINCT h.id) as competitor_count
        FROM hotels h
        JOIN rate_snapshots rs ON h.id = rs.hotel_id AND rs.check_in = $2
        WHERE h.user_id = $1 
          AND h.is_own_hotel = false 
          AND LOWER(h.city) = LOWER($3)
      `, [userId, checkIn, hotel.city]);
      
      const comp = compResult.rows[0];
      const avgPrice = parseFloat(comp.avg_price) || 0;
      const currentPrice = parseFloat(hotel.current_price) || 0;
      
      // Calculate position vs market
      let marketPosition = null;
      if (avgPrice > 0 && currentPrice > 0) {
        marketPosition = ((currentPrice - avgPrice) / avgPrice * 100).toFixed(1);
      }
      
      return {
        ...hotel,
        competitors: {
          avg: avgPrice ? avgPrice.toFixed(0) : null,
          min: comp.min_price ? parseFloat(comp.min_price).toFixed(0) : null,
          max: comp.max_price ? parseFloat(comp.max_price).toFixed(0) : null,
          count: parseInt(comp.competitor_count) || 0
        },
        marketPosition
      };
    }));
    
    // Aggregate totals
    const totals = {
      hotelCount: portfolio.length,
      totalValue: portfolio.reduce((sum, h) => sum + (parseFloat(h.current_price) || 0), 0),
      avgMarketPosition: portfolio.filter(h => h.marketPosition !== null)
        .reduce((sum, h, _, arr) => sum + parseFloat(h.marketPosition) / arr.length, 0).toFixed(1)
    };
    
    res.json({ hotels: portfolio, totals });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
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
