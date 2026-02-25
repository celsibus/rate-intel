require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const { migrate } = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

// Health check (before routes so it works even if DB fails)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
const hotelRoutes = require('./routes/hotels');
const rateRoutes = require('./routes/rates');
const alertRoutes = require('./routes/alerts');
const aiRoutes = require('./routes/ai');

app.use('/api/hotels', hotelRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Cron job: scrape rates every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Running scheduled rate scrape...');
  try {
    const { scrapeAllHotels } = require('./jobs/scrape');
    await scrapeAllHotels();
  } catch (err) {
    console.error('[CRON] Scrape failed:', err.message);
  }
});

// Start server with migration
async function start() {
  await migrate();
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║  RateIntel - Revenue Intelligence                  ║
║  Port: ${PORT}                                        ║
║  Status: Running                                   ║
╚════════════════════════════════════════════════════╝
    `);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
