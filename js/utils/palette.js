/**
 * Palette Extraction Utility
 * Scans an image and extracts the most dominant colors.
 * Returns an array of hex color strings (e.g., ['#ff0000', '#00ff00', ...]).
 */

class PaletteExtractor {
    constructor(sampleCount = 5000, maxColors = 5) {
        this.sampleCount = sampleCount; // Number of pixels to sample
        this.maxColors = maxColors; // Number of dominant colors to return
        this.offscreen = document.createElement('canvas');
        this.ctx = this.offscreen.getContext('2d');
    }

    // Convert RGBA components to a hex string (ignoring alpha)
    rgbaToHex(r, g, b) {
        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Sample random pixels from the image data
    samplePixels(imageData) {
        const { data, width, height } = imageData;
        const totalPixels = width * height;
        const step = Math.max(1, Math.floor(totalPixels / this.sampleCount));
        const colors = [];
        for (let i = 0; i < totalPixels; i += step) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Ignore fully transparent pixels
            const a = data[idx + 3];
            if (a === 0) continue;
            colors.push(this.rgbaToHex(r, g, b));
        }
        return colors;
    }

    // Count occurrences of each color and return the top N
    getDominantColors(colors) {
        const freq = {};
        colors.forEach((c) => {
            freq[c] = (freq[c] || 0) + 1;
        });
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        return sorted.slice(0, this.maxColors).map(([hex]) => hex);
    }

    // Main entry point: extract palette from an HTMLImageElement
    extract(image) {
        // Ensure the offscreen canvas matches the image dimensions (but limit size for performance)
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
        const w = Math.round(image.width * scale);
        const h = Math.round(image.height * scale);
        this.offscreen.width = w;
        this.offscreen.height = h;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(image, 0, 0, w, h);
        const imageData = this.ctx.getImageData(0, 0, w, h);
        const sampled = this.samplePixels(imageData);
        return this.getDominantColors(sampled);
    }
}

// Expose globally
window.PaletteExtractor = PaletteExtractor;
