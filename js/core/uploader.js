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
        try {
            const worker = new Worker('js/heic-worker.js');

            return await new Promise((resolve, reject) => {
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
        } catch (err) {
            // Worker creation failed (e.g., CSP or unsupported environment). Fall back to in-page converter.
            this.onStatusChange?.('HEIC worker unavailable, falling back to main-thread converter');
            return await this.convertAppleImageToPng(file);
        }
    }

    async prepareFile(file) {
        if (!file) {
            throw new Error('No file selected');
        }

        this.onStatusChange?.(`Reading ${file.name}...`);

        const normalizedBlob = this.isAppleCompressedImage(file)
            ? await this.convertAppleImageWithWorker(file)
            : file;

        const url = URL.createObjectURL(normalizedBlob);
        // Track created object URLs so caller can release them later
        this._objectUrls = this._objectUrls || new Set();
        this._objectUrls.add(url);

        return {
            file,
            blob: normalizedBlob,
            url,
            isConverted: normalizedBlob !== file
        };
    }

    // Create a hidden file input and wire it to call back with the selected file results.
    // Usage: const input = uploader.createFileInput({ multiple: false, accept: 'image/*', onSelect: fn })
    createFileInput({ multiple = false, accept = 'image/*', onSelect } = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = !!multiple;
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            const results = [];
            for (const f of files) {
                try {
                    const res = await this.handleFile(f);
                    results.push(res);
                } catch (err) {
                    this.onStatusChange?.(`Upload error: ${err.message}`);
                }
            }
            if (typeof onSelect === 'function') onSelect(results);
            input.value = '';
        });

        return input;
    }

    // Attach drag & drop support to an element. Calls handleFile for each dropped file.
    attachDropZone(element, { multiple = false } = {}) {
        if (!element) return;
        const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
        element.addEventListener('dragenter', prevent);
        element.addEventListener('dragover', prevent);
        element.addEventListener('drop', async (e) => {
            prevent(e);
            const dt = e.dataTransfer;
            if (!dt) return;
            const files = Array.from(dt.files || []);
            if (!multiple && files.length > 1) files.length = 1;
            for (const f of files) {
                try {
                    await this.handleFile(f);
                } catch (err) {
                    this.onStatusChange?.(`Drop error: ${err.message}`);
                }
            }
        });
    }

    // Release a prepared resource (revokes object URLs, frees references)
    releasePrepared(prepared) {
        if (!prepared) return;
        if (prepared.url && this._objectUrls && this._objectUrls.has(prepared.url)) {
            URL.revokeObjectURL(prepared.url);
            this._objectUrls.delete(prepared.url);
        }
        // If the converted blob was created by us and not the original file, allow GC
        if (prepared.isConverted && prepared.blob) {
            // no-op: dropping references is enough for GC; callers should drop their refs
        }
    }

    // Cleanup all tracked object URLs
    dispose() {
        if (this._objectUrls) {
            for (const u of this._objectUrls) {
                try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
            }
            this._objectUrls.clear();
        }
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
