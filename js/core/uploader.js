/**
 * Lossless Upload Engine
 * Handles native file selection, HEIC/HEIF transcoding, object URL lifecycle, and image decoding.
 */

class Uploader {
    constructor({ onFileSelected, onStatusChange } = {}) {
        this.onFileSelected = onFileSelected;
        this.onStatusChange = onStatusChange;
        this.workerUrl = null;
    }

    isAppleCompressedImage(file) {
        return /\.(heic|heif)$/i.test(file.name || '');
    }

    async importHeicConverter() {
        if (!window.heic2any) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load HEIC converter'));
                document.head.appendChild(script);
            });
        }

        return window.heic2any;
    }

    async convertAppleImageToPng(file) {
        const heic2any = await this.importHeicConverter();
        const result = await heic2any({
            blob: file,
            toType: 'image/png'
        });

        return Array.isArray(result) ? result[0] : result;
    }

    async convertAppleImageWithWorker(file) {
        const worker = new Worker('js/heic-worker.js');

        return new Promise((resolve, reject) => {
            worker.onmessage = (event) => {
                const data = event.data;
                if (data.success) {
                    resolve(data.blob);
                } else {
                    reject(new Error(data.error || 'HEIC conversion failed'));
                }
                worker.terminate();
            };

            worker.onerror = (error) => {
                reject(new Error(error.message || 'HEIC worker failed'));
                worker.terminate();
            };

            worker.postMessage(file);
        });
    }

    async prepareFile(file) {
        if (!file) {
            throw new Error('No file selected');
        }

        this.onStatusChange?.(`Reading ${file.name}...`);

        const normalizedBlob = this.isAppleCompressedImage(file)
            ? await this.convertAppleImageWithWorker(file)
            : file;

        return {
            file,
            blob: normalizedBlob,
            url: URL.createObjectURL(normalizedBlob),
            isConverted: normalizedBlob !== file
        };
    }

    async handleFile(file) {
        try {
            this.onStatusChange?.('Processing upload...');
            const prepared = await this.prepareFile(file);

            this.onStatusChange?.('Decoding image...');
            const image = await this.decodeImage(prepared.url);

            if (typeof this.onFileSelected === 'function') {
                this.onFileSelected({
                    image,
                    url: prepared.url,
                    fileName: prepared.file.name,
                    isConverted: prepared.isConverted
                });
            }

            return {
                image,
                url: prepared.url,
                fileName: prepared.file.name,
                isConverted: prepared.isConverted
            };
        } catch (error) {
            if (typeof this.onStatusChange === 'function') {
                this.onStatusChange(`Error: ${error.message}`);
            }
            throw error;
        }
    }

    decodeImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(image);
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Unable to decode image'));
            };

            image.src = url;
        });
    }
}

window.Uploader = Uploader;
