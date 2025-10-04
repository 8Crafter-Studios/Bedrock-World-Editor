export function sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*]/g, "");
}

import { Buffer } from "buffer";

// Characters forbidden in filenames on Windows/macOS/Linux
const INVALID_FILENAME_CHARS = /[/\\:*?"<>|\x00-\x1F]/g;

// Escape prefix for encoded characters
const ESCAPE_PREFIX = "%"; // e.g., %3A for ':'

function escapeFilename(str: string): string {
    return str.replace(INVALID_FILENAME_CHARS, (char) => {
        return ESCAPE_PREFIX + char.charCodeAt(0).toString(16).padStart(2, "0");
    });
}

function unescapeFilename(str: string): string {
    return str.replace(new RegExp(`${ESCAPE_PREFIX}([0-9a-fA-F]{2})`, "g"), (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });
}

export function bufferToSafeFilename(buf: Buffer): string {
    const base64url = buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return escapeFilename(base64url);
}

export function safeFilenameToBuffer(filename: string): Buffer {
    const unescaped = unescapeFilename(filename);
    const base64 = unescaped.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return Buffer.from(padded, "base64");
}
