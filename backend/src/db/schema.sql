-- RateIntel Database Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'basic',
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  country VARCHAR(100) DEFAULT 'Colombia',
  booking_url VARCHAR(500),
  is_own_hotel BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2),
  percent_change DECIMAL(5, 2),
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER REFERENCES hotels(id) ON DELETE CASCADE,
  check_in DATE,
  recommended_price DECIMAL(10, 2),
  confidence DECIMAL(3, 2),
  reasoning TEXT,
  competitor_avg DECIMAL(10, 2),
  competitor_min DECIMAL(10, 2),
  competitor_max DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default user
INSERT INTO users (email, name) VALUES ('celso@faranda.com', 'Celso Fernández') ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_hotel_date ON rate_snapshots(hotel_id, check_in);
CREATE INDEX IF NOT EXISTS idx_hotels_user ON hotels(user_id);
