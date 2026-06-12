// Main app module extracted from inline script in Index.html
// This file initializes listeners and re-exports functions from smaller modules.
import { initUI } from './ui.js';
import { initCanvas } from './processor.js';

function hideGlobalLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initUI();
  hideGlobalLoader();
});
