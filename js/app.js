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

    // Trigger segmentation when image loads
    useEffect(() => {
        if (state.image && state.segmentationEnabled && state.segmentationReady) {
            window.segmentationPipeline.processImage(state.image);
        }
    }, [state.image, state.segmentationEnabled, state.segmentationReady]);

    // File Upload Handler
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isHeic = file.name.toLowerCase().match(/\.(heic|heif)$/);
        window.globalState.setState({ fileName: 'Processing...' });

        if (isHeic) {
            const worker = new Worker('js/heic-worker.js');
            worker.postMessage(file);
            worker.onmessage = (e) => {
                if (e.data.success) {
                    loadImageBlob(e.data.blob, file.name);
                } else {
                    window.globalState.setState({ fileName: `Error: ${e.data.error}` });
                }
                worker.terminate();
            };
        } else {
            loadImageBlob(file, file.name);
        }
    };

    // Load Image into State
    const loadImageBlob = (blob, fileName) => {
        if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);

        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            window.globalState.setState({
                image: img,
                blobUrl: url,
                fileName: `Active: ${fileName}`,
                aspectRatio: 'original',
                panX: 0.5,
                panY: 0.5,
                flipH: false,
                flipV: false,
                rotation: 0
            });
        };

        img.src = url;
    };

    // Mouse Panning
    const dragInfo = useRef({ active: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

    const handleMouseDown = (e) => {
        e.preventDefault();
        if (!state.image) return;
        dragInfo.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            initialPanX: state.panX,
            initialPanY: state.panY
        };
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
                <div className="panel-section">
                    <h2>1. Core Ingestion Engine</h2>
                    <button className="btn" onClick={() => fileInputRef.current.click()}>Upload Image</button>
                    <input type="file" ref={fileInputRef} accept="image/*,.heic,.heif" hidden onChange={handleFileChange} />
                    <div className="status-indicator">{state.fileName}</div>
                </div>

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

                <div className="panel-section">
                    <h2>4. Matrix Transforms</h2>
                    <div className="btn-group">
                        <button className="btn" onClick={() => window.globalState.setState({ flipH: !state.flipH })}>Flip H</button>
                        <button className="btn" onClick={() => window.globalState.setState({ flipV: !state.flipV })}>Flip V</button>
                        <button className="btn" onClick={() => window.globalState.setState({ rotation: (state.rotation + 90) % 360 })}>Rot 90°</button>
                    </div>
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
