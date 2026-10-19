/**
 * src/utils/imageUtils.ts.ts
 *
 * @module
 * @description A file containing URLs and file paths used by the app.
 * @supports Preload, Renderer
 */
/** */
import type { NativeImage } from "electron";

/**
 * Pads a {@link NativeImage} to a square.
 *
 * @param nativeImg The {@link NativeImage} to pad.
 * @param scaleMin If provided, will scale the image so that it is at least this size using nearest-neighbor scaling, and using a multiple of the original size to preserve full quality.
 * @returns The padded {@link NativeImage}.
 */
export function padNativeImageToSquare(nativeImg: NativeImage, scaleMin: number | null = null): NativeImage {
    if (scaleMin === null) return padNativeImageToSquare_noScale(nativeImg);
    // const t1: number = performance.now();
    const imgSize: Electron.Size = nativeImg.getSize();
    const originalMaxAxis: number = Math.max(imgSize.width, imgSize.height);
    if (originalMaxAxis >= scaleMin) return padNativeImageToSquare_noScale(nativeImg);

    const multiplier: number = scaleMin !== null && originalMaxAxis < scaleMin ? Math.ceil(scaleMin / originalMaxAxis) : 1;

    const scaledWidth: number = imgSize.width * multiplier;
    const scaledHeight: number = imgSize.height * multiplier;
    const size: number = originalMaxAxis * multiplier;

    const srcCanvas: HTMLCanvasElement = document.createElement("canvas");
    srcCanvas.width = imgSize.width;
    srcCanvas.height = imgSize.height;
    const srcCtx: CanvasRenderingContext2D = srcCanvas.getContext("2d", { willReadFrequently: true })!;

    srcCtx.putImageData(new ImageData(new Uint8ClampedArray(nativeImg.toBitmap()), imgSize.width, imgSize.height), 0, 0);

    const destCanvas: HTMLCanvasElement = document.createElement("canvas");
    destCanvas.width = size;
    destCanvas.height = size;
    const destCtx: CanvasRenderingContext2D = destCanvas.getContext("2d", { willReadFrequently: true })!;
    destCtx.clearRect(0, 0, size, size);

    destCtx.imageSmoothingEnabled = false;

    const x: number = (size - scaledWidth) / 2;
    const y: number = (size - scaledHeight) / 2;

    destCtx.drawImage(srcCanvas, x, y, scaledWidth, scaledHeight);

    const imageData: Uint8ClampedArray = destCtx.getImageData(0, 0, size, size).data;

    // const t2: number = performance.now();
    // console.debug("padNativeImageToSquare", t2 - t1, "ms, size:", size);

    return electron.nativeImage.createFromBitmap(Buffer.from(imageData.buffer), { width: size, height: size });
}

/**
 * Pads a {@link NativeImage} to a square.
 *
 * @param nativeImg The {@link NativeImage} to pad.
 * @returns The padded {@link NativeImage}.
 */
function padNativeImageToSquare_noScale(nativeImg: NativeImage): Electron.NativeImage {
    // const t1: number = performance.now(); // DEBUG
    const imgSize: Electron.Size = nativeImg.getSize();

    const size: number = Math.max(imgSize.width, imgSize.height);
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx: CanvasRenderingContext2D = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, size, size);

    const x: number = (size - imgSize.width) / 2;
    const y: number = (size - imgSize.height) / 2;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(nativeImg.toBitmap()), imgSize.width, imgSize.height), x, y);

    const imageData: Uint8ClampedArray = ctx.getImageData(0, 0, size, size).data;
    // const t2: number = performance.now(); // DEBUG
    // console.debug("padNativeImageToSquare", t2 - t1, "ms, size:", size); // DEBUG
    return electron.nativeImage.createFromBitmap(Buffer.from(imageData.buffer), { width: size, height: size });
}

// const asyncEncoderCanvas = new OffscreenCanvas(1, 1);
// const encoderCtx: OffscreenCanvasRenderingContext2D = asyncEncoderCanvas.getContext("2d")!;

