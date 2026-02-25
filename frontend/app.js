// RateIntel Frontend Application

const API_BASE = '/api';
let priceChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  setDefaultDates();
  loadHotels();
  loadRates();
  loadAlerts();
});

// Tab Navigation
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// Set default dates
function setDefaultDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  document.getElementById('checkInDate').value = formatDate(tomorrow);
  document.getElementById('aiDate').value = formatDate(tomorrow);
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Status update
function setStatus(text) {
  document.getElementById('statusText').textContent = text;
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
}

// ==================== HOTELS ====================

async function loadHotels() {
  try {
    const response = await fetch(`${API_BASE}/hotels`);
    const hotels = await response.json();
    
    renderHotelList(hotels);
    populateHotelSelects(hotels);
    
  } catch (err) {
    console.error('Error loading hotels:', err);
    setStatus('Error cargando hoteles');
  }
}

function renderHotelList(hotels) {
  const container = document.getElementById('hotelList');
  
  if (hotels.length === 0) {
    container.innerHTML = '<p>No hay hoteles configurados. Agrega tu hotel y competidores.</p>';
    return;
  }
  
  container.innerHTML = hotels.map(h => `
    <div class="hotel-item ${h.is_own_hotel ? 'own' : ''}">
      <div>
        <strong>${h.name}</strong>
        ${h.is_own_hotel ? '⭐' : ''}
        <br>
        <small>${h.city} | ${h.booking_url ? '✓ Booking URL' : '✗ Sin URL'}</small>
      </div>
      <button class="delete-btn" onclick="deleteHotel(${h.id})">🗑️</button>
    </div>
  `).join('');
}

function populateHotelSelects(hotels) {
  const alertSelect = document.getElementById('alertHotel');
  const aiSelect = document.getElementById('aiHotel');
  
  const competitorOptions = hotels
    .filter(h => !h.is_own_hotel)
    .map(h => `<option value="${h.id}">${h.name}</option>`)
    .join('');
  
  const ownOptions = hotels
    .filter(h => h.is_own_hotel)
    .map(h => `<option value="${h.id}">${h.name}</option>`)
    .join('');
  
  alertSelect.innerHTML = competitorOptions || '<option>No hay competidores</option>';
  aiSelect.innerHTML = ownOptions || '<option>No hay hotel propio</option>';
}

