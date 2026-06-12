/**
 * Vanilla Core: Canvas Renderer & Matrix Engine
 * Pure logic - Zero dependency on React or UI state frameworks.
 */
class CanvasEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    calculateRenderMath(baseWidth, state) {
        const isRotated = state.rotation % 180 !== 0;
        let currentAspectRatio;

        if (state.aspectRatio === 'original' && state.image) {
            currentAspectRatio = isRotated
                ? (state.image.height / state.image.width)
                : (state.image.width / state.image.height);
        } else if (typeof state.aspectRatio === 'string' && state.aspectRatio.includes('/')) {
            const [num, den] = state.aspectRatio.split('/');
            currentAspectRatio = parseFloat(num) / parseFloat(den);
        } else {
            currentAspectRatio = parseFloat(state.aspectRatio) || (16 / 9);
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
            canvasWidth: baseWidth,
            canvasHeight,
            offsetX,
            offsetY,
            scale,
            maxOffsetX,
            maxOffsetY
        };
    }

    createLayer(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    drawBackdrop(ctx, style, width, height) {
        if (style === 'flat') {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        if (style === 'noise') {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            for (let i = 0; i < 1100; i += 1) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 2.4;
                ctx.fillRect(x, y, size, size);
            }
            return;
        }

        const gradient = ctx.createRadialGradient(
            width * 0.5,
            height * 0.35,
            width * 0.05,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.9
        );
        gradient.addColorStop(0, '#1e293b');
        gradient.addColorStop(0.4, '#0f172a');
        gradient.addColorStop(1, '#020617');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    makeMaskCanvas(maskObj, width, height) {
        const source = document.createElement('canvas');
        source.width = maskObj.width;
        source.height = maskObj.height;
        const sourceCtx = source.getContext('2d');
        const imageData = sourceCtx.createImageData(maskObj.width, maskObj.height);

        for (let i = 0; i < maskObj.mask.length; i += 1) {
            const alpha = maskObj.mask[i];
            const offset = i * 4;
            imageData.data[offset] = 255;
            imageData.data[offset + 1] = 255;
            imageData.data[offset + 2] = 255;
            imageData.data[offset + 3] = alpha;
        }

        sourceCtx.putImageData(imageData, 0, 0);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.imageSmoothingEnabled = true;
        maskCtx.drawImage(source, 0, 0, width, height);
        return maskCanvas;
    }

    applyPhotoTransform(ctx, state, math) {
        ctx.save();
        ctx.translate((math.canvasWidth / 2) + math.offsetX, (math.canvasHeight / 2) + math.offsetY);
        ctx.rotate(state.rotation * Math.PI / 180);
        ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        ctx.scale(math.scale, math.scale);
    }

    drawSubjectLayer(subjectCtx, state, math, maskCanvas) {
        this.applyPhotoTransform(subjectCtx, state, math);
        subjectCtx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2, state.image.width, state.image.height);
        subjectCtx.restore();

        if (maskCanvas) {
            subjectCtx.save();
            subjectCtx.globalCompositeOperation = 'destination-in';
            subjectCtx.drawImage(maskCanvas, 0, 0, math.canvasWidth, math.canvasHeight);
            subjectCtx.restore();
        }
    }

    applyXRayOutline(ctx, maskCanvas, color, thickness) {
        ctx.save();
        // We will draw the maskCanvas multiple times in a circle to create a stroke.
        const steps = 8; // number of steps in the circle
        for (let i = 0; i < steps; i++) {
            const angle = (i * 2 * Math.PI) / steps;
            const dx = Math.cos(angle) * thickness;
            const dy = Math.sin(angle) * thickness;
            ctx.drawImage(maskCanvas, dx, dy);
        }
        // Now, colorize the drawn mask (which is now a thicker outline) by using source-in.
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
    }

    drawShadow(ctx, sourceCanvas, strength, lightAngle) {
        if (!sourceCanvas) return;

        const angleRad = (lightAngle - 90) * Math.PI / 180;
        const offsetX = Math.cos(angleRad) * 22 * strength;
        const offsetY = Math.sin(angleRad) * 22 * strength;

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.32 * strength;
        ctx.filter = `blur(${10 * strength}px)`;
        ctx.drawImage(sourceCanvas, offsetX, offsetY);
        ctx.restore();
    }

    drawRimLight(ctx, maskCanvas, width, height, lightAngle) {
        if (!maskCanvas) return;

        const gradient = ctx.createRadialGradient(
            width * 0.5 + Math.cos((lightAngle - 90) * Math.PI / 180) * width * 0.18,
            height * 0.5 + Math.sin((lightAngle - 90) * Math.PI / 180) * height * 0.18,
            0,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.7
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.32)');
        gradient.addColorStop(0.6, 'rgba(255,255,255,0.04)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');

        const overlay = document.createElement('canvas');
        overlay.width = width;
        overlay.height = height;
        const overlayCtx = overlay.getContext('2d');
        overlayCtx.fillStyle = gradient;
        overlayCtx.fillRect(0, 0, width, height);
        overlayCtx.globalCompositeOperation = 'destination-in';
        overlayCtx.drawImage(maskCanvas, 0, 0, width, height);

        ctx.drawImage(overlay, 0, 0);
    }

    drawTextLayer(ctx, width, height) {
        ctx.save();
        ctx.font = '700 40px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 18;
        ctx.fillText('AI SUBJECT LAYER', width * 0.5, height * 0.2);
        ctx.restore();
    }

    render(state, containerWidth, containerHeight) {
        if (!state.image || !containerWidth || !containerHeight) {
            if (this.canvas.width > 0 || this.canvas.height > 0) {
                this.canvas.width = 0;
                this.canvas.height = 0;
            }
            return null;
        }

        const tempMath = this.calculateRenderMath(1, state);
        const targetAspectRatio = 1 / tempMath.canvasHeight;
        const containerAspectRatio = containerWidth / containerHeight;
        const finalCanvasWidth = targetAspectRatio > containerAspectRatio
            ? containerWidth
            : containerHeight * targetAspectRatio;
        const math = this.calculateRenderMath(finalCanvasWidth, state);

        this.canvas.width = math.canvasWidth;
        this.canvas.height = math.canvasHeight;
        this.ctx.clearRect(0, 0, math.canvasWidth, math.canvasHeight);

        const backdropLayer = this.createLayer(math.canvasWidth, math.canvasHeight);
        this.drawBackdrop(backdropLayer.getContext('2d'), state.backdropStyle, math.canvasWidth, math.canvasHeight);

        const subjectLayer = this.createLayer(math.canvasWidth, math.canvasHeight);
        const maskCanvas = state.segmentationEnabled && state.segmentationMask && state.segmentationMask.mask
            ? this.makeMaskCanvas(state.segmentationMask, math.canvasWidth, math.canvasHeight)
            : null;
        this.drawSubjectLayer(subjectLayer.getContext('2d'), state, math, maskCanvas);

        // Apply X-ray outline if we have a mask
        if (maskCanvas) {
            this.applyXRayOutline(subjectLayer.getContext('2d'), maskCanvas, '#00ff00', 2);
        }

        // Apply rim relighting if we have a mask
        if (maskCanvas) {
            this.drawRimLight(subjectLayer.getContext('2d'), maskCanvas, math.canvasWidth, math.canvasHeight, state.lightAngle);
        }

        const shadowLayer = this.createLayer(math.canvasWidth, math.canvasHeight);
        this.drawShadow(shadowLayer.getContext('2d'), subjectLayer, state.shadowStrength, state.lightAngle);

        const textLayer = this.createLayer(math.canvasWidth, math.canvasHeight);
        this.drawTextLayer(textLayer.getContext('2d'), math.canvasWidth, math.canvasHeight);

        this.ctx.drawImage(backdropLayer, 0, 0);
        this.ctx.drawImage(shadowLayer, 0, 0);

        if (state.textBehindSubject) {
            this.ctx.drawImage(textLayer, 0, 0);
            this.ctx.drawImage(subjectLayer, 0, 0);
        } else {
            this.ctx.drawImage(subjectLayer, 0, 0);
            this.ctx.drawImage(textLayer, 0, 0);
        }

        if (maskCanvas) {
            this.drawRimLight(this.ctx, maskCanvas, math.canvasWidth, math.canvasHeight, state.lightAngle);
        }

        return math;
    }
}

window.CanvasEngine = CanvasEngine;
