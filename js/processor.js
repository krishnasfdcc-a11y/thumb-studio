// Minimal processor module with draw placeholder. The original draw code
// is large; here we provide an entry point that the UI can call.
export const canvas = document.getElementById('imageCanvas');
export const ctx = canvas.getContext('2d');

export function initCanvas(){
  // placeholder state
  window.S = window.S || {};
  window.S.img = window.S.img || new Image();
  window.S.loaded = window.S.loaded || false;
}

export function draw(){
  if(!window.S || !window.S.loaded) return;
  const img = window.S.img;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0, 0);
}