async function addHotel() {
  const name = document.getElementById('hotelName').value;
  const city = document.getElementById('hotelCity').value;
  const bookingUrl = document.getElementById('hotelUrl').value;
  const isOwnHotel = document.getElementById('isOwnHotel').checked;
  
  if (!name || !city) {
    alert('Nombre y ciudad son requeridos');
    return;
  }
  
  try {
    setStatus('Agregando hotel...');
    
    await fetch(`${API_BASE}/hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, city, bookingUrl, isOwnHotel })
    });
    
    // Clear form
    document.getElementById('hotelName').value = '';
    document.getElementById('hotelCity').value = '';
    document.getElementById('hotelUrl').value = '';
    document.getElementById('isOwnHotel').checked = false;
    
    loadHotels();
    setStatus('Hotel agregado');
    
  } catch (err) {
    console.error('Error adding hotel:', err);
    setStatus('Error agregando hotel');
  }
}

async function deleteHotel(id) {
  if (!confirm('¿Eliminar este hotel?')) return;
  
  try {
    await fetch(`${API_BASE}/hotels/${id}`, { method: 'DELETE' });
    loadHotels();
    loadRates();
    setStatus('Hotel eliminado');
  } catch (err) {
    console.error('Error deleting hotel:', err);
  }
}

// ==================== RATES ====================

async function loadRates() {
  const checkIn = document.getElementById('checkInDate').value;
  
  try {
    setStatus('Cargando tarifas...');
    
    const [ratesRes, compareRes] = await Promise.all([
      fetch(`${API_BASE}/rates/latest?checkIn=${checkIn}`),
      fetch(`${API_BASE}/rates/compare?checkIn=${checkIn}`)
    ]);
    
    const rates = await ratesRes.json();
    const comparison = await compareRes.json();
    
    renderRateGrid(rates);
    renderStats(comparison.stats, comparison.ownHotel);
    await loadPriceHistory(rates);
    
    setStatus('Listo');
    
  } catch (err) {
    console.error('Error loading rates:', err);
    document.getElementById('rateGrid').innerHTML = '<p>Error cargando tarifas</p>';
    setStatus('Error');
  }
}

function renderRateGrid(rates) {
  const container = document.getElementById('rateGrid');
  
  if (rates.length === 0) {
    container.innerHTML = '<p>No hay datos de tarifas. Agrega hoteles y ejecuta el scraper.</p>';
    return;
  }
  
  container.innerHTML = rates.map(r => `
    <div class="rate-card ${r.is_own_hotel ? 'own-hotel' : ''}">
      <h4>${r.hotel_name} ${r.is_own_hotel ? '⭐' : ''}</h4>
      <div class="price">
        ${r.price ? `${r.currency || 'COP'} ${Number(r.price).toLocaleString()}` : 'Sin datos'}
      </div>
      <div class="meta">
        ${r.room_type || 'Standard'}
        ${r.scraped_at ? '<br>' + new Date(r.scraped_at).toLocaleString() : ''}
      </div>
    </div>
  `).join('');
}

function renderStats(stats, ownHotel) {
  const container = document.getElementById('statsBar');
  
  if (!stats || !stats.count) {
    container.innerHTML = '<p>Sin datos de competidores</p>';
    return;
  }
  
  const position = ownHotel && stats.avg 
    ? (((ownHotel.price - stats.avg) / stats.avg) * 100).toFixed(1)
    : null;
  
  container.innerHTML = `
    <div class="stat">
      <div class="stat-value">${Number(stats.avg).toLocaleString()}</div>
      <div class="stat-label">Promedio Comp.</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Number(stats.min).toLocaleString()}</div>
      <div class="stat-label">Mínimo</div>
    </div>
    <div class="stat">
      <div class="stat-value">${Number(stats.max).toLocaleString()}</div>
      <div class="stat-label">Máximo</div>
    </div>
    <div class="stat">
      <div class="stat-value">${stats.count}</div>
      <div class="stat-label">Competidores</div>
    </div>
    ${position !== null ? `
      <div class="stat">
        <div class="stat-value" style="color: ${position > 0 ? '#e74c3c' : '#27ae60'}">
          ${position > 0 ? '+' : ''}${position}%
        </div>
        <div class="stat-label">Tu Posición</div>
      </div>
    ` : ''}
  `;
}

async function loadPriceHistory(rates) {
  if (rates.length === 0) return;
  
  // Get history for first hotel with data
  const hotelWithData = rates.find(r => r.price);
  if (!hotelWithData) return;
  
  try {
    const response = await fetch(`${API_BASE}/rates/history/${hotelWithData.hotel_id}`);
    const history = await response.json();
    
    renderPriceChart(history);
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function renderPriceChart(history) {
  const ctx = document.getElementById('priceChart').getContext('2d');
  
  // Group by date
  const byDate = {};
  history.forEach(h => {
    const date = h.check_in.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(h.price);
  });
  
  const labels = Object.keys(byDate).sort();
  const data = labels.map(d => {
    const prices = byDate[d];
    return prices.reduce((a, b) => a + parseFloat(b), 0) / prices.length;
  });
  
  if (priceChart) priceChart.destroy();
  
  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Precio Promedio',
        data,
        borderColor: '#000080',
        backgroundColor: 'rgba(0, 0, 128, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

async function triggerScrape() {
  if (!confirm('¿Ejecutar scraping de Booking.com ahora?')) return;
  
  try {
    setStatus('Scrapeando... (puede tomar varios minutos)');
    
    const response = await fetch(`${API_BASE}/rates/scrape`, { method: 'POST' });
    const result = await response.json();
    
    setStatus(`Scrape completado: ${result.results?.length || 0} tarifas`);
    loadRates();
    
  } catch (err) {
    console.error('Error triggering scrape:', err);
    setStatus('Error en scrape');
  }
}

// ==================== ALERTS ====================

async function loadAlerts() {
  try {
    const [alertsRes, historyRes] = await Promise.all([
      fetch(`${API_BASE}/alerts`),
      fetch(`${API_BASE}/alerts/history`)
    ]);
    
    const alerts = await alertsRes.json();
    const history = await historyRes.json();
    
    renderAlertList(alerts);
    renderAlertHistory(history);
    
  } catch (err) {
    console.error('Error loading alerts:', err);
  }
}

function renderAlertList(alerts) {
  const container = document.getElementById('alertList');
  
  if (alerts.length === 0) {
    container.innerHTML = '<p>No hay alertas configuradas.</p>';
    return;
  }
  
  container.innerHTML = alerts.map(a => `
    <div class="alert-item">
      <strong>${a.hotel_name}</strong> - Umbral: ${a.threshold_percent}%
      <br>
      <small>
        ${a.notify_email ? '📧 Email' : ''} 
        ${a.notify_whatsapp ? `📱 WhatsApp (${a.whatsapp_number || 'N/A'})` : ''}
        ${a.is_active ? '✅ Activa' : '❌ Inactiva'}
      </small>
      <button class="btn-small" onclick="deleteAlert(${a.id})">🗑️</button>
    </div>
  `).join('');
}

function renderAlertHistory(history) {
  const container = document.getElementById('alertHistory');
  
  if (history.length === 0) {
    container.innerHTML = '<p>No hay historial de alertas.</p>';
    return;
  }
  
  container.innerHTML = history.map(h => `
    <div class="history-item ${h.percent_change > 0 ? 'up' : 'down'}">
      <strong>${h.hotel_name}</strong>
      ${h.percent_change > 0 ? '📈' : '📉'} ${h.percent_change.toFixed(1)}%
      <br>
      <small>
        $${Number(h.old_price).toLocaleString()} → $${Number(h.new_price).toLocaleString()}
        | ${new Date(h.sent_at).toLocaleString()}
      </small>
    </div>
  `).join('');
}

async function createAlert() {
  const hotelId = document.getElementById('alertHotel').value;
  const thresholdPercent = document.getElementById('alertThreshold').value;
  const notifyEmail = document.getElementById('alertEmail').checked;
  const notifyWhatsapp = document.getElementById('alertWhatsapp').checked;
  const whatsappNumber = document.getElementById('alertWhatsappNumber').value;
  
  if (notifyWhatsapp && !whatsappNumber) {
    alert('Ingresa el número de WhatsApp');
    return;
  }
  
  try {
    setStatus('Creando alerta...');
    
    await fetch(`${API_BASE}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId, thresholdPercent, notifyEmail, notifyWhatsapp, whatsappNumber })
    });
    
    loadAlerts();
    setStatus('Alerta creada');
    
  } catch (err) {
    console.error('Error creating alert:', err);
    setStatus('Error creando alerta');
  }
}

