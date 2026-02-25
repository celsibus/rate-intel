const nodemailer = require('nodemailer');
const db = require('../db');

// Email transporter (configure with your SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Twilio client for WhatsApp
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = require('twilio');
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Check for price changes and send alerts
 */
async function checkAndSendAlerts() {
  console.log('[ALERTS] Checking for price alerts...');
  
  try {
    // Get all active alerts
    const alertsResult = await db.query(`
      SELECT a.*, h.name as hotel_name, u.email as user_email
      FROM alerts a
      JOIN hotels h ON a.hotel_id = h.id
      JOIN users u ON a.user_id = u.id
      WHERE a.is_active = true
    `);
    
    for (const alert of alertsResult.rows) {
      // Get the two most recent prices for this hotel
      const pricesResult = await db.query(`
        SELECT price, scraped_at
        FROM rate_snapshots
        WHERE hotel_id = $1
        ORDER BY scraped_at DESC
        LIMIT 2
      `, [alert.hotel_id]);
      
      if (pricesResult.rows.length < 2) continue;
      
      const [newest, previous] = pricesResult.rows;
      const oldPrice = parseFloat(previous.price);
      const newPrice = parseFloat(newest.price);
      
      if (oldPrice === 0) continue;
      
      const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
      
      // Check if change exceeds threshold
      if (Math.abs(percentChange) >= parseFloat(alert.threshold_percent)) {
        console.log(`[ALERTS] ${alert.hotel_name}: ${percentChange.toFixed(1)}% change detected`);
        
        // Send email alert
        if (alert.notify_email && alert.user_email) {
          await sendEmailAlert(alert, oldPrice, newPrice, percentChange);
        }
        
        // Send WhatsApp alert
        if (alert.notify_whatsapp && alert.whatsapp_number) {
          await sendWhatsAppAlert(alert, oldPrice, newPrice, percentChange);
        }
        
        // Log alert history
        await db.query(`
          INSERT INTO alert_history (alert_id, old_price, new_price, percent_change)
          VALUES ($1, $2, $3, $4)
        `, [alert.id, oldPrice, newPrice, percentChange]);
      }
    }
    
    console.log('[ALERTS] Check complete');
    
  } catch (err) {
    console.error('[ALERTS] Error:', err);
  }
}

/**
 * Send email alert
 */
async function sendEmailAlert(alert, oldPrice, newPrice, percentChange) {
  const direction = percentChange > 0 ? '📈 SUBIÓ' : '📉 BAJÓ';
  const color = percentChange > 0 ? '#e74c3c' : '#27ae60';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${color};">${direction} ${Math.abs(percentChange).toFixed(1)}%</h2>
      <h3>${alert.hotel_name}</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Precio anterior</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-size: 18px;">$${oldPrice.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Precio nuevo</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-size: 18px; color: ${color}; font-weight: bold;">$${newPrice.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Cambio</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%</td>
        </tr>
      </table>
      <p style="margin-top: 20px; color: #666;">
        Tu umbral configurado es ${alert.threshold_percent}%.
      </p>
      <p style="color: #999; font-size: 12px;">
        Este es un mensaje automático de RateIntel.
      </p>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'RateIntel <alerts@rateintel.co>',
      to: alert.user_email,
      subject: `${direction} ${alert.hotel_name} - RateIntel`,
      html
    });
    console.log(`[ALERTS] Email sent to ${alert.user_email}`);
  } catch (err) {
    console.error(`[ALERTS] Failed to send email to ${alert.user_email}:`, err.message);
  }
}

/**
 * Send WhatsApp alert via Twilio
 */
async function sendWhatsAppAlert(alert, oldPrice, newPrice, percentChange) {
  if (!twilioClient) {
    console.log('[ALERTS] WhatsApp disabled: Twilio not configured');
    return;
  }
  
  const direction = percentChange > 0 ? '📈 SUBIÓ' : '📉 BAJÓ';
  const sign = percentChange > 0 ? '+' : '';
  
  const message = `*${direction} ${Math.abs(percentChange).toFixed(1)}%*

🏨 *${alert.hotel_name}*

💰 Precio anterior: $${oldPrice.toLocaleString('es-CO')}
💵 Precio nuevo: $${newPrice.toLocaleString('es-CO')}
📊 Cambio: ${sign}${percentChange.toFixed(1)}%

_Alerta de RateIntel_`;
  
  try {
    const whatsappNumber = alert.whatsapp_number.replace(/[^0-9]/g, '');
    
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:+${whatsappNumber}`,
      body: message
    });
    
    console.log(`[ALERTS] WhatsApp sent to ${alert.whatsapp_number}`);
  } catch (err) {
    console.error(`[ALERTS] Failed to send WhatsApp to ${alert.whatsapp_number}:`, err.message);
  }
}

module.exports = { checkAndSendAlerts, sendEmailAlert, sendWhatsAppAlert };
