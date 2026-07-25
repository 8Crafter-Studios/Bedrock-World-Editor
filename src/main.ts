import { isSecondInstance } from "./preMain.ts";
import {
    app,
    /* autoUpdater,  */ BrowserWindow,
    dialog,
    ipcMain,
    Menu,
    nativeTheme,
    net,
    protocol,
    shell,
    type ApplicationInfoForProtocolReturnValue,
    type IpcMainEvent,
    type MessageBoxReturnValue,
    type OpenDialogReturnValue,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import "./init/sleep.ts";
import "./init/JSONB.ts";
import { initialize as initializeRemote, enable as enableRemoteForWebContents } from "@electron/remote/main";
import isDev from "electron-is-dev";
import { ProgId, Regedit, ShellOption } from "electron-regedit-fixed";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
// import "./utils/ProgressBar.ts";
import "./utils/version.ts";
import "./utils/config.ts";
import "./init/Locale.ts";
import "./api/main.ts";
import { APP_DATA_FOLDER_PATH } from "./utils/URLs.ts";
import { updateElectronApp } from "update-electron-app";
import CommentJSON from "comment-json";
import { Octokit } from "@octokit/rest";
import semver from "semver";
const mime = require("mime-types") as typeof import("mime-types");
// import { setupTitlebar, attachTitlebarToWindow } from "custom-electron-titlebar/main";
const openAboutWindow_function = require("about-window").default as typeof import("about-window").default;
function openAboutWindow(parentWindow?: BrowserWindow): BrowserWindow {
    return openAboutWindow_function({
        icon_path:
            isDev ?
                path.join(__dirname, "../../resources/icon.png")
            :   path.join(process.resourcesPath, "resources/icon.png") /* path.join(__dirname, (isDev ? "../../" : "") + "resources/icon.png"), */,
        product_name: "Bedrock World Editor",
        copyright: "Copyright (c) 2025-2026 8Crafter Studios",
        adjust_window_size: true,
        use_version_info: [
            ["app", app.getVersion() + (VERSION_BUILD !== null ? `+${VERSION_BUILD}` : "") + (isDev ? "*" : "")],
            ["mcbe-leveldb", VERSION_MCBE_LEVELDB],
            ["@8crafter/leveldb-zlib", VERSION_LEVELDB_ZLIB],
            // ["Minecraft", "v1.21.101"],
            ...(["electron", "chrome", "node", "v8"] as const).map((e) => [e, process.versions[e]]),
        ] as [string, string][],
        package_json_dir: path.join(__dirname, isDev ? "../../" : ""),
        bug_report_url: "https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues",
        homepage: "https://wiki.8crafter.com/main/apps/bedrock-world-editor",
        win_options: {
            parent: parentWindow!,
        },
    });
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string | undefined;

// Verify that the data folders exist.
if (!existsSync(APP_DATA_FOLDER_PATH)) {
    mkdirSync(APP_DATA_FOLDER_PATH, { recursive: true });
}
if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "mounted_volumes"))) {
    mkdirSync(path.join(APP_DATA_FOLDER_PATH, "mounted_volumes"), { recursive: true });
}

const mainWindowIDs: number[] = [];

let startup: boolean = false;

if (!isDev) {
    // Register protocol handler for custom URL scheme
    app.setAsDefaultProtocolClient("bedrock-world-editor");
}

