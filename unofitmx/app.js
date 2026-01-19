let deferredPrompt;
const btn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  btn.hidden = false;
});

btn.addEventListener('click', async () => {
  btn.hidden = true;
  if(deferredPrompt){
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
});