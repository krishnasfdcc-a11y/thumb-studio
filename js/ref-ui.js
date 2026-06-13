// Ref UI logic moved from ref.html to modular file
// GLOBAL LOADER UTILITY
function showLoader(msg = "Processing...") {
    const lm = document.getElementById('loaderMsg'); if(lm) lm.textContent = msg;
    const gl = document.getElementById('globalLoader'); if(gl) gl.style.display = 'flex';
}
function hideLoader() { const gl = document.getElementById('globalLoader'); if(gl) gl.style.display = 'none'; const pc = document.getElementById('progressContainer'); if(pc) pc.style.display = 'none'; }

// GLOBAL STATE & DEFAULTS
const S = {
  img: new Image(), loaded: false, preset: 'cinematic', color: '#ffffff', textStyle: 'classic',
  cropMode: 'original', imgPanX: 50, imgPanY: 50, exportScale: '1', 
  pos: 'bot-right', offsetX: 0, offsetY: 0, fontSize: 4, fmt: 'jpeg',
  adjust: { bri: 100, con: 100, sat: 100, warm: 0 },
  bgBlur: 0, bgDim: 0, colorPop: false, fxGrain: 0, fxBloom: 0, fxVignette: 0, fxTiltShift: 0, fxGlitch: 0, fxLightLeak: 0,
  removeBg: false, smartBg: null, bgColor: '#ffffff', extractedColors: ['#3ddc84', '#7c6fff'],
  bp: { active: false, mask: null, originalMaskData: null, feather: 0, layerMode: 'behind', outline: false, outlineWidth: 1, shadow: false, scalePop: 0 },
  lighting: { angle: 45, intensity: 0 },
  watermark: { img: null, size: 15, op: 80 }, customFont: null, originalExif: null, 
  textX: 0, textY: 0, dragMode: false, isDragging: false, dragOffsetX: 0, dragOffsetY: 0, textBounds: {x:0,y:0,w:0,h:0},
  eraserMode: false, isPainting: false, brushMode: 'erase', brushSize: 40, cropRect: {sx:0,sy:0,sw:0,sh:0},
  doodle: { active: false, strokes: [] }, isDoodling: false,
  isRecording: false, time: 0, particles: [] 
};

const DEFAULTS = { panX:50, panY:50, fontSize:4, offsetX:0, offsetY:0, lightAngle:45, lightIntensity:0, bpFeather:0, bpOutlineWidth:1, bpScalePop:0, bgBlur:0, bgDim:0, fxGrain:0, fxBloom:0, fxVignette:0, fxTiltShift:0, fxGlitch:0, fxLightLeak:0, bri:100, con:100, sat:100, warm:0, wmSize:15, wmOp:80 };
window.resetS = function(k) { const el = document.getElementById(k); if(!el) return; el.value = DEFAULTS[k]; el.dispatchEvent(new Event('input')); };

const PRESETS = {
  cinematic: { font:"'Bebas Neue',sans-serif", style:'normal', weight:'400', subFont:"'Bebas Neue',sans-serif", spacing:5, shadow:{c:'rgba(0,0,0,.85)',b:10,x:2,y:2} },
  y2k: { font:"'VT323',monospace", style:'normal', weight:'400', subFont:"'VT323',monospace", spacing:2, shadow:{c:'rgba(255,85,0,.6)',b:10,x:0,y:0}, color: '#ff5500', fxGrain: 40, fxBloom: 30 },
  polaroid: { font:"'Caveat',cursive", style:'normal', weight:'700', subFont:"'DM Sans',sans-serif", spacing:2, shadow:{c:'rgba(0,0,0,.3)',b:4,x:1,y:1}, color: '#000000', fxGrain: 25, fxBloom: 10 },
  wedding: { font:"'Playfair Display',serif", style:'italic', weight:'400', subFont:"'DM Sans',sans-serif", spacing:2, shadow:{c:'rgba(0,0,0,.4)',b:6,x:1,y:1} },
  luxury: { font:"'Cinzel',serif", style:'normal', weight:'600', subFont:"'Raleway',sans-serif", spacing:8, shadow:{c:'rgba(0,0,0,.3)',b:5,x:0,y:1}, color: '#d4af37' },
  vaporwave: { font:"'Varela Round',sans-serif", style:'normal', weight:'400', subFont:"'Varela Round',sans-serif", spacing:5, shadow:{c:'rgba(0,0,0,.8)',b:0,x:3,y:3}, color: 'grad-purple', fxBloom: 40 },
  roadtrip: { font:"'Righteous',sans-serif", style:'normal', weight:'400', subFont:"'DM Sans',sans-serif", spacing:3, shadow:{c:'rgba(0,0,0,.9)',b:12,x:4,y:4} },
  cottage: { font:"'Amatic SC',cursive", style:'normal', weight:'700', subFont:"'DM Sans',sans-serif", spacing:4, shadow:{c:'rgba(0,0,0,.2)',b:5,x:0,y:1}, color: '#ffffff', fxBloom: 20 },
  editorial: { font:"'Cormorant Garamond',serif", style:'normal', weight:'600', subFont:"'DM Sans',sans-serif", spacing:9, shadow:{c:'rgba(0,0,0,.4)',b:4,x:0,y:0} }
};

const canvas = document.getElementById('imageCanvas'); const ctx = canvas ? canvas.getContext('2d') : null;
let colorThief = null; if (typeof ColorThief !== 'undefined') { colorThief = new ColorThief(); }

// PROJECT RESTORE ENGINE (STEGANOGRAPHY)
function restoreProject(p) {
    showLoader("Restoring Project Data...");
    setTimeout(() => {
        document.getElementById('titleText').value = p.title || '';
        document.getElementById('subText').value = p.subtitle || '';
        document.getElementById('dateInput').value = p.date || '';
        
        ['panX','panY','fontSize','offsetX','offsetY','bri','con','sat','warm','bgBlur','bgDim','fxGrain','fxBloom','fxVignette','fxTiltShift','fxGlitch','fxLightLeak','bpScalePop'].forEach(id => {
            if(p[id] !== undefined) {
                const el = document.getElementById(id);
                if(el) { el.value = p[id]; el.dispatchEvent(new Event('input')); }
                if(['bri','con','sat','warm'].includes(id)) S.adjust[id] = parseInt(p[id]);
            }
        });

        document.getElementById('removeBgToggle').checked = p.removeBg; S.removeBg = p.removeBg;
        document.getElementById('colorPopToggle').checked = p.colorPop; S.colorPop = p.colorPop;
        document.getElementById('bpShadowToggle').checked = p.bp.shadow; S.bp.shadow = p.bp.shadow;
        document.getElementById('bpOutlineToggle').checked = p.bp.outline; S.bp.outline = p.bp.outline;
        
        S.color = p.color; S.bgColor = p.bgColor; S.preset = p.preset; S.textStyle = p.textStyle || 'classic';
        S.pos = p.pos;
        S.lighting = p.lighting || {angle:45, intensity:0};
        const la = document.getElementById('lightAngle'); const li = document.getElementById('lightIntensity'); if(la) la.value = S.lighting.angle; if(li) li.value = S.lighting.intensity;

        document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
        const pc = document.querySelector(`.preset-card[data-preset="${p.preset}"]`); if(pc) pc.classList.add('active');
        
        document.querySelectorAll('.txt-style-btn').forEach(b=>b.classList.remove('active'));
        const tc = document.querySelector(`.txt-style-btn[data-style="${S.textStyle}"]`); if(tc) tc.classList.add('active');
        
        const lm = document.getElementById('layerMode'); if(lm) { lm.value = p.bp.layerMode; S.bp.layerMode = p.bp.layerMode; }
        
        if (p.bp.active) { const btn = document.getElementById('btnDetect'); if(btn) btn.click(); } else { draw(); hideLoader(); }
    }, 100);
}