// /**
//  * Converts a {@link NativeImage} to a PNG buffer.
//  *
//  * @param nativeImg The {@link NativeImage} to convert.
//  * @returns A promise resolving with the PNG buffer.
//  */
// export async function convertNativeImageToPngAsync(nativeImg: NativeImage): Promise<Buffer<ArrayBuffer>> {
//     const size = nativeImg.getSize();

//     asyncEncoderCanvas.width = size.width;
//     asyncEncoderCanvas.height = size.height;

//     const rawBuffer: Buffer = nativeImg.toBitmap();

//     const srcPixels = new Uint32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);

//     const destBuffer = new ArrayBuffer(srcPixels.byteLength);
//     const destPixels = new Uint32Array(destBuffer);

//     const t1 = performance.now();
//     for (let i = 0; i < srcPixels.length; i++) {
//         const pixel: number = srcPixels[i]!;
//         // Swaps the R and B channels.
//         destPixels[i] = ((pixel & 0x00ff0000) >> 16) | ((pixel & 0x000000ff) << 16) | (pixel & 0xff00ff00);
//     }
//     const t2 = performance.now();
//     console.debug("convertNativeImageToPngAsync", t2 - t1, "ms");

//     const imageData = new ImageData(new Uint8ClampedArray(destBuffer), size.width, size.height);

//     encoderCtx.putImageData(imageData, 0, 0);

//     const blob = await asyncEncoderCanvas.convertToBlob({ type: "image/png" });

//     const arrayBuffer = await blob.arrayBuffer();
//     return Buffer.from(arrayBuffer);
// }
/**
 * Converts a {@link NativeImage} to an uncompressed PNG buffer.
 *
 * @param nativeImg The {@link NativeImage} to convert.
 * @returns A promise resolving with the uncompressed PNG buffer.
 */
