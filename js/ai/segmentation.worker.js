// Import the WASM binaries inside the worker
importScripts(
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/body-segmentation/dist/body-segmentation.min.js'
);

let segmenter = null;
let modelReady = false;

// Initialize the model when the worker loads
async function initModel() {
    try {
        await tf.setBackend('webgl');
        await tf.ready();
        segmenter = await bodySegmentation.createSegmenter(
            bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation, 
            { runtime: 'tfjs', modelType: 'general' }
        );
        modelReady = true;
        postMessage({ status: 'ready' });
    } catch (error) {
        postMessage({ 
            status: 'error', 
            message: `Model initialization failed: ${error.message}` 
        });
    }
}

// Start initialization
initModel();

// Listen for messages from the main UI thread
self.onmessage = async function(e) {
    if (e.data.type === 'segment' && modelReady && segmenter) {
        try {
            const { imageData, requestId } = e.data;
            
            if (!imageData || !imageData.data) {
                throw new Error('Invalid ImageData received');
            }

            // Convert ImageData to tensor
            const imageTensor = tf.browser.fromPixels(imageData);
            
            // Run segmentation
            const people = await segmenter.segmentPeople(imageTensor);
            
            // Generate binary mask with transparent background
            const mask = await bodySegmentation.toBinaryMask(
                people,
                {r: 255, g: 255, b: 255, a: 255}, 
                {r: 0, g: 0, b: 0, a: 0}          
            );
            
            // Clean up tensors
            imageTensor.dispose();
            
            // Send the mask data back to the main thread
            postMessage({ 
                status: 'success',
                maskData: {
                    data: mask.data,
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
