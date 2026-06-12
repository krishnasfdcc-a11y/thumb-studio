/**
 * Global State Manager for Cross-Module Communication
 * Manages UI state, AI settings, and canvas configuration
 */

class GlobalState {
    constructor() {
        this.state = {
            // Image & File Management
            image: null,
            blobUrl: null,
            fileName: 'Ready (Supports Apple HEIC)',

            // Canvas Transforms
            aspectRatio: 'original',
            panX: 0.5,
            panY: 0.5,
            flipH: false,
            flipV: false,
            rotation: 0,

            // Segmentation & AI
            segmentationEnabled: true,
            segmentationReady: false,
            segmentationMask: null,
            segmentationStatus: 'Worker initializing...',

            // Effects & Lighting
            textBehindSubject: true,
            shadowStrength: 0.7,
            lightAngle: 45,

            // Container & Rendering
            containerSize: { width: 0, height: 0 }
        };

        this.listeners = [];
        this.requestIdCounter = 0;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    setState(updates) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Only notify if something actually changed
        const changed = Object.keys(updates).some(key => oldState[key] !== this.state[key]);
        if (changed) {
            this.listeners.forEach(listener => listener(this.state));
        }
    }

    getState() {
        return { ...this.state };
    }

    getNextRequestId() {
        return ++this.requestIdCounter;
    }
}

// Global singleton instance
window.globalState = new GlobalState();
