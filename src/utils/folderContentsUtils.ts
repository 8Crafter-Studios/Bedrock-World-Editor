import { Dirent, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import "../libs/zip.js";

/**
 * Recursively add the contents of the zip folder to a destination folder.
 *
 * @param {zip.ZipDirectoryEntry} directoryEntry The zip directory entry to extract the contents from.
 * @param {string} basePath The base path to extract the contents to.
 * @param {string} destinationFolder The subfolder of the zip and base path to extract the contents from and to respectively.
 * @returns {Promise<void>} A promise that resolves when the contents are extracted.
 */
export async function addFolderContentsReversed(
    directoryEntry: zip.ZipDirectoryEntry,
    basePath: string,
    destinationFolder: string = "",
    onItemAddCallback?: (item: zip.ZipFileEntry<any, any>) => void
): Promise<void> {
    const folderContents: zip.ZipEntry[] = directoryEntry.children;
    for (const item of folderContents) {
        try {
            mkdirSync(path.resolve(basePath, destinationFolder), { recursive: true });
        } catch {}
        if (item instanceof zip.fs.ZipFileEntry) {
            writeFileSync(path.resolve(basePath, destinationFolder, item.name), new Uint8Array(await (await item.getBlob()).arrayBuffer()));
            onItemAddCallback?.(item);
        } else if (item instanceof zip.fs.ZipDirectoryEntry) {
            await addFolderContentsReversed(item, basePath, path.join(destinationFolder, item.name), onItemAddCallback);
        }
    }
}

/**
 * Adds the contents of a folder to the zip file system.
 *
 * @param directoryEntry The zip directory entry.
 * @param basePath The base path.
 * @param folder The folder.
 */
export function addFolderContents(directoryEntry: zip.ZipDirectoryEntry, basePath: string, folder: string = ""): void {
    const folderContents: Dirent<string>[] = readdirSync(path.join(basePath, folder), { withFileTypes: true });
    for (const item of folderContents) {
        if (item.isFile()) {
            directoryEntry.addBlob(item.name, new Blob([readFileSync(path.resolve(basePath, folder, item.name))]));
        } else if (item.isDirectory()) {
            addFolderContents(directoryEntry.addDirectory(item.name), basePath, path.join(folder, item.name));
        }
    }
}