if (process.platform === "win32") {
    app.setAppUserModelId("com.8crafter.bedrock-world-editor");

    //#region Windows Registry

    // var squirrelCommand: string | undefined = process.argv[1];
    // if (squirrelCommand === "--squirrel-install" || squirrelCommand === "--squirrel-updated") {
    //     writeFileSync(path.join(app.getPath("userData"), "INSTALL_FILE_TYPE_ASSOCIATIONS_ON_STARTUP"), "");
    // } else {
    //     function getProgIds(): ProgId[] {
    //         return [
    //             new ProgId({
    //                 description: "Ore UI Customizer Plugin",
    //                 appName: "OreUICustomizer.ouicplugin",
    //                 friendlyAppName: "Ore UI Customizer",
    //                 icon: path.join(__dirname, (isDev ? "../../" : "../../../") + "resources/icon.ico"),
    //                 extensions: ["mcouicplugin", "ouicplugin"],
    //                 squirrel: true,
    //                 contentType: "application/ouicplugin",
    //                 perceivedType: "application",
    //                 setDefault: true,
    //                 shell: [
    //                     new ShellOption({
    //                         verb: ShellOption.OPEN,
    //                         action: "Open",
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.PREVIEW,
    //                         args: ["--preview", "%1"],
    //                     }),
    //                 ],
    //             }),
    //             new ProgId({
    //                 description: "Ore UI Customizer Theme",
    //                 appName: "OreUICustomizer.ouictheme",
    //                 friendlyAppName: "Ore UI Customizer",
    //                 icon: path.join(__dirname, (isDev ? "../../" : "../../../") + "resources/icon.ico"),
    //                 extensions: ["mcouictheme", "ouictheme"],
    //                 squirrel: true,
    //                 contentType: "application/ouictheme",
    //                 perceivedType: "application",
    //                 setDefault: true,
    //                 shell: [
    //                     new ShellOption({
    //                         verb: ShellOption.OPEN,
    //                         action: "Open",
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.EDIT,
    //                         args: ["--edit", "%1"],
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.PREVIEW,
    //                         args: ["--preview", "%1"],
    //                     }),
    //                 ],
    //             }),
    //             new ProgId({
    //                 description: "Ore UI Customizer Config",
    //                 appName: "OreUICustomizer.ouicconfig",
    //                 friendlyAppName: "Ore UI Customizer",
    //                 icon: path.join(__dirname, (isDev ? "../../" : "../../../") + "resources/icon.ico"),
    //                 extensions: ["mcouicconfig", "ouicconfig"],
    //                 squirrel: true,
    //                 contentType: "application/ouicconfig",
    //                 perceivedType: "application",
    //                 setDefault: true,
    //                 shell: [
    //                     new ShellOption({
    //                         verb: ShellOption.OPEN,
    //                         action: "Open",
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.EDIT,
    //                         args: ["--edit", "%1"],
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.PREVIEW,
    //                         args: ["--preview", "%1"],
    //                     }),
    //                 ],
    //             }),
    //             new ProgId({
    //                 description: "Ore UI Customizer Add-On",
    //                 appName: "OreUICustomizer.ouicaddon",
    //                 friendlyAppName: "Ore UI Customizer",
    //                 icon: path.join(__dirname, (isDev ? "../../" : "../../../") + "resources/icon.ico"),
    //                 extensions: ["mcouicaddon", "ouicaddon"],
    //                 squirrel: true,
    //                 contentType: "application/ouicaddon",
    //                 perceivedType: "application",
    //                 setDefault: true,
    //                 shell: [
    //                     new ShellOption({
    //                         verb: ShellOption.OPEN,
    //                         action: "Open",
    //                     }),
    //                     new ShellOption({
    //                         verb: ShellOption.PREVIEW,
    //                         args: ["--preview", "%1"],
    //                     }),
    //                 ],
    //             }),
    //         ];
    //     }
    //     const dateISOString: string = new Date().toISOString().replaceAll(":", "_");
    //     /* const logToInstallFile: Console["log"] = (...data: any[]): void => {
    //         appendFileSync(path.join(APP_DATA_FOLDER_PATH, `INSTALL_${dateISOString}.LOG`), `[${new Date().toISOString()}] [LOG] ${data.join(" ")}\n`);
    //     }; */
    //     switch (squirrelCommand) {
    //         /* case "--squirrel-install":
    //         case "--squirrel-updated":
    //             logToInstallFile("Installing...");
    //             console.log("Squirrel install/update");
    //             (async function SquirreInstallOrUpdate_RegisterProgIds(): Promise<void> {
    //                 mkdirSync(APP_DATA_FOLDER_PATH, { recursive: true });
    //                 console.log(2);
    //                 console.log(progIds);
    //                 logToInstallFile("Preparing to install progIds...");
    //                 for (const progId of progIds) {
    //                     try {
    //                         logToInstallFile("Installing " + progId.appName + "...");
    //                         console.log(
    //                             3,
    //                             JSON.stringify({
    //                                 ...progId,
    //                                 shell: progId.shell.map((shell: Omit<ShellOption, "progId">) =>
    //                                     Object.fromEntries(Object.entries(shell).filter(([key]) => key !== "progid"))
    //                                 ),
    //                             })
    //                         );
    //                         logToInstallFile(5);
    //                         await progId.install();
    //                         logToInstallFile(6);
    //                         console.log(6);
    //                         appendFileSync(
    //                             path.join(APP_DATA_FOLDER_PATH, `INSTALL_SUCCESSES_${dateISOString}.LOG`),
    //                             `[${new Date().toISOString()}] [LOG] ${JSON.stringify({
    //                                 ...progId,
    //                                 shell: progId.shell.map((shell: Omit<ShellOption, "progId">) =>
    //                                     Object.fromEntries(Object.entries(shell).filter(([key]) => key !== "progid"))
    //                                 ),
    //                             })}\n`
    //                         );
    //                         console.log(1);
    //                         logToInstallFile("Installed " + progId.appName + ".");
    //                     } catch (e: any) {
    //                         console.log(4);
    //                         appendFileSync(
    //                             path.join(APP_DATA_FOLDER_PATH, `INSTALL_ERRORS_${dateISOString}.LOG`),
    //                             `[${new Date().toISOString()}] [ERROR] ${e}${e?.stack}\n${process.argv[1]}\n${process.env.NODE_ENV}\n`
    //                         );
    //                     }
    //                 }
    //                 logToInstallFile("Finished installing progIds.");
    //                 app.quit();
    //             })();
    //             logToInstallFile("After install progIds function.");
    //             startup = true;
    //             break; */
    //         case "--squirrel-uninstall":
    //             console.log("Squirrel uninstall");
    //             (async function SquirrelUninstall_UnregisterProgIds(): Promise<void> {
    //                 mkdirSync(APP_DATA_FOLDER_PATH, { recursive: true });
    //                 const progIds: ProgId[] = getProgIds();
    //                 for (const progId of progIds) {
    //                     try {
    //                         await progId.uninstall();
    //                     } catch (e: any) {
    //                         appendFileSync(
    //                             path.join(APP_DATA_FOLDER_PATH, `UNINSTALL_ERRORS_${dateISOString}.LOG`),
    //                             `[${new Date().toISOString()}] [ERROR] ${e}${e?.stack}\n${process.argv[1]}\n${process.env.NODE_ENV}\n`
    //                         );
    //                     }
    //                 }
    //                 app.quit();
    //             })();
    //             startup = true;
    //             break;
    //         case "--squirrel-obsolete":
    //             console.log("Squirrel obsolete");
    //             startup = true;
    //             app.quit();
    //             break;
    //         default:
    //             if (process.env.NODE_ENV !== "development" && existsSync(path.join(app.getPath("userData"), "INSTALL_FILE_TYPE_ASSOCIATIONS_ON_STARTUP"))) {
    //                 const progIds: ProgId[] = getProgIds();
    //                 Regedit.installAll()
    //                     .then((): void => {
    //                         rmSync(path.join(app.getPath("userData"), "INSTALL_FILE_TYPE_ASSOCIATIONS_ON_STARTUP"), { recursive: true, force: true });
    //                     })
    //                     .catch((e: any): void => {
    //                         appendFileSync(
    //                             path.join(APP_DATA_FOLDER_PATH, `UNINSTALL_ERRORS_${dateISOString}.LOG`),
    //                             `[${new Date().toISOString()}] [ERROR] ${e}${e?.stack}\n${process.argv[1]}\n${process.env.NODE_ENV}\n`
    //                         );
    //                     });
    //             }
    //     }
    // }

    //#endregion Window Registry

    // appendFileSync(path.join(APP_DATA_FOLDER_PATH, "test.txt"), "\n" + process.argv[1] + "\n" + process.env.NODE_ENV);

    /* if (Regedit.squirrelStartupEvent()) {
        startup = true;
    } */
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
    app.quit();
}

