// Processor: drawing, crop/pan, filters and simple text overlay
export const canvas = document.getElementById('imageCanvas');
export const ctx = canvas.getContext('2d');

export function initCanvas(){
  window.S = window.S || {};
  window.S.img = window.S.img || new Image();
  window.S.loaded = window.S.loaded || false;
  // editing state defaults
  window.S.state = window.S.state || {
    cropMode: 'original',
    panX: 50,
    panY: 50,
    rotation: 0, // degrees (preview only)
    flipH: false,
    flipV: false,
    filters: { bri: 100, con: 100, sat: 100, warm: 50 },
    preset: null,
    title: '',
    subtitle: '',
    pos: 'bot-right',
    offsetX: 0,
    offsetY: 0,
    fontSize: 4
  };
}

function parseRatioString(mode){
  if(!mode || mode === 'original') return null;
  const parts = String(mode).split(':');
  if(parts.length !== 2) return null;
  const w = parseFloat(parts[0]);
  const h = parseFloat(parts[1]);
  if(!w || !h) return null;
  return w / h;
}

function computeCropRect(img, ratio, panX, panY){
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  let cropW = imgW;
  let cropH = imgH;
  if(ratio){
    if(imgW / imgH > ratio){
      cropH = imgH;
      cropW = Math.round(cropH * ratio);
    } else {
      cropW = imgW;
      cropH = Math.round(cropW / ratio);
    }
  }
  const cx = Math.round((panX/100) * imgW);
  const cy = Math.round((panY/100) * imgH);
  let sx = cx - Math.floor(cropW/2);
  let sy = cy - Math.floor(cropH/2);
  if(sx < 0) sx = 0;
  if(sy < 0) sy = 0;
  if(sx + cropW > imgW) sx = imgW - cropW;
  if(sy + cropH > imgH) sy = imgH - cropH;
  return { sx, sy, sWidth: cropW, sHeight: cropH };
}

function drawTextOverlay(ctx, st, cw, ch){
  const title = st.title || '';
  const subtitle = st.subtitle || '';
  if(!title && !subtitle) return;
  ctx.save();
  const titleSize = Math.max(18, Math.round(ch * 0.08 * (parseFloat(st.fontSize || 4) / 4)));
  const subSize = Math.max(12, Math.round(titleSize * 0.45));
  ctx.textBaseline = 'top';
  ctx.font = `${titleSize}px 'DM Sans', sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';

  const padding = 26;
  let x = padding;
  let y = padding;
  let align = 'left';
  switch(st.pos){
    case 'top-left': x = padding; y = padding; align='left'; break;
    case 'top-center': x = cw/2; y = padding; align='center'; break;
    case 'top-right': x = cw - padding; y = padding; align='right'; break;
    case 'mid-center': x = cw/2; y = ch/2 - titleSize; align='center'; break;
    case 'bot-left': x = padding; y = ch - padding - titleSize - subSize; align='left'; break;
    case 'bot-center': x = cw/2; y = ch - padding - titleSize - subSize; align='center'; break;
    case 'bot-right': x = cw - padding; y = ch - padding - titleSize - subSize; align='right'; break;
    default: x = padding; y = padding; align='left';
  }
  x += st.offsetX || 0; y += st.offsetY || 0;
  ctx.textAlign = align;
  if(title){ ctx.strokeText(title, x, y); ctx.fillText(title, x, y); }
  if(subtitle){ ctx.font = `${subSize}px 'DM Sans', sans-serif`; ctx.strokeText(subtitle, x, y + titleSize + 6); ctx.fillText(subtitle, x, y + titleSize + 6); }
  ctx.restore();
}

export function draw(){
  if(!window.S || !window.S.loaded) return;
  const img = window.S.img;
  const st = window.S.state || {};
  const ratio = parseRatioString(st.cropMode);
  const panX = Number.isFinite(st.panX) ? st.panX : 50;
  const panY = Number.isFinite(st.panY) ? st.panY : 50;
  const crop = computeCropRect(img, ratio, panX, panY);

  // Limit display size for preview to avoid huge canvases
  const MAX_DIM = 1400;
  const scale = Math.min(1, MAX_DIM / Math.max(crop.sWidth, crop.sHeight));
  const outW = Math.max(1, Math.round(crop.sWidth * scale));
  const outH = Math.max(1, Math.round(crop.sHeight * scale));

  canvas.width = outW;
  canvas.height = outH;
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Build filter string
  const f = st.filters || {};
  const bri = f.bri ?? 100;
  const con = f.con ?? 100;
  const sat = f.sat ?? 100;
  const warm = f.warm ?? 50; // 0..100
  const hue = Math.round((warm - 50) * 0.8); // map to -40..40
  ctx.filter = `brightness(${bri}%) contrast(${con}%) saturate(${sat}%) hue-rotate(${hue}deg)`;

  // Draw cropped region scaled to canvas
  try{
    ctx.drawImage(img, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, outW, outH);
  }catch(e){ console.error('drawImage failed', e); }

  ctx.filter = 'none';

  // apply preview rotation/flip via CSS transform if present (visual only)
  const rot = st.rotation || 0;
  const flipH = st.flipH ? -1 : 1;
  const flipV = st.flipV ? -1 : 1;
  const css = `rotate(${rot}deg) scale(${flipH}, ${flipV})`;
  if(canvas.style) canvas.style.transform = css;

  // text overlay
  try{ drawTextOverlay(ctx, st, canvas.width, canvas.height); }catch(e){ console.warn('text overlay error', e); }

  ctx.restore();
}
