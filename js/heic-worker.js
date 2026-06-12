// Import conversion library natively into the Web Worker context.
self.importScripts("https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js");

self.onmessage = function(e) {
    const file = e.data;
    
    // heic2any returns a Promise. Setting toType ensures lossless format conversion.
    heic2any({
        blob: file,
        toType: "image/png" 
    }).then(function(resultBlob) {
        // Handle potential animated sequences gracefully
        const blob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
        self.postMessage({ success: true, blob: blob });
    }).catch(function(error) {
        self.postMessage({ success: false, error: error.message });
    });
};