if (!isSecondInstance && (process.platform === "win32" || process.platform === "darwin")) {
    if (!config.shownDialogs.includes("allow_automatic_updates")) {
        app.whenReady().then((): void => {
            const result: number = dialog.showMessageBoxSync({
                type: "question",
                title: "Enable Automatic Updates?",
                message: "Would you like to enable automatic updates?",
                detail: "The app will only check for updates while it is open, it does not install any background processes.",
                buttons: ["Enable", "Disable", "Cancel"],
                noLink: true,
                defaultId: 0,
                cancelId: 2,
            });
            if (result === 2) return;
            config.shownDialogs.push("allow_automatic_updates");
            config.autoUpdateEnabled = result === 0;
            if (config.autoUpdateEnabled) {
                // TODO: Add an option to allow changing the update check interval.
                updateElectronApp();
            }
        });
    } else if (config.autoUpdateEnabled) {
        // TODO: Add an option to allow changing the update check interval.
        updateElectronApp();
    }
}

if (!startup) {
    initializeRemote();

    // setupTitlebar();

    /* function handleWindowOpen(details: Electron.HandlerDetails, mainWindow: Electron.BrowserWindow): Electron.WindowOpenHandlerResponse {
    return {
        action: "allow",
        createWindow: (options: BrowserWindowConstructorOptions) => {
            const browserWindow = new BrowserWindow(options);
            browserWindow.webContents.setWindowOpenHandler(()=>handleWindowOpen(details, browserWindow));
            mainWindow.emit("did-create-window", browserWindow);
            mainWindow.on("did-create-window")
            return browserWindow.webContents;
        },
    };
} */

    protocol.registerSchemesAsPrivileged([
        {
            scheme: "bedrock-world-editor",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "resource",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "resource-image",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "module",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "node",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "script",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
        {
            scheme: "com.8crafter",
            privileges: { bypassCSP: true, secure: true, standard: true, supportFetchAPI: true },
        },
    ]);
}

let webContentsStartedLoading: boolean = false;

let webContentsLoaded: boolean = false;

const onWebContentsLoadedCallbacks: (() => void)[] = [];

/**
 * Creates the main window for the app.
 *
 * @returns The ID of the created window, or `undefined` if the window was not createReadStream.
 */
export function createWindow(): number | void {
    if (isSecondInstance) return;
    if (isDev) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        title: "Bedrock World Editor",
        icon: path.join(__dirname, (isDev ? "../../" : "") + "resources/icon.png"),
        // accentColor: "#00c066",
        // backgroundColor: "#00FFFF",
        // titleBarStyle: "hidden",
        // titleBarOverlay: {symbolColor: "#00FF88"},
        // titleBarOverlay: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: false,
            nodeIntegration: true,
            webSecurity: !isDev,
            allowRunningInsecureContent: false,
            // webSecurity: false,
            nodeIntegrationInWorker: true,
        },
        resizable: true,
        darkTheme: nativeTheme.shouldUseDarkColorsForSystemIntegratedUI,
    });
    mainWindow.webContents.on("will-navigate", (e, url) => {
        if (url.endsWith(".wasm")) {
            console.log(url);
            const request = net.request(url);
            request.on("response", (res) => {
                if (res.headers["content-type"] !== "application/wasm") {
                    res.headers["content-type"] = "application/wasm";
                }
            });
            request.end();
        }
    });

    mainWindow.webContents.on(
        "render-process-gone",
        (): Promise<void> =>
            dialog
                .showMessageBox(mainWindow, {
                    type: "error",
                    title: "Crashed",
                    message: "This window has crashed. Would you like to restart it?",
                    detail: "Any worlds that were open in this window have their modified copies stuck in the application's temp folder and will need to be removed manually.",
                    buttons: ["Restart", "Close"],
                    noLink: true,
                    defaultId: 0,
                    cancelId: 1,
                })
                .then((result: MessageBoxReturnValue): void => {
                    if (result.response === 0) {
                        mainWindow.reload();
                    } else {
                        mainWindow.close();
                    }
                })
    );

    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    // mainWindow.webContents.setWindowOpenHandler((details)=>handleWindowOpen(details, mainWindow));
    enableRemoteForWebContents(mainWindow.webContents);
    // console.log(Menu.getApplicationMenu());

    // const fileMenu: Menu = Menu.buildFromTemplate([
    //     {
    //         label: "New Window",
    //         accelerator: "Ctrl+N",
    //         click(): void {
    //             createWindow();
    //         },
    //     },
    //     { type: "separator" },
    //     {
    //         type: "submenu",
    //         label: "Import",
    //         toolTip: "Import files.",
    //         submenu: [
    //             {
    //                 label: "Config",
    //                 toolTip: "Configs are presets of Ore UI Customizer settings.",
    //                 async click(): Promise<void> {
    //                     mainWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
    //                     const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow, {
    //                         buttonLabel: "Import",
    //                         filters: [{ name: "Config", extensions: ["mcouicconfig", "ouicconfig", "json", "jsonc", "jsonl", "jsonld"] }],
    //                         message: "Select config files to import",
    //                         properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
    //                         title: "Import Configs",
    //                     });
    //                     if (result.canceled) return;
    //                     const configPaths: string[] = result.filePaths;
    //                     configPaths.forEach((configPath: string): void => {
    //                         mainWindow.webContents.send<1>("import-from-file", configPath, "config");
    //                     });
    //                 },
    //             },
    //             {
    //                 label: "Plugin",
    //                 toolTip: "Plugins change the behavior of the Ore UI.",
    //                 async click(): Promise<void> {
    //                     mainWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
    //                     const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow, {
    //                         buttonLabel: "Import",
    //                         filters: [
    //                             { name: "Plugin", extensions: ["mcouicplugin", "ouicplugin"] },
    //                             { name: "Single-File Plugin", extensions: ["cjs", "mjs", "js"] },
    //                         ],
    //                         message: "Select plugin files to import",
    //                         properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
    //                         title: "Import Plugins",
    //                     });
    //                     if (result.canceled) return;
    //                     const pluginPaths: string[] = result.filePaths;
    //                     pluginPaths.forEach((pluginPath: string): void => {
    //                         mainWindow.webContents.send<1>("import-from-file", pluginPath, "plugin");
    //                     });
    //                 },
    //             },
    //             {
    //                 label: "Theme",
    //                 toolTip: "Themes change the appearance of the Ore UI.",
    //                 async click(): Promise<void> {
    //                     mainWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
    //                     const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow, {
    //                         buttonLabel: "Import",
    //                         filters: [
    //                             { name: "Theme", extensions: ["mcouictheme", "ouictheme"] },
    //                             { name: "Single-File Theme", extensions: ["json", "jsonc", "jsonl", "jsonld"] },
    //                         ],
    //                         message: "Select theme files to import",
    //                         properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
    //                         title: "Import Themes",
    //                     });
    //                     if (result.canceled) return;
    //                     const themePaths: string[] = result.filePaths;
    //                     themePaths.forEach((themePath: string): void => {
    //                         mainWindow.webContents.send<1>("import-from-file", themePath, "theme");
    //                     });
    //                 },
    //             },
    //             {
    //                 label: "Add-On",
    //                 toolTip:
    //                     "Add-Ons just renamed .zip files with some configs, plugins, and themes in them. They are used to import multiple configs, plugins, and themes at once.",
    //                 async click(): Promise<void> {
    //                     mainWindow.webContents.executeJavaScript("try { SoundEffects.popB(); } catch {}");
    //                     const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow, {
    //                         buttonLabel: "Import",
    //                         filters: [{ name: "Add-On", extensions: ["mcouicaddon", "ouicaddon"] }],
    //                         message: "Select add-on files to import",
    //                         properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
    //                         title: "Import Add-Ons",
    //                     });
    //                     if (result.canceled) return;
    //                     const addonPaths: string[] = result.filePaths;
    //                     addonPaths.forEach((addonPath: string): void => {
    //                         mainWindow.webContents.send<1>("import-from-file", addonPath, "add-on");
    //                     });
    //                 },
    //             },
    //         ],
    //     },
    //     { type: "separator" },
    //     {
    //         label: "Preferences",
    //         click(): void {
    //             mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Preferences);
    //         },
    //     },
    //     { type: "separator" },
    //     { role: "quit" },
    // ]);
    // const menu = Menu.buildFromTemplate([
    //     {
    //         role: "fileMenu",
    //         submenu: fileMenu,
    //         type: "submenu",
    //         label: "File",
    //         enabled: true,
    //         visible: true,
    //     },
    //     { role: "editMenu" },
    //     { role: "viewMenu" },
    //     {
    //         label: "Go",
    //         submenu: [
    //             {
    //                 label: "Back",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", "go-back");
    //                 },
    //             },
    //             {
    //                 label: "Forward",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", "go-forward");
    //                 },
    //             },
    //             {
    //                 type: "separator",
    //             },
    //             {
    //                 label: "Home",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Home);
    //                 },
    //             },
    //             {
    //                 label: "Versions",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Installations);
    //                 },
    //             },
    //             {
    //                 label: "Plugins",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Plugins);
    //                 },
    //             },
    //             {
    //                 label: "Themes",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Themes);
    //                 },
    //             },
    //             {
    //                 label: "Configs",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Configs);
    //                 },
    //             },
    //             {
    //                 label: "Marketplace",
    //                 click(): void {
    //                     mainWindow.webContents.send<1>("go-menu-action", CustomizerAppPage.Marketplace);
    //                 },
    //             },
    //         ],
    //     },
    //     { role: "windowMenu" },
    //     {
    //         role: "help",
    //         type: "submenu",
    //         submenu: [
    //             {
    //                 label: "Ore UI Customizer Website",
    //                 click(): void {
    //                     shell.openExternal("https://www.8crafter.com/utilities/bedrock-world-editor");
    //                 },
    //             },
    //             {
    //                 label: "Check for App Updates...",
    //                 click(): void {
    //                     autoUpdater.checkForUpdates();
    //                 },
    //             } /*
    //             {
    //                 label: "Check for Customizer Updates...",
    //                 async click(_menuItem: Electron.MenuItem, baseWindow: Electron.BaseWindow | undefined): Promise<void> {
    //                     const isLatestVersion: boolean | undefined = await checkIfCurrentOreUICustomizerVersionIsLatest();
    //                     if (isLatestVersion === undefined) {
    //                         dialog.showMessageBox({
    //                             type: "error",
    //                             title: "Error",
    //                             message: "There was an error checking for updates, check your internet connection and try again.",
    //                             buttons: ["Okay"],
    //                             noLink: true,
    //                         });
    //                     } else if (isLatestVersion) {
    //                         const currentVersion: APIVersionJSON | undefined = getCurrentOreUICustomizerVersion();
    //                         dialog
    //                             .showMessageBox({
    //                                 type: "info",
    //                                 title: "No Ore UI Customizer Updates Available",
    //                                 message: `The latest version of the Ore UI Customizer is already downloaded.\nVersion: ${currentVersion?.version}`,
    //                                 buttons: ["Okay", "Force Redownload"],
    //                                 noLink: true,
    //                                 cancelId: 0,
    //                                 defaultId: 0,
    //                             })
    //                             .then((result: MessageBoxReturnValue): void => {
    //                                 if (result.response === 1) {
    //                                     updateLocalAPICopy(baseWindow ? BrowserWindow.fromId(baseWindow.id!) ?? undefined : undefined);
    //                                     return;
    //                                 } else {
    //                                     return;
    //                                 }
    //                             });
    //                     } else {
    //                         const latestVersion: APIVersionJSON | undefined = await getLatestOreUICustomizerVersion();
    //                         if (latestVersion === undefined) {
    //                             dialog.showMessageBox({
    //                                 type: "error",
    //                                 title: "Error",
    //                                 message: "There was an error checking for updates, check your internet connection and try again.",
    //                                 buttons: ["Okay"],
    //                                 noLink: true,
    //                             });
    //                         } else {
    //                             const currentVersion: APIVersionJSON | undefined = getCurrentOreUICustomizerVersion();
    //                             dialog
    //                                 .showMessageBox({
    //                                     type: "info",
    //                                     title: "Ore UI Customizer Update Available",
    //                                     message: `A new version of the Ore UI Customizer is available.\nVersion: ${latestVersion.version}\nCurrent Version: ${currentVersion?.version}\n\nWould you like to download it now?`,
    //                                     buttons: ["Download", "Cancel"],
    //                                     noLink: true,
    //                                     cancelId: 1,
    //                                     defaultId: 0,
    //                                 })
    //                                 .then((result: MessageBoxReturnValue): void => {
    //                                     if (result.response === 0) {
    //                                         updateLocalAPICopy(baseWindow ? BrowserWindow.fromId(baseWindow.id!) ?? undefined : undefined);
    //                                         return;
    //                                     } else {
    //                                         return;
    //                                     }
    //                                 });
    //                         }
    //                     }
    //                 },
    //             }, */,
    //             {
    //                 label: "App Changelogs",
    //                 click(): void {
    //                     dialog.showMessageBox({
    //                         type: "error",
    //                         title: "Function Not Implemented",
    //                         message: "This feature is not implemented yet.",
    //                         buttons: ["Okay"],
    //                         noLink: true,
    //                     });
    //                 },
    //             },
    //             {
    //                 label: "Customizer Changelogs",
    //                 click(): void {
    //                     dialog.showMessageBox({
    //                         type: "error",
    //                         title: "Function Not Implemented",
    //                         message: "This feature is not implemented yet.",
    //                         buttons: ["Okay"],
    //                         noLink: true,
    //                     });
    //                 },
    //             },
    //             {
    //                 type: "separator",
    //             },
    //             {
    //                 label: "About",
    //                 accelerator: "CmdOrCtrl+F1",
    //                 click(): void {
    //                     openAboutWindow(mainWindow);
    //                 },
    //             },
    //         ],
    //     },
    // ]);
    // mainWindow.setMenu(menu);
    // attachTitlebarToWindow(mainWindow);

    mainWindowIDs.push(mainWindow.id);

    // Open the DevTools.
    if (isDev) mainWindow.webContents.openDevTools();

    if (!webContentsLoaded && !webContentsStartedLoading) {
        webContentsStartedLoading = true;
        mainWindow.webContents.on("dom-ready", (): void => {
            webContentsLoaded = true;
            webContentsStartedLoading = false;
            onWebContentsLoadedCallbacks.forEach((callback: () => void): void => {
                try {
                    callback();
                } catch (e) {
                    console.error(e);
                }
            });
            onWebContentsLoadedCallbacks.length = 0;
        });
    }
    return mainWindow.id;
}