// Toggle WhatsApp number field visibility
document.addEventListener('DOMContentLoaded', () => {
  const whatsappCheckbox = document.getElementById('alertWhatsapp');
  const whatsappRow = document.getElementById('whatsappNumberRow');
  
  if (whatsappCheckbox && whatsappRow) {
    whatsappCheckbox.addEventListener('change', () => {
      whatsappRow.style.display = whatsappCheckbox.checked ? 'flex' : 'none';
    });
  }
});

async function deleteAlert(alertId) {
  if (!confirm('¿Eliminar esta alerta?')) return;
  
  try {
    setStatus('Eliminando alerta...');
    await fetch(`${API_BASE}/alerts/${alertId}`, { method: 'DELETE' });
    loadAlerts();
    setStatus('Alerta eliminada');
  } catch (err) {
    console.error('Error deleting alert:', err);
    setStatus('Error eliminando alerta');
  }
}

// ==================== AI ====================

async function getAiRecommendation() {
  const hotelId = document.getElementById('aiHotel').value;
  const checkIn = document.getElementById('aiDate').value;
  
  if (!hotelId || !checkIn) {
    alert('Selecciona hotel y fecha');
    return;
  }
  
  const container = document.getElementById('aiResult');
  container.innerHTML = '<div class="loading">🤖 Analizando mercado con IA...</div>';
  setStatus('Consultando IA...');
  
  try {
    const response = await fetch(`${API_BASE}/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotelId, checkIn })
    });
    
    const result = await response.json();
    
    if (!result.recommendation) {
      container.innerHTML = `<p>${result.message || 'No hay suficientes datos de competidores'}</p>`;
      setStatus('Sin datos suficientes');
      return;
    }
    
    const rec = result.recommendation;
    const comp = result.competitors;
    
    container.innerHTML = `
      <div class="ai-recommendation">
        <h3>Precio Recomendado</h3>
        <div class="ai-price">$ ${Number(rec.recommended_price).toLocaleString()}</div>
        
        <div class="ai-confidence">
          <span>Confianza:</span>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${rec.confidence * 100}%"></div>
          </div>
          <span>${(rec.confidence * 100).toFixed(0)}%</span>
        </div>
        
        <div style="margin: 12px 0;">
          <strong>Estrategia:</strong> ${rec.strategy || 'competitive'}
        </div>
        
        <div class="ai-reasoning">"${rec.reasoning}"</div>
        
        <div style="margin-top: 16px; text-align: left;">
          <strong>Datos de competencia:</strong><br>
          Promedio: $${Number(comp.avg).toLocaleString()} | 
          Min: $${Number(comp.min).toLocaleString()} | 
          Max: $${Number(comp.max).toLocaleString()} | 
          ${comp.count} competidores
        </div>
      </div>
    `;
    
    setStatus('Recomendación generada');
    
  } catch (err) {
    console.error('Error getting AI recommendation:', err);
    container.innerHTML = '<p>Error al consultar IA</p>';
    setStatus('Error IA');
  }
}
