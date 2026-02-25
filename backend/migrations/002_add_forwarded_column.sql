-- Add forwarded column to alert_history for Clawdbot integration
ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS forwarded BOOLEAN DEFAULT false;
