import { nativeImage } from "@electron/remote";
import type { NativeImage } from "electron";

/**
 * Pads a {@link NativeImage} to a square.
 *
 * @param nativeImg The {@link NativeImage} to pad.
 * @returns The padded {@link NativeImage}.
 */
export async function padNativeImageToSquare(nativeImg: NativeImage): Promise<Electron.NativeImage> {
    const png: Buffer<ArrayBufferLike> = nativeImg.toPNG();
    const base64: string = png.toString("base64");

    const img = new Image();
    img.src = "data:image/png;base64," + base64;

    await img.decode();

    const size: number = Math.max(img.width, img.height);
    const canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);

    const x: number = (size - img.width) / 2;
    const y: number = (size - img.height) / 2;
    ctx.drawImage(img, x, y);

    const paddedBase64: string = canvas.toDataURL("image/png");
    return nativeImage.createFromDataURL(paddedBase64);
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
