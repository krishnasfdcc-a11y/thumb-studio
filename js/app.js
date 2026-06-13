const { useState, useEffect, useRef, useCallback } = React;

function App() {
    // React state synced from global state
    const [state, setState] = useState(window.globalState.getState());
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const mathRef = useRef(null);

    // Subscribe to global state changes
    useEffect(() => {
        const unsubscribe = window.globalState.subscribe((newState) => {
            setState(newState);
        });
        return unsubscribe;
    }, []);

    // Initialize Canvas Engine
    useEffect(() => {
        if (canvasRef.current && !engineRef.current) {
            engineRef.current = new window.CanvasEngine(canvasRef.current);
        }
    }, []);

    // Initialize upload engine once
    useEffect(() => {
        if (!window.uploader) {
            window.uploader = new window.Uploader({
                onStatusChange: (message) => window.globalState.setState({ fileName: message }),
                onFileSelected: ({ image, url, fileName, isConverted }) => {
                    // Extract dominant color palette from the loaded image
                    const palette = window.PaletteExtractor ? new window.PaletteExtractor().extract(image) : [];
                    const extracted = palette.slice(0, 5);
                    const primary = extracted[0] || '#7c6fff';
                    window.globalState.setState({
                        image,
                        blobUrl: url,
                        fileName: `Active: ${fileName}${isConverted ? ' (converted from HEIC/HEIF)' : ''}`,
                        aspectRatio: 'original',
                        panX: 0.5,
                        panY: 0.5,
                        flipH: false,
                        flipV: false,
                        rotation: 0,
                        segmentationMask: null,
                        segmentationStatus: 'Ready for segmentation',
                        palette,
                        extractedColors: extracted,
                        color: primary,
                        colorPop: false
                    });
                }
            });
        }
    }, []);

    // Handle container resize
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                window.globalState.setState({
                    containerSize: {
                        width: Math.floor(width),
                        height: Math.floor(height)
                    }
                });
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                resizeObserver.unobserve(containerRef.current);
            }
        };
    }, []);

    // Render Canvas whenever state changes
    useEffect(() => {
        if (engineRef.current && state.containerSize.width > 0) {
            mathRef.current = engineRef.current.render(state, state.containerSize.width, state.containerSize.height);
        }
    }, [state]);

    // Apply CSS filters for simple visual effects (contrast, brightness, background blur)
    useEffect(() => {
        if (canvasRef.current) {
            const { contrast, brightness, backgroundBlur } = state.effects;
            // Convert backgroundBlur (0-1) to pixel blur radius (max 20px)
            const blurPx = Math.round(backgroundBlur * 20);
            canvasRef.current.style.filter = `contrast(${contrast}) brightness(${brightness}) blur(${blurPx}px)`;
        }
    }, [state.effects]);

    // Trigger segmentation when image loads
    useEffect(() => {
        if (state.image && state.segmentationEnabled && state.segmentationReady) {
            window.segmentationPipeline.processImage(state.image);
        }
    }, [state.image, state.segmentationEnabled, state.segmentationReady]);

    // File Upload Handler
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file || !window.uploader) return;

        window.uploader.handleFile(file).catch((error) => {
            console.error('Upload failed:', error);
            window.globalState.setState({ fileName: `Error: ${error.message}` });
        });
    };

    // Mouse Panning
    const dragInfo = useRef({ active: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });
    const drawInfo = useRef({ active: false, strokeIndex: null }); // For doodle/mask drawing

    const handleMouseDown = (e) => {
        e.preventDefault();
        if (!state.image) return;
        // Only pan when brush mode is "pan"
        if (state.brushMode === 'pan') {
            dragInfo.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                initialPanX: state.panX,
                initialPanY: state.panY
            };
        }
    };

    // Pointer down for doodle or mask correction
    const handlePointerDown = (e) => {
        if (!state.image) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (state.brushMode === 'doodle') {
            // Start a new doodle stroke
            const current = window.globalState.getState();
            const newStroke = {
                points: [{ x, y }],
                color: current.brushColor,
                size: current.brushSize
            };
            const newStrokes = [...current.doodleStrokes, newStroke];
            const newIndex = newStrokes.length - 1;
            window.globalState.setState({ doodleStrokes: newStrokes });
            drawInfo.current = { active: true, strokeIndex: newIndex };
        } else if (state.brushMode === 'mask') {
            // Start a mask correction stroke (store similarly)
            const current = window.globalState.getState();
            const newStroke = {
                points: [{ x, y }],
                strength: current.maskCorrectionStrength
            };
            const newStrokes = [...(current.maskCorrectionStrokes || []), newStroke];
            const newIndex = newStrokes.length - 1;
            window.globalState.setState({ maskCorrectionStrokes: newStrokes });
            drawInfo.current = { active: true, strokeIndex: newIndex };
        }
    };

    const handlePointerMove = (e) => {
        if (!drawInfo.current.active) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (state.brushMode === 'doodle') {
            const current = window.globalState.getState();
            const strokes = current.doodleStrokes.slice();
            const idx = drawInfo.current.strokeIndex;
            if (strokes[idx]) {
                strokes[idx].points.push({ x, y });
                window.globalState.setState({ doodleStrokes: strokes });
            }
        } else if (state.brushMode === 'mask') {
            const current = window.globalState.getState();
            const strokes = (current.maskCorrectionStrokes || []).slice();
            const idx = drawInfo.current.strokeIndex;
            if (strokes[idx]) {
                strokes[idx].points.push({ x, y });
                window.globalState.setState({ maskCorrectionStrokes: strokes });
            }
        }
    };

    const handlePointerUp = (e) => {
        if (drawInfo.current.active) {
            drawInfo.current = { active: false, strokeIndex: null };
        }
    };

    const handleMouseMove = useCallback((e) => {
        if (!dragInfo.current.active || !mathRef.current || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const math = mathRef.current;

        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const deltaLogicalX = (e.clientX - dragInfo.current.startX) * scaleX;
        const deltaLogicalY = (e.clientY - dragInfo.current.startY) * scaleY;

        if (math.maxOffsetX > 0) {
            const newPanX = Math.max(0, Math.min(1, dragInfo.current.initialPanX - (deltaLogicalX / math.maxOffsetX)));
            window.globalState.setState({ panX: newPanX });
        }

        if (math.maxOffsetY > 0) {
            const newPanY = Math.max(0, Math.min(1, dragInfo.current.initialPanY - (deltaLogicalY / math.maxOffsetY)));
            window.globalState.setState({ panY: newPanY });
        }
    }, []);

    useEffect(() => {
        const stopDrag = () => { dragInfo.current.active = false; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopDrag);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopDrag);
        };
    }, [handleMouseMove]);

    return (
        <div className="editor-layout">
            <aside className="sidebar">
                {/* Core Ingestion */}
                <div className="panel-section">
                    <h2>1. Core Ingestion Engine</h2>
                    <button className="btn" onClick={() => fileInputRef.current.click()}>Upload Image</button>
                    <input type="file" ref={fileInputRef} accept="image/*,.heic,.heif" hidden onChange={handleFileChange} />
                    <div className="status-indicator">{state.fileName}</div>
                </div>

                {/* Math / Pan */}
                <div className="panel-section">
                    <h2>2. Math / Pan Constraints</h2>
                    <label>Target Aspect Ratio</label>
                    <select value={state.aspectRatio} onChange={e => window.globalState.setState({ aspectRatio: e.target.value })}>
                        <option value="original">Original Aspect Ratio</option>
                        <optgroup label="Social Media & Video">
                            <option value="16/9">16:9 (YouTube)</option>
                            <option value="9/16">9:16 (Shorts / Story)</option>
                            <option value="1/1">1:1 (Square)</option>
                            <option value="4/5">4:5 (IG Portrait)</option>
                        </optgroup>
                    </select>
                    <label>Pan X: {(state.panX * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.001" value={state.panX} onChange={e => window.globalState.setState({ panX: parseFloat(e.target.value) })} />
                    <label>Pan Y: {(state.panY * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.001" value={state.panY} onChange={e => window.globalState.setState({ panY: parseFloat(e.target.value) })} />
                </div>

                {/* AI Segmentation */}
                <div className="panel-section">
                    <h2>3. AI Subject Isolation</h2>
                    <label>Segmentation</label>
                    <div className="btn-group">
                        <button className="btn" onClick={() => window.globalState.setState({ segmentationEnabled: !state.segmentationEnabled })}>
                            {state.segmentationEnabled ? 'Disable' : 'Enable'}
                        </button>
                    </div>
                    <div className="status-indicator">{state.segmentationStatus}</div>

                    <label>Light Angle: {state.lightAngle}°</label>
                    <input type="range" min="0" max="360" step="1" value={state.lightAngle} onChange={e => window.globalState.setState({ lightAngle: parseInt(e.target.value) })} />

                    <label>Shadow Strength: {(state.shadowStrength * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.05" value={state.shadowStrength} onChange={e => window.globalState.setState({ shadowStrength: parseFloat(e.target.value) })} />

                    <div className="btn-group">
                        <button className="btn" onClick={() => window.globalState.setState({ textBehindSubject: true })}>Text Behind</button>
                        <button className="btn" onClick={() => window.globalState.setState({ textBehindSubject: false })}>Text In Front</button>
                    </div>
                </div>

                {/* Matrix Transforms */}
                <div className="panel-section">
                    <h2>4. Matrix Transforms</h2>
                    <div className="btn-group">
                        <button className="btn" onClick={() => window.globalState.setState({ flipH: !state.flipH })}>Flip H</button>
                        <button className="btn" onClick={() => window.globalState.setState({ flipV: !state.flipV })}>Flip V</button>
                        <button className="btn" onClick={() => window.globalState.setState({ rotation: (state.rotation + 90) % 360 })}>Rot 90°</button>
                    </div>
                </div>

                {/* Text & Palette */}
                <div className="panel-section">
                    <h2>5. Text & Palette</h2>
                    <label>Text Content</label>
                    <input type="text" value={state.text.value} onChange={e => window.globalState.setState({ text: { ...state.text, value: e.target.value } })} />
                    <label>Font Size: {state.text.size}px</label>
                    <input type="range" min="10" max="120" step="1" value={state.text.size} onChange={e => window.globalState.setState({ text: { ...state.text, size: parseInt(e.target.value) } })} />
                    <label>Text Color</label>
                    <input type="color" value={state.text.color} onChange={e => window.globalState.setState({ text: { ...state.text, color: e.target.value } })} />
                    <label>Rotation: {state.text.rotation}°</label>
                    <input type="range" min="0" max="360" step="1" value={state.text.rotation} onChange={e => window.globalState.setState({ text: { ...state.text, rotation: parseInt(e.target.value) } })} />
                    <label>Position X: {(state.text.x * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={state.text.x} onChange={e => window.globalState.setState({ text: { ...state.text, x: parseFloat(e.target.value) } })} />
                    <label>Position Y: {(state.text.y * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={state.text.y} onChange={e => window.globalState.setState({ text: { ...state.text, y: parseFloat(e.target.value) } })} />
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {state.palette && state.palette.map((c, i) => (
                            <button key={i} onClick={() => window.globalState.setState({ text: { ...state.text, color: c } })} style={{ background: c, width: '24px', height: '24px', border: '1px solid #555' }} title={c} />
                        ))}
                    </div>
                </div>

                {/* Effects */}
                <div className="panel-section">
                    <h2>6. Visual Effects</h2>
                    <label>Contrast: {state.effects.contrast.toFixed(2)}</label>
                    <input type="range" min="0.5" max="2" step="0.01" value={state.effects.contrast} onChange={e => window.globalState.setState({ effects: { ...state.effects, contrast: parseFloat(e.target.value) } })} />
                    <label>Brightness: {state.effects.brightness.toFixed(2)}</label>
                    <input type="range" min="0.5" max="2" step="0.01" value={state.effects.brightness} onChange={e => window.globalState.setState({ effects: { ...state.effects, brightness: parseFloat(e.target.value) } })} />
                    <label>Background Blur: {(state.effects.backgroundBlur * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={state.effects.backgroundBlur} onChange={e => window.globalState.setState({ effects: { ...state.effects, backgroundBlur: parseFloat(e.target.value) } })} />
                </div>

                {/* Brush Controls */}
                <div className="panel-section">
                    <h2>7. Brush & Doodle</h2>
                    <label>Mode</label>
                    <select value={state.brushMode} onChange={e => window.globalState.setState({ brushMode: e.target.value })}>
                        <option value="pan">Pan</option>
                        <option value="doodle">Doodle</option>
                        <option value="mask">Mask Correction</option>
                    </select>
                    <label>Brush Color</label>
                    <input type="color" value={state.brushColor} onChange={e => window.globalState.setState({ brushColor: e.target.value })} />
                    <label>Brush Size: {state.brushSize}px</label>
                    <input type="range" min="1" max="20" step="1" value={state.brushSize} onChange={e => window.globalState.setState({ brushSize: parseInt(e.target.value) })} />
                    <label>Mask Correction Strength: {(state.maskCorrectionStrength * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.01" value={state.maskCorrectionStrength} onChange={e => window.globalState.setState({ maskCorrectionStrength: parseFloat(e.target.value) })} />
                </div>

                {/* Macro & Export */}
                <div className="panel-section">
                    <h2>8. Automation & Export</h2>
                    <button className="btn" onClick={() => window.viralEdit && window.viralEdit.applyViralEdit()}>Viral Edit Macro</button>
                    <button className="btn" onClick={() => {
                        if (canvasRef.current) {
                            canvasRef.current.toBlob(blob => {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = 'thumb-studio.png';
                                a.click();
                                URL.revokeObjectURL(a.href);
                            }, 'image/png');
                        }
                    }}>Export Image</button>
                </div>
            </aside>

            <main className="workspace">
                <div className="canvas-container" ref={containerRef}>
                    <canvas ref={canvasRef} onMouseDown={handleMouseDown}></canvas>
                </div>
            </main>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