export function convertNativeImageToPngUncompressed(nativeImg: NativeImage): Buffer<ArrayBuffer> {
    const size = nativeImg.getSize();
    const width: number = size.width;
    const height: number = size.height;

    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, height, false);
    ihdrData[8] = 8; // 8 bits per channel
    ihdrData[9] = 6; // Color type 6 (RGBA)
    ihdrData[10] = 0; // Compression (0 = deflate)
    ihdrData[11] = 0; // Filter (0 = adaptive)
    ihdrData[12] = 0; // No interlace
    const ihdrChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk("IHDR", ihdrData);

    const scanlineStride: number = width * 4 + 1; // 4 bytes per pixel + 1 filter byte
    const uncompressedDataSize: number = scanlineStride * height;

    const maxBlockSize = 65535; // Max size for uncompressed deflate blocks
    const numBlocks: number = Math.ceil(uncompressedDataSize / maxBlockSize);
    const idatPayloadSize: number = 2 + numBlocks * 5 + uncompressedDataSize + 4;

    const idatData = new Uint8Array(idatPayloadSize);
    idatData[0] = 0x78; // Zlib Header (Deflate, 32K window)
    idatData[1] = 0x01; // Zlib Flags (No preset dictionary)

    const rawBuffer = nativeImg.toBitmap();
    const srcPixels = new Uint32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);

    let destIdx = 2;
    let bytesLeft = uncompressedDataSize;
    let srcY = 0,
        srcX = 0,
        byteInLine = 0;

    // Process data stream directly into deflate blocks
    while (bytesLeft > 0) {
        const blockLen = Math.min(bytesLeft, maxBlockSize);
        idatData[destIdx++] = blockLen === bytesLeft ? 0x01 : 0x00; // BFINAL + BTYPE (00)

        idatData[destIdx++] = blockLen & 0xff;
        idatData[destIdx++] = (blockLen >> 8) & 0xff;
        const nlen = ~blockLen & 0xffff;
        idatData[destIdx++] = nlen & 0xff;
        idatData[destIdx++] = (nlen >> 8) & 0xff;

        for (let b = 0; b < blockLen; b++) {
            if (byteInLine === 0) {
                idatData[destIdx++] = 0; // Filter method: None
                byteInLine++;
            } else {
                const pixel = srcPixels[srcY * width + srcX]!;
                const channel = (byteInLine - 1) % 4;

                // Read from BGRA and stream out directly as RGBA
                if (channel === 0) {
                    idatData[destIdx++] = (pixel >> 16) & 0xff; // R
                } else if (channel === 1) {
                    idatData[destIdx++] = (pixel >> 8) & 0xff; // G
                } else if (channel === 2) {
                    idatData[destIdx++] = pixel & 0xff; // B
                } else {
                    idatData[destIdx++] = (pixel >> 24) & 0xff; // A
                    srcX++;
                    if (srcX === width) {
                        srcX = 0;
                        srcY++;
                    }
                }
                byteInLine = (byteInLine + 1) % scanlineStride;
            }
        }
        bytesLeft -= blockLen;
    }

    let s1: number = 1,
        s2: number = 0;
    srcY = 0;
    srcX = 0;
    byteInLine = 0;
    for (let i = 0; i < uncompressedDataSize; i++) {
        let b: number = 0;
        if (byteInLine === 0) {
            byteInLine++;
        } else {
            const pixel: number = srcPixels[srcY * width + srcX]!;
            const channel: number = (byteInLine - 1) % 4;
            if (channel === 0) b = (pixel >> 16) & 0xff;
            else if (channel === 1) b = (pixel >> 8) & 0xff;
            else if (channel === 2) b = pixel & 0xff;
            else {
                b = (pixel >> 24) & 0xff;
                srcX++;
                if (srcX === width) {
                    srcX = 0;
                    srcY++;
                }
            }
            byteInLine = (byteInLine + 1) % scanlineStride;
        }
        s1 = (s1 + b) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    new DataView(idatData.buffer).setUint32(idatPayloadSize - 4, (s2 << 16) | s1, false);

    const idatChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk("IDAT", idatData);
    const iendChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk("IEND", new Uint8Array(0));

    const finalBuffer: Buffer<ArrayBuffer> = Buffer.alloc(pngSignature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
    let offset: number = 0;
    finalBuffer.set(pngSignature, offset);
    offset += pngSignature.length;
    finalBuffer.set(ihdrChunk, offset);
    offset += ihdrChunk.length;
    finalBuffer.set(idatChunk, offset);
    offset += idatChunk.length;
    finalBuffer.set(iendChunk, offset);
    offset += iendChunk.length;

    return finalBuffer;
}

// CRC-32 Table helper for compliance
const convertNativeImageToPng_crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
    let c: number = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    convertNativeImageToPng_crcTable[n] = c;
}

function convertNativeImageToPng_createChunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    chunk[4] = type.charCodeAt(0);
    chunk[5] = type.charCodeAt(1);
    chunk[6] = type.charCodeAt(2);
    chunk[7] = type.charCodeAt(3);
    chunk.set(data, 8);
    let crc = -1;
    for (let i = 4; i < chunk.length - 4; i++) crc = convertNativeImageToPng_crcTable[(crc ^ chunk[i]!) & 0xff]! ^ (crc >>> 8);
    view.setUint32(chunk.length - 4, ~crc, false);
    return chunk;
}

/**
 * Converts a {@link NativeImage} to a zlib-compressed PNG buffer.
 *
 * @param nativeImg The {@link NativeImage} to convert.
 * @returns A promise resolving with the zlib-compressed PNG buffer.
 */
