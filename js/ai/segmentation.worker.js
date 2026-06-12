// Import the WASM binaries inside the worker
importScripts(
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/body-segmentation/dist/body-segmentation.min.js'
);

let segmenter = null;

// Initialize the model when the worker loads
async function initModel() {
    await tf.setBackend('webgl');
    await tf.ready();
    segmenter = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation, 
        { runtime: 'tfjs', modelType: 'general' }
    );
    postMessage({ status: 'ready' });
}

initModel();

// Listen for messages from the main UI thread
self.onmessage = async function(e) {
    if (e.data.type === 'segment' && segmenter) {
        try {
            const { imageData, requestId } = e.data;
            const people = await segmenter.segmentPeople(imageData);
            const mask = await bodySegmentation.toBinaryMask(people);
            
            // Send the mask data back to the main thread as grayscale with width and height
            postMessage({ 
                status: 'success', 
                maskData: {
                    data: mask,
                    width: imageData.width,
                    height: imageData.height
                },
                requestId
            });
        } catch (error) {
            postMessage({ 
                status: 'error', 
                message: error.message,
                requestId: e.data.requestId 
            });
        }
    }
};
