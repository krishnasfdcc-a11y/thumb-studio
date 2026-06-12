// UI handlers: events, sliders, AI wiring, export, pointer interactions
import { draw, canvas } from './processor.js';
import { transformImgPermanent, showLoader, hideLoader, extractColors, detectPerson, resetS } from './processor.js';

function preventDefault(event) {
  event.preventDefault();
  event.stopPropagation();
}

function setLoadedState(show = true) {
  const canvasEl = document.getElementById('imageCanvas');
  if (canvasEl) canvasEl.style.display = show ? 'block' : 'none';
  const placeholderEl = document.getElementById('placeholder');
  if (placeholderEl) placeholderEl.style.display = show ? 'none' : 'flex';
  const dragHintEl = document.getElementById('dragHint');
  if (dragHintEl) dragHintEl.style.display = show ? 'block' : 'none';
}

async function parseExifDate(file) {
  if (!window.exifr) return;
  try {
    const exif = await window.exifr.parse(file);
    if (!exif) return;
    const dateValue = exif.DateTimeOriginal || exif.CreateDate || exif.DateTime;
    if (!dateValue) return;
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) {
      const input = document.getElementById('dateInput');
      if (input) input.value = date.toISOString().substring(0, 10);
    }
  } catch (error) {
    console.warn('EXIF parse failed', error);
  }
}

