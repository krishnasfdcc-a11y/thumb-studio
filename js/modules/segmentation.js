/**
 * Segmentation Pipeline Module
 * Handles downsampling, worker dispatch, and mask processing
 */

class SegmentationPipeline {
    constructor() {
        this.downsampleSize = 256;
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.downsampleSize;
        this.offscreenCanvas.height = this.downsampleSize;
    }

    downsampleImage(imageElement) {
        const ctx = this.offscreenCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.downsampleSize, this.downsampleSize);
        
        // Draw image downsampled to 256x256
        ctx.drawImage(
            imageElement,
            0, 0,
            this.downsampleSize,
            this.downsampleSize
        );

        // Extract ImageData
        return ctx.getImageData(0, 0, this.downsampleSize, this.downsampleSize);
    }

    async processImage(imageElement) {
        if (!imageElement) return null;

        try {
            const downsampledData = this.downsampleImage(imageElement);
            const requestId = window.aiWorkerManager.sendFrame(downsampledData);
            
            return requestId;
        } catch (error) {
            console.error('Segmentation error:', error);
            window.globalState.setState({
                segmentationStatus: `Failed: ${error.message}`,
                segmentationEnabled: false
            });
            return null;
        }
    }

    reset() {
        const ctx = this.offscreenCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.downsampleSize, this.downsampleSize);
    }
}

// Global singleton
window.segmentationPipeline = new SegmentationPipeline();
