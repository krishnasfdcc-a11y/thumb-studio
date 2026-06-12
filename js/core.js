/**
 * Vanilla Core: Canvas Renderer & Matrix Engine
 * Pure logic - Zero dependency on React or UI state frameworks.
 */
class CanvasEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Cache offscreen canvases for performance to avoid garbage collection stutter
        this.layers = {
            backdrop: document.createElement('canvas'),
            subject: document.createElement('canvas'),
            shadow: document.createElement('canvas'),
            text: document.createElement('canvas'),
            doodle: document.createElement('canvas'), // Layer for freehand doodles
            bloom: document.createElement('canvas'), // Layer for bloom effect
            glitch: document.createElement('canvas'), // Layer for glitch effect
            mask: document.createElement('canvas'),
            maskSource: document.createElement('canvas'),
            outline: document.createElement('canvas')
        };
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

    getLayer(name, width, height) {
        const canvas = this.layers[name];
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        } else {
            canvas.getContext('2d').clearRect(0, 0, width, height);
        }
        return canvas;
    }

    makeMaskCanvas(maskObj, width, height) {
        const source = this.getLayer('maskSource', maskObj.width, maskObj.height);
        const sourceCtx = source.getContext('2d');
        const imageData = new ImageData(
            new Uint8ClampedArray(maskObj.mask),
            maskObj.width,
            maskObj.height
        );

        sourceCtx.putImageData(imageData, 0, 0);
        const maskCanvas = this.getLayer('mask', width, height);
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.imageSmoothingEnabled = true;
        maskCtx.drawImage(source, 0, 0, width, height);
        return maskCanvas;
    }

    // Apply mask correction strokes onto the mask canvas.
    // Strokes are arrays of points in canvas-space.
    applyMaskCorrection(maskCanvas, strokes, strength = 0.85) {
        if (!maskCanvas || !strokes || strokes.length === 0) return;
        const ctx = maskCanvas.getContext('2d');
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'white';
        const radius = Math.max(1, strength * 24);
        strokes.forEach(stroke => {
            if (!stroke.points) return;
            stroke.points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fill();
            });
        });
        ctx.restore();
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
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const outlineLayer = this.getLayer('outline', width, height);
        const outlineCtx = outlineLayer.getContext('2d');
        
        const steps = 8; 
        for (let i = 0; i < steps; i++) {
            const angle = (i * 2 * Math.PI) / steps;
            const dx = Math.cos(angle) * thickness;
            const dy = Math.sin(angle) * thickness;
            outlineCtx.drawImage(maskCanvas, dx, dy);
        }
        
        outlineCtx.globalCompositeOperation = 'source-in';
        outlineCtx.fillStyle = color;
        outlineCtx.fillRect(0, 0, width, height);
        outlineCtx.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.drawImage(outlineLayer, 0, 0);
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

    drawRimLight(ctx, width, height, lightAngle) {

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

        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    // Draw dynamic text layer based on state.text configuration
    drawTextLayer(ctx, width, height, text) {
        // Provide defaults if text object is missing
        const {
            value = 'AI SUBJECT LAYER',
            x = 0.5,
            y = 0.2,
            size = 40,
            color = 'rgba(255,255,255,0.92)',
            shadow = true,
            shadowBlur = 18,
            rotation = 0,
            weight = '700'
        } = text || {};

        ctx.save();
        ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        if (shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = shadowBlur;
        }
        // Translate to the desired position and apply rotation
        ctx.translate(width * x, height * y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillText(value, 0, 0);
        ctx.restore();
    }

    // Render doodle strokes onto their layer
    drawDoodleLayer(ctx, strokes) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (!strokes || strokes.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        strokes.forEach(stroke => {
            const { points, color = '#fff', size = 2 } = stroke;
            if (!points || points.length < 1) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        });
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

        // 1. Draw base original photo as background
        const backgroundLayer = this.getLayer('backdrop', math.canvasWidth, math.canvasHeight);
        const bgCtx = backgroundLayer.getContext('2d');
        this.applyPhotoTransform(bgCtx, state, math);
        bgCtx.drawImage(state.image, -state.image.width / 2, -state.image.height / 2, state.image.width, state.image.height);
        bgCtx.restore();

        const subjectLayer = this.getLayer('subject', math.canvasWidth, math.canvasHeight);
        let maskCanvas = state.segmentationEnabled && state.segmentationMask && state.segmentationMask.mask
            ? this.makeMaskCanvas(state.segmentationMask, math.canvasWidth, math.canvasHeight)
            : null;

        // Apply any mask correction strokes (user-painted) directly to the mask canvas
        if (maskCanvas && state.maskCorrectionStrokes && state.maskCorrectionStrokes.length > 0) {
            this.applyMaskCorrection(maskCanvas, state.maskCorrectionStrokes, state.maskCorrectionStrength);
        }
        this.drawSubjectLayer(subjectLayer.getContext('2d'), state, math, maskCanvas);

        // Apply X-ray outline if we have a mask
        if (maskCanvas) {
            this.applyXRayOutline(subjectLayer.getContext('2d'), maskCanvas, '#00ff00', 2);
        }

        // Apply rim relighting if we have a mask
        if (maskCanvas) {
            this.drawRimLight(subjectLayer.getContext('2d'), math.canvasWidth, math.canvasHeight, state.lightAngle);
        }

        const shadowLayer = this.getLayer('shadow', math.canvasWidth, math.canvasHeight);
        this.drawShadow(shadowLayer.getContext('2d'), subjectLayer, state.shadowStrength, state.lightAngle);

        // Bloom effect: create a blurred additive pass from the subject layer
        if (state.effects && state.effects.bloom && state.effects.bloom > 0) {
            const bloomLayer = this.getLayer('bloom', math.canvasWidth, math.canvasHeight);
            const bctx = bloomLayer.getContext('2d');
            bctx.clearRect(0, 0, bloomLayer.width, bloomLayer.height);
            // Draw subject into bloom buffer
            bctx.drawImage(subjectLayer, 0, 0);
            // Apply blur filter based on bloom amount
            const blurPx = Math.round(state.effects.bloom * 40);
            bctx.filter = `blur(${blurPx}px)`;
            // Draw the blurred result back onto the bloom canvas
            const temp = document.createElement('canvas');
            temp.width = bloomLayer.width; temp.height = bloomLayer.height;
            const tctx = temp.getContext('2d');
            tctx.drawImage(bloomLayer, 0, 0);
            bctx.clearRect(0, 0, bloomLayer.width, bloomLayer.height);
            bctx.drawImage(temp, 0, 0);
            bctx.filter = 'none';
        }

        const textLayer = this.getLayer('text', math.canvasWidth, math.canvasHeight);
        this.drawTextLayer(textLayer.getContext('2d'), math.canvasWidth, math.canvasHeight, state.text);

        // Doodle layer (freehand strokes)
        const doodleLayer = this.getLayer('doodle', math.canvasWidth, math.canvasHeight);
        this.drawDoodleLayer(doodleLayer.getContext('2d'), state.doodleStrokes);

        this.ctx.drawImage(backgroundLayer, 0, 0);

        if (state.textBehindSubject) {
            this.ctx.drawImage(textLayer, 0, 0);
            this.ctx.drawImage(shadowLayer, 0, 0);
            this.ctx.drawImage(subjectLayer, 0, 0);
        } else {
            this.ctx.drawImage(subjectLayer, 0, 0);
            this.ctx.drawImage(textLayer, 0, 0);
        }

        // Optionally draw bloom additive pass beneath doodles and grain
        if (state.effects && state.effects.bloom && state.effects.bloom > 0) {
            const bloomLayer = this.getLayer('bloom', math.canvasWidth, math.canvasHeight);
            this.ctx.save();
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.globalAlpha = Math.min(0.9, state.effects.bloom * 0.8);
            this.ctx.drawImage(bloomLayer, 0, 0);
            this.ctx.restore();
        }

        // Overlay doodle strokes on top of everything
        this.ctx.drawImage(doodleLayer, 0, 0);

        // Apply grain effect if enabled
        if (state.effects && state.effects.grain && state.effects.grain > 0) {
            this.applyGrain(this.ctx, state.effects.grain);
        }

        return math;
    }
}

window.CanvasEngine = CanvasEngine;
