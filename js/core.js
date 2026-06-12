/**
 * Vanilla Core: Canvas Renderer & Matrix Engine
 * Pure logic - Zero dependency on React or UI state frameworks.
 */
class CanvasEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    // Math Engine (Pure)
    calculateRenderMath(baseWidth, state) {
        const isRotated = state.rotation % 180 !== 0;
        let currentAspectRatio;
        // Handle "original" aspect ratio string, otherwise parse the float value
        if (state.aspectRatio === 'original' && state.image) {
            currentAspectRatio = isRotated ? (state.image.height / state.image.width) : (state.image.width / state.image.height);
        } else if (typeof state.aspectRatio === 'string' && state.aspectRatio.includes('/')) {
            const [num, den] = state.aspectRatio.split('/');
            currentAspectRatio = parseFloat(num) / parseFloat(den);
        } else {
            // Provide a fallback if parsing fails for any reason
            currentAspectRatio = parseFloat(state.aspectRatio) || (16/9);
        }
        
        const canvasHeight = baseWidth / currentAspectRatio;
        if (!state.image) return { canvasWidth: baseWidth, canvasHeight };

        const imgW = isRotated ? state.image.height : state.image.width;
        const imgH = isRotated ? state.image.width : state.image.height;
        
        const scale = Math.max(baseWidth / imgW, canvasHeight / imgH);
        
        const scaledW = imgW * scale;
        const scaledH = imgH * scale;
        
        const maxOffsetX = Math.max(0, scaledW - baseWidth);
        const maxOffsetY = Math.max(0, scaledH - canvasHeight);
        
        const offsetX = (0.5 - state.panX) * maxOffsetX;
        const offsetY = (0.5 - state.panY) * maxOffsetY;
        
        return {
            canvasWidth: baseWidth, canvasHeight,
            offsetX, offsetY, scale, maxOffsetX, maxOffsetY
        };
    }

    // Fluid Workspace Renderer
    render(state, containerWidth, containerHeight) {
        // If there's no image or the container has no size, clear the canvas.
        if (!state.image || !containerWidth || !containerHeight) {
            if (this.canvas.width > 0 || this.canvas.height > 0) {
                this.canvas.width = 0;
                this.canvas.height = 0;
            }
            return null;
        }

        // 1. Get the target aspect ratio by reusing the logic in calculateRenderMath.
        // We call it with a dummy width (1) to extract the ratio from the resulting height.
        const tempMath = this.calculateRenderMath(1, state);
        const targetAspectRatio = 1 / tempMath.canvasHeight; // Since baseWidth was 1, height is 1/ratio.

        // 2. Calculate the final canvas dimensions that fit inside the container.
        const containerAspectRatio = containerWidth / containerHeight;
        let finalCanvasWidth;

        if (targetAspectRatio > containerAspectRatio) {
            // Target is wider than container -> limited by container width.
            finalCanvasWidth = containerWidth;
        } else {
            // Target is narrower or same as container -> limited by container height.
            finalCanvasWidth = containerHeight * targetAspectRatio;
        }

        // 3. Now, run the full math calculation with the correct, dynamic base width.
        const math = this.calculateRenderMath(finalCanvasWidth, state);

        // Apply the calculated, scaled bounds to the raw canvas element.
        this.canvas.width = math.canvasWidth;
        this.canvas.height = math.canvasHeight;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Non-destructive drawing operations (this part is unchanged).
        this.ctx.save();
        this.ctx.translate((math.canvasWidth / 2) + math.offsetX, (math.canvasHeight / 2) + math.offsetY);
        this.ctx.rotate(state.rotation * Math.PI / 180);
        this.ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        this.ctx.scale(math.scale, math.scale);
        this.ctx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2, state.image.width, state.image.height);
        this.ctx.restore();

        return math; // Expose calculated math so React can clamp mouse panning boundaries.
    }
}
window.CanvasEngine = CanvasEngine;