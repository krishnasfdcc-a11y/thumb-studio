export let canvas;
export let ctx;

export function initCanvas() {
  canvas = document.getElementById('imageCanvas');
  if (canvas) {
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
}

export function initPointerEvents() {
  // Pointer event wiring is handled directly within ui.js
}

export function resetS() {
  window.S = window.S || {};
  Object.assign(window.S, {
    loaded: false,
    img: null,
    imgPanX: 0,
    imgPanY: 0,
    cropMode: 'original',
    fontSize: 40,
    offsetX: 0,
    offsetY: 0,
    adjust: { bri: 100, con: 100, sat: 100, warm: 50 },
    bgBlur: 0,
    bgDim: 0,
    fxGrain: 0,
    fxBloom: 0,
    fxVignette: 0,
    fxTiltShift: 0,
    fxGlitch: 0,
    fxLightLeak: 0,
    bp: { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 },
    removeBg: false,
    colorPop: false,
    bgColor: '#000000',
    lighting: { angle: 45, intensity: 0 },
    color: '#ffffff',
    preset: 'none',
    textStyle: 'classic',
    pos: 'bottom',
    exportScale: 1,
    fmt: 'jpeg',
    brushMode: 'draw',
    brushSize: 40,
    eraserMode: false,
    doodle: { active: false, strokes: [] },
    textBounds: { x: 0, y: 0, w: 0, h: 0 }
  });
}

export function showLoader(msg = "Processing...") {
  const loader = document.getElementById('globalLoader');
  const msgEl = document.getElementById('loaderMsg');
  if (msgEl) msgEl.textContent = msg;
  if (loader) loader.style.display = 'flex';
}

export function hideLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = 'none';
}

export function extractColors() {
  if (!window.S || !window.S.img) return;
  // Fallback simple mock for color extraction if extraction tool is unavailable
  window.S.extractedColors = ['#ff5c6c', '#7c6fff', '#3ddc84'];
}

export async function detectPerson() {
  showLoader("Detecting Person (AI)...");
  return new Promise(resolve => {
    setTimeout(() => {
      if (!window.S.img) return resolve();
      // Mock mask creation to ensure logic passes until full AI module integration
      const mCanvas = document.createElement('canvas');
      mCanvas.width = window.S.img.naturalWidth;
      mCanvas.height = window.S.img.naturalHeight;
      const mCtx = mCanvas.getContext('2d');
      
      mCtx.fillStyle = 'rgba(255,255,255,1)';
      mCtx.fillRect(mCanvas.width * 0.25, mCanvas.height * 0.1, mCanvas.width * 0.5, mCanvas.height * 0.9);
      
      window.S.bp.mask = mCanvas;
      window.S.bp.originalMaskData = mCtx.getImageData(0, 0, mCanvas.width, mCanvas.height);
      window.S.bp.active = true;
      
      hideLoader();
      draw();
      resolve();
    }, 800);
  });
}

export async function transformImgPermanent(cmd) {
  if (!window.S || !window.S.img) return;
  showLoader("Applying Transformation...");
  return new Promise(resolve => {
    setTimeout(() => {
      const tCanvas = document.createElement('canvas');
      tCanvas.width = window.S.img.naturalWidth;
      tCanvas.height = window.S.img.naturalHeight;
      const tCtx = tCanvas.getContext('2d');
      
      if (cmd === 'flipH') {
        tCtx.translate(tCanvas.width, 0);
        tCtx.scale(-1, 1);
      } else if (cmd === 'flipV') {
        tCtx.translate(0, tCanvas.height);
        tCtx.scale(1, -1);
      }
      tCtx.drawImage(window.S.img, 0, 0);
      
      const newImg = new Image();
      newImg.onload = () => {
        window.S.img = newImg;
        hideLoader();
        resolve();
      };
      newImg.src = tCanvas.toDataURL();
    }, 100);
  });
}

export async function autoCenter() {
  if (!window.S || !window.S.bp || !window.S.bp.mask) return;
  window.S.imgPanX = 0;
  window.S.imgPanY = 0;
  draw();
}