if (!startup && !started) {
    if (
        app.runningUnderARM64Translation &&
        process.platform !== "win32" // TEMP: There is no ARM64 build for windows at the moment. Remove this when one is available.
    ) {
        dialog
            .showMessageBox({
                type: "warning",
                title: "ARM64 Translation",
                message:
                    "You are running the x64 build of this app on an ARM64 machine.\n\nThis is not recommended as it will cause terrible performance, it is highly recommended to download the ARM64 native build of the app.",
                buttons: ["Download", "Ignore"],
                noLink: true,
            })
            .then((result: MessageBoxReturnValue): void => {
                if (result.response === 0) {
                    shell.openExternal("https://github.com/Bedrock-World-Editor/Bedrock-World-Editor/releases");
                }
            });
    }

    ipcMain.on("create-window", (event: IpcMainEvent): void => {
        createWindow();
        event.returnValue = void true;
    });

    ipcMain.on("open-about-window", (event: IpcMainEvent, parentWindowID: number): void => {
        const parentWindow: BrowserWindow | null = BrowserWindow.fromId(parentWindowID);
        event.returnValue = openAboutWindow(parentWindow ?? undefined).id;
    });

    let ready: boolean = false;

    const onReadyCallbacks: (() => void)[] = [];

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on("ready", (): void => {
        protocol.handle("resource", async (request: GlobalRequest): Promise<GlobalResponse> => {
            // console.log(request);
            const url: URL = new URL(request.url);
            // console.log(url);
            /* dialog.showMessageBox({
            type: "info",
            title: "Resource Request",
            message: `A resource request was made for the following URL:\n${url.href}\n${__dirname}`,
            buttons: ["Continue", "Cancel"],
        }); */
            /* BrowserWindow.getAllWindows().forEach((window: BrowserWindow): void => {
            window.webContents.send<1, "log">(
                "console-action",
                "log",
                url,
                "../".repeat(+!isDev + 2) + path.posix.join("resources", url.hostname, url.pathname),
                MAIN_WINDOW_VITE_DEV_SERVER_URL
            );
        }); */
            if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
                /* BrowserWindow.getAllWindows().forEach((window: BrowserWindow): void => {
                window.webContents.send<1, "log">(
                    "console-action",
                    "log",
                    new URL(path.posix.join("resources", url.hostname, url.pathname), MAIN_WINDOW_VITE_DEV_SERVER_URL).toJSON()
                );
            }); */
                // return await fetch(new URL(path.posix.join("resources", url.hostname, url.pathname), MAIN_WINDOW_VITE_DEV_SERVER_URL));
                return new Response(readFileSync(path.join(__dirname, "../../", "resources", url.hostname, url.pathname === "/" ? "" : url.pathname)), {
                    headers: {
                        "Content-Type": mime.lookup(path.join(url.hostname, url.pathname === "/" ? "" : url.pathname)) || "application/octet-stream",
                    },
                });
            } else {
                /* BrowserWindow.getAllWindows().forEach((window: BrowserWindow): void => {
                window.webContents.send<1, "log">("console-action", "log", path.join(__dirname, "../", "resources", url.hostname, url.pathname));
            }); */
                return new Response(readFileSync(path.join(__dirname, "../../../", "resources", url.hostname, url.pathname === "/" ? "" : url.pathname)), {
                    headers: {
                        "Content-Type": mime.lookup(path.join(url.hostname, url.pathname === "/" ? "" : url.pathname)) || "application/octet-stream",
                    },
                });
            }
        });
        protocol.handle("resource-image", async (request: GlobalRequest): Promise<GlobalResponse> => {
            const url: URL = new URL(request.url);
            if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
                let imagePath: string = path
                    .join(__dirname, "../../", "resources", url.hostname, url.pathname === "/" ? "" : url.pathname)
                    .replace(/[/\\]$/, "");
                if (!/\.[a-zA-Z]+$/.test(imagePath)) {
                    for (const extension of [
                        ".tga",
                        ".svg",
                        ".gif",
                        ".apng",
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".jfif",
                        ".pjpeg",
                        ".pjp",
                        ".webp",
                        ".avif",
                        ".bmp",
                        ".ico",
                        ".cur",
                        ".tif",
                        ".tiff",
                    ]) {
                        if (existsSync(imagePath + extension)) {
                            imagePath += extension;
                            break;
                        }
                    }
                }
                try {
                    return new Response(readFileSync(imagePath));
                } catch (e) {
                    console.error(e);
                    if (url.searchParams.get("use_missing_texture") !== "false") {
                        return new Response(readFileSync(path.join(__dirname, "../../", "resources", "mc/textures/misc/missing_texture.png")));
                    }
                    return new Response(`Image not found. ${e}`, { status: 404 });
                }
            } else {
                let imagePath: string = path
                    .join(__dirname, "../../../", "resources", url.hostname, url.pathname === "/" ? "" : url.pathname)
                    .replace(/[/\\]$/, "");
                if (!/\.[a-zA-Z]+$/.test(imagePath)) {
                    for (const extension of [
                        ".tga",
                        ".svg",
                        ".gif",
                        ".apng",
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".jfif",
                        ".pjpeg",
                        ".pjp",
                        ".webp",
                        ".avif",
                        ".bmp",
                        ".ico",
                        ".cur",
                        ".tif",
                        ".tiff",
                    ]) {
                        if (existsSync(imagePath + extension)) {
                            imagePath += extension;
                            break;
                        }
                    }
                }
                try {
                    return new Response(readFileSync(imagePath));
                } catch (e) {
                    console.error(e);
                    if (url.searchParams.get("use_missing_texture") !== "false") {
                        return new Response(readFileSync(path.join(__dirname, "../../../", "resources", "mc/textures/misc/missing_texture.png")));
                    }
                    return new Response(`Image not found. ${e}`, { status: 404 });
                }
            }
        });
        protocol.handle("module", async (request: GlobalRequest): Promise<GlobalResponse> => {
            // console.log(request);
            return new Response(`export default require(${JSON.stringify(request.url.replace(/^module:\/?\/?/, "").replace(/\/$/, ""))});`, {
                headers: {
                    "Content-Type": request.url.endsWith(".wasm") ? "application/wasm" : "application/javascript",
                },
            });
        });
        protocol.handle("node", async (request: GlobalRequest): Promise<GlobalResponse> => {
            // console.log(request);
            return new Response(`export default require(${JSON.stringify(request.url.replace(/^node:\/?\/?/, "").replace(/\/$/, ""))});`, {
                headers: {
                    "Content-Type": request.url.endsWith(".wasm") ? "application/wasm" : "application/javascript",
                },
            });
        });
        protocol.handle("script", async (request: GlobalRequest): Promise<GlobalResponse> => {
            // console.log(request);
            const pathname: string = decodeURIComponent(new URL(request.url).pathname);
            return new Response(readFileSync(pathname), {
                headers: {
                    "Content-Type": request.url.endsWith(".wasm") ? "application/wasm" : "application/javascript",
                },
            });
        });
        protocol.handle("com.8crafter", async (request: GlobalRequest): Promise<GlobalResponse> => {
            // console.log(request);
            const pathname: string = new URL(request.url).pathname;
            return /* new Response( */ await fetch(new URL(pathname, "https://8crafter.com")); /* , {
            headers: {
                "Content-Type": "application/javascript",
            },
        }); */
        });
        createWindow();
        ready = true;
        onReadyCallbacks.forEach((callback: () => void): void => {
            try {
                callback();
            } catch (e) {
                console.error(e);
            }
        });
        onReadyCallbacks.length = 0;
    });

    app.on("activate", (): void => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    function handleURL(url: string): void {
        if (/^bedrock-world-editor:\/{0,2}$/.test(url)) {
            lastFocusedMainWindows.at(-1)?.focus();
            return;
        }
        const parsedURL: URL = new URL(url);
        if (parsedURL.protocol === "bedrock-world-editor:") {
            switch (parsedURL.hostname + (parsedURL.pathname === "/" ? "" : parsedURL.pathname)) {
                case "openFile": {
                    const source: string | null = parsedURL.searchParams.get("path");
                    lastFocusedMainWindows.at(-1)?.webContents.send<1>("open-file", source!, (parsedURL.searchParams.get("type") ?? undefined) as never);
                    break;
                }
                // IDEA: Add support for editing `.mcworld` and `.mctemplate` files, and maybe even selecting a `.mcaddon` file that contains worlds to open all of those worlds at once.
                case "openLevelDBFolder": {
                    const source: string | null = parsedURL.searchParams.get("path");
                    lastFocusedMainWindows.at(-1)?.webContents.send<1>("open-leveldb-folder", source!);
                    break;
                }
                case "openWorldFolder": {
                    const source: string | null = parsedURL.searchParams.get("path");
                    const tabMode: string | null = parsedURL.searchParams.get("tabMode");
                    const isolated: string | null = parsedURL.searchParams.get("isolated");
                    lastFocusedMainWindows.at(-1)?.webContents.send<1>(
                        "open-world-folder",
                        source!,
                        (tabMode as TabManagerTabMode) ?? undefined,
                        isolated === null ? undefined
                        : isolated === "true" || isolated === "" || isolated === "1" ? true
                        : isolated === "false" || isolated === "0" ? false
                        : undefined
                    );
                    break;
                }
                case "about": {
                    openAboutWindow(lastFocusedMainWindows.at(-1));
                    break;
                }
                default: {
                    dialog.showMessageBox({
                        type: "error",
                        title: "Unsupported URI Path",
                        message: `The URI path is not supported.\nURI Path: ${url}`,
                        buttons: ["OK"],
                        noLink: true,
                    });
                }
            }
        }
    }

    app.on("open-url", (_event: Electron.Event, url: string): void => {
        handleURL(url);
    });

    // eslint-disable-next-line prefer-const
    let lastFocusedMainWindows: BrowserWindow[] = [];

    app.on("browser-window-focus", (_event: Electron.Event, window: BrowserWindow): void => {
        if (mainWindowIDs.includes(window.id)) {
            if (lastFocusedMainWindows.includes(window)) lastFocusedMainWindows.splice(lastFocusedMainWindows.indexOf(window), 1);
            lastFocusedMainWindows.push(window);
        }
    });

    // TODO: Update this to have better file type support, like how it was done with the URIs.
    function handleFileOpen(filePath: string, mode: "open" | "edit" | "preview" = "open", type?: IpcRendererOpenFileType | "world" | "leveldb" | null): void {
        switch (mode) {
            case "open":
            case "edit":
            case "preview":
                try {
                    switch (true) {
                        case type === "world":
                        case type === "leveldb":
                        case (type === "unset" || !type) && existsSync(filePath) && statSync(filePath).isDirectory():
                            if (type === "world" || ((type === "unset" || !type) && existsSync(path.join(filePath, "level.dat")))) {
                                lastFocusedMainWindows.at(-1)?.webContents.send<1>("open-world-folder", filePath, mode === "preview" ? "readonly" : undefined);
                            } else {
                                lastFocusedMainWindows
                                    .at(-1)
                                    ?.webContents.send<1>("open-leveldb-folder", filePath, mode === "preview" ? "readonly" : undefined);
                            }
                            break;
                        case !!type || type === undefined:
                        case /^\.(?:mcworld|mcstructure|mcaddon|jsonc?|nbt|bin|hex|snbt|dat|schem|schematic)$/i.test(path.extname(filePath).toLowerCase()):
                            lastFocusedMainWindows
                                .at(-1)
                                ?.webContents.send<1>("open-file", filePath, type ?? undefined, mode === "preview" ? "readonly" : undefined);
                            break;
                        case type === null:
                        default:
                            dialog.showMessageBox({
                                type: "error",
                                title: "Unsupported File Type",
                                message: `The file type of the file at ${filePath} is not supported.`,
                                detail: "Supported file types: .mcworld, .mcstructure, .mcaddon, .json, .jsonc, .nbt, .bin, .hex, .snbt, .dat, .schem, .schematic",
                                buttons: ["Okay"],
                                noLink: true,
                            });
                    }
                } catch (e: any) {
                    dialog.showMessageBox({
                        type: "error",
                        title: "Error Opening File",
                        message: `There was an error opening the file at ${filePath}.`,
                        detail: e.message + e?.stack,
                        buttons: ["Okay"],
                        noLink: true,
                    });
                }
                break;
            default:
                break;
        }
    }

    app.on("open-file", (event: Electron.Event, filePath: string): void => {
        event.preventDefault(); /* 
        const dateISOString: string = new Date().toISOString().replaceAll(":", "_");
        writeFileSync(path.join(APP_DATA_FOLDER_PATH, `OPEN_FILE_${dateISOString}.LOG`), `[${new Date().toISOString()}] [LOG] ${process.argv}\n`);
        dialog.showMessageBox({
            type: "info",
            title: "Open File",
            message: `File Path: ${filePath}`,
            detail: `${process.argv}`,
        }); */
        if (!filePath) return;
        if (webContentsLoaded) {
            handleFileOpen(filePath);
        } else {
            onWebContentsLoadedCallbacks.push((): void => void handleFileOpen(filePath));
        }
    });
    function handleArgv(originalArgv: string[], secondInstance: boolean = false): void {
        console.log("handleArgv", originalArgv, "secondInstance:", secondInstance);
        const argv: string[] = originalArgv.slice(1 + +(originalArgv[1] === "--process-start-args"));
        // TODO: Add support for handling URIs on Linux.
        // Handle URIs on Windows.
        if (argv.includes("--allow-file-access-from-files")) {
            const restArgv: string[] = argv.slice(argv.indexOf("--allow-file-access-from-files") + 1);
            if (restArgv[0]?.startsWith("bedrock-world-editor:")) {
                handleURL(restArgv[0]);
            }
        }
        const nonAllowFileAccessFromFilesParams: string[] = argv.filter((arg: string): boolean => arg !== "--allow-file-access-from-files");
        if (
            nonAllowFileAccessFromFilesParams.length === 0 ||
            (nonAllowFileAccessFromFilesParams.length === 1 && nonAllowFileAccessFromFilesParams[0] === "--new-window")
        ) {
            // (lastFocusedMainWindows.at(-1) ?? app)?.focus();
            if (secondInstance) createWindow();
            return;
        }
        const filePath: string | undefined = argv.find((arg: string): boolean => arg !== "." && /^(?!-)/.test(arg));
        if (filePath && existsSync(filePath)) {
            handleFileOpen(
                filePath,
                argv.includes("--edit") ? "edit"
                : argv.includes("--preview") ? "preview"
                : "open",
                argv.some((v: string): boolean => v.startsWith("--file-tab-type=")) ?
                    (argv.find((v: string): boolean => v.startsWith("--file-tab-type="))?.split("=")[1] as IpcRendererOpenFileType)
                :   undefined
            );
        }
    }
    if (webContentsLoaded) {
        handleArgv(process.argv);
    } else {
        onWebContentsLoadedCallbacks.push((): void => void handleArgv(process.argv));
    }
    app.on("second-instance", (_event: Electron.Event, argv: string[], _workingDirectory: string, _additionalData: unknown): void => {
        // const dateISOString: string = new Date().toISOString().replaceAll(":", "_");
        // writeFileSync(path.join(APP_DATA_FOLDER_PATH, `STARTUP_${dateISOString}.LOG`), `[${new Date().toISOString()}] [LOG] ${argv}\n`);
        if (webContentsLoaded) {
            handleArgv(argv, true);
        } else {
            onWebContentsLoadedCallbacks.push((): void => void handleArgv(argv, true));
        }
    });

    // Quit when all windows are closed, except on macOS (unless the
    // config.quitOnCloseAllWindows config option is set to true). There, it's
    // common for applications and their menu bar to stay active until the user
    // quits explicitly with Cmd + Q.
    app.on("window-all-closed", (): void => {
        if (process.platform !== "darwin" || config.quitOnCloseAllWindows) {
            app.quit();
        }
    });

    if (!isSecondInstance) {
        if (process.platform === "win32") {
            userTasks: if (!isDev) {
                const tasks: Electron.Task[] = [
                    {
                        program: process.execPath,
                        arguments: "--new-window",
                        iconPath: process.execPath,
                        iconIndex: 0,
                        title: "New Window",
                        description: "Opens a new window",
                    },
                ];
                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"), JSON.stringify(tasks));
                app.setUserTasks(tasks);
            } else if (existsSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"))) {
                let tasks: Electron.Task[];
                try {
                    tasks = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"), "utf-8"));
                } catch (e) {
                    dialog.showMessageBox({
                        type: "error",
                        title: "Error Reading Taskbar User Tasks",
                        message: `There was an error reading the taskbar user tasks from ${path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json")}.`,
                        detail: e instanceof Error ? (e.stack ?? e.toString()) : String(e),
                        buttons: ["OK"],
                        noLink: true,
                    });
                    break userTasks;
                }
                try {
                    app.setUserTasks(tasks);
                } catch (e) {
                    dialog.showMessageBox({
                        type: "error",
                        title: "Error Setting Taskbar User Tasks",
                        message: `There was an error setting the taskbar user tasks from ${path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json")}.`,
                        detail: e instanceof Error ? (e.stack ?? e.toString()) : String(e),
                        buttons: ["OK"],
                        noLink: true,
                    });
                    break userTasks;
                }
            } else {
                app.getApplicationInfoForProtocol("bedrock-world-editor:").then(
                    (info: ApplicationInfoForProtocolReturnValue): void => {
                        if (path.basename(info.path) === "electron.exe") return;
                        const tasks: Electron.Task[] = [
                            {
                                program: info.path,
                                arguments: "--new-window",
                                iconPath: info.path,
                                iconIndex: 0,
                                title: "New Window",
                                description: "Opens a new window",
                            },
                        ];
                        writeFileSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"), JSON.stringify(tasks));
                        app.setUserTasks(tasks);
                    },
                    (): void => {}
                );
            }
        }
        new Octokit().repos.listReleases({ owner: "8Crafter-Studios", repo: "Bedrock-World-Editor" }).then(
            (releases): void => {
                const latestRelease: (typeof releases.data)[number] | null = releases.data
                    .filter(
                        (release: (typeof releases.data)[number]): boolean =>
                            !!semver.valid(release.tag_name) &&
                            // TODO: Add an option to allow showing draft releases.
                            !release.draft /* && config.notifyForPrereleaseUpdates ? true : !release.prerelease */
                    )
                    .reduce(
                        (a: (typeof releases.data)[number] | null, b: (typeof releases.data)[number]): (typeof releases.data)[number] | null =>
                            a ?
                                semver.compareBuild(a.tag_name, b.tag_name) < 0 ?
                                    b
                                :   a
                            :   (b ?? null),
                        null
                    );
                if (!latestRelease) return;
                if (semver.compareBuild(app.getVersion(), latestRelease.tag_name) < 0) {
                    let trimmedChangelog: string | undefined =
                        latestRelease.body ? latestRelease.body.split("\n").slice(0, 10).join("\n").slice(0, 2000) : undefined;
                    if (trimmedChangelog) {
                        if (trimmedChangelog !== latestRelease.body) {
                            trimmedChangelog += "\n...";
                        }
                    }
                    dialog
                        .showMessageBox({
                            type: "info",
                            title: "Update Available",
                            message: `A new version of Bedrock World Editor is available.\n\nCurrent Version: ${app.getVersion().replace(/^(?!v)/, "v")}\nLatest Version: ${
                                latestRelease.tag_name
                            }`,
                            detail: trimmedChangelog ? `Release Notes:\n${trimmedChangelog}` : undefined!,
                            buttons: ["Open", "Cancel"],
                            noLink: true,
                            cancelId: 1,
                            defaultId: 0,
                        })
                        .then((result: Electron.MessageBoxReturnValue): void => {
                            if (result.response === 0) {
                                shell.openExternal(latestRelease.html_url);
                            }
                        });
                }
            },
            (): void => {}
        );
    }

    // In this file you can include the rest of your app's specific main process
    // code. You can also put them in separate files and import them here.
}
