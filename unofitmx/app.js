// UNOFitMX - Sistema operativo interno para gimnasios
// Role-based access control and database-connected operations

// Application state
const AppState = {
  currentRole: 'ADM',
  loading: false,
  lastError: null
};

// PWA Install prompt handling
let deferredPrompt;
const btn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (btn) btn.hidden = false;
});

if (btn) {
  btn.addEventListener('click', async () => {
    btn.hidden = true;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
}

// Page stabilization
window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("ready");
  initializeApp();
});

// Initialize app - load initial data
async function initializeApp() {
  await loadStatus();
}

// Page navigation - smooth, no shifts
function go(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

// API helper with graceful error handling
async function api(endpoint, options = {}) {
  const { method = 'GET', body, role = AppState.currentRole } = options;

  try {
    AppState.loading = true;
    AppState.lastError = null;

    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      fetchOptions.body = JSON.stringify({ ...body, role });
    } else if (method === 'GET' && role) {
      endpoint += (endpoint.includes('?') ? '&' : '?') + `role=${role}`;
    }

    const response = await fetch(`/api${endpoint}`, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error del sistema');
    }

    return { success: true, data };
  } catch (error) {
    AppState.lastError = error.message;
    return { success: false, error: error.message };
  } finally {
    AppState.loading = false;
  }
}

// Status display embedded in existing UI element
async function loadStatus() {
  const el = document.getElementById("status");
  if (!el) return;

  const result = await api('/status');
  if (result.success) {
    el.textContent = result.data.status;
  }
}

// Toggle system status with database persistence
async function toggleStatus() {
  const el = document.getElementById("status");
  if (!el) return;

  const currentStatus = el.textContent;
  const newStatus = currentStatus === "Sistema estable"
    ? "Sistema en mantenimiento"
    : "Sistema estable";

  const result = await api('/status', {
    method: 'POST',
    body: { newStatus }
  });

  if (result.success) {
    el.textContent = result.data.status;
    showFeedback('Estado actualizado');
  } else {
    showFeedback(result.error);
  }
}

// Control activation with role permissions
async function activateControl() {
  const result = await api('/control/activate', {
    method: 'POST',
    body: {}
  });

  if (result.success) {
    showFeedback(result.data.message);
  } else {
    showFeedback(result.error);
  }
}

// Messages/communications handling
async function openMessages() {
  const result = await api('/messages/send', {
    method: 'POST',
    body: { message: 'Notificación interna' }
  });

  if (result.success) {
    showFeedback(result.data.message);
  } else {
    showFeedback(result.error);
  }
}

// Income monitoring with permission check
async function viewIncome() {
  const result = await api('/income');

  if (result.success) {
    showFeedback(result.data.message);
  } else {
    showFeedback(result.error);
  }
}

// Users review with role-based access
async function checkUsers() {
  const result = await api('/users/check', {
    method: 'POST',
    body: {}
  });

  if (result.success) {
    showFeedback(result.data.message);
  } else {
    showFeedback(result.error);
  }
}

// Reset application state
async function resetApp() {
  const result = await api('/reset', { method: 'POST', body: {} });

  if (result.success) {
    localStorage.clear();
    showFeedback(result.data.message);
    setTimeout(() => location.reload(), 500);
  } else {
    showFeedback(result.error);
  }
}

// Feedback display using native alert - no new visual elements
function showFeedback(msg) {
  alert(msg);
}

// Legacy function mappings for HTML onclick handlers
function notify(msg) {
  // Map legacy notify calls to appropriate backend operations
  switch (msg) {
    case 'Control activo':
      activateControl();
      break;
    case 'Mensajes listos':
      openMessages();
      break;
    case 'Ingresos monitoreados':
      viewIncome();
      break;
    case 'Usuarios OK':
      checkUsers();
      break;
    default:
      showFeedback(msg);
  }
}
