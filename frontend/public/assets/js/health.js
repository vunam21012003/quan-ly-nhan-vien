import { api } from './api.js';

async function renderHealth() {
  const el = document.getElementById('health');
  try {
    const h = await api('/health');
    el.textContent = `OK | DB: ${h.db?.ok ? 'OK' : 'FAIL'} | Uptime: ${
      h.uptime_seconds
    }s`;
    el.style.color = h.db?.ok ? 'green' : 'orange';
  } catch (e) {
    el.textContent = `FAIL: ${e.message}`;
    el.style.color = 'red';
  }
}

document.addEventListener('DOMContentLoaded', renderHealth);
