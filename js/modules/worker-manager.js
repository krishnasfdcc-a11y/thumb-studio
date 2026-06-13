/**
 * AI Worker Manager Module
 * Handles initialization, communication, and result processing for the segmentation worker
 */

class AIWorkerManager {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.pendingRequests = new Map();
    }

    async initialize() {
        return new Promise((resolve) => {
            this.worker = new Worker('js/ai/segmentation.worker.js');

            this.worker.onmessage = (event) => {
                const { status, message, maskData, requestId } = event.data;

                if (status === 'ready') {
                    this.isReady = true;
                    window.globalState.setState({ 
                        segmentationReady: true,
                        segmentationStatus: 'AI Worker ready'
                    });
                    resolve();
                }

                if (status === 'success' && maskData) {
                    // maskData contains: { data: Uint8Array, width, height }
                    window.globalState.setState({
                        segmentationMask: {
                            mask: maskData.data,
                            width: maskData.width,
                            height: maskData.height
                        },
                        bp: {
                            ...window.globalState.getState().bp,
                            active: true,
                            mask: {
                                mask: maskData.data,
                                width: maskData.width,
                                height: maskData.height
                            },
                            originalMaskData: null
                        },
                        segmentationStatus: 'Mask received'
                    });
                    
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.get(requestId)();
                        this.pendingRequests.delete(requestId);
                    }
                }

                if (status === 'error') {
                    window.globalState.setState({
                        segmentationStatus: `Error: ${message}`,
                        segmentationEnabled: false
                    });
                }
            };

            this.worker.onerror = (event) => {
                console.error('Worker error:', event);
                window.globalState.setState({
                    segmentationStatus: `Worker failed: ${event.message}`,
                    segmentationEnabled: false
                });
            };
        });
    }

    sendFrame(imageData) {
        if (!this.isReady || !this.worker) return null;

        const requestId = window.globalState.getNextRequestId();
        
        window.globalState.setState({
            segmentationStatus: 'Processing...'
        });

        // Send ImageData to worker with transferable buffer
        this.worker.postMessage(
            { type: 'segment', imageData, requestId },
            [imageData.data.buffer]
        );

        return requestId;
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isReady = false;
        }
    }
}

// Global singleton
window.aiWorkerManager = new AIWorkerManager();
