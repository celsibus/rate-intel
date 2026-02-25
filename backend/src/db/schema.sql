-- RateIntel Database Schema

-- Users (hoteliers)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'basic', -- basic, pro, chain
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Hotels (owned by users)
CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT 'Colombia',
  booking_url VARCHAR(500),
  is_own_hotel BOOLEAN DEFAULT false, -- true = user's hotel, false = competitor
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rate snapshots (scraped data)
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  room_type VARCHAR(255),
  price DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'COP',
  source VARCHAR(50) DEFAULT 'booking.com',
  scraped_at TIMESTAMP DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
  threshold_percent DECIMAL(5, 2) DEFAULT 10.0,
  notify_email BOOLEAN DEFAULT true,
  notify_whatsapp BOOLEAN DEFAULT false,
  whatsapp_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2),
  percent_change DECIMAL(5, 2),
  sent_at TIMESTAMP DEFAULT NOW()
);

-- AI recommendations
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
  check_in DATE,
  recommended_price DECIMAL(10, 2),
  confidence DECIMAL(3, 2), -- 0.00 to 1.00
  reasoning TEXT,
  competitor_avg DECIMAL(10, 2),
  competitor_min DECIMAL(10, 2),
  competitor_max DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_snapshots_hotel_date ON rate_snapshots(hotel_id, check_in);
CREATE INDEX IF NOT EXISTS idx_rate_snapshots_scraped ON rate_snapshots(scraped_at);
CREATE INDEX IF NOT EXISTS idx_hotels_user ON hotels(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
