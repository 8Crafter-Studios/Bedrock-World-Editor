import { BrowserWindow, ipcMain, ipcRenderer, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";

ipcMain.on("window-eval", (event: IpcMainEvent, script: string): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = eval(script);
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-progress-bar", (event: IpcMainEvent, progress: number, options?: Electron.ProgressBarOptions): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setProgressBar(progress, options);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("center-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.center();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-document-is-edited", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isDocumentEdited();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-document-is-edited", (event: IpcMainEvent, isEdited: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setDocumentEdited(isEdited);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-movable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMovable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-movable", (event: IpcMainEvent, isMovable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setMovable(isMovable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-always-on-top", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isAlwaysOnTop();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-always-on-top", (event: IpcMainEvent, isAlwaysOnTop: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setAlwaysOnTop(isAlwaysOnTop);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-app-details", (event: IpcMainEvent, options: Electron.AppDetailsOptions): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setAppDetails(options);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-aspect-ratio", (event: IpcMainEvent, aspectRatio: number, extraSize?: Electron.Size): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setAspectRatio(aspectRatio, extraSize);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-auto-hide-cursor", (event: IpcMainEvent, autoHide: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setAutoHideCursor(autoHide);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-menu-bar-is-visible", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMenuBarVisible();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-menu-bar-is-visible", (event: IpcMainEvent, visible: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setMenuBarVisibility(visible);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-auto-hide-menu-bar", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMenuBarAutoHide();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-auto-hide-menu-bar", (event: IpcMainEvent, hide: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setAutoHideMenuBar(hide);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-background-color", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getBackgroundColor();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-background-color", (event: IpcMainEvent, backgroundColor: string): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setBackgroundColor(backgroundColor);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-background-material", (event: IpcMainEvent, material: Parameters<BrowserWindow["setBackgroundMaterial"]>[0]): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setBackgroundMaterial(material);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-bounds", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getBounds();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-bounds", (event: IpcMainEvent, bounds: Partial<Electron.Rectangle>, animate?: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setBounds(bounds, animate);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-taskbar-overlay-icon", (event: IpcMainEvent, overlay: Electron.NativeImage | null, description: string): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setOverlayIcon(overlay, description);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-title-bar-overlay", (event: IpcMainEvent, options: Electron.TitleBarOverlayOptions): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setTitleBarOverlay(options);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-ignore-mouse-events", (event: IpcMainEvent, ignore: boolean, options?: Electron.IgnoreMouseEventsOptions): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setIgnoreMouseEvents(ignore, options);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-kiosk", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isKiosk();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-kiosk", (event: IpcMainEvent, flag: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setKiosk(flag);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-position", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getPosition();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-position", (event: IpcMainEvent, x: number, y: number, animate?: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setPosition(x, y, animate);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-button-position", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getWindowButtonPosition();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-button-position", (event: IpcMainEvent, position: Electron.Point | null): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setWindowButtonPosition(position);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-button-visibility", (event: IpcMainEvent, visible: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setWindowButtonVisibility(visible);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-resizable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isResizable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-resizable", (event: IpcMainEvent, resizable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setResizable(resizable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-size", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getSize();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-size", (event: IpcMainEvent, width: number, height: number, animate?: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setSize(width, height, animate);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-content-size", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getContentSize();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-content-size", (event: IpcMainEvent, width: number, height: number, animate?: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setContentSize(width, height, animate);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-skip-taskbar", (event: IpcMainEvent, skip: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setSkipTaskbar(skip);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-thumbar-buttons", (event: IpcMainEvent, buttons: Electron.ThumbarButton[]): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setThumbarButtons(buttons);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-title", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.getTitle();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-title", (event: IpcMainEvent, title: string): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setTitle(title);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-vibrancy", (event: IpcMainEvent, type: Parameters<BrowserWindow["setVibrancy"]>[0], options?: Electron.VibrancyOptions): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setVibrancy(type, options);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-minimized", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMinimized();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("minimize-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.minimize();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-maximized", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMaximized();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("maximize-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.maximize();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("restore-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.restore();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("reload-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.reload();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("unmaximize-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.unmaximize();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-focusable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isFocusable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-focusable", (event: IpcMainEvent, isFocusable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setFocusable(isFocusable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-focused", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isFocused();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("focus-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.focus();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("flash-window", (event: IpcMainEvent, flashStatus: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.flashFrame(flashStatus);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("hide-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.hide();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("show-window", (event: IpcMainEvent, inactive: boolean = false): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow[inactive ? "showInactive" : "show"]();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("close-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.close();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("destroy-window", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.destroy();
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-closable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isClosable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-closable", (event: IpcMainEvent, closable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setClosable(closable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-minimizable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMinimizable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-minimizable", (event: IpcMainEvent, minimizable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setMinimizable(minimizable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-maximizable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isMaximizable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-maximizable", (event: IpcMainEvent, maximizable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setMaximizable(maximizable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-full-screenable", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isFullScreenable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-full-screenable", (event: IpcMainEvent, fullscreenable: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setFullScreenable(fullscreenable);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-is-full-screen", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.isFullScreenable();
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("set-window-is-full-screen", (event: IpcMainEvent, flag: boolean): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        sourceWindow.setFullScreen(flag);
        event.returnValue = void true;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-window-id", (event: IpcMainEvent): void => {
    const sourceWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender)!;
    try {
        event.returnValue = sourceWindow.id;
    } catch (error) {
        console.error(error);
        event.returnValue = void false;
    }
});

ipcMain.on("get-is-404-response", async (event: IpcMainEvent, uri: string): Promise<void> => {
    try {
        const response = await fetch(uri);
        event.returnValue = response.status === 404;
    } catch (e) {
        event.returnValue = true;
    }
});

ipcMain.handle("get-is-404-response", async (event: IpcMainInvokeEvent, uri: string): Promise<boolean> => {
    try {
        const response = await fetch(uri);
        return response.status === 404;
    } catch (e) {
        return true;
    }
});

declare global {
    namespace Electron {
        interface IpcRenderer {
            sendSync<_T extends 1>(channel: "window-eval", script: string): any;
            sendSync<_T extends 1>(channel: "set-progress-bar", progress: number, options?: Electron.ProgressBarOptions): void;
            sendSync<_T extends 1>(channel: "center-window"): void;
            sendSync<_T extends 1>(channel: "get-document-is-edited"): boolean;
            sendSync<_T extends 1>(channel: "set-document-is-edited", isEdited: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-movable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-movable", isMovable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-always-on-top"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-always-on-top", isAlwaysOnTop: boolean): void;
            sendSync<_T extends 1>(channel: "set-app-details", options: Electron.AppDetailsOptions): void;
            sendSync<_T extends 1>(channel: "set-aspect-ratio", aspectRatio: number, extraSize?: Electron.Size): void;
            sendSync<_T extends 1>(channel: "set-auto-hide-cursor", autoHide: boolean): void;
            sendSync<_T extends 1>(channel: "get-menu-bar-is-visible"): boolean;
            sendSync<_T extends 1>(channel: "set-menu-bar-is-visible", visible: boolean): void;
            sendSync<_T extends 1>(channel: "get-auto-hide-menu-bar"): boolean;
            sendSync<_T extends 1>(channel: "set-auto-hide-menu-bar", hide: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-background-color"): string;
            sendSync<_T extends 1>(channel: "set-window-background-color", backgroundColor: string): void;
            sendSync<_T extends 1>(
                channel: "set-window-background-material",
                material: globalThis.Parameters<BrowserWindow["setBackgroundMaterial"]>[0]
            ): string;
            sendSync<_T extends 1>(channel: "get-window-bounds"): Electron.Rectangle;
            sendSync<_T extends 1>(channel: "set-window-bounds", bounds: Partial<Electron.Rectangle>, animate?: boolean): void;
            sendSync<_T extends 1>(channel: "set-window-taskbar-overlay-icon", overlay: Electron.NativeImage | null, description: string): void;
            sendSync<_T extends 1>(channel: "set-window-title-bar-overlay", options: Electron.TitleBarOverlayOptions): void;
            sendSync<_T extends 1>(channel: "set-window-ignore-mouse-events", ignore: boolean, options?: Electron.IgnoreMouseEventsOptions): void;
            sendSync<_T extends 1>(channel: "get-window-is-kiosk"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-kiosk", flag: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-position"): number[];
            sendSync<_T extends 1>(channel: "set-window-position", x: number, y: number, animate?: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-button-position"): Electron.Point | null;
            sendSync<_T extends 1>(channel: "set-window-button-position", position: Electron.Point | null): void;
            sendSync<_T extends 1>(channel: "set-window-button-visibility", visible: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-resizable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-resizable", resizable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-size"): number[];
            sendSync<_T extends 1>(channel: "set-window-size", width: number, height: number, animate?: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-content-size"): number[];
            sendSync<_T extends 1>(channel: "set-window-content-size", width: number, height: number, animate?: boolean): void;
            sendSync<_T extends 1>(channel: "set-window-skip-taskbar", skip: boolean): number;
            sendSync<_T extends 1>(channel: "set-thumbar-buttons", buttons: Electron.ThumbarButton[]): number;
            sendSync<_T extends 1>(channel: "get-window-title"): string;
            sendSync<_T extends 1>(channel: "set-window-title", title: string): void;
            sendSync<_T extends 1>(
                channel: "set-window-vibrancy",
                type: globalThis.Parameters<BrowserWindow["setVibrancy"]>[0],
                options?: Electron.VibrancyOptions
            ): string;
            sendSync<_T extends 1>(channel: "get-window-is-minimized"): boolean;
            sendSync<_T extends 1>(channel: "minimize-window"): void;
            sendSync<_T extends 1>(channel: "restore-window"): void;
            sendSync<_T extends 1>(channel: "get-window-is-maximized"): boolean;
            sendSync<_T extends 1>(channel: "maximize-window"): void;
            sendSync<_T extends 1>(channel: "unmaximize-window"): void;
            sendSync<_T extends 1>(channel: "reload-window"): void;
            sendSync<_T extends 1>(channel: "get-window-is-focusable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-focusable", isFocusable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-focused"): boolean;
            sendSync<_T extends 1>(channel: "focus-window"): void;
            sendSync<_T extends 1>(channel: "flash-window", flashStatus: boolean): void;
            sendSync<_T extends 1>(channel: "hide-window"): void;
            sendSync<_T extends 1>(channel: "show-window", inactive?: boolean): void;
            sendSync<_T extends 1>(channel: "close-window"): void;
            sendSync<_T extends 1>(channel: "destroy-window"): void;
            sendSync<_T extends 1>(channel: "get-window-is-closable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-closable", closable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-maximizable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-maximizable", maximizable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-minimizable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-minimizable", minimizable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-full-screenable"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-full-screenable", fullscreenable: boolean): void;
            sendSync<_T extends 1>(channel: "get-window-is-full-screen"): boolean;
            sendSync<_T extends 1>(channel: "set-window-is-full-screen", flag: boolean): void;
            sendSync<_T extends 1>(channel: "create-window"): void;
            sendSync<_T extends 1>(channel: "open-about-window", parentWindowID?: number): number;
            sendSync<_T extends 1>(channel: "get-is-404-response", uri: string): boolean;
            invoke<_T extends 1>(channel: "get-is-404-response", uri: string): Promise<boolean>;
        }
    }
}