// INGESTION & DATE FIX
const readExif = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => { try { resolve(piexif.load(e.target.result)); } catch(err) { resolve(null); } };
    reader.readAsDataURL(file);
});

function initUIBindings() {
    const imgInput = document.getElementById('imgInput');
    if (imgInput) imgInput.addEventListener('change', async e => {
        const file = e.target.files[0]; if(!file) return;
        showLoader("Loading Raw Image...");
        
        window.pendingProjectRestore = null;
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
            S.originalExif = await readExif(file);
            if (S.originalExif && S.originalExif["0th"] && S.originalExif["0th"][piexif.ImageIFD.ImageDescription]) {
                let desc = S.originalExif["0th"][piexif.ImageIFD.ImageDescription];
                if(typeof desc === 'string' && desc.includes("ThumbStudioProject::")) {
                    try { window.pendingProjectRestore = JSON.parse(desc.split("ThumbStudioProject::")[1].replace(/\0/g, '')); } catch(e){ console.warn("Failed to parse project file"); }
                }
            }
        } else { S.originalExif = null; }

        document.getElementById('dateInput').value = '';
        try { const exifD = await exifr.parse(file); if (exifD && exifD.DateTimeOriginal) { const pd = new Date(exifD.DateTimeOriginal); if(!isNaN(pd)) document.getElementById('dateInput').value = pd.toISOString().split('T')[0]; } } catch(err) {}

        let pFile = file;
        if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') { 
            showLoader("Converting HEIC to JPEG...");
            const conv = await heic2any({ blob: file, toType: "image/jpeg", quality: 1.0 }); pFile = Array.isArray(conv) ? conv[0] : conv; 
        }

        S.img.onload = () => { 
            S.loaded = true; extractColors(); 
            const ph = document.getElementById('placeholder'); if(ph) ph.style.display='none'; 
            const ut = document.getElementById('uploadText'); if(ut) ut.textContent="Upload new photo or project";
            if (canvas) canvas.style.display='block'; const dh = document.getElementById('dragHint'); if(dh) dh.style.display='flex';
            
            if (window.pendingProjectRestore) {
                restoreProject(window.pendingProjectRestore);
            } else {
                draw(); hideLoader();
            }
        };
        S.img.src = URL.createObjectURL(pFile); e.target.value = ''; 
    });

    const fontInput = document.getElementById('fontInput');
    if (fontInput) fontInput.addEventListener('change', async e => {
        const file = e.target.files[0]; if(!file) return;
        try { const font = new FontFace('UserCustomFont', `url(${URL.createObjectURL(file)})`); await font.load(); document.fonts.add(font); S.customFont = 'UserCustomFont'; const ft = document.getElementById('fontText'); if(ft) ft.textContent = "✓ Custom Font Active"; draw(); } catch(err) { alert("Invalid font."); } e.target.value = '';
    });

    const viralBtn = document.getElementById('btnViralEdit');
    if (viralBtn) viralBtn.addEventListener('click', function() {
        if (!S.loaded) return alert('Upload a photo first!');
        if (isViral && viralBackup) {
            ['bri','con','sat','bgBlur','bgDim','fxVignette','bpScalePop'].forEach(id => { const el = document.getElementById(id); if(el) { el.value = viralBackup[id]; el.dispatchEvent(new Event('input')); } });
            const st = document.getElementById('bpShadowToggle'); if(st) { st.checked = viralBackup.shadow; st.dispatchEvent(new Event('change')); }
            const lm = document.getElementById('layerMode'); if(lm) { lm.value = viralBackup.layer; lm.dispatchEvent(new Event('change')); }
            const t = document.getElementById('titleText'); if(t) t.value = viralBackup.title;
            S.preset = viralBackup.preset; document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active')); const pc = document.querySelector(`.preset-card[data-preset="${S.preset}"]`); if(pc) pc.classList.add('active');
            S.color = viralBackup.color;
            isViral = false; this.innerHTML = '✨ 1-Click Viral Auto-Edit'; this.style.background = 'linear-gradient(90deg, #ff00a0, #ff5500)'; draw();
        } else {
            showLoader("Applying Viral Magic...");
            setTimeout(() => {
                viralBackup = { bri: S.adjust.bri, con: S.adjust.con, sat: S.adjust.sat, bgBlur: S.bgBlur, bgDim: S.bgDim, fxVignette: S.fxVignette, bpScalePop: S.bp.scalePop, shadow: S.bp.shadow, layer: S.bp.layerMode, title: document.getElementById('titleText').value, preset: S.preset, color: S.color };
                
                const setVal = (id,val)=>{ const el = document.getElementById(id); if(el){ el.value=val; el.dispatchEvent(new Event('input')); } };
                setVal('bri',105); setVal('con',115); setVal('sat',125); setVal('bgBlur',8); setVal('bgDim',20);
                setVal('fxVignette',35); setVal('bpScalePop',10);
                const st = document.getElementById('bpShadowToggle'); if(st){ st.checked=true; st.dispatchEvent(new Event('change')); }
                const lm = document.getElementById('layerMode'); if(lm){ lm.value='behind'; lm.dispatchEvent(new Event('change')); }
                document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active'));
                const mag = document.querySelector('.preset-card[data-preset="magazine"]'); if(mag) mag.classList.add('active'); S.preset = 'magazine';
                const tInput = document.getElementById('titleText'); if(tInput && !tInput.value) { tInput.value = "VIRAL"; S.titleText = "VIRAL"; }
                S.color = (S.extractedColors && S.extractedColors.length > 0) ? `grad-#ffffff-${S.extractedColors[0]}` : 'grad-gold';
                isViral = true; this.innerHTML = '↺ Undo Viral Edit'; this.style.background = '#333';
                if (!S.bp.mask) { const bd = document.getElementById('btnDetect'); if(bd) bd.click(); } else { draw(); hideLoader(); }
            }, 50);
        }
    });

    // Other UI bindings will be attached below via delegated listeners
}

let viralBackup = null; let isViral = false;

