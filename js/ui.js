// UI handlers (event wiring). Moves many element listeners out of HTML.
import { draw, canvas } from './processor.js';
import { transformImgPermanent } from './processor.js';

const uploadText = () => document.getElementById('uploadText');
const placeholder = () => document.getElementById('placeholder');
const dragHint = () => document.getElementById('dragHint');
const dateInput = () => document.getElementById('dateInput');

function preventDefault(event) {
  event.preventDefault();
  event.stopPropagation();
}

function setLoadedState(show = true) {
  const canvasEl = document.getElementById('imageCanvas');
  if (canvasEl) canvasEl.style.display = show ? 'block' : 'none';
  const placeholderEl = placeholder();
  if (placeholderEl) placeholderEl.style.display = show ? 'none' : 'flex';
  const dragHintEl = dragHint();
  if (dragHintEl) dragHintEl.style.display = show ? 'block' : 'none';
}

async function parseExifDate(file) {
  if (!window.exifr || !dateInput) return;
  try {
    const exif = await window.exifr.parse(file);
    if (!exif) return;
    const dateValue = exif.DateTimeOriginal || exif.CreateDate || exif.DateTime;
    if (!dateValue) return;
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) {
      const input = dateInput();
      if (input) input.value = date.toISOString().substring(0, 10);
    }
  } catch (error) {
    console.warn('EXIF parse failed', error);
  }
}

function extractColorsAndFillSwatches(){
  const img = window.S?.img;
  const panel = document.getElementById('dynamicSwatchesPanel');
  const container = document.getElementById('dynamicSwatches');
  if(!img || !container || !panel) return;
  panel.style.display = 'block';
  const colors = [];
  if(window.ColorThief){
    try{
      const ct = new ColorThief();
      const pal = ct.getPalette(img, 5);
      for(const c of pal) colors.push(`rgb(${c[0]},${c[1]},${c[2]})`);
    }catch(e){ console.warn('ColorThief failed', e); }
  }
  if(colors.length === 0){
    const tmp = document.createElement('canvas');
    tmp.width = Math.min(200, img.naturalWidth);
    tmp.height = Math.min(200, img.naturalHeight);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(img,0,0,tmp.width,tmp.height);
    const data = tctx.getImageData(0,0,tmp.width,tmp.height).data;
    const samples = 5;
    for(let i=0;i<samples;i++){
      const idx = (Math.floor((i/(samples-1))*(data.length/4-1)) * 4);
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      colors.push(`rgb(${r},${g},${b})`);
    }
  }
  container.innerHTML = '';
  colors.forEach(col =>{
    const d = document.createElement('div');
    d.className = 'sw';
    d.style.background = col;
    d.dataset.color = col;
    d.title = col;
    d.addEventListener('click', ()=>{ window.S.state.accentColor = col; draw(); });
    container.appendChild(d);
  });
}

