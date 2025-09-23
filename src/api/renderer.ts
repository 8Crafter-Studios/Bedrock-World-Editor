import type { IpcRendererEvent } from "electron";
const { ipcRenderer } = require("electron") as typeof import("electron");
import { dialog } from "@electron/remote";

ipcRenderer.on("console-action", function <
    T extends Exclude<keyof Console, "Console">
>(_event: IpcRendererEvent, action: T, ...args: Parameters<Console[T]>): void {
    console[action](...(args as []));
});

ipcRenderer.on("open-file", async function (_event: IpcRendererEvent, path: string): Promise<void> {
    getCurrentWindow().focus();
    switch (true) {
        default:
            dialog.showMessageBox({
                type: "warning",
                title: "Feature Not Implemented",
                message: `Unable to open the file at ${path}.`,
                detail: "The ability to open this type of file has not been implemented yet.",
                buttons: ["OK"],
                noLink: true,
            });
    }
});

ipcRenderer.on("open-world-folder", async function (_event: IpcRendererEvent, path: string): Promise<void> {
    getCurrentWindow().focus();
    switch (true) {
        default:
            dialog.showMessageBox({
                type: "warning",
                title: "Feature Not Implemented",
                message: `Unable to open the folder at ${path}.`,
                detail: "The ability to open this type of folder has not been implemented yet.",
                buttons: ["OK"],
                noLink: true,
            });
    }
});

ipcRenderer.on("open-leveldb-folder", async function (_event: IpcRendererEvent, path: string): Promise<void> {
    getCurrentWindow().focus();
    switch (true) {
        default:
            dialog.showMessageBox({
                type: "warning",
                title: "Feature Not Implemented",
                message: `Unable to open the folder at ${path}.`,
                detail: "The ability to open this type of folder has not been implemented yet.",
                buttons: ["OK"],
                noLink: true,
            });
    }
});

declare global {
    namespace Electron {
        interface WebContents {
            send<_T extends 1, T extends Exclude<keyof Console, "Console">>(
                channel: "console-action",
                action: T,
                ...args: globalThis.Parameters<Console[T]>
            ): void;
            send<_T extends 1>(channel: "open-file", path: string): void;
            send<_T extends 1>(channel: "open-world-folder", path: string): void;
            send<_T extends 1>(channel: "open-leveldb-folder", path: string): void;
        }
    }
}
