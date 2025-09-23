/**
 * The nineslice data of an image.
 */
export interface NinesliceData {
    /**
     * The nineslice size.
     */
    nineslice_size: [
        /**
         * The distance on the left.
         */
        left: number,
        /**
         * The distance on the top.
         */
        top: number,
        /**
         * The distance on the right.
         */
        right: number,
        /**
         * The distance on the bottom.
         */
        bottom: number
    ];
    /**
     * The base size.
     */
    base_size: [
        /**
         * The base width of the image.
         */
        width: number,
        /**
         * The base height of the image.
         */
        height: number
    ];
}

export class Nineslice {
    public static resize(imageData: ImageData, newWidth: number, newHeight: number): ImageData {
        const oldWidth: number = imageData.width;
        const oldHeight: number = imageData.height;
        const oldPixelArray: Uint8ClampedArray = imageData.data;
        const newPixelArray: Uint8ClampedArray = new Uint8ClampedArray(newWidth * newHeight * 4);
        for (let y: number = 0; y < newHeight; y++) {
            for (let x: number = 0; x < newWidth; x++) {
                const oldX: number = Math.floor((x * oldWidth) / newWidth);
                const oldY: number = Math.floor((y * oldHeight) / newHeight);
                const oldIdx: number = (oldY * oldWidth + oldX) * 4;
                const newIdx: number = (y * newWidth + x) * 4;
                newPixelArray[newIdx] = oldPixelArray[oldIdx]!;
                newPixelArray[newIdx + 1] = oldPixelArray[oldIdx + 1]!;
                newPixelArray[newIdx + 2] = oldPixelArray[oldIdx + 2]!;
                newPixelArray[newIdx + 3] = oldPixelArray[oldIdx + 3]!;
            }
        }
        return new ImageData(newPixelArray, newWidth, newHeight);
    }
    public static ninesliceResize(
        { nineslice_size, base_size }: NinesliceData,
        pixelArray: Uint8ClampedArray<ArrayBufferLike>,
        newWidth: number,
        newHeight: number
    ): Uint8ClampedArray<ArrayBuffer> {
        const [left, top, right, bottom] = nineslice_size;
        const [baseWidth, baseHeight] = base_size;

        const output: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(newWidth * newHeight * 4);

        function getPixel(x: number, y: number): [r: number, g: number, b: number, a: number] {
            x = Math.max(0, Math.min(baseWidth - 1, x));
            y = Math.max(0, Math.min(baseHeight - 1, y));
            const idx: number = (y * baseWidth + x) * 4;
            return [pixelArray[idx] ?? 0, pixelArray[idx + 1] ?? 0, pixelArray[idx + 2] ?? 0, pixelArray[idx + 3] ?? 255];
        }

        function setPixel(x: number, y: number, rgba: [r: number, g: number, b: number, a: number]): void {
            if (x < 0 || y < 0 || x >= newWidth || y >= newHeight) return;
            const idx: number = (y * newWidth + x) * 4;
            for (let i: number = 0; i < 4; i++) {
                output[idx + i] = rgba[i]!;
            }
        }

        function stretch(srcX: number, srcY: number, srcW: number, srcH: number, destX: number, destY: number, destW: number, destH: number): void {
            for (let y: number = 0; y < destH; y++) {
                const sampleY: number = srcH === 1 ? srcY : srcY + Math.floor((y * srcH) / destH);
                for (let x: number = 0; x < destW; x++) {
                    const sampleX: number = srcW === 1 ? srcX : srcX + Math.floor((x * srcW) / destW);

                    const pixel: [r: number, g: number, b: number, a: number] = getPixel(sampleX, sampleY);

                    setPixel(destX + x, destY + y, pixel);
                }
            }
        }

        // Calculate middle region sizes
        const midSrcW: number = baseWidth - left - right;
        const midSrcH: number = baseHeight - top - bottom;
        const midDestW: number = newWidth - left - right;
        const midDestH: number = newHeight - top - bottom;

        // Top-left corner
        stretch(0, 0, left, top, 0, 0, left, top);
        // Top-middle edge
        stretch(left, 0, midSrcW, top, left, 0, midDestW, top);
        // Top-right corner
        stretch(baseWidth - right, 0, right, top, newWidth - right, 0, right, top);

        // Middle-left edge
        stretch(0, top, left, midSrcH, 0, top, left, midDestH);
        // Center
        stretch(left, top, midSrcW, midSrcH, left, top, midDestW, midDestH);
        // Middle-right edge
        stretch(baseWidth - right, top, right, midSrcH, newWidth - right, top, right, midDestH);

        // Bottom-left corner
        stretch(0, baseHeight - bottom, left, bottom, 0, newHeight - bottom, left, bottom);
        // Bottom-middle edge
        stretch(left, baseHeight - bottom, midSrcW, bottom, left, newHeight - bottom, midDestW, bottom);
        // Bottom-right corner
        stretch(baseWidth - right, baseHeight - bottom, right, bottom, newWidth - right, newHeight - bottom, right, bottom);

        return output;
    }
}
