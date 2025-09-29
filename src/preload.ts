// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import "./init/sleep.ts";
import "./init/JSONB.ts";
import "./init/getCurrentWindow.ts";
import "./init/SoundEffects.ts";
import "./init/TabManager.ts";
import "./utils/ProgressBar.ts";
import "./utils/config.ts";
import "./utils/version.ts";
import { app, autoUpdater, dialog, Menu, nativeTheme, shell } from "@electron/remote";
import { APP_DATA_FOLDER_PATH } from "./utils/URLs.ts";
/* import { Titlebar } from "custom-electron-titlebar";

window.addEventListener('DOMContentLoaded', () => {
  // Title bar implementation
  new Titlebar({
    icon: "resource://icon.png",
  });
}); */

export function onThemeChange(value: typeof config.theme): void {
    switch (value) {
        default:
        case "auto":
            nativeTheme.themeSource = "system";
            break;
        case "dark":
            nativeTheme.themeSource = "dark";
            break;
        case "light":
        case "blue":
            nativeTheme.themeSource = "light";
            break;
    }

    changeTheme(config.actualTheme);
}

function changeTheme(theme: typeof config.actualTheme): void {
    forEachRuleCallback((rule: CSSStyleDeclaration, _ruleName: string, _styleSheet: CSSStyleSheet): void => {
        if (
            rule?.cssText?.match(
                /(?<=(?:[\n\s;{]|^)---theme-var-switcher--[a-zA-Z0-9\-_]+[\n\s]*:[\n\s]*var\([\n\s]*--[a-zA-Z0-9\-_]*)(?:light|dark|blue-theme)(?=[a-zA-Z0-9\-_]*[\n\s]*\)[\n\s]*;?)/
            )
        ) {
            rule.cssText = rule.cssText.replaceAll(
                /(?<=(?:[\n\s;{]|^)---theme-var-switcher--[a-zA-Z0-9\-_]+[\n\s]*:[\n\s]*var\([\n\s]*--[a-zA-Z0-9\-_]*)(?:light|dark|blue-theme)(?=[a-zA-Z0-9\-_]*[\n\s]*\)[\n\s]*;?)/g,
                theme === "blue" ? "blue-theme" : theme
            );
        }
    });
    document.querySelector(":root")?.classList.remove("dark_theme", "light_theme", "blue_theme");
    document.querySelector(":root")?.classList.add(`${theme}_theme`);
}

/**
 * Executes a callback for each style rule.
 *
 * @param {(rule: CSSStyleDeclaration, ruleName: string, styleSheet: CSSStyleSheet)=>any} callbackfn The callback function.
 * @returns {null} Returns `null`.
 */
function forEachRuleCallback(callbackfn: (rule: CSSStyleDeclaration, ruleName: string, styleSheet: CSSStyleSheet) => any): null {
    for (var i: number = 0; i < document.styleSheets.length; i++) {
        var ix,
            sheet: CSSStyleSheet = document.styleSheets[i]!;
        for (ix = 0; ix < sheet.cssRules.length; ix++) {
            const rule: CSSStyleRule | CSSRule = sheet.cssRules[ix] as CSSStyleRule | CSSRule;
            if (!rule || !("style" in rule)) continue;
            callbackfn(rule.style, rule.selectorText, sheet);
        }
    }
    return null;
}

config.on("settingChanged:theme", onThemeChange);

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (nativeTheme.themeSource !== "system") return;
    onThemeChange(config.theme);
});

window.addEventListener("DOMContentLoaded", () => {
    onThemeChange(config.theme);
});

const currentWindow: Electron.BrowserWindow = getCurrentWindow();

