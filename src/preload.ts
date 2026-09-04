// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import "./utils/version.ts";
import "./init/sleep.ts";
import "./init/JSONB.ts";
import "./init/getCurrentWindow.ts";
import "./utils/config.ts";
import "./init/Locale.ts";
import "./init/SoundEffects.ts";
import "./init/TabManager.ts";
import "./utils/ProgressBar.ts";
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
 * @param callbackfn The callback function.
 * @returns Returns `null`.
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
        label: translate`menu_bar.file.new_window.label`,
        accelerator: "CmdOrCtrl+N",
        click(): void {
            ipcRenderer.send("new-window");
        },
    },
    { type: "separator" },
    {
        type: "submenu",
        label: translate`menu_bar.file.open.label`,
        toolTip: translate`menu_bar.file.open.tooltip`,
        submenu: [
            {
                label: translate`menu_bar.file.open.world_folder.label`,
                toolTip: translate`menu_bar.file.open.world_folder.tooltip`,
                async click(): Promise<void> {
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the world folders in.
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        // IDEA: Implement functionality to remember the folder that the last opened world folder was located in to default to that folder.
                        buttonLabel: translate`dialog.open.menu_bar.file.open.world_folder.button_label`,
                        message: translate`dialog.open.menu_bar.file.open.world_folder.message`,
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: translate`dialog.open.menu_bar.file.open.world_folder.title`,
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((folderPath: string): void => {
                        currentWindow.webContents.send<1>("open-world-folder", folderPath, undefined /* TEMP */);
                    });
                },
            },
            {
                label: translate`menu_bar.file.open.leveldb_folder.label`,
                toolTip: translate`menu_bar.file.open.leveldb_folder.tooltip`,
                async click(): Promise<void> {
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the LevelDB folders in.
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        // IDEA: Implement functionality to remember the folder that the last opened LevelDB folder was located in to default to that folder.
                        buttonLabel: translate`dialog.open.menu_bar.file.open.leveldb_folder.button_label`,
                        message: translate`dialog.open.menu_bar.file.open.leveldb_folder.message`,
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: translate`dialog.open.menu_bar.file.open.leveldb_folder.title`,
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-leveldb-folder", path);
                    });
                },
            },
            {
                label: translate`menu_bar.file.open.nbt_file.label`,
                toolTip: translate`menu_bar.file.open.nbt_file.tooltip`,
                async click(): Promise<void> {
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the NBT files in.
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        // IDEA: Implement functionality to remember the folder that the last opened NBT file was located in to default to that folder.
                        buttonLabel: translate`dialog.open.menu_bar.file.open.nbt_file.button_label`,
                        filters: [
                            { name: "NBT", extensions: ["nbt", "mcstructure", "schem", "schematic", "bin", "snbt", "hex", "dat"] },
                            { name: "All", extensions: ["*"] },
                        ],
                        message: translate`dialog.open.menu_bar.file.open.nbt_file.message`,
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: translate`dialog.open.menu_bar.file.open.nbt_file.title`,
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-file", path, "nbt");
                    });
                },
            },
            {
                label: translate`menu_bar.file.open.json_file.label`,
                toolTip: translate`menu_bar.file.open.json_file.tooltip`,
                async click(): Promise<void> {
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the JSON files in.
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        // IDEA: Implement functionality to remember the folder that the last opened JSON file was located in to default to that folder.
                        buttonLabel: translate`dialog.open.menu_bar.file.open.json_file.button_label`,
                        filters: [
                            { name: "JSON", extensions: ["json", "jsonc"] }, // TODO: Add JSONL support.
                            { name: "All", extensions: ["*"] },
                        ],
                        message: translate`dialog.open.menu_bar.file.open.json_file.message`,
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: translate`dialog.open.menu_bar.file.open.json_file.title`,
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-file", path, "json");
                    });
                },
            },
            {
                label: translate`menu_bar.file.open.raw_file.label`,
                toolTip: translate`menu_bar.file.open.raw_file.tooltip`,
                async click(): Promise<void> {
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the binary files in.
                    const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(currentWindow, {
                        // IDEA: Implement functionality to remember the folder that the last opened binary file was located in to default to that folder.
                        buttonLabel: translate`dialog.open.menu_bar.file.open.raw_file.button_label`,
                        filters: [{ name: "All", extensions: ["*"] }],
                        message: translate`dialog.open.menu_bar.file.open.raw_file.message`,
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: translate`dialog.open.menu_bar.file.open.raw_file.title`,
                    });
                    if (result.canceled) return;
                    const configPaths: string[] = result.filePaths;
                    configPaths.forEach((path: string): void => {
                        currentWindow.webContents.send<1>("open-file", path, "binary");
                    });
                },
            },
        ],
    },
    // TODO: Implement this for Windows.
    ...(process.platform === "darwin" ?
        ([
            {
                label: translate`menu_bar.file.open_recent.label`,
                role: "recentDocuments",
                submenu: [
                    {
                        label: translate`menu_bar.file.open_recent.clear_recent.label`,
                        role: "clearRecentDocuments",
                    },
                ],
            },
        ] satisfies Electron.MenuItemConstructorOptions[])
    :   []),
    { type: "separator" },
    {
        label: translate`menu_bar.file.preferences.label`,
        click(): void {
            tabManager.switchTab("settings");
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
                label: translate`menu_bar.help.open_app_data_folder.label`,
                click(): void {
                    shell.openPath(APP_DATA_FOLDER_PATH);
                },
            },
            {
                type: "separator",
            },
            {
                label: translate`menu_bar.help.website.label`,
                click(): void {
                    shell.openExternal("https://wiki.8crafter.com/main/apps/bedrock-world-editor");
                },
            },
            {
                label: translate`menu_bar.help.github.label`,
                click(): void {
                    shell.openExternal("https://github.com/8Crafter-Studios/Bedrock-World-Editor");
                },
            },
            {
                label: translate`menu_bar.help.discord.label`,
                click(): void {
                    shell.openExternal("https://discord.8crafter.com");
                },
            },
            {
                // TODO: This should be disabled on unsupported operating systems.
                label: translate`menu_bar.help.check_for_updates.label`,
                async click(): Promise<void> {
                    try {
                        // const pkg = require("../package.json");
                        // const os = require("node:os");
                        // const userAgent = require("node:util").format('%s/%s (%s: %s)', pkg.name, pkg.version, os.platform(), os.arch());
                        const feedURL = `https://update.electronjs.org/8Crafter-Studios/Bedrock-World-Editor/${process.platform}-${process.arch}/${app.getVersion()}`;
                        const feedInfo: Response = await fetch(feedURL);
                        if (feedInfo.status === 204) {
                            dialog.showMessageBox({
                                type: "info",
                                title: "Up to Date",
                                message: "Bedrock World Editor is up to date.",
                                buttons: ["OK"],
                                noLink: true,
                            });
                        } else if (feedInfo.status !== 200) {
                            dialog.showMessageBox({
                                type: "error",
                                title: "Error Checking for Updates",
                                message: `There was an error checking for updates. Status Code: ${feedInfo.status}`,
                                detail: feedInfo.statusText,
                                buttons: ["OK"],
                                noLink: true,
                            });
                            return;
                        }
                        const releaseInfo: {
                            name: string;
                            // TODO: Figure out if this actually could be a null type or not, or whether it is just not present.
                            notes?: string | null;
                            url: string;
                        } = await feedInfo.json();
                        let trimmedChangelog: string | undefined =
                            releaseInfo.notes ? releaseInfo.notes.split("\n").slice(0, 10).join("\n").slice(0, 2000) : undefined;
                        if (trimmedChangelog) {
                            if (trimmedChangelog !== releaseInfo.notes) {
                                trimmedChangelog += "\n...";
                            }
                        }
                        const updateConfirmationResult: Electron.MessageBoxReturnValue = await dialog.showMessageBox({
                            type: "info",
                            title: "Update Available",
                            message: `A new version of Bedrock World Editor is available.\n\nCurrent Version: ${app.getVersion().replace(/^(?!v)/, "v")}\nLatest Version: ${
                                releaseInfo.name
                            }`,
                            detail: trimmedChangelog ? `Release Notes:\n${trimmedChangelog}` : undefined!,
                            buttons: ["Install", "Cancel"],
                            noLink: true,
                            cancelId: 1,
                            defaultId: 0,
                        });
                        if (updateConfirmationResult.response === 1) return;
                        autoUpdater.setFeedURL({
                            url: feedURL,
                        });
                        function notifyOfUpdateReady(): void {
                            autoUpdater.off("update-downloaded", notifyOfUpdateReady);
                            dialog
                                .showMessageBox({
                                    type: "info",
                                    title: "Application Update",
                                    message: releaseInfo.name,
                                    detail: "A new version has been downloaded. Restart the application to apply the updates.",
                                    buttons: ["Restart", "Later"],
                                    noLink: true,
                                })
                                .then(({ response }: Electron.MessageBoxReturnValue): void => {
                                    if (response === 0) {
                                        autoUpdater.quitAndInstall();
                                    }
                                });
                        }
                        autoUpdater.on("update-downloaded", notifyOfUpdateReady);
                        autoUpdater.checkForUpdates();
                    } catch (e) {
                        dialog.showMessageBox({
                            type: "error",
                            title: "Error Checking for Updates",
                            message: "There was an error checking for updates.",
                            detail: e instanceof Error ? (e.stack ?? e.toString()) : String(e),
                            buttons: ["OK"],
                            noLink: true,
                        });
                        return;
                    }
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
                label: translate`menu_bar.help.changelogs.label`,
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
                label: translate`menu_bar.help.next_debug_hud.label`,
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
                label: translate`menu_bar.help.previous_debug_hud.label`,
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
                label: translate`menu_bar.help.about.label`,
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
} else {
    // Prevents ALT from focusing/unfocusing the menu bar.
    window.addEventListener("keydown", (e: KeyboardEvent): void => {
        if (e.altKey) e.preventDefault();
    });
}

globalThis.currentMenu = menu;

declare global {
    namespace globalThis {
        var currentMenu: Electron.Menu;
    }
}