// LISTENERS and helpers
function extractColors() { try { if(!colorThief || !S.img) return; S.extractedColors = colorThief.getPalette(S.img, 5).map(c => "#" + (1<<24 | c[0]<<16 | c[1]<<8 | c[2]).toString(16).slice(1)); const cP = document.getElementById('dynamicSwatches'); if(cP) cP.innerHTML = ''; S.extractedColors.forEach(hex => { const sw = document.createElement('div'); sw.className = 'sw'; sw.style.background = hex; sw.dataset.color = hex; cP.appendChild(sw); }); for(let i=0; i<S.extractedColors.length; i++) { const c1 = S.extractedColors[i]; const c2 = S.extractedColors[(i+1) % S.extractedColors.length]; const sw = document.createElement('div'); sw.className = 'sw'; sw.style.background = `linear-gradient(135deg, ${c1}, ${c2})`; sw.dataset.color = `grad-${c1}-${c2}`; cP.appendChild(sw); } const panel = document.getElementById('dynamicSwatchesPanel'); if(panel) panel.style.display='block'; } catch(e) { console.warn(e); } }

// UI delegated listeners
function attachDelegatedListeners(){
    const cropMode = document.getElementById('cropMode'); if(cropMode) cropMode.addEventListener('change', e=>{ S.cropMode = e.target.value; document.getElementById('panControls').style.display = S.cropMode==='original'?'none':'block'; draw(); });

    ['panX','panY','fontSize','offsetX','offsetY','bri','con','sat','warm','bgBlur','bgDim','fxGrain','fxBloom','fxVignette','fxTiltShift','fxGlitch','fxLightLeak','bpScalePop'].forEach(id => { const el = document.getElementById(id); if(!el) return; el.addEventListener('input', e => { 
        if(id==='offsetX' || id==='offsetY') S.dragMode = false;
        const val = e.target.value;
        if(['bri','con','sat','warm'].includes(id)) S.adjust[id] = parseInt(val);
        if(id.includes('bg')||id.includes('fx')||id.includes('bp')||id==='fontSize') S[id] = parseFloat(val); else if(['panX','panY'].includes(id)) S['imgPan'+id.slice(-1)] = parseFloat(val);
        draw(); }); });

    const posGrid = document.getElementById('posGrid'); if(posGrid) posGrid.addEventListener('click',e=>{ const btn = e.target.closest('.pos-btn[data-pos]'); if (!btn) return; document.querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); S.pos = btn.dataset.pos; S.dragMode = false; draw(); });

    const presetsGrid = document.getElementById('presetsGrid'); if(presetsGrid) presetsGrid.addEventListener('click', e=>{ const card = e.target.closest('.preset-card'); if(!card) return; document.querySelectorAll('.preset-card').forEach(c=>c.classList.remove('active')); card.classList.add('active'); S.preset = card.dataset.preset; if(PRESETS[S.preset] && PRESETS[S.preset].color) S.color = PRESETS[S.preset].color; draw(); });

    const txtStyleGrid = document.getElementById('txtStyleGrid'); if(txtStyleGrid) txtStyleGrid.addEventListener('click', e=>{ const btn = e.target.closest('.txt-style-btn'); if(!btn) return; document.querySelectorAll('.txt-style-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); S.textStyle = btn.dataset.style; draw(); });

    const swWrap = document.querySelector('.swatches-wrap'); if(swWrap) swWrap.addEventListener('click', e=>{ const sw = e.target.closest('.sw'); if(!sw) return; document.querySelectorAll('.sw').forEach(s=>s.classList.remove('active')); sw.classList.add('active'); S.color = sw.dataset.color; draw(); });

    const layerMode = document.getElementById('layerMode'); if(layerMode) layerMode.addEventListener('change', e=>{ S.bp.layerMode = e.target.value; draw(); });
    const bpShadow = document.getElementById('bpShadowToggle'); if(bpShadow) bpShadow.addEventListener('change', e=>{ S.bp.shadow = e.target.checked; draw(); });
    const lightAngle = document.getElementById('lightAngle'); if(lightAngle) lightAngle.addEventListener('input', e=>{ S.lighting.angle = parseInt(e.target.value); draw(); });
    const lightIntensity = document.getElementById('lightIntensity'); if(lightIntensity) lightIntensity.addEventListener('input', e=>{ S.lighting.intensity = parseInt(e.target.value); draw(); });
    const bpFeather = document.getElementById('bpFeather'); if(bpFeather) bpFeather.addEventListener('input', e=>{ S.bp.feather = parseInt(e.target.value); draw(); });
    const bpOutlineToggle = document.getElementById('bpOutlineToggle'); if(bpOutlineToggle) bpOutlineToggle.addEventListener('change', e=>{ S.bp.outline = e.target.checked; const c = document.getElementById('bpOutlineControls'); if(c) c.style.display = S.bp.outline ? 'block' : 'none'; draw(); });
    const bpOutlineWidth = document.getElementById('bpOutlineWidth'); if(bpOutlineWidth) bpOutlineWidth.addEventListener('input', e=>{ S.bp.outlineWidth = parseInt(e.target.value); draw(); });

    const btnSmartBg = document.getElementById('btnSmartBg'); if(btnSmartBg) btnSmartBg.addEventListener('click', () => {
        if(!S.bp.mask) return alert("Detect Person First!");
        const rmb = document.getElementById('removeBgToggle'); if(rmb){ rmb.checked = true; S.removeBg = true; }
        const bgC = document.createElement('canvas'); bgC.width = 1000; bgC.height = 1000; const bgCtx = bgC.getContext('2d');
        const grad = bgCtx.createLinearGradient(0, 0, 1000, 1000); grad.addColorStop(0, S.extractedColors[0] || '#111'); grad.addColorStop(1, S.extractedColors[1] || '#444');
        bgCtx.fillStyle = grad; bgCtx.fillRect(0, 0, 1000, 1000);
        for(let i=0; i<100; i++) { bgCtx.beginPath(); bgCtx.arc(Math.random()*1000, Math.random()*1000, Math.random()*200, 0, Math.PI*2); bgCtx.fillStyle = `rgba(255,255,255,${Math.random()*0.1})`; bgCtx.fill(); }
        S.smartBg = bgC; draw();
    });

    const colorPopToggle = document.getElementById('colorPopToggle'); if(colorPopToggle) colorPopToggle.addEventListener('change', e=>{ if (e.target.checked && !S.bp.mask) { alert("Detect Person first!"); e.target.checked = false; return; } S.colorPop = e.target.checked; draw(); });
    const removeBgToggle = document.getElementById('removeBgToggle'); if(removeBgToggle) removeBgToggle.addEventListener('change', e=>{ 
        if (e.target.checked && !S.bp.mask) { alert("Detect Person first!"); e.target.checked = false; return; } 
        S.removeBg = e.target.checked; const br = document.getElementById('bgRemoveControls'); if(br) br.style.display = S.removeBg ? 'block' : 'none'; if(!S.removeBg) S.smartBg = null; draw(); 
    });
    const bgColorPicker = document.getElementById('bgColorPicker'); if(bgColorPicker) bgColorPicker.addEventListener('input', e=>{ S.bgColor = e.target.value; draw(); });

    const wmInput = document.getElementById('wmInput'); if(wmInput) wmInput.addEventListener('change', e => { const file = e.target.files[0]; if(!file) return; S.watermark.img = new Image(); S.watermark.img.onload = () => { const wc = document.getElementById('wmControls'); if(wc) wc.style.display = 'block'; draw(); }; S.watermark.img.src = URL.createObjectURL(file); });
    const wmSize = document.getElementById('wmSize'); if(wmSize) wmSize.addEventListener('input', e=>{ S.watermark.size = parseInt(e.target.value); draw(); });
    const wmOp = document.getElementById('wmOp'); if(wmOp) wmOp.addEventListener('input', e=>{ S.watermark.op = parseInt(e.target.value); draw(); });

    // Eraser / Doodle
    const eraserToggle = document.getElementById('eraserToggle'); if(eraserToggle) eraserToggle.addEventListener('change', e=>{ 
        S.eraserMode = e.target.checked; const ec = document.getElementById('eraserControls'); if(ec) ec.style.display = S.eraserMode ? 'block' : 'none'; 
        if(S.eraserMode) { if(canvas) canvas.classList.add('eraser-cursor'); const dh = document.getElementById('dragHint'); if(dh) dh.style.display='none'; const dt = document.getElementById('doodleToggle'); if(dt){ dt.checked=false; } S.doodle.active=false; const dc = document.getElementById('doodleControls'); if(dc) dc.style.display='none';} else { if(canvas) canvas.classList.remove('eraser-cursor'); const dh = document.getElementById('dragHint'); if(dh) dh.style.display='flex'; }
    });
    document.querySelectorAll('input[name="bmode"]').forEach(r => r.addEventListener('change', e => S.brushMode = e.target.value));
    const brushSize = document.getElementById('brushSize'); if(brushSize) brushSize.addEventListener('input', e=>{ S.brushSize = parseInt(e.target.value); });
    const btnResetEraser = document.getElementById('btnResetEraser'); if(btnResetEraser) btnResetEraser.addEventListener('click', () => { if(!S.bp.mask || !S.bp.originalMaskData) return; S.bp.mask.getContext('2d').putImageData(S.bp.originalMaskData, 0, 0); draw(); });

    const doodleToggle = document.getElementById('doodleToggle'); if(doodleToggle) doodleToggle.addEventListener('change', e=>{
        S.doodle.active = e.target.checked; const dc = document.getElementById('doodleControls'); if(dc) dc.style.display = S.doodle.active ? 'block' : 'none';
        if(S.doodle.active) { if(canvas) canvas.classList.add('eraser-cursor'); const dh = document.getElementById('dragHint'); if(dh) dh.style.display='none'; const et = document.getElementById('eraserToggle'); if(et){ et.checked=false; } S.eraserMode=false; const ec = document.getElementById('eraserControls'); if(ec) ec.style.display='none';} else { if(canvas) canvas.classList.remove('eraser-cursor'); const dh = document.getElementById('dragHint'); if(dh) dh.style.display='flex'; }
    });
    const btnUndoDoodle = document.getElementById('btnUndoDoodle'); if(btnUndoDoodle) btnUndoDoodle.addEventListener('click', () => { S.doodle.strokes.pop(); draw(); });

    const btnSmartBg2 = document.getElementById('btnSmartBg'); // already handled above if present

    // Preset/style quick bindings for title/sub
    const titleText = document.getElementById('titleText'); if(titleText) titleText.addEventListener('input',draw);
    const subText = document.getElementById('subText'); if(subText) subText.addEventListener('input',draw);
    const dateInput = document.getElementById('dateInput'); if(dateInput) dateInput.addEventListener('change',draw);

    // Format buttons
    document.querySelectorAll('.fmt-btn').forEach(btn=>{ btn.addEventListener('click',()=>{ document.querySelectorAll('.fmt-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }); });

    // Download/print
    const btnDl = document.getElementById('btnDl'); if(btnDl) btnDl.addEventListener('click', ()=>{ if (!S.loaded) return; showLoader("Generating HD File..."); setTimeout(()=>{ draw(); const eC = getExportCanvas(); const fmtBtn = document.querySelector('.fmt-btn.active'); const f = fmtBtn? fmtBtn.dataset.fmt : 'jpeg'; if (f === 'pdf') { try { const { jsPDF } = window.jspdf; const o = eC.width > eC.height ? 'landscape' : 'portrait'; const pdf = new jsPDF({ orientation: o, unit: 'px', format: [eC.width, eC.height] }); pdf.addImage(eC.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, eC.width, eC.height); pdf.save(`ThumbStudio_${Date.now()}.pdf`); } catch (err) { alert(err); } hideLoader(); return; } let finalD = eC.toDataURL(`image/${f}`, 1.0); if (f === 'jpeg') { try { let eObj = S.originalExif || {"0th":{}, "Exif":{}, "GPS":{}, "Interop":{}, "1st":{}, "thumbnail":null}; if (eObj.thumbnail) delete eObj.thumbnail; const pState = { title: document.getElementById('titleText').value, subtitle: document.getElementById('subText').value, date: document.getElementById('dateInput').value, panX: S.imgPanX, panY: S.imgPanY, fontSize: S.fontSize, offsetX: S.offsetX, offsetY: S.offsetY, bri: S.adjust.bri, con: S.adjust.con, sat: S.adjust.sat, warm: S.adjust.warm, bgBlur: S.bgBlur, bgDim: S.bgDim, fxGrain: S.fxGrain, fxBloom: S.fxBloom, fxVignette: S.fxVignette, fxTiltShift: S.fxTiltShift, fxGlitch: S.fxGlitch, fxLightLeak: S.fxLightLeak, bpScalePop: S.bp.scalePop, removeBg: S.removeBg, bgColor: S.bgColor, colorPop: S.colorPop, bp: { active: S.bp.active, layerMode: S.bp.layerMode, shadow: S.bp.shadow, outline: S.bp.outline, outlineWidth: S.bp.outlineWidth, feather: S.bp.feather }, lighting: S.lighting, color: S.color, preset: S.preset, textStyle: S.textStyle, pos: S.pos }; eObj["0th"][piexif.ImageIFD.ImageDescription] = "ThumbStudioProject::" + JSON.stringify(pState); finalD = piexif.insert(piexif.dump(eObj), finalD); } catch(ex) { console.warn("EXIF injection failed", ex); } } const a = document.createElement('a'); a.download = `ThumbStudio_${Date.now()}.${f}`; a.href = finalD; a.click(); hideLoader(); }, 50); });

    const btnPrint = document.getElementById('btnPrint'); if(btnPrint) btnPrint.addEventListener('click', ()=>{ if (!S.loaded) return; showLoader("Preparing Print Spooler..."); setTimeout(()=>{ draw(); const dataUrl = getExportCanvas().toDataURL('image/jpeg', 1.0); const win = window.open(''); win.document.write(`<html><head><title>Print Image</title><style>@page { margin: 0; size: auto; } body { margin: 0; display: flex; justify-content: center; align-items: center; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } img { max-width: 100%; max-height: 100vh; object-fit: contain; }</style></head><body><img id="pImg" src="${dataUrl}" /><script>document.getElementById('pImg').onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };<\/script></body></html>`); win.document.close(); hideLoader(); }, 50); });
}

// POINTER EVENTS (Drag, Erase, Neon Doodle)
function getCP(e) { const r = canvas.getBoundingClientRect(); const sX = canvas.width/r.width; const sY = canvas.height/r.height; let cX = e.clientX, cY = e.clientY; if(e.touches && e.touches.length>0){ cX = e.touches[0].clientX; cY = e.touches[0].clientY; } return { x: (cX-r.left)*sX, y: (cY-r.top)*sY }; }
function pD(e) { 
    if(!S.loaded) return; const p = getCP(e); 
    if (S.doodle.active) { S.isDoodling = true; S.doodle.strokes.push({ color: document.getElementById('doodleColor').value, size: parseInt(document.getElementById('doodleSize').value), points: [p] }); if(e.cancelable && e.type.includes('touch')) e.preventDefault(); return; }
    if (S.eraserMode && S.bp.mask) { S.isPainting = true; paintMask(p.x, p.y); if(e.cancelable && e.type.includes('touch')) e.preventDefault(); return; }
    const b = S.textBounds; if(p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h) { S.isDragging = true; S.dragMode = true; S.dragOffsetX = p.x - S.textX; S.dragOffsetY = p.y - S.textY; canvas.style.cursor='grabbing'; document.querySelectorAll('.pos-btn').forEach(btn=>btn.classList.remove('active')); if(e.cancelable && e.type.includes('touch')) e.preventDefault(); } 
}
function pM(e) { 
    if(!S.loaded) return; const p = getCP(e); 
    if (S.isDoodling) { S.doodle.strokes[S.doodle.strokes.length-1].points.push(p); draw(); if(e.cancelable && e.type.includes('touch')) e.preventDefault(); return; }
    if (S.isPainting) { paintMask(p.x, p.y); if(e.cancelable && e.type.includes('touch')) e.preventDefault(); return; }
    if (!S.isDragging) { const b = S.textBounds; canvas.style.cursor = (p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h) ? 'grab' : 'default'; return; } 
    if(e.cancelable && e.type.includes('touch')) e.preventDefault(); S.textX = p.x - S.dragOffsetX; S.textY = p.y - S.dragOffsetY; draw(); 
}
function pU() { S.isDragging = false; S.isPainting = false; S.isDoodling = false; canvas.style.cursor = 'default'; }

function paintMask(cX, cY) {
  if(!S.bp.mask || !canvas) return;
  const mCtx = S.bp.mask.getContext('2d'); const ratioX = cX / canvas.width, ratioY = cY / canvas.height;
  const origX = S.cropRect.sx + (ratioX * S.cropRect.sw), origY = S.cropRect.sy + (ratioY * S.cropRect.sh);
  mCtx.beginPath(); mCtx.arc(origX, origY, S.brushSize * (S.img.naturalHeight / 1000), 0, Math.PI * 2);
  mCtx.globalCompositeOperation = S.brushMode === 'erase' ? 'destination-out' : 'source-over'; 
  mCtx.fillStyle = S.brushMode === 'erase' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)'; mCtx.fill(); mCtx.globalCompositeOperation = 'source-over'; draw();
}

canvas && canvas.addEventListener('mousedown', pD); canvas && canvas.addEventListener('mousemove', pM); window.addEventListener('mouseup', pU);
canvas && canvas.addEventListener('touchstart', pD, {passive: false}); canvas && canvas.addEventListener('touchmove', pM, {passive: false}); window.addEventListener('touchend', pU);

// AI ENGINE
let bpModel = null; const btnDetect = document.getElementById('btnDetect'); const dStat = document.getElementById('detectStatus');
if(btnDetect) btnDetect.addEventListener('click', async () => {
  if (!S.loaded) return alert('Upload a photo first!'); btnDetect.disabled = true;
  showLoader('Running AI Subject Inference...');
  setTimeout(async () => {
      try {
        if (!bpModel) { await tf.setBackend('webgl'); await tf.ready(); bpModel = await bodySegmentation.createSegmenter(bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation, { runtime: 'tfjs', modelType: 'general' }); }
        let iW = S.img.naturalWidth, iH = S.img.naturalHeight; const s = Math.min(1, 512 / Math.max(iW, iH)); iW = Math.round(iW * s); iH = Math.round(iH * s);
        const iC = document.createElement('canvas'); iC.width = iW; iC.height = iH; iC.getContext('2d').drawImage(S.img, 0, 0, iW, iH);
        const people = await bpModel.segmentPeople(iC);
        if (!people || people.length === 0) { btnDetect.disabled = false; hideLoader(); return alert('No person detected.'); }
        const mask = await bodySegmentation.toBinaryMask(people, {r:255,g:255,b:255,a:255}, {r:0,g:0,b:0,a:0});
        const tC = document.createElement('canvas'); tC.width = iW; tC.height = iH; tC.getContext('2d').putImageData(mask, 0, 0);
        const mC = document.createElement('canvas'); mC.width = S.img.naturalWidth; mC.height = S.img.naturalHeight; mC.getContext('2d').drawImage(tC, 0, 0, mC.width, mC.height);
        S.bp.originalMaskData = mC.getContext('2d').getImageData(0, 0, mC.width, mC.height); S.bp.mask = mC; S.bp.active = true;
        const bpControls = document.getElementById('bpControls'); if(bpControls) bpControls.style.display='block'; const autoBtn = document.getElementById('btnAutoCenter'); if(autoBtn) autoBtn.style.display='block';
        if(S.lighting.intensity === 0) { const li = document.getElementById('lightIntensity'); if(li) li.value = 40; S.lighting.intensity = 40; }
        draw(); hideLoader(); dStat && (dStat.innerHTML = '✓ AI Mask built!');
      } catch(err) { console.error(err); hideLoader(); dStat && (dStat.innerHTML = 'Failed.'); } 
      btnDetect.disabled = false; 
  }, 50);
});

const btnAutoCenter = document.getElementById('btnAutoCenter'); if(btnAutoCenter) btnAutoCenter.addEventListener('click', () => {
    if(!S.bp.mask) return;
    const m = S.bp.originalMaskData; if(!m) return; const mData = m.data; const w = S.img.naturalWidth; const h = S.img.naturalHeight;
    let minX = w, minY = h, maxX = 0, maxY = 0; let found = false;
    for (let y = 0; y < h; y+=4) { for (let x = 0; x < w; x+=4) { const i = (y * w + x) * 4; if (mData[i] > 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; found = true; } } }
    if(found) {
        const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
        if (w > S.cropRect.sw) S.imgPanX = Math.max(0, Math.min(100, ((cx - S.cropRect.sw / 2) / (w - S.cropRect.sw)) * 100)); else S.imgPanX = 50;
        if (h > S.cropRect.sh) S.imgPanY = Math.max(0, Math.min(100, ((cy - S.cropRect.sh / 2) / (h - S.cropRect.sh)) * 100)); else S.imgPanY = 50;
        const panX = document.getElementById('panX'); const panY = document.getElementById('panY'); if(panX) panX.value = S.imgPanX; if(panY) panY.value = S.imgPanY; draw(); 
    }
});

function getGradientFill(context, startX, endX) {
  const g = context.createLinearGradient(startX, 0, endX, 0);
  if (S.color.startsWith('grad-#')) {
      const parts = S.color.split('-'); g.addColorStop(0, parts[1]); g.addColorStop(1, parts[2]);
  } else {
      if (S.color === 'grad-gold') { g.addColorStop(0,'#f5c842'); g.addColorStop(1,'#ff5c6c'); }
      if (S.color === 'grad-purple') { g.addColorStop(0,'#7c6fff'); g.addColorStop(1,'#00fff0'); }
      if (S.color === 'grad-neon') { g.addColorStop(0,'#ff5500'); g.addColorStop(1,'#ff00a0'); }
  }
  return g;
}

function drawSpaced(context, text, x, y, font, spacing, align, mode, explicitColor = null) {
  context.font = font; context.textAlign = 'left'; const chars = [...text];
  let totalW = chars.reduce((s,c)=>s+context.measureText(c).width+spacing, 0) - spacing;
  let startX = align === 'right' ? x - totalW : (align === 'center' ? x - totalW/2 : x); 
  let curX = startX;
  chars.forEach(c => {
    const cw = context.measureText(c).width; 
    const fillStyle = explicitColor ? explicitColor : (S.color.startsWith('grad') ? getGradientFill(context, startX, startX + totalW) : S.color);
    if (mode === 'stroke') { context.strokeStyle = fillStyle; context.strokeText(c, curX, y); }
    else { context.fillStyle = fillStyle; context.fillText(c, curX, y); }
    curX += cw + spacing;
  });
}

// MAIN DRAW LOOP
function getFilters(isBg) {
    let f = [];
    if(isBg && S.bgBlur > 0) f.push(`blur(${Math.min(S.bgBlur * (canvas.height/1000), 30)}px)`);
    if(isBg && S.bgDim > 0) f.push(`brightness(${100 - S.bgDim}%)`);
    if(S.adjust.bri !== 100) f.push(`brightness(${S.adjust.bri}%)`);
    if(S.adjust.con !== 100) f.push(`contrast(${S.adjust.con}%)`);
    if(S.adjust.sat !== 100) f.push(`saturate(${S.adjust.sat}%)`);
    if(S.adjust.warm > 0) f.push(`sepia(${S.adjust.warm}%)`);
    if(isBg && S.colorPop && S.bp.mask) f.push('grayscale(100%) contrast(150%)');
    return f.length > 0 ? f.join(' ') : 'none';
}

function draw() {
  if (!S.loaded || !canvas || !ctx) return; const p = PRESETS[S.preset] || PRESETS.cinematic;
  const tRatio = S.cropMode !== 'original' ? parseFloat(S.cropMode.split(':')[0])/parseFloat(S.cropMode.split(':')[1]) : S.img.naturalWidth/S.img.naturalHeight;
  let sx = 0, sy = 0, sw = S.img.naturalWidth, sh = S.img.naturalHeight;
  if (tRatio > sw/sh + 0.01) { sh = sw / tRatio; sy = (S.img.naturalHeight - sh) * (S.imgPanY / 100); } else if (tRatio < sw/sh - 0.01) { sw = sh * tRatio; sx = (S.img.naturalWidth - sw) * (S.imgPanX / 100); }
  S.cropRect = {sx, sy, sw, sh}; canvas.width = sw; canvas.height = sh; const W = canvas.width, H = canvas.height;
  
  let bgZoom = 1; let fgZoom = 1; let fgYOffset = 0;
  if (S.isRecording) {
      bgZoom = 1 + (S.time * 0.05);
      fgZoom = 1 + (S.time * 0.08);
      fgYOffset = -S.time * (H * 0.03);
  }
  
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  
  ctx.save();
  ctx.translate(W/2, H/2); ctx.scale(bgZoom, bgZoom); ctx.translate(-W/2, -H/2);
  
  if (S.removeBg && S.bp.mask) { if(S.smartBg) ctx.drawImage(S.smartBg, 0, 0, W, H); else { ctx.fillStyle = S.bgColor; ctx.fillRect(0, 0, W, H); } } 
  else { ctx.save(); ctx.filter = getFilters(true); ctx.drawImage(S.img, sx, sy, sw, sh, 0, 0, W, H); if (S.colorPop && S.bp.mask) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = S.extractedColors[0] || '#7c6fff'; ctx.fillRect(0,0,W,H); } ctx.restore(); }

  if (S.fxTiltShift > 0) {
      const bc = document.createElement('canvas'); bc.width = W; bc.height = H; const bCtx = bc.getContext('2d');
      bCtx.filter = `blur(${Math.min(S.fxTiltShift * 0.2 * (H/1000), 30)}px)`; bCtx.drawImage(canvas, 0, 0);
      bCtx.globalCompositeOperation = 'destination-in'; const grad = bCtx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.3, 'rgba(0,0,0,0)'); grad.addColorStop(0.7, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,1)');
      bCtx.fillStyle = grad; bCtx.fillRect(0, 0, W, H); ctx.drawImage(bc, 0, 0);
  }

  if (S.fxGlitch > 0) {
      const shift = (S.fxGlitch / 100) * (W * 0.05) * (S.isRecording ? (0.5 + Math.random()) : 1);
      for(let i=0; i<4; i++) { let sY = Math.random() * H; let sH = Math.random() * (H * 0.05); let sX = (Math.random() - 0.5) * shift * 2; ctx.drawImage(canvas, 0, sY, W, sH, sX, sY, W, sH); }
      ctx.save(); ctx.globalAlpha = S.fxGlitch / 200; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(canvas, shift, 0); ctx.drawImage(canvas, -shift, 0); ctx.restore();
  }
  
  if (S.fxVignette > 0) { 
      const cx = W/2, cy = H/2; const radius = Math.max(cx, cy) * 1.5; 
      const vigGrad = ctx.createRadialGradient(cx, cy, radius * (1 - S.fxVignette/100), cx, cy, radius); 
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)'); vigGrad.addColorStop(1, `rgba(0,0,0,${S.fxVignette/100})`); 
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, W, H); ctx.restore(); 
  }
  
  ctx.restore();

  const title = document.getElementById('titleText').value.trim(); const rawSubText = document.getElementById('subText').value.trim(); const rawDate = document.getElementById('dateInput').value;
  let subParts = []; if(rawSubText) subParts.push(rawSubText); if(rawDate) { const pD = new Date(rawDate); if(!isNaN(pD)) subParts.push(pD.toLocaleDateString('en-US')); }
  const subtitle = subParts.join(' | ');
  
  const tSize = Math.max(H * (S.fontSize / 100), 18); const sSize = Math.max(tSize * 0.46, 12); const lGap = tSize * 0.22; const totH = tSize + (subtitle ? lGap + sSize : 0);
  
  let align = 'left'; if (S.pos.includes('right')) align = 'right'; else if (S.pos.includes('center')) align = 'center';
  if (!S.dragMode) { let x = W * 0.045; if (align === 'right') x = W - W*0.045; else if (align === 'center') x = W / 2; let y = H * 0.04; if (S.pos.includes('bot')) y = H - H*0.04 - totH; else if (S.pos.includes('mid')) y = (H - totH) / 2; S.textX = x + (S.offsetX * (W/1000)); S.textY = y + (S.offsetY * (H/1000)); }
  
  const activeFont = S.customFont ? `'${S.customFont}'` : p.font;
  
  let maxW = 0;
  if(title) { ctx.font = `${p.style} ${p.weight} ${tSize}px ${activeFont}`; maxW = Math.max(maxW, ctx.measureText(title).width + (p.spacing*title.length)); }
  if(subtitle) { ctx.font = `300 ${sSize}px ${p.subFont}`; maxW = Math.max(maxW, ctx.measureText(subtitle).width + (Math.round(p.spacing*0.6)*subtitle.length)); }
  const bPad = Math.round(tSize * 0.28); 
  let bx = S.textX; if (align === 'right') bx = S.textX - maxW; else if (align === 'center') bx = S.textX - maxW / 2;
  
  let textOp = 1; let textYShift = 0;
  if (S.isRecording) {
      const introPhase = Math.min(1, S.time / 0.3);
      const textEase = 1 - Math.pow(1 - introPhase, 3);
      textOp = textEase; textYShift = (1 - textEase) * (H * 0.05);
  }
  
  S.textBounds = { x: bx - bPad, y: S.textY + textYShift - 10, w: maxW + bPad*2, h: totH + 20 };

  function renderText(mode = 'fill') {
    if (!title && !subtitle) return; 
    ctx.save(); ctx.globalAlpha = textOp; ctx.textBaseline = 'top'; 
    
    if (mode === 'fill') {
        if(S.textStyle === 'glow') { ctx.shadowColor = S.color.startsWith('grad')?'#ffffff':S.color; ctx.shadowBlur = 20 * (H/1000); ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; }
        else if(S.textStyle === 'hardshadow') { ctx.shadowColor = '#000000'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 6 * (H/1000); ctx.shadowOffsetY = 6 * (H/1000); }
        else { ctx.shadowColor = p.shadow.c; ctx.shadowBlur = p.shadow.b; ctx.shadowOffsetX = p.shadow.x; ctx.shadowOffsetY = p.shadow.y; }
    } else { ctx.shadowColor = 'transparent'; ctx.lineWidth = S.bp.outlineWidth * Math.max(1, (H/800)); }

    if(S.textStyle === 'ribbon' && mode === 'fill') {
        ctx.save(); ctx.shadowColor='transparent'; ctx.fillStyle = 'rgba(0,0,0,0.85)';
        const pX = 20*(W/1000); const pY = 10*(H/1000);
        ctx.fillRect(S.textBounds.x - pX, S.textBounds.y - pY, S.textBounds.w + pX*2, S.textBounds.h + pY*2); ctx.restore();
    }
    
    function drawLine(text, baseY, font, spacing, size) {
        const y = baseY + textYShift;
        ctx.font = font; ctx.textAlign = align; 
        const cF = S.color.startsWith('grad') ? getGradientFill(ctx, align==='right'?S.textX-ctx.measureText(text).width:(align==='center'?S.textX-ctx.measureText(text).width/2:S.textX), align==='right'?S.textX:(align==='center'?S.textX+ctx.measureText(text).width/2:S.textX+ctx.measureText(text).width)) : S.color;
        if(mode === 'fill') {
            if(S.textStyle === 'outline') {
                ctx.lineWidth = size * 0.15; ctx.strokeStyle = '#000000';
                if(spacing > 0) drawSpaced(ctx, text, S.textX, y, font, spacing, align, 'stroke', '#000000'); else ctx.strokeText(text, S.textX, y);
            }
            if(spacing > 0) drawSpaced(ctx, text, S.textX, y, font, spacing, align, 'fill', cF);
            else { ctx.fillStyle = cF; ctx.fillText(text, S.textX, y); }
        } else {
            ctx.strokeStyle = cF;
            if(spacing > 0) drawSpaced(ctx, text, S.textX, y, font, spacing, align, 'stroke', cF); else ctx.strokeText(text, S.textX, y);
        }
    }

    if(title) drawLine(title, S.textY, `${p.style} ${p.weight} ${tSize}px ${activeFont}`, p.spacing, tSize);
    if(subtitle) drawLine(subtitle.toUpperCase(), S.textY + tSize + lGap, `300 ${sSize}px ${p.subFont}`, Math.round(p.spacing*0.6), sSize);
    ctx.restore();
  }

  if (S.bp.layerMode === 'behind') renderText('fill');

  if (S.bp.mask && (S.bp.active || S.removeBg || S.colorPop || S.bp.scalePop > 0 || S.isRecording)) {
      const pC = document.createElement('canvas'); pC.width = S.img.naturalWidth; pC.height = S.img.naturalHeight; const pCtx = pC.getContext('2d');
      if (S.bp.feather > 0) pCtx.filter = `blur(${Math.min(S.bp.feather * (pC.height/1000), 30)}px)`;
      pCtx.drawImage(S.bp.mask, 0, 0, pC.width, pC.height); pCtx.filter = getFilters(false);
      pCtx.globalCompositeOperation = 'source-in'; pCtx.drawImage(S.img, 0, 0, pC.width, pC.height);
      
      if (S.lighting.intensity > 0) { const rad = S.lighting.angle * (Math.PI / 180); const cx = pC.width/2; const cy = pC.height/2; const grad = pCtx.createRadialGradient(cx + Math.cos(rad) * cx, cy + Math.sin(rad) * cy, 0, cx, cy, pC.width); grad.addColorStop(0, `rgba(255,255,255,${S.lighting.intensity/100})`); grad.addColorStop(1, 'rgba(0,0,0,0)'); pCtx.globalCompositeOperation = 'overlay'; pCtx.fillStyle = grad; pCtx.fillRect(0, 0, pC.width, pC.height); }
      
      ctx.save(); 
      if (S.bp.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = Math.min(40 * (H/1000), 30); ctx.shadowOffsetX = 10 * (H/1000); ctx.shadowOffsetY = 15 * (H/1000); } 
      
      const scaleP = 1 + (S.bp.scalePop / 100);
      ctx.translate(W/2, H); ctx.scale(scaleP * fgZoom, scaleP * fgZoom); ctx.translate(-W/2, -H + fgYOffset);
      
      ctx.drawImage(pC, sx, sy, sw, sh, 0, 0, W, H); 
      ctx.restore();
      
      if (S.bp.active && S.bp.outline && !S.removeBg) { 
          const sC = document.createElement('canvas'); sC.width = W; sC.height = H; const sCtx = sC.getContext('2d'); renderText('stroke'); sCtx.globalCompositeOperation = 'destination-in'; sCtx.drawImage(pC, sx, sy, sw, sh, 0, 0, W, H); 
          ctx.save(); 
          ctx.translate(W/2, H); ctx.scale(scaleP * fgZoom, scaleP * fgZoom); ctx.translate(-W/2, -H + fgYOffset);
          ctx.drawImage(sC, 0, 0, W, H); 
          ctx.restore();
      }
  }

  if (S.fxLightLeak > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = (S.fxLightLeak / 100) * (S.isRecording ? (0.8 + Math.sin(S.time * Math.PI)*0.2) : 1);
      const lg = ctx.createLinearGradient(0, 0, W*0.8, H*0.8); lg.addColorStop(0, '#ff4b1f'); lg.addColorStop(0.5, '#ff9068'); lg.addColorStop(1, 'transparent');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  if (S.doodle.strokes.length > 0) {
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      S.doodle.strokes.forEach(s => {
          ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = s.size * (H/1000);
          ctx.shadowColor = s.color; ctx.shadowBlur = Math.min(20 * (H/1000), 30);
          s.points.forEach((p, i) => { if(i===0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.stroke();
      });
      ctx.restore();
  }

  if (S.bp.layerMode === 'front') renderText('fill');

  if (S.fxBloom > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = S.fxBloom / 100; ctx.filter = `blur(${Math.min(15 * (H/1000), 30)}px)`; ctx.drawImage(canvas, 0, 0); ctx.restore(); }
  if (S.fxGrain > 0) { const gC = document.createElement('canvas'); gC.width = 300; gC.height = 300; const gCtx = gC.getContext('2d'); const iD = gCtx.createImageData(300, 300); for(let i=0; i<iD.data.length; i+=4) { const v = Math.random() * 255; iD.data[i] = v; iD.data[i+1] = v; iD.data[i+2] = v; iD.data[i+3] = (S.fxGrain/100)*255; } gCtx.putImageData(iD, 0, 0); ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(gC, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }

  if (S.watermark.img) { ctx.save(); ctx.globalAlpha = S.watermark.op / 100; const wmTW = W * (S.watermark.size / 100); const wmTH = S.watermark.img.naturalHeight * (wmTW / S.watermark.img.naturalWidth); const wmPad = W * 0.03; ctx.drawImage(S.watermark.img, W - wmTW - wmPad, H - wmTH - wmPad, wmTW, wmTH); ctx.restore(); }
}

// VIDEO EXPORT ENGINE
let vidBlobUrl = null;
const btnVideo = document.getElementById('btnVideo'); if(btnVideo) btnVideo.addEventListener('click', async () => {
    if (!S.loaded || !S.bp.mask) { alert('You must "Detect Person" first to create a 3D Video!'); return; }
    document.getElementById('loaderMsg').textContent = "Rendering Cinematic Video... 0%"; document.getElementById('globalLoader').style.display = 'flex'; document.getElementById('progressContainer').style.display = 'block'; document.getElementById('progressBar').style.width = '0%';
    const vC = document.createElement('canvas'); const maxV = 1080; let vW = canvas.width, vH = canvas.height; if (vW > maxV || vH > maxV) { if (vW > vH) { vH = Math.round(vH * (maxV / vW)); vW = maxV; } else { vW = Math.round(vW * (maxV / vH)); vH = maxV; } } vC.width = vW; vC.height = vH; vC.style.position = 'fixed'; vC.style.top = '0'; vC.style.left = '0'; vC.style.opacity = '0.01'; vC.style.pointerEvents = 'none'; vC.style.zIndex = '-999'; document.body.appendChild(vC);
    const vCtx = vC.getContext('2d'); vCtx.drawImage(canvas, 0, 0, vW, vH);
    const stream = vC.captureStream(30); let mime = 'video/mp4'; if (!MediaRecorder.isTypeSupported(mime)) { mime = 'video/webm;codecs=vp9'; if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm'; }
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 }); let chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => { const blob = new Blob(chunks, { type: mime }); if(vidBlobUrl) URL.revokeObjectURL(vidBlobUrl); vidBlobUrl = URL.createObjectURL(blob); document.getElementById('globalLoader').style.display = 'none'; document.getElementById('progressContainer').style.display = 'none'; const vMod = document.getElementById('videoModal'); const vPrev = document.getElementById('vidPreview'); vPrev.src = vidBlobUrl; vMod.style.display = 'flex'; S.isRecording = false; S.time = 0; S.particles = []; draw(); vC.remove(); };
    S.particles = Array.from({length: 40}, () => ({ x: Math.random() * vW, y: Math.random() * vH, r: Math.random() * 4 + 1, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 - 1 }));
    S.isRecording = true; recorder.start(); let frame = 0; const maxFrames = 90; const frameDelay = 1000 / 30; function renderNextFrame() { if (frame > maxFrames) { recorder.stop(); return; } S.time = frame / maxFrames; draw(); vCtx.clearRect(0, 0, vW, vH); vCtx.drawImage(canvas, 0, 0, vW, vH); const track = stream.getVideoTracks()[0]; if (track && track.requestFrame) track.requestFrame(); const pct = Math.round((frame / maxFrames) * 100); document.getElementById('progressBar').style.width = pct + '%'; document.getElementById('loaderMsg').textContent = `Rendering Video... ${pct}%`; frame++; setTimeout(renderNextFrame, frameDelay); }
    renderNextFrame();
});

document.getElementById('btnDownloadVid') && document.getElementById('btnDownloadVid').addEventListener('click', () => { if (!vidBlobUrl) return; const a = document.createElement('a'); a.href = vidBlobUrl; a.download = `ThumbStudio_Vid_${Date.now()}.mp4`; a.click(); });

// EXPORT ENGINE
function getExportCanvas() {
  let eC = canvas;
  if (S.exportScale !== '1') { const max = parseInt(S.exportScale); let tW = canvas.width, tH = canvas.height; if (tW > max || tH > max) { if (tW > tH) { tH = Math.round(tH * (max / tW)); tW = max; } else { tW = Math.round(tW * (max / tH)); tH = max; } } eC = document.createElement('canvas'); eC.width = tW; eC.height = tH; const eCtx = eC.getContext('2d'); eCtx.imageSmoothingEnabled = true; eCtx.imageSmoothingQuality = 'high'; eCtx.drawImage(canvas, 0, 0, tW, tH); } return eC;
}

// Setup pointer bindings and UI after DOM load
window.addEventListener('DOMContentLoaded', () => {
    initUIBindings(); attachDelegatedListeners();
});
