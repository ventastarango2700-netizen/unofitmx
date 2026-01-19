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
    if(deferredPrompt){
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
}

// Page stabilization
window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("ready");
});

// Page navigation
function go(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

// User actions
function notify(msg) {
  alert(msg);
}

function toggleStatus() {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = el.textContent === "Sistema estable"
      ? "Sistema en mantenimiento"
      : "Sistema estable";
  }
}

function resetApp() {
  localStorage.clear();
  alert("Estado reiniciado");
  location.reload();
}
