import { /* BrowserWindow, */ getCurrentWindow } from "@electron/remote";

globalThis.electron = require("electron") as typeof import("electron");
globalThis.ipcRenderer = globalThis.electron.ipcRenderer;
// globalThis.getCurrentWindow = function getCurrentWindow(): Electron.BrowserWindow {
//     return BrowserWindow.fromId(ipcRenderer.sendSync("get-window-id"))!;
// };
// This is faster than the custom getCurrentWindow function above (it takes about 26 ms for 50 runs as opposed to about 36 ms).
globalThis.getCurrentWindow = getCurrentWindow;

declare global {
    namespace globalThis {
        var electron: typeof import("electron");
        var ipcRenderer: typeof import("electron").ipcRenderer;
        function getCurrentWindow(): Electron.BrowserWindow;
    }
}