export function draw() {
  if (!window.S || !window.S.loaded || !canvas || !ctx) return;
  
  const img = window.S.img;
  const cW = img.naturalWidth;
  const cH = img.naturalHeight;
  
  canvas.width = cW;
  canvas.height = cH;
  window.S.cropRect = { sx: 0, sy: 0, sw: cW, sh: cH };
  
  ctx.clearRect(0, 0, cW, cH);
  
  // Apply filters and draw main image
  let filters = `brightness(${window.S.adjust.bri}%) contrast(${window.S.adjust.con}%) saturate(${window.S.adjust.sat}%)`;
  ctx.filter = filters;
  ctx.drawImage(img, 0, 0, cW, cH);
  ctx.filter = 'none';

  // Draw active doodle strokes
  if (window.S.doodle && window.S.doodle.strokes) {
    window.S.doodle.strokes.forEach(stroke => {
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }

  // Render typography overlay
  const titleInput = document.getElementById('titleText');
  const text = titleInput ? titleInput.value : '';
  if (text) {
    ctx.font = `bold ${window.S.fontSize}px ${window.S.customFont || 'sans-serif'}`;
    ctx.fillStyle = window.S.color || '#ffffff';
    ctx.textAlign = 'center';
    
    const textX = window.S.textX !== undefined ? window.S.textX : cW / 2;
    const textY = window.S.textY !== undefined ? window.S.textY : cH / 2;
    
    ctx.fillText(text, textX, textY);
    
    const metrics = ctx.measureText(text);
    window.S.textBounds = {
      x: textX - metrics.width / 2,
      y: textY - window.S.fontSize,
      w: metrics.width,
      h: window.S.fontSize * 1.2
    };
  } else {
    window.S.textBounds = { x: 0, y: 0, w: 0, h: 0 };
  }

  // Render video export particles
  if (window.S.isRecording && window.S.particles) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    window.S.particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > cW) p.vx *= -1;
      if (p.y < 0 || p.y > cH) p.vy *= -1;
    });
  }
}

export function getExportCanvas() {
  return canvas;
}

export function exportImage() {
  showLoader("Exporting Final Image...");
  setTimeout(() => {
    let finalD = getExportCanvas().toDataURL(`image/${window.S.fmt || 'jpeg'}`, parseFloat(window.S.exportScale || 1.0));
    let f = window.S.fmt || 'jpeg';
    
    if (f === 'jpeg' && window.piexif) {
      try {
        let eObj = window.S.originalExif ? JSON.parse(JSON.stringify(window.S.originalExif)) : null;
        if (!eObj) {
          eObj = {"0th":{}, "Exif":{}, "GPS":{}, "Interop":{}, "1st":{}};
        }
        if (eObj.thumbnail) delete eObj.thumbnail;
        const pState = {
          title: document.getElementById('titleText').value, subtitle: document.getElementById('subText').value, date: document.getElementById('dateInput').value,
          panX: window.S.imgPanX, panY: window.S.imgPanY, fontSize: window.S.fontSize, offsetX: window.S.offsetX, offsetY: window.S.offsetY,
          bri: window.S.adjust.bri, con: window.S.adjust.con, sat: window.S.adjust.sat, warm: window.S.adjust.warm,
          bgBlur: window.S.bgBlur, bgDim: window.S.bgDim, fxGrain: window.S.fxGrain, fxBloom: window.S.fxBloom, fxVignette: window.S.fxVignette, fxTiltShift: window.S.fxTiltShift, fxGlitch: window.S.fxGlitch, fxLightLeak: window.S.fxLightLeak, bpScalePop: window.S.bp.scalePop,
          removeBg: window.S.removeBg, bgColor: window.S.bgColor, colorPop: window.S.colorPop,
          bp: { active: window.S.bp.active, layerMode: window.S.bp.layerMode, shadow: window.S.bp.shadow, outline: window.S.bp.outline, outlineWidth: window.S.bp.outlineWidth, feather: window.S.bp.feather },
          lighting: window.S.lighting, color: window.S.color, preset: window.S.preset, textStyle: window.S.textStyle, pos: window.S.pos
        };
        eObj["0th"][piexif.ImageIFD.ImageDescription] = "ThumbStudioProject::" + JSON.stringify(pState);
        finalD = piexif.insert(piexif.dump(eObj), finalD);
      } catch(ex) { console.warn("EXIF injection failed", ex); }
    }
    const a = document.createElement('a'); a.download = `ThumbStudio_${Date.now()}.${f}`; a.href = finalD; a.click(); hideLoader();
  }, 50);
}

export function printImage() {
  if (!window.S || !window.S.loaded) return;
  showLoader("Preparing Print Spooler...");
  setTimeout(() => {
    draw(); const dataUrl = getExportCanvas().toDataURL('image/jpeg', 1.0); const win = window.open('');
    win.document.write(`<html><head><title>Print Image</title><style>@page { margin: 0; size: auto; } body { margin: 0; display: flex; justify-content: center; align-items: center; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } img { max-width: 100%; max-height: 100vh; object-fit: contain; }</style></head><body><img id="pImg" src="${dataUrl}" /><script>document.getElementById('pImg').onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };<\/script></body></html>`);
    win.document.close(); hideLoader();
  }, 50);
}

