require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// Routes
const hotelRoutes = require('./routes/hotels');
const rateRoutes = require('./routes/rates');
const alertRoutes = require('./routes/alerts');
const aiRoutes = require('./routes/ai');

app.use('/api/hotels', hotelRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Cron job: scrape rates every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Running scheduled rate scrape...');
  const { scrapeAllHotels } = require('./jobs/scrape');
  await scrapeAllHotels();
});

app.listen(PORT, () => {
  console.log(`🚀 RateIntel running on port ${PORT}`);
});
