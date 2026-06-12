// Main app module extracted from inline script in Index.html
// This file initializes listeners and re-exports functions from smaller modules.
import { initCanvas, initPointerEvents, resetS } from './processor.js';
import { initUI } from './ui.js';

window.resetS = resetS;

function hideGlobalLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  resetS();
  initUI();
  initPointerEvents();
  hideGlobalLoader();
});