async function loadImageFile(file) {
  if (!file) return;
  const uploadTextEl = document.getElementById('uploadText');
  if (uploadTextEl) uploadTextEl.textContent = file.name || 'Uploaded Image';

  let blob = file;
  const fileName = file.name?.toLowerCase() || '';
  if (file.type === 'image/heic' || file.type === 'image/heif' || fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    if (window.heic2any) {
      try {
        blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 1.0 });
      } catch (error) {
        console.error('HEIC conversion failed', error);
      }
    }
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      window.S = window.S || {};
      window.S.img = img;
      window.S.loaded = true;
      setLoadedState(true);
      draw();
      extractColors();
      await parseExifDate(file);
      if (file.type === 'image/jpeg' || file.type === 'image/jpg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
        try {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              window.S.originalExif = window.piexif.load(reader.result);
            } catch(e) { window.S.originalExif = null; }
          };
          reader.readAsDataURL(file);
        } catch(e) { window.S.originalExif = null; }
      } else {
        window.S.originalExif = null;
      }
      resolve(img);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function initUI() {
  // 1-Click Viral Auto-Edit
  const btnViralEdit = document.getElementById('btnViralEdit');
  if (btnViralEdit) {
    let isViral = false;
    let viralBackup = null;
    btnViralEdit.addEventListener('click', function() {
      if (!window.S || !window.S.loaded) return alert('Upload a photo first!');
      const S = window.S;
      if (isViral && viralBackup) {
        ['bri','con','sat','bgBlur','bgDim','fxVignette','bpScalePop'].forEach(id => {
          const el = document.getElementById(id);
          if (el) { el.value = viralBackup[id]; el.dispatchEvent(new Event('input')); }
        });
        const st = document.getElementById('bpShadowToggle');
        if (st) { st.checked = viralBackup.shadow; st.dispatchEvent(new Event('change')); }
        const layerSelect = document.getElementById('layerMode');
        if (layerSelect) { layerSelect.value = viralBackup.layer; layerSelect.dispatchEvent(new Event('change')); }
        const tInput = document.getElementById('titleText');
        if (tInput) tInput.value = viralBackup.title;
        S.preset = viralBackup.preset;
        document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
        const pc = document.querySelector(`.preset-card[data-preset="${S.preset}"]`);
        if (pc) pc.classList.add('active');
        S.color = viralBackup.color;
        isViral = false;
        this.innerHTML = '✨ 1-Click Viral Auto-Edit';
        this.style.background = 'linear-gradient(90deg, #ff00a0, #ff5500)';
        draw();
      } else {
        showLoader("Applying Viral Magic...");
        setTimeout(() => {
          viralBackup = { bri: S.adjust.bri, con: S.adjust.con, sat: S.adjust.sat, bgBlur: S.bgBlur, bgDim: S.bgDim, fxVignette: S.fxVignette, bpScalePop: S.bp.scalePop, shadow: S.bp.shadow, layer: S.bp.layerMode, title: document.getElementById('titleText').value, preset: S.preset, color: S.color };

          document.getElementById('bri').value = 105; document.getElementById('bri').dispatchEvent(new Event('input'));
          document.getElementById('con').value = 115; document.getElementById('con').dispatchEvent(new Event('input'));
          document.getElementById('sat').value = 125; document.getElementById('sat').dispatchEvent(new Event('input'));
          document.getElementById('bgBlur').value = 8; document.getElementById('bgBlur').dispatchEvent(new Event('input'));
          document.getElementById('bgDim').value = 20; document.getElementById('bgDim').dispatchEvent(new Event('input'));
          document.getElementById('fxVignette').value = 35; document.getElementById('fxVignette').dispatchEvent(new Event('input'));
          document.getElementById('bpScalePop').value = 10; document.getElementById('bpScalePop').dispatchEvent(new Event('input'));

          document.getElementById('bpShadowToggle').checked = true; document.getElementById('bpShadowToggle').dispatchEvent(new Event('change'));
          document.getElementById('layerMode').value = 'behind'; document.getElementById('layerMode').dispatchEvent(new Event('change'));

          document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
          const mag = document.querySelector('.preset-card[data-preset="magazine"]');
          if (mag) mag.classList.add('active');
          S.preset = 'magazine';

          const tInput = document.getElementById('titleText');
          if (tInput && !tInput.value) { tInput.value = "VIRAL"; }
          S.color = (S.extractedColors && S.extractedColors.length > 0) ? `grad-#ffffff-${S.extractedColors[0]}` : 'grad-gold';

          isViral = true;
          this.innerHTML = '↺ Undo Viral Edit';
          this.style.background = '#333';
          if (!S.bp.mask) { document.getElementById('btnDetect').click(); } else { draw(); hideLoader(); }
        }, 50);
      }
    });
  }

  // File upload
  const imgInput = document.getElementById('imgInput');
  if (imgInput) {
    imgInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await loadImageFile(file);
        if (window.S && window.S.loaded) {
          if (window.S.originalExif && window.S.originalExif["0th"] && window.S.originalExif["0th"][window.piexif.ImageIFD.ImageDescription]) {
            const desc = window.S.originalExif["0th"][window.piexif.ImageIFD.ImageDescription];
            if (typeof desc === 'string' && desc.includes("ThumbStudioProject::")) {
              try {
                const p = JSON.parse(desc.split("ThumbStudioProject::")[1].replace(/\0/g, ''));
                // restore project state
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
                const pc = document.querySelector(`.preset-card[data-preset="${p.preset}"]`);
                if (pc) pc.classList.add('active');
                document.querySelectorAll('.txt-style-btn').forEach(b=>b.classList.remove('active'));
                const tc = document.querySelector(`.txt-style-btn[data-style="${window.S.textStyle}"]`);
                if (tc) tc.classList.add('active');
                document.getElementById('layerMode').value = p.bp.layerMode; window.S.bp.layerMode = p.bp.layerMode;
                document.getElementById('bpOutlineControls').style.display = window.S.bp.outline ? 'block' : 'none';
                document.getElementById('bgRemoveControls').style.display = window.S.removeBg ? 'block' : 'none';
                if (p.bp.active) { detectPerson().then(() => hideLoader()); } else { draw(); hideLoader(); }
              } catch(e) { draw(); hideLoader(); }
            } else { draw(); hideLoader(); }
          } else { draw(); hideLoader(); }
        } else { hideLoader(); }
      } catch (error) {
        console.error('Failed to load image', error);
        hideLoader();
      } finally {
        e.target.value = '';
      }
    });
  }

  // Drag and drop
  const uploadZone = document.getElementById('uploadZone');
  if (uploadZone) {
    uploadZone.addEventListener('dragenter', preventDefault);
    uploadZone.addEventListener('dragover', preventDefault);
    uploadZone.addEventListener('dragleave', preventDefault);
    uploadZone.addEventListener('drop', async event => {
      preventDefault(event);
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        await loadImageFile(file);
      } catch (error) {
        console.error('Failed to load dropped image', error);
      }
    });
  }

  // Crop mode
  const cropMode = document.getElementById('cropMode');
  if (cropMode) {
    cropMode.addEventListener('change', e => {
      window.S = window.S || {};
      window.S.cropMode = e.target.value;
      document.getElementById('panControls').style.display = window.S.cropMode === 'original' ? 'none' : 'block';
      draw();
    });
  }

  // Pan sliders
  const panX = document.getElementById('panX');
  const panY = document.getElementById('panY');
  if (panX) panX.addEventListener('input', e => { window.S.imgPanX = Number(e.target.value); draw(); });
  if (panY) panY.addEventListener('input', e => { window.S.imgPanY = Number(e.target.value); draw(); });

  // Transform buttons
  window.transformImg = function(cmd) {
    window.S = window.S || {};
    transformImgPermanent(cmd).then(() => {
      const bpControls = document.getElementById('bpControls');
      const btnAutoCenter = document.getElementById('btnAutoCenter');
      if(bpControls) bpControls.style.display = 'none';
      if(btnAutoCenter) btnAutoCenter.style.display = 'none';
      draw();
    });
  };

  // Basic sliders
  ['bri','con','sat','warm','fontSize','bgBlur','bgDim','fxGrain','fxBloom','fxVignette','fxTiltShift','fxGlitch','fxLightLeak','bpScalePop','offsetX','offsetY','bpOutlineWidth','lightAngle','lightIntensity','bpFeather','brushSize','doodleSize','wmSize','wmOp'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', e => {
      window.S = window.S || {};
      const v = parseFloat(e.target.value);
      if(['bri','con','sat','warm'].includes(id)) { window.S.adjust = window.S.adjust || {}; window.S.adjust[id] = v; }
      else if(id === 'fontSize') window.S.fontSize = v;
      else if(id === 'bpenX') window.S.imgPanX = v;
      else if(id === 'panY') window.S.imgPanY = v;
      else if(id === 'offsetX') { window.S.offsetX = v; window.S.dragMode = false; }
      else if(id === 'offsetY') { window.S.offsetY = v; window.S.dragMode = false; }
      else if(id === 'lightAngle') window.S.lighting = window.S.lighting || {angle:45, intensity:0}; window.S.lighting.angle = v;
      else if(id === 'lightIntensity') window.S.lighting = window.S.lighting || {angle:45, intensity:0}; window.S.lighting.intensity = v;
      else if(id === 'bpOutlineWidth') window.S.bp = window.S.bp || { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 }; window.S.bp.outlineWidth = v;
      else if(id === 'bpFeather') window.S.bp = window.S.bp || { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 }; window.S.bp.feather = v;
      else if(id === 'brushSize') window.S.brushSize = v;
      else if(id.startsWith('fx')) { window.S[id] = v; }
      else if(id.startsWith('bg')) { window.S[id] = v; }
      else if(id.startsWith('wm') && id !== 'wmInput') { window.S.watermark = window.S.watermark || { img: null, size: 15, op: 80 }; if(id === 'wmSize') window.S.watermark.size = v; if(id === 'wmOp') window.S.watermark.op = v; }
      else window.S[id] = v;
      draw();
    });
  });

  // Presets
  const presetsGrid = document.getElementById('presetsGrid');
  if(presetsGrid){
    presetsGrid.addEventListener('click', e => {
      const card = e.target.closest('.preset-card');
      if(!card) return;
      const preset = card.dataset.preset;
      window.S = window.S || {};
      window.S.preset = preset;
      const p = window.S;
      const PRESETS = {
        cinematic: { bri:110, con:120, sat:110, warm:55 },
        y2k: { bri:105, con:105, sat:130, warm:35 },
        polaroid: { bri:115, con:100, sat:95, warm:65 },
        wedding: { bri:110, con:95, sat:90, warm:60 },
        luxury: { bri:95, con:120, sat:105, warm:40 },
        vaporwave: { bri:100, con:95, sat:160, warm:20 },
        roadtrip: { bri:110, con:110, sat:115, warm:55 },
        cottage: { bri:100, con:95, sat:90, warm:60 },
        editorial: { bri:100, con:125, sat:100, warm:45 },
        magazine: { bri:108, con:130, sat:105, warm:50 }
      };
      const filters = PRESETS[preset] || { bri:100, con:100, sat:100, warm:50 };
      window.S.adjust = Object.assign({}, window.S.adjust || {}, filters);
      ['bri','con','sat','warm'].forEach(k => { const el = document.getElementById(k); if(el) el.value = window.S.adjust[k]; });
      presetsGrid.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      draw();
    });
  }

  // Text inputs
  const titleText = document.getElementById('titleText');
  const subText = document.getElementById('subText');
  if(titleText) titleText.addEventListener('input', e => { window.S = window.S || {}; draw(); });
  if(subText) subText.addEventListener('input', e => { window.S = window.S || {}; draw(); });
  const dateInput = document.getElementById('dateInput');
  if(dateInput) dateInput.addEventListener('change', draw);

  // Quick text styles
  const txtStyleGrid = document.getElementById('txtStyleGrid');
  if(txtStyleGrid){
    txtStyleGrid.addEventListener('click', e=>{
      const btn = e.target.closest('.txt-style-btn');
      if(!btn) return;
      document.querySelectorAll('.txt-style-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      window.S.textStyle = btn.dataset.style;
      draw();
    });
  }

  // Font upload
  const fontInput = document.getElementById('fontInput');
  if(fontInput){
    fontInput.addEventListener('change', e => {
      const f = e.target.files?.[0]; if(!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const fontName = `userfont-${Date.now()}`;
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(`@font-face { font-family: '${fontName}'; src: url(${reader.result}); }`));
        document.head.appendChild(style);
        window.S.customFont = fontName;
        const ft = document.getElementById('fontText');
        if(ft) ft.textContent = "✓ Custom Font Active";
        draw();
      };
      reader.readAsDataURL(f);
      e.target.value = '';
    });
  }

  // Position grid
  const posGrid = document.getElementById('posGrid');
  if(posGrid){
    posGrid.addEventListener('click', e => {
      const btn = e.target.closest('.pos-btn'); if(!btn) return;
      const pos = btn.dataset.pos;
      window.S.pos = pos;
      posGrid.querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      window.S.dragMode = false;
      draw();
    });
  }

  // Color swatches
  const swatchesWrap = document.querySelector('.swatches-wrap');
  if(swatchesWrap){
    swatchesWrap.addEventListener('click', e => {
      const sw = e.target.closest('.sw'); if(!sw) return;
      document.querySelectorAll('.sw').forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
      window.S = window.S || {};
      window.S.color = sw.dataset.color;
      draw();
    });
  }

  // Export scale
  const exportScale = document.getElementById('exportScale');
  if(exportScale) exportScale.addEventListener('change', e => { window.S.exportScale = e.target.value; });

  // Format buttons
  document.querySelectorAll('.fmt-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.fmt-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      window.S.fmt = btn.dataset.fmt;
    });
  });

  // AI: layer mode, shadow, lighting, outline
  const layerMode = document.getElementById('layerMode');
  if(layerMode) layerMode.addEventListener('change', e => { window.S.bp = window.S.bp || { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 }; window.S.bp.layerMode = e.target.value; draw(); });

  const bpShadowToggle = document.getElementById('bpShadowToggle');
  if(bpShadowToggle) bpShadowToggle.addEventListener('change', e => { window.S.bp = window.S.bp || { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 }; window.S.bp.shadow = e.target.checked; draw(); });

  const bpOutlineToggle = document.getElementById('bpOutlineToggle');
  const bpOutlineControls = document.getElementById('bpOutlineControls');
  if(bpOutlineToggle){
    bpOutlineToggle.addEventListener('change', e => {
      window.S.bp = window.S.bp || { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 };
      window.S.bp.outline = e.target.checked;
      if(bpOutlineControls) bpOutlineControls.style.display = e.target.checked ? 'block' : 'none';
      draw();
    });
  }

  // Remove background toggle
  const removeBgToggle = document.getElementById('removeBgToggle');
  const bgRemoveControls = document.getElementById('bgRemoveControls');
  if(removeBgToggle){
    removeBgToggle.addEventListener('change', e => {
      if(e.target.checked && !window.S || !window.S.bp || !window.S.bp.mask) { alert("Detect Person first!"); e.target.checked = false; return; }
      window.S.removeBg = e.target.checked;
      if(bgRemoveControls) bgRemoveControls.style.display = e.target.checked ? 'block' : 'none';
      if(!e.target.checked && window.S) window.S.smartBg = null;
      draw();
    });
  }

  // Color pop toggle
  const colorPopToggle = document.getElementById('colorPopToggle');
  if(colorPopToggle){
    colorPopToggle.addEventListener('change', e => {
      if(e.target.checked && (!window.S || !window.S.bp || !window.S.bp.mask)) { alert("Detect Person first!"); e.target.checked = false; return; }
      window.S.colorPop = e.target.checked;
      draw();
    });
  }

  // Background color
  const bgColorPicker = document.getElementById('bgColorPicker');
  if(bgColorPicker) bgColorPicker.addEventListener('input', e => { window.S.bgColor = e.target.value; draw(); });

  // Smart bg button
  const btnSmartBg = document.getElementById('btnSmartBg');
  if(btnSmartBg){
    btnSmartBg.addEventListener('click', () => {
      if(!window.S || !window.S.bp || !window.S.bp.mask) return alert("Detect Person First!");
      document.getElementById('removeBgToggle').checked = true; window.S.removeBg = true;
      if(bgRemoveControls) bgRemoveControls.style.display = 'block';
      const bgC = document.createElement('canvas'); bgC.width = 1000; bgC.height = 1000; const bgCtx = bgC.getContext('2d');
      const grad = bgCtx.createLinearGradient(0, 0, 1000, 1000); grad.addColorStop(0, window.S.extractedColors[0] || '#111'); grad.addColorStop(1, window.S.extractedColors[1] || '#444');
      bgCtx.fillStyle = grad; bgCtx.fillRect(0, 0, 1000, 1000);
      for(let i=0; i<100; i++) { bgCtx.beginPath(); bgCtx.arc(Math.random()*1000, Math.random()*1000, Math.random()*200, 0, Math.PI*2); bgCtx.fillStyle = `rgba(255,255,255,${Math.random()*0.1})`; bgCtx.fill(); }
      window.S.smartBg = bgC; draw();
    });
  }

  // Detect person
  const btnDetect = document.getElementById('btnDetect');
  if(btnDetect){
    btnDetect.addEventListener('click', () => detectPerson());
  }

  // Auto center
  const btnAutoCenter = document.getElementById('btnAutoCenter');
  if(btnAutoCenter){
    btnAutoCenter.addEventListener('click', () => {
      if(!window.S || !window.S.bp || !window.S.bp.mask) return;
      import('./processor.js').then(m => m.autoCenter());
    });
  }

  // Watermark upload
  const wmInput = document.getElementById('wmInput');
  if(wmInput){
    wmInput.addEventListener('change', e => {
      const file = e.target.files[0]; if(!file) return;
      window.S.watermark = window.S.watermark || { img: null, size: 15, op: 80 };
      const wmImg = new Image();
      wmImg.onload = () => {
        window.S.watermark.img = wmImg;
        const wmControls = document.getElementById('wmControls');
        if(wmControls) wmControls.style.display = 'block';
        draw();
      };
      wmImg.src = URL.createObjectURL(file);
    });
  }

  // Eraser toggle
  const eraserToggle = document.getElementById('eraserToggle');
  const eraserControls = document.getElementById('eraserControls');
  if(eraserToggle){
    eraserToggle.addEventListener('change', e => {
      window.S.eraserMode = e.target.checked;
      if(eraserControls) eraserControls.style.display = e.target.checked ? 'block' : 'none';
      if(e.target.checked) {
        canvas.classList.add('eraser-cursor');
        const dragHint = document.getElementById('dragHint');
        if(dragHint) dragHint.style.display = 'none';
        const doodleToggle = document.getElementById('doodleToggle');
        if(doodleToggle){ doodleToggle.checked = false; window.S.doodle = window.S.doodle || { active: false, strokes: [] }; window.S.doodle.active = false; }
        const doodleControls = document.getElementById('doodleControls');
        if(doodleControls) doodleControls.style.display = 'none';
      } else {
        canvas.classList.remove('eraser-cursor');
        const dragHint = document.getElementById('dragHint');
        if(dragHint) dragHint.style.display = 'flex';
      }
    });
  }

  // Brush mode
  document.querySelectorAll('input[name="bmode"]').forEach(r => {
    r.addEventListener('change', e => { window.S.brushMode = e.target.value; });
  });

  // Reset eraser
  const btnResetEraser = document.getElementById('btnResetEraser');
  if(btnResetEraser){
    btnResetEraser.addEventListener('click', () => {
      if(!window.S || !window.S.bp || !window.S.bp.originalMaskData) return;
      window.S.bp.mask.getContext('2d').putImageData(window.S.bp.originalMaskData, 0, 0);
      draw();
    });
  }

  // Doodle toggle
  const doodleToggle = document.getElementById('doodleToggle');
  const doodleControls = document.getElementById('doodleControls');
  if(doodleToggle){
    doodleToggle.addEventListener('change', e => {
      window.S.doodle = window.S.doodle || { active: false, strokes: [] };
      window.S.doodle.active = e.target.checked;
      if(doodleControls) doodleControls.style.display = e.target.checked ? 'block' : 'none';
      if(e.target.checked) {
        canvas.classList.add('eraser-cursor');
        const dragHint = document.getElementById('dragHint');
        if(dragHint) dragHint.style.display = 'none';
        const eraserToggle = document.getElementById('eraserToggle');
        if(eraserToggle){ eraserToggle.checked = false; window.S.eraserMode = false; }
        const eraserControls = document.getElementById('eraserControls');
        if(eraserControls) eraserControls.style.display = 'none';
      } else {
        canvas.classList.remove('eraser-cursor');
        const dragHint = document.getElementById('dragHint');
        if(dragHint) dragHint.style.display = 'flex';
      }
    });
  }

  // Undo doodle
  const btnUndoDoodle = document.getElementById('btnUndoDoodle');
  if(btnUndoDoodle){
    btnUndoDoodle.addEventListener('click', () => {
      window.S.doodle = window.S.doodle || { active: false, strokes: [] };
      window.S.doodle.strokes.pop();
      draw();
    });
  }

  // Export image
  const btnDl = document.getElementById('btnDl');
  if(btnDl){
    btnDl.addEventListener('click', async () => {
      draw();
      const eC = document.querySelector('.fmt-btn.active')?.dataset?.fmt || 'jpeg';
      const { exportImage } = await import('./processor.js');
      exportImage();
    });
  }

  // Print
  const btnPrint = document.getElementById('btnPrint');
  if(btnPrint){
    btnPrint.addEventListener('click', async () => {
      const { printImage } = await import('./processor.js');
      printImage();
    });
  }

  // Video export
  const btnVideo = document.getElementById('btnVideo');
  if(btnVideo){
    btnVideo.addEventListener('click', async () => {
      const { exportVideo } = await import('./processor.js');
      exportVideo().then(blobUrl => {
        const vMod = document.getElementById('videoModal');
        const vPrev = document.getElementById('vidPreview');
        if(vPrev && vMod && blobUrl) { vPrev.src = blobUrl; vMod.style.display = 'flex'; }
      }).catch(() => {});
    });
  }

  // Download video button
  const btnDownloadVid = document.getElementById('btnDownloadVid');
  if(btnDownloadVid){
    btnDownloadVid.addEventListener('click', () => {
      const blobUrl = document.getElementById('vidPreview').src;
      if(!blobUrl) return;
      const a = document.createElement('a');
      a.href = blobUrl; a.download = `ThumbStudio_Vid_${Date.now()}.mp4`; a.click();
    });
  }

  // Pointer events
  function getCP(e) {
    const r = canvas.getBoundingClientRect();
    const sX = canvas.width/r.width; const sY = canvas.height/r.height;
    let cX = e.clientX, cY = e.clientY;
    if(e.touches && e.touches.length>0){ cX = e.touches[0].clientX; cY = e.touches[0].clientY; }
    return { x: (cX-r.left)*sX, y: (cY-r.top)*sY };
  }

  function paintMask(cX, cY) {
    if(!window.S || !window.S.bp || !window.S.bp.mask) return;
    const mCtx = window.S.bp.mask.getContext('2d');
    const ratioX = cX / canvas.width, ratioY = cY / canvas.height;
    const origX = window.S.cropRect.sx + (ratioX * window.S.cropRect.sw), origY = window.S.cropRect.sy + (ratioY * window.S.cropRect.sh);
    mCtx.beginPath();
    mCtx.arc(origX, origY, (window.S.brushSize || 40) * (window.S.img.naturalHeight / 1000), 0, Math.PI * 2);
    mCtx.globalCompositeOperation = window.S.brushMode === 'erase' ? 'destination-out' : 'source-over';
    mCtx.fillStyle = window.S.brushMode === 'erase' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';
    mCtx.fill();
    mCtx.globalCompositeOperation = 'source-over';
    draw();
  }

  function pD(e) {
    if(!window.S || !window.S.loaded) return;
    const p = getCP(e);
    if (window.S.doodle && window.S.doodle.active) {
      window.S.isDoodling = true;
      window.S.doodle.strokes.push({ color: document.getElementById('doodleColor').value, size: parseInt(document.getElementById('doodleSize').value) || 10, points: [p] });
      if(e.cancelable && e.type.includes('touch')) e.preventDefault();
      return;
    }
    if (window.S.eraserMode && window.S.bp && window.S.bp.mask) {
      window.S.isPainting = true;
      paintMask(p.x, p.y);
      if(e.cancelable && e.type.includes('touch')) e.preventDefault();
      return;
    }
    const b = window.S.textBounds;
    if(p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h) {
      window.S.isDragging = true;
      window.S.dragMode = true;
      window.S.dragOffsetX = p.x - window.S.textX;
      window.S.dragOffsetY = p.y - window.S.textY;
      canvas.style.cursor='grabbing';
      document.querySelectorAll('.pos-btn').forEach(btn=>btn.classList.remove('active'));
      if(e.cancelable && e.type.includes('touch')) e.preventDefault();
    }
  }

  function pM(e) {
    if(!window.S || !window.S.loaded) return;
    const p = getCP(e);
    if (window.S.isDoodling) {
      window.S.doodle = window.S.doodle || { active: false, strokes: [] };
      window.S.doodle.strokes[window.S.doodle.strokes.length-1].points.push(p);
      draw();
      if(e.cancelable && e.type.includes('touch')) e.preventDefault();
      return;
    }
    if (window.S.isPainting) {
      paintMask(p.x, p.y);
      if(e.cancelable && e.type.includes('touch')) e.preventDefault();
      return;
    }
    if (!window.S.isDragging) {
      const b = window.S.textBounds;
      canvas.style.cursor = (p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h) ? 'grab' : 'default';
      return;
    }
    if(e.cancelable && e.type.includes('touch')) e.preventDefault();
    window.S.textX = p.x - window.S.dragOffsetX;
    window.S.textY = p.y - window.S.dragOffsetY;
    draw();
  }

  function pU() {
    if(window.S) {
      window.S.isDragging = false;
      window.S.isPainting = false;
      window.S.isDoodling = false;
    }
    canvas.style.cursor = 'default';
  }

  canvas.addEventListener('mousedown', pD);
  canvas.addEventListener('mousemove', pM);
  window.addEventListener('mouseup', pU);
  canvas.addEventListener('touchstart', pD, {passive: false});
  canvas.addEventListener('touchmove', pM, {passive: false});
  window.addEventListener('touchend', pU);

  setLoadedState(false);
}
