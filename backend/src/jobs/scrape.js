const puppeteer = require('puppeteer');
const db = require('../db');
const { checkAndSendAlerts } = require('./alerts');

/**
 * Scrape hotel rates from Booking.com
 * @param {string} bookingUrl - The Booking.com URL for the hotel
 * @param {Date} checkIn - Check-in date
 * @param {Date} checkOut - Check-out date
 */
async function scrapeBookingRates(bookingUrl, checkIn, checkOut) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Format dates for Booking.com URL
    const checkInStr = formatDate(checkIn);
    const checkOutStr = formatDate(checkOut);
    
    // Build search URL with dates
    let url = bookingUrl;
    if (url.includes('?')) {
      url += `&checkin=${checkInStr}&checkout=${checkOutStr}&group_adults=2&no_rooms=1`;
    } else {
      url += `?checkin=${checkInStr}&checkout=${checkOutStr}&group_adults=2&no_rooms=1`;
    }
    
    console.log(`[SCRAPE] Fetching: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for prices to load
    await page.waitForSelector('[data-testid="price-and-discounted-price"], .prco-valign-middle-helper, .bui-price-display__value', { timeout: 15000 }).catch(() => {});
    
    // Extract prices
    const prices = await page.evaluate(() => {
      const results = [];
      
      // Try multiple selectors for room prices
      const priceSelectors = [
        '[data-testid="price-and-discounted-price"]',
        '.prco-valign-middle-helper',
        '.bui-price-display__value',
        '.price-text-color',
        '[data-component="base/text"]'
      ];
      
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.innerText;
          // Extract number from price text (handles COP, USD, etc.)
          const match = text.match(/[\d.,]+/);
          if (match) {
            const price = parseFloat(match[0].replace(/[.,]/g, m => m === ',' ? '' : '.'));
            if (price > 10000) { // COP prices are typically > 100,000
              results.push({ price, currency: 'COP', raw: text });
            } else if (price > 10) { // USD prices
              results.push({ price, currency: 'USD', raw: text });
            }
          }
        });
      }
      
      // Try to get room type names
      const roomTypes = [];
      document.querySelectorAll('.hprt-roomtype-icon-link, [data-testid="room-name"]').forEach(el => {
        roomTypes.push(el.innerText.trim());
      });
      
      return { prices: results, roomTypes };
    });
    
    await browser.close();
    
    // Return the lowest price (usually the standard room)
    if (prices.prices.length > 0) {
      const lowestPrice = prices.prices.sort((a, b) => a.price - b.price)[0];
      return {
        price: lowestPrice.price,
        currency: lowestPrice.currency,
        roomType: prices.roomTypes[0] || 'Standard'
      };
    }
    
    return null;
    
  } catch (err) {
    console.error(`[SCRAPE] Error: ${err.message}`);
    if (browser) await browser.close();
    return null;
  }
}

/**
 * Scrape all hotels for all users
 */
async function scrapeAllHotels() {
  console.log('[SCRAPE] Starting full scrape...');
  
  try {
    // Get all hotels with booking URLs
    const result = await db.query(`
      SELECT h.*, u.id as user_id
      FROM hotels h
      JOIN users u ON h.user_id = u.id
      WHERE h.booking_url IS NOT NULL AND h.booking_url != ''
    `);
    
    const hotels = result.rows;
    console.log(`[SCRAPE] Found ${hotels.length} hotels to scrape`);
    
    const results = [];
    const today = new Date();
    
    // Scrape for next 7 days
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkIn = new Date(today);
      checkIn.setDate(checkIn.getDate() + dayOffset);
      
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 1);
      
      for (const hotel of hotels) {
        console.log(`[SCRAPE] Scraping ${hotel.name} for ${formatDate(checkIn)}`);
        
        const rateData = await scrapeBookingRates(hotel.booking_url, checkIn, checkOut);
        
        if (rateData) {
          // Save to database
          await db.query(`
            INSERT INTO rate_snapshots (hotel_id, check_in, check_out, room_type, price, currency)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [hotel.id, formatDate(checkIn), formatDate(checkOut), rateData.roomType, rateData.price, rateData.currency]);
          
          results.push({
            hotel: hotel.name,
            checkIn: formatDate(checkIn),
            price: rateData.price,
            currency: rateData.currency
          });
          
          console.log(`[SCRAPE] ✓ ${hotel.name}: ${rateData.currency} ${rateData.price}`);
        } else {
          console.log(`[SCRAPE] ✗ ${hotel.name}: No price found`);
        }
        
        // Rate limiting: wait 3 seconds between requests
        await sleep(3000);
      }
    }
    
    // Check for alerts after scraping
    await checkAndSendAlerts();
    
    console.log(`[SCRAPE] Completed. ${results.length} prices captured.`);
    return results;
    
  } catch (err) {
    console.error('[SCRAPE] Fatal error:', err);
    throw err;
  }
}

// Helper functions
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if called directly
if (require.main === module) {
  scrapeAllHotels()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { scrapeBookingRates, scrapeAllHotels };
