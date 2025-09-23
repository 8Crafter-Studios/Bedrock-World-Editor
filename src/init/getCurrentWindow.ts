import { BrowserWindow } from "@electron/remote";

globalThis.electron = require("electron");
globalThis.ipcRenderer = globalThis.electron.ipcRenderer;
globalThis.getCurrentWindow = function getCurrentWindow(): Electron.BrowserWindow {
    return BrowserWindow.fromId(ipcRenderer.sendSync("get-window-id"))!;
};

declare global {
    namespace globalThis {
        var electron: typeof import("electron");
        var ipcRenderer: typeof import("electron").ipcRenderer;
        function getCurrentWindow(): Electron.BrowserWindow;
    }
}
