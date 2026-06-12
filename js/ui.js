// UI handlers (event wiring). Moves many element listeners out of HTML.
import { draw, canvas, ctx } from './processor.js';

export function initUI(){
  // Wire up simple listeners that were inlined in the original HTML.
  document.getElementById('btnDl').addEventListener('click', () => {
    draw();
    // trigger download by simulating original behavior (kept simple)
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 1.0);
    a.download = `ThumbStudio_${Date.now()}.jpeg`;
    a.click();
  });

  document.getElementById('imgInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if(!file) return;
    // simple image load (heavy logic remains in processor)
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image(); img.onload = () => { window.S = window.S || {}; window.S.img = img; window.S.loaded = true; draw(); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}
