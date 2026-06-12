// UI handlers (event wiring). Moves many element listeners out of HTML.
import { draw, canvas } from './processor.js';

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
      await parseExifDate(file);
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

  setLoadedState(false);
}