async function loadImageFile(file) {
  if (!file) return;
  const textEl = uploadText();
  if (textEl) textEl.textContent = file.name || 'Uploaded Image';

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
      try{ extractColorsAndFillSwatches(); }catch(e){}
      await parseExifDate(file);
        // check for embedded project JSON in EXIF (piexif)
        try{
          if(window.piexif && file.type && file.type.includes('jpeg') || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')){
            const reader = new FileReader();
            reader.onload = () => {
              try{
                const ex = piexif.load(reader.result);
                const desc = ex && ex["0th"] && ex["0th"][piexif.ImageIFD.ImageDescription];
                if(desc && typeof desc === 'string' && desc.includes('ThumbStudioProject::')){
                  try{ const j = JSON.parse(desc.split('ThumbStudioProject::')[1].replace(/\0/g,''));
                    // apply a subset of state
                    if(!window.S.state) window.S.state = {};
                    ['panX','panY','fontSize','offsetX','offsetY','bri','con','sat','warm','bgBlur','bgDim','fxGrain','fxBloom','fxVignette','fxTiltShift','fxGlitch','fxLightLeak','bpScalePop'].forEach(k=>{ if(j[k]!==undefined){ if(['bri','con','sat','warm'].includes(k)){ window.S.state.filters = window.S.state.filters || {}; window.S.state.filters[k] = Number(j[k]); } else { window.S.state[k] = j[k]; } } });
                    window.S.bp = window.S.bp || {};
                    if(j.bp){ window.S.bp.layerMode = j.bp.layerMode; window.S.bp.shadow = j.bp.shadow; window.S.bp.outline = j.bp.outline; window.S.bp.feather = j.bp.feather; }
                    if(j.color) window.S.state.accentColor = j.color;
                    setTimeout(()=>{ draw(); }, 50);
                  }catch(e){}
                }
              }catch(e){ }
            };
            reader.readAsDataURL(file);
          }
        }catch(e){}
      resolve(img);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function initUI(){
  const btnDl = document.getElementById('btnDl');
  if (btnDl) {
    btnDl.addEventListener('click', () => {
      draw();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 1.0);
      a.download = `ThumbStudio_${Date.now()}.jpeg`;
      a.click();
    });
  }

  const imgInput = document.getElementById('imgInput');
  if (imgInput) {
    imgInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await loadImageFile(file);
      } catch (error) {
        console.error('Failed to load image', error);
      } finally {
        e.target.value = '';
      }
    });
  }

  // export with EXIF project save injection
  const exportBtn = document.getElementById('btnDl');
  if(exportBtn){
    exportBtn.addEventListener('click', async () => {
      if(!window.S || !window.S.loaded) return;
      draw();
      const eCanvas = canvas;
      const fmt = document.querySelector('.fmt-btn.active')?.dataset?.fmt || 'jpeg';
      if(fmt === 'pdf'){ // keep existing simple behavior
        const a = document.createElement('a'); a.href = eCanvas.toDataURL('image/jpeg',1.0); a.download = `ThumbStudio_${Date.now()}.pdf`; a.click(); return;
      }
      let finalData = eCanvas.toDataURL(`image/${fmt}`, 1.0);
      if(fmt === 'jpeg' && window.piexif){
        try{
          const base = piexif.load(finalData);
          const obj = base || {"0th":{}, "Exif":{}, "GPS":{}, "Interop":{}, "1st":{}, "thumbnail":null};
          if(obj.thumbnail) delete obj.thumbnail;
          const pState = {
            title: document.getElementById('titleText')?.value || '', subtitle: document.getElementById('subText')?.value || '', date: document.getElementById('dateInput')?.value || '',
            panX: window.S.state?.panX, panY: window.S.state?.panY, fontSize: window.S.state?.fontSize, offsetX: window.S.state?.offsetX, offsetY: window.S.state?.offsetY,
            bri: window.S.state?.filters?.bri, con: window.S.state?.filters?.con, sat: window.S.state?.filters?.sat, warm: window.S.state?.filters?.warm,
            bgBlur: window.S.bgBlur, bgDim: window.S.bgDim, fxGrain: window.S.fxGrain, fxBloom: window.S.fxBloom, fxVignette: window.S.fxVignette, fxTiltShift: window.S.fxTiltShift, fxGlitch: window.S.fxGlitch, fxLightLeak: window.S.fxLightLeak, bpScalePop: window.S.bp?.scalePop,
            removeBg: window.S.removeBg, bgColor: window.S.bgColor, colorPop: window.S.colorPop,
            bp: { active: window.S.bp?.active, layerMode: window.S.bp?.layerMode, shadow: window.S.bp?.shadow, outline: window.S.bp?.outline, outlineWidth: window.S.bp?.outlineWidth, feather: window.S.bp?.feather },
            lighting: window.S.lighting, color: window.S.state?.accentColor || window.S.color, preset: window.S.preset, textStyle: window.S.textStyle, pos: window.S.state?.pos
          };
          obj["0th"][piexif.ImageIFD.ImageDescription] = "ThumbStudioProject::" + JSON.stringify(pState);
          finalData = piexif.insert(piexif.dump(obj), finalData);
        }catch(ex){ console.warn('EXIF inject failed', ex); }
      }
      const a = document.createElement('a'); a.href = finalData; a.download = `ThumbStudio_${Date.now()}.${fmt}`; a.click();
    });
  }

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
  // wire basic controls we expect to exist
  const cropMode = document.getElementById('cropMode');
  if(cropMode){
    cropMode.addEventListener('change', e => { window.S = window.S || {}; window.S.state = window.S.state || {}; window.S.state.cropMode = e.target.value; draw(); });
  }

  const panX = document.getElementById('panX');
  const panY = document.getElementById('panY');
  if(panX){ panX.addEventListener('input', e => { window.S.state.panX = Number(e.target.value); draw(); }); }
  if(panY){ panY.addEventListener('input', e => { window.S.state.panY = Number(e.target.value); draw(); }); }

  // transform buttons
  window.transformImg = function(cmd){
    window.S = window.S || {}; window.S.state = window.S.state || {};
    switch(cmd){
      case 'rotL': window.S.state.rotation = (window.S.state.rotation - 90) % 360; break;
      case 'rotR': window.S.state.rotation = (window.S.state.rotation + 90) % 360; break;
      case 'flipH': window.S.state.flipH = !window.S.state.flipH; break;
      case 'flipV': window.S.state.flipV = !window.S.state.flipV; break;
    }
    draw();
  };

  // basic sliders: brightness/contrast/sat/warmth
  const setSlider = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', e => {
      window.S = window.S || {}; window.S.state = window.S.state || {}; window.S.state.filters = window.S.state.filters || {};
      window.S.state.filters[key] = Number(e.target.value);
      draw();
    });
  };
  setSlider('bri','bri'); setSlider('con','con'); setSlider('sat','sat'); setSlider('warm','warm');

  // presets
  const presetsGrid = document.getElementById('presetsGrid');
  if(presetsGrid){
    presetsGrid.addEventListener('click', e => {
      const card = e.target.closest('.preset-card');
      if(!card) return;
      const preset = card.dataset.preset;
      window.S = window.S || {}; window.S.state = window.S.state || {};
      // simple preset mapping
      const map = {
        cinematic: { bri:110, con:120, sat:110, warm:55 },
        y2k: { bri:105, con:105, sat:130, warm:35 },
        polaroid: { bri:115, con:100, sat:95, warm:65 },
        wedding: { bri:110, con:95, sat:90, warm:60 },
        luxury: { bri:95, con:120, sat:105, warm:40 },
        vaporwave: { bri:100, con:95, sat:160, warm:20 },
        roadtrip: { bri:110, con:110, sat:115, warm:55 },
        cottage: { bri:100, con:95, sat:90, warm:60 },
        editorial: { bri:100, con:125, sat:100, warm:45 }
      };
      const filters = map[preset] || { bri:100, con:100, sat:100, warm:50 };
      window.S.state.filters = Object.assign({}, window.S.state.filters || {}, filters);
      // update slider UI values if present
      ['bri','con','sat','warm'].forEach(k => { const el = document.getElementById(k); if(el) el.value = window.S.state.filters[k]; });
      // visual active state
      presetsGrid.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      draw();
    });
  }

  // text inputs
  const titleText = document.getElementById('titleText');
  const subText = document.getElementById('subText');
  if(titleText){ titleText.addEventListener('input', e => { window.S.state.title = e.target.value; draw(); }); }
  if(subText){ subText.addEventListener('input', e => { window.S.state.subtitle = e.target.value; draw(); }); }

  // font upload
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
        window.S.state.fontFamily = fontName;
        const ft = document.getElementById('fontText'); if(ft) ft.textContent = f.name;
        draw();
      };
      reader.readAsDataURL(f);
    });
  }

  // position grid wiring
  const posGrid = document.getElementById('posGrid');
  if(posGrid){
    posGrid.addEventListener('click', e => {
      const btn = e.target.closest('.pos-btn'); if(!btn) return;
      const pos = btn.dataset.pos; window.S.state.pos = pos; posGrid.querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); draw();
    });
  }

  const offX = document.getElementById('offsetX'); const offY = document.getElementById('offsetY');
  if(offX) offX.addEventListener('input', e => { window.S.state.offsetX = Number(e.target.value); draw(); });
  if(offY) offY.addEventListener('input', e => { window.S.state.offsetY = Number(e.target.value); draw(); });

  // simple doodle toggle stub
  const doodleToggle = document.getElementById('doodleToggle'); if(doodleToggle){ doodleToggle.addEventListener('change', e => { console.log('doodle toggle', e.target.checked); }); }

  // export video stub
  const btnVideo = document.getElementById('btnVideo'); if(btnVideo){ btnVideo.addEventListener('click', () => { alert('Video export is not implemented yet (stub).'); }); }

  setLoadedState(false);
}
