// Web Worker for lightweight MediaPipe-style segmentation.
// This module expects image pixels from the main thread at a small, performance-friendly resolution.

self.onmessage = async (event) => {
    const message = event.data;

    if (message.type === 'segment') {
        try {
            const { pixels, width, height, requestId } = message.payload;
            const mask = computeAlphaMaskFromImage(pixels, width, height);
            self.postMessage({ type: 'mask', payload: { mask, width, height, requestId } });
        } catch (error) {
            self.postMessage({ type: 'error', payload: { message: error.message || 'Segmentation failed' } });
        }
    }
};

self.postMessage({ type: 'ready' });

function computeAlphaMaskFromImage(pixels, width, height) {
    const mask = new Uint8ClampedArray(width * height);
    const threshold = 100;

    for (let i = 0, j = 0; i < pixels.length; i += 4, j += 1) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
        mask[j] = brightness > threshold ? 255 : 0;
    }

    return mask;
}