const fileMenu: Electron.Menu = Menu.buildFromTemplate([
    {
        label: "New Window",
        accelerator: "Ctrl+N",
        click(): void {
            ipcRenderer.send("new-window");
        },
    },
    { type: "separator" },
    {
        type: "submenu",
        label: "Open",
        toolTip: "Open a file or folder.",
        enabled: false,
        submenu: [
            {
                label: "NBT File",
                toolTip: "Open NBT files.",
                async click(): Promise<void> {
                    currentWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        buttonLabel: "Open",
                        filters: [
                            { name: "Config", extensions: ["nbt", "mcstructure", "schem", "schematic", "bin", "snbt", "hex", "dat"] },
                            { name: "All", extensions: ["*"] },
                        ],
                        message: "Select NBT files to open",
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open NBT Files",
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-file", path);
                    });
                },
            },
            {
                label: "JSON File",
                toolTip: "Open JSON files.",
                async click(): Promise<void> {
                    currentWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        buttonLabel: "Open",
                        filters: [
                            { name: "Config", extensions: ["json", "jsonc"] },
                            { name: "All", extensions: ["*"] },
                        ],
                        message: "Select NBT files to open",
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open NBT Files",
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-file", path);
                    });
                },
            },
            {
                label: "World Folder",
                toolTip: "Open world folders.",
                async click(): Promise<void> {
                    currentWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        buttonLabel: "Open",
                        message: "Select world folders to open",
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open World Folders",
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-world-folder", path);
                    });
                },
            },
            {
                label: "LevelDB Folder",
                toolTip: "Open LevelDB folders.",
                async click(): Promise<void> {
                    currentWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        buttonLabel: "Open",
                        message: "Select LevelDB folders to open",
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open LevelDB Folders",
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-leveldb-folder", path);
                    });
                },
            },
        ],
    },
    { type: "separator" },
    {
        label: "Preferences",
        click(): void {
            $("#app-tab-preferences").show();
        },
    },
    { type: "separator" },
    { role: "quit" },
]);
const menu = Menu.buildFromTemplate([
    {
        role: "fileMenu",
        submenu: fileMenu,
        type: "submenu",
        label: "File",
        enabled: true,
        visible: true,
    },
    { role: "editMenu" },
    {
        role: "viewMenu",
        submenu: [
            { role: "reload" },
            { role: "forceReload" },
            { role: "toggleDevTools" },
            {
                role: "toggleDevTools",
                accelerator: "F12",
                visible: false,
                acceleratorWorksWhenHidden: true,
            },
            { type: "separator" },
            { role: "resetZoom" },
            { role: "zoomIn" },
            { role: "zoomOut" },
            { type: "separator" },
            { role: "togglefullscreen" },
        ],
    },
    { role: "windowMenu", submenu: [{ role: "minimize", accelerator: "" }, { role: "zoom" }, { role: "close", accelerator: "" }] },
    {
        role: "help",
        type: "submenu",
        submenu: [
            {
                label: "Open App Data Folder",
                click(): void {
                    shell.openPath(APP_DATA_FOLDER_PATH);
                },
            },
            {
                type: "separator",
            },
            {
                label: "Website",
                click(): void {
                    shell.openExternal("https://wiki.8crafter.com/main/apps/bedrock-world-editor");
                },
            },
            {
                label: "GitHub",
                click(): void {
                    shell.openExternal("https://github.com/8Crafter-Studios/Bedrock-World-Editor");
                },
            },
            {
                label: "Check for Updates...",
                click(): void {
                    autoUpdater.checkForUpdates();
                },
            } /* 
                    {
                        label: "Check for Customizer Updates...",
                        async click(_menuItem: Electron.MenuItem, baseWindow: Electron.BaseWindow | undefined): Promise<void> {
                            const isLatestVersion: boolean | undefined = await checkIfCurrentOreUICustomizerVersionIsLatest();
                            if (isLatestVersion === undefined) {
                                dialog.showMessageBox({
                                    type: "error",
                                    title: "Error",
                                    message: "There was an error checking for updates, check your internet connection and try again.",
                                    buttons: ["Okay"],
                                    noLink: true,
                                });
                            } else if (isLatestVersion) {
                                const currentVersion: APIVersionJSON | undefined = getCurrentOreUICustomizerVersion();
                                dialog
                                    .showMessageBox({
                                        type: "info",
                                        title: "No Ore UI Customizer Updates Available",
                                        message: `The latest version of the Ore UI Customizer is already downloaded.\nVersion: ${currentVersion?.version}`,
                                        buttons: ["Okay", "Force Redownload"],
                                        noLink: true,
                                        cancelId: 0,
                                        defaultId: 0,
                                    })
                                    .then((result: MessageBoxReturnValue): void => {
                                        if (result.response === 1) {
                                            updateLocalAPICopy(baseWindow ? BrowserWindow.fromId(baseWindow.id!) ?? undefined : undefined);
                                            return;
                                        } else {
                                            return;
                                        }
                                    });
                            } else {
                                const latestVersion: APIVersionJSON | undefined = await getLatestOreUICustomizerVersion();
                                if (latestVersion === undefined) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "There was an error checking for updates, check your internet connection and try again.",
                                        buttons: ["Okay"],
                                        noLink: true,
                                    });
                                } else {
                                    const currentVersion: APIVersionJSON | undefined = getCurrentOreUICustomizerVersion();
                                    dialog
                                        .showMessageBox({
                                            type: "info",
                                            title: "Ore UI Customizer Update Available",
                                            message: `A new version of the Ore UI Customizer is available.\nVersion: ${latestVersion.version}\nCurrent Version: ${currentVersion?.version}\n\nWould you like to download it now?`,
                                            buttons: ["Download", "Cancel"],
                                            noLink: true,
                                            cancelId: 1,
                                            defaultId: 0,
                                        })
                                        .then((result: MessageBoxReturnValue): void => {
                                            if (result.response === 0) {
                                                updateLocalAPICopy(baseWindow ? BrowserWindow.fromId(baseWindow.id!) ?? undefined : undefined);
                                                return;
                                            } else {
                                                return;
                                            }
                                        });
                                }
                            }
                        },
                    }, */,
            {
                label: "Changelogs",
                enabled: false,
                click(): void {
                    dialog.showMessageBox({
                        type: "error",
                        title: "Function Not Implemented",
                        message: "This feature is not implemented yet.",
                        buttons: ["Okay"],
                        noLink: true,
                    });
                },
            },
            {
                label: "Next Debug HUD",
                accelerator: "F3",
                visible: false,
                acceleratorWorksWhenHidden: true,
                click(): void {
                    config.debugHUD = config.constants.debugOverlayModeList.at(
                        (config.constants.debugOverlayModeList.indexOf(config.debugHUD) + 1) % config.constants.debugOverlayModeList.length
                    );
                },
            },
            {
                label: "Previous Debug HUD",
                accelerator: "F4",
                visible: false,
                acceleratorWorksWhenHidden: true,
                click(): void {
                    config.debugHUD = config.constants.debugOverlayModeList.at(
                        (config.constants.debugOverlayModeList.indexOf(config.debugHUD) - 1) % config.constants.debugOverlayModeList.length
                    );
                },
            },
            {
                type: "separator",
            },
            {
                label: "About",
                accelerator: "CmdOrCtrl+F1",
                click(): void {
                    ipcRenderer.sendSync<1>("open-about-window", currentWindow.id);
                },
            },
        ],
    },
]);
currentWindow.setMenu(menu);

if (process.platform === "darwin") {
    const currentWindow: Electron.BrowserWindow = getCurrentWindow();
    if (currentWindow.isFocused()) {
        Menu.setApplicationMenu(menu);
    }
    currentWindow.on("focus", (): void => {
        Menu.setApplicationMenu(menu);
    });
}

globalThis.currentMenu = menu;

declare global {
    namespace globalThis {
        var currentMenu: Electron.Menu;
    }
}