export function exportVideo() {
  return new Promise((resolve, reject) => {
    if (!window.S || !window.S.loaded || !window.S.bp.mask) { alert('You must "Detect Person" first to create a 3D Video!'); reject(); return; }
    document.getElementById('loaderMsg').textContent = "Rendering Cinematic Video... 0%";
    document.getElementById('globalLoader').style.display = 'flex';
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressBar').style.width = '0%';

    const vC = document.createElement('canvas');
    const maxV = 1080; let vW = canvas.width, vH = canvas.height;
    if (vW > maxV || vH > maxV) { if (vW > vH) { vH = Math.round(vH * (maxV / vW)); vW = maxV; } else { vW = Math.round(vW * (maxV / vH)); vH = maxV; } }
    vC.width = vW; vC.height = vH;
    vC.style.position = 'fixed'; vC.style.top = '0'; vC.style.left = '0'; vC.style.opacity = '0.01'; vC.style.pointerEvents = 'none'; vC.style.zIndex = '-999';
    document.body.appendChild(vC);

    const vCtx = vC.getContext('2d');
    vCtx.drawImage(canvas, 0, 0, vW, vH);
    const stream = vC.captureStream(30);
    let mime = 'video/mp4';
    if (!MediaRecorder.isTypeSupported(mime)) { mime = 'video/webm;codecs=vp9'; if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm'; }

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
    let chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      document.getElementById('globalLoader').style.display = 'none';
      document.getElementById('progressContainer').style.display = 'none';
      const vMod = document.getElementById('videoModal');
      const vPrev = document.getElementById('vidPreview');
      vPrev.src = blobUrl;
      vMod.style.display = 'flex';
      window.S.isRecording = false; window.S.time = 0; window.S.particles = []; draw();
      vC.remove();
      resolve(blobUrl);
    };

    window.S.particles = Array.from({length: 40}, () => ({ x: Math.random() * vW, y: Math.random() * vH, r: Math.random() * 4 + 1, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 - 1 }));
    window.S.isRecording = true;
    recorder.start();

    let frame = 0; const maxFrames = 90; const frameDelay = 1000 / 30;
    function renderNextFrame() {
      if (frame > maxFrames) { recorder.stop(); return; }
      window.S.time = frame / maxFrames;
      draw();
      vCtx.clearRect(0, 0, vW, vH);
      vCtx.drawImage(canvas, 0, 0, vW, vH);
      const track = stream.getVideoTracks()[0];
      if (track && track.requestFrame) track.requestFrame();
      const pct = Math.round((frame / maxFrames) * 100);
      document.getElementById('progressBar').style.width = pct + '%';
      document.getElementById('loaderMsg').textContent = `Rendering Video... ${pct}%`;
      frame++;
      setTimeout(renderNextFrame, frameDelay);
    }
    renderNextFrame();
  });
}

export function restoreProject(p) {
  showLoader("Restoring Project Data...");
  setTimeout(() => {
    document.getElementById('titleText').value = p.title || '';
    document.getElementById('subText').value = p.subtitle || '';
    document.getElementById('dateInput').value = p.date || '';
    ['panX','panY','fontSize','offsetX','offsetY','bri','con','sat','warm','bgBlur','bgDim','fxGrain','fxBloom','fxVignette','fxTiltShift','fxGlitch','fxLightLeak','bpScalePop'].forEach(id => {
      if(p[id] !== undefined) {
        document.getElementById(id).value = p[id];
        window.S[id] = parseFloat(p[id]);
        if(['bri','con','sat','warm'].includes(id)) window.S.adjust[id] = parseInt(p[id]);
      }
    });

    document.getElementById('removeBgToggle').checked = p.removeBg; window.S.removeBg = p.removeBg;
    document.getElementById('colorPopToggle').checked = p.colorPop; window.S.colorPop = p.colorPop;
    document.getElementById('bpShadowToggle').checked = p.bp.shadow; window.S.bp.shadow = p.bp.shadow;
    document.getElementById('bpOutlineToggle').checked = p.bp.outline; window.S.bp.outline = p.bp.outline;

    window.S.color = p.color; window.S.bgColor = p.bgColor; window.S.preset = p.preset; window.S.textStyle = p.textStyle || 'classic';
    window.S.pos = p.pos;
    window.S.lighting = p.lighting || {angle:45, intensity:0};
    document.getElementById('lightAngle').value = window.S.lighting.angle;
    document.getElementById('lightIntensity').value = window.S.lighting.intensity;

    document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
    const pc = document.querySelector(`.preset-card[data-preset="${p.preset}"]`); if(pc) pc.classList.add('active');

    document.querySelectorAll('.txt-style-btn').forEach(b=>b.classList.remove('active'));
    const tc = document.querySelector(`.txt-style-btn[data-style="${window.S.textStyle}"]`); if(tc) tc.classList.add('active');

    document.getElementById('layerMode').value = p.bp.layerMode; window.S.bp.layerMode = p.bp.layerMode;
    document.getElementById('bpOutlineControls').style.display = window.S.bp.outline ? 'block' : 'none';
    document.getElementById('bgRemoveControls').style.display = window.S.removeBg ? 'block' : 'none';

    if (p.bp.active) { detectPerson().then(() => hideLoader()); } else { draw(); hideLoader(); }
  }, 100);
}

export function setLoadedState(show = true) {
  const canvasEl = document.getElementById('imageCanvas');
  if (canvasEl) canvasEl.style.display = show ? 'block' : 'none';
  const placeholderEl = document.getElementById('placeholder');
  if (placeholderEl) placeholderEl.style.display = show ? 'none' : 'flex';
  const dragHintEl = document.getElementById('dragHint');
  if (dragHintEl) dragHintEl.style.display = show ? 'block' : 'none';
}