export async function convertNativeImageToPngZlibAsync(nativeImg: NativeImage): Promise<Buffer<ArrayBuffer>> {
    const zlib = require("node:zlib") as typeof import("node:zlib");
    const size = nativeImg.getSize();
    const width: number = size.width;
    const height: number = size.height;

    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdrData = new Uint8Array(13);
    const ihdrView = new DataView(ihdrData.buffer);
    ihdrView.setUint32(0, width, false);
    ihdrView.setUint32(4, height, false);
    ihdrData[8] = 8; // 8 bits per channel
    ihdrData[9] = 6; // Color type 6 (RGBA)
    ihdrData[10] = 0; // Compression (0 = deflate)
    ihdrData[11] = 0; // Filter (0 = adaptive)
    ihdrData[12] = 0; // No interlace
    const ihdrChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk("IHDR", ihdrData);

    const scanlineStride = width * 4 + 1;
    const uncompressedData = new Uint8Array(scanlineStride * height);

    const rawBuffer: Buffer = nativeImg.toBitmap();
    const srcPixels = new Uint32Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength / 4);

    let srcIdx = 0;
    let destIdx = 0;

    for (let y = 0; y < height; y++) {
        uncompressedData[destIdx++] = 0; // Filter method: None for this scanline row

        for (let x = 0; x < width; x++) {
            const pixel: number = srcPixels[srcIdx++]!;

            // Fast bit-swizzle from BGRA raw memory mapping straight to RGBA output stream
            uncompressedData[destIdx++] = (pixel >> 16) & 0xff; // R
            uncompressedData[destIdx++] = (pixel >> 8) & 0xff; // G
            uncompressedData[destIdx++] = pixel & 0xff; // B
            uncompressedData[destIdx++] = (pixel >> 24) & 0xff; // A
        }
    }

    const bytesPerRow: number = width * 4 + 1;
    const dynamicWindowBits: number = Math.max(9, Math.min(15, Math.ceil(Math.log2(bytesPerRow * 2))));

    // const t1 = performance.now();
    const compressedData: Buffer = await new Promise(
        (resolve: (value: Buffer) => void, reject: (reason: Error | null) => void): void =>
            void zlib.deflate(
                uncompressedData,
                {
                    level: 6,
                    windowBits: dynamicWindowBits,
                    memLevel: 8,
                    strategy: zlib.constants.Z_DEFAULT_STRATEGY,
                },
                (err: Error | null, result: Buffer): void => void (err === null ? resolve(result) : reject(err))
            )
    );
    // const t2 = performance.now();
    // console.log(`ZLIB compression took ${t2 - t1} ms`);
    const idatChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk(
        "IDAT",
        new Uint8Array(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength)
    );
    const iendChunk: Uint8Array<ArrayBuffer> = convertNativeImageToPng_createChunk("IEND", new Uint8Array(0));

    const finalBuffer: Buffer<ArrayBuffer> = Buffer.alloc(pngSignature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
    let offset: number = 0;
    finalBuffer.set(pngSignature, offset);
    offset += pngSignature.length;
    finalBuffer.set(ihdrChunk, offset);
    offset += ihdrChunk.length;
    finalBuffer.set(idatChunk, offset);
    offset += idatChunk.length;
    finalBuffer.set(iendChunk, offset);
    offset += iendChunk.length;

    return finalBuffer;
}

/**
 * Converts a PNG buffer to an ICO buffer.
 *
 * @param pngBuffer The PNG buffer.
 * @returns The ICO buffer.
 */
export function pngToIco(pngBuffer: Buffer<ArrayBufferLike>): Buffer<ArrayBuffer> {
    const pngSize: number = pngBuffer.length;

    const header: Buffer<ArrayBuffer> = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);

    const entry: Buffer<ArrayBuffer> = Buffer.alloc(16);
    entry.writeUInt8(0, 0);
    entry.writeUInt8(0, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngSize, 8);
    entry.writeUInt32LE(6 + 16, 12);

    return Buffer.concat([header, entry, pngBuffer]);
}

/**
 * Blends the foreground over the background.
 *
 * @param fr Foreground red.
 * @param fg  Foreground green.
 * @param fb Foreground blue.
 * @param fa Foreground alpha.
 * @param br Background red.
 * @param bg Background green.
 * @param bb Background blue.
 * @returns The blended pixel.
 */
export function blendPixelOverBackground(
    fr: number,
    fg: number,
    fb: number,
    fa: number,
    br: number,
    bg: number,
    bb: number
): [r: number, g: number, b: number, a: number] {
    const A = fa / 255;

    const r = fr * A + br * (1 - A);
    const g = fg * A + bg * (1 - A);
    const b = fb * A + bb * (1 - A);

    return [r, g, b, 255];
}
