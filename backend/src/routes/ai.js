const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Get AI price recommendation
router.post('/recommend', async (req, res) => {
  try {
    const { hotelId, checkIn } = req.body;
    const userId = req.body.userId || 1;
    
    // Get own hotel info
    const hotelResult = await db.query(
      'SELECT * FROM hotels WHERE id = $1',
      [hotelId]
    );
    const hotel = hotelResult.rows[0];
    
    if (!hotel) {
      return res.status(404).json({ error: 'Hotel not found' });
    }
    
    // Get competitor rates for this date
    const compResult = await db.query(`
      SELECT h.name, rs.price, rs.room_type
      FROM hotels h
      JOIN rate_snapshots rs ON h.id = rs.hotel_id
      WHERE h.user_id = $1 AND h.is_own_hotel = false AND rs.check_in = $2
      ORDER BY rs.scraped_at DESC
    `, [userId, checkIn]);
    
    const competitors = compResult.rows;
    const prices = competitors.map(c => parseFloat(c.price)).filter(p => p > 0);
    
    if (prices.length === 0) {
      return res.json({
        recommendation: null,
        message: 'No competitor data available for this date'
      });
    }
    
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    // Call Claude for recommendation
    const prompt = `Eres un experto en Revenue Management hotelero. Analiza estos datos y recomienda una tarifa.

HOTEL: ${hotel.name}
CIUDAD: ${hotel.city}
FECHA: ${checkIn}

COMPETIDORES:
${competitors.map(c => `- ${c.name}: $${c.price} (${c.room_type || 'Standard'})`).join('\n')}

ESTADÍSTICAS:
- Promedio competencia: $${avg.toFixed(0)}
- Mínimo: $${min}
- Máximo: $${max}

Responde SOLO en este formato JSON:
{
  "recommended_price": NUMBER,
  "confidence": NUMBER (0.0-1.0),
  "reasoning": "STRING (máx 200 caracteres)",
  "strategy": "premium|competitive|value"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const responseText = message.content[0].text;
    let recommendation;
    
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      recommendation = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Failed to parse AI response:', responseText);
      recommendation = null;
    }
    
    if (recommendation) {
      // Save to database
      await db.query(`
        INSERT INTO ai_recommendations 
        (hotel_id, check_in, recommended_price, confidence, reasoning, competitor_avg, competitor_min, competitor_max)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [hotelId, checkIn, recommendation.recommended_price, recommendation.confidence, 
          recommendation.reasoning, avg, min, max]);
    }
    
    res.json({
      recommendation,
      competitors: {
        avg: avg.toFixed(0),
        min,
        max,
        count: prices.length
      }
    });
    
  } catch (err) {
    console.error('Error getting AI recommendation:', err);
    res.status(500).json({ error: 'AI service error' });
  }
});

// Get recommendation history
router.get('/history/:hotelId', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM ai_recommendations
      WHERE hotel_id = $1
      ORDER BY created_at DESC
      LIMIT 30
    `, [req.params.hotelId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching AI history:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
