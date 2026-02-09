import { nativeImage } from "@electron/remote";
import type { NativeImage } from "electron";

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
