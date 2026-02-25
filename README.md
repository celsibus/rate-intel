# RateIntel 📊

**Revenue Intelligence for Independent Hotels**

SaaS de inteligencia de tarifas para hoteles pequeños y medianos que no pueden pagar IDeaS o Lighthouse.

## Features

- 🔍 **Rate Scraping**: Monitoreo automático de tarifas de competidores en Booking.com
- 📊 **Dashboard**: Comparativa visual de precios con tema Windows 95 retro
- 📈 **Históricos**: Gráficos de evolución de tarifas (últimos 30 días)
- 🔔 **Alertas**: Notificación por email cuando un competidor cambia precio >X%
- 🤖 **IA**: Recomendaciones de precio con Claude (Anthropic)

## Pricing

| Plan | Precio | Incluye |
|------|--------|---------|
| Básico | $29/mes | 1 hotel, 5 competidores |
| Pro | $49/mes | 1 hotel, 15 competidores, alertas WhatsApp |
| Cadena | $199/mes | Hasta 10 hoteles |

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Scraping**: Puppeteer
- **Frontend**: Vanilla JS + CSS (Windows 95 theme)
- **AI**: Claude (Anthropic)
- **Payments**: Stripe (coming soon)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/celsibus/rate-intel
cd rate-intel

# 2. Install dependencies
cd backend && npm install

# 3. Configure environment
cp ../.env.example .env
# Edit .env with your credentials

# 4. Initialize database
psql $DATABASE_URL -f src/db/schema.sql

# 5. Run
npm run dev
```

## API Endpoints

### Hotels
- `GET /api/hotels` - List hotels
- `POST /api/hotels` - Add hotel
- `DELETE /api/hotels/:id` - Remove hotel

### Rates
- `GET /api/rates/latest` - Latest rates for all hotels
- `GET /api/rates/history/:hotelId` - Historical rates
- `GET /api/rates/compare` - Competitive comparison
- `POST /api/rates/scrape` - Trigger manual scrape

### Alerts
- `GET /api/alerts` - List alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert
- `GET /api/alerts/history` - Alert history

### AI
- `POST /api/ai/recommend` - Get AI price recommendation
- `GET /api/ai/history/:hotelId` - Recommendation history

## Cron Jobs

Rate scraping runs automatically every 6 hours. Configure in `src/index.js`.

## Test Hotels (Cartagena)

- Hotel Casa San Agustín
- Hotel Casa Lola
- Hotel Casona del Colegio

## License

Proprietary - Celso Fernández & Atenea

---

Built with ❤️ in Colombia 🇨🇴
