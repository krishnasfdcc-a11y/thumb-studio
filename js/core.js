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
        const canvasHeight = baseWidth / state.aspectRatio;
        
        if (!state.image) return { canvasWidth: baseWidth, canvasHeight };

        const isRotated = state.rotation % 180 !== 0;
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
    render(state) {
        if (!state.image) return null;
        
        const baseWidth = 1920; 
        const math = this.calculateRenderMath(baseWidth, state);
        
        // Apply bounds to raw DOM node
        this.canvas.width = math.canvasWidth;
        this.canvas.height = math.canvasHeight;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Non-destructive drawing operations
        this.ctx.save();
        this.ctx.translate((math.canvasWidth / 2) + math.offsetX, (math.canvasHeight / 2) + math.offsetY);
        this.ctx.rotate(state.rotation * Math.PI / 180);
        this.ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        this.ctx.scale(math.scale, math.scale);
        this.ctx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2, state.image.width, state.image.height);
        this.ctx.restore();
        
        return math; // Expose calculated math so React can clamp mouse panning boundaries
    }
}
window.CanvasEngine = CanvasEngine;