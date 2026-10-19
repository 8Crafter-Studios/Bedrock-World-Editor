import { EventEmitter } from "node:events";
import {
    ChunksDatUtils,
    entryContentTypeToFormatMap,
    getContentTypeFromDBKey,
    getKeyDisplayName,
    getKeysOfTypesG,
    MCDBEntryContentTypes,
    MCEntryContentTypes,
    parseSNBTCompoundString,
    parseSpecificIntType,
    prettyPrintSNBT,
    prismarineToSNBT,
    toLong,
    writeSpecificIntType,
    type EntryContentTypeFormatData,
    type MCDBEntryContentType,
    type MCEntryContentType,
    type NBTSchemas,
    type VectorXZ,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import type { TreeEditorDataStorageObjectInput } from "../../app/components/TreeEditor";
import { LevelDB } from "@8crafter/leveldb-zlib";
import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { APP_DATA_FOLDER_PATH } from "../utils/URLs";
import type { MapEditorDataStorageObject } from "../../app/components/MapEditor";
import { app, dialog, Menu } from "@electron/remote";
import type { MenuItemConstructorOptions, NativeImage } from "electron";
import { convertNativeImageToPngZlibAsync, padNativeImageToSquare, pngToIco } from "../utils/imageUtils";
import { awaitDefaultWorldIconDataURI, defaultWorldIconDataURI } from "../utils/preloadImages";
import { checkIsURIOrPath, normalizePathSlashes } from "../utils/pathUtils";
import type { HexEditorDataStorageObject } from "../../app/components/BinaryHexEditor";
import type { WorldEditorDataStorageObject } from "../../app/tabs/worldEditor";
import { allPromisesSettledUnhandled, stringifyError } from "../utils/miscUtils";
import type { CommentJSONValue } from "comment-json";
import commentJSON from "comment-json";

namespace exports {
    // type DefaultEventMap = [never];
    // type Listener<K, T, F> =
    //     T extends DefaultEventMap ? F
    //     : K extends keyof T ?
    //         T[K] extends unknown[] ?
    //             (...args: T[K]) => void
    //         :   never
    //     :   never;
    // type Listener1<K extends keyof T, T> = Listener<K, T, (...args: any[]) => void>;
    // type EventMap<T> = Record<keyof T, any[]> | DefaultEventMap;
    // type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T;
    /**
     * Events emitted by the {@link TabManager} class.
     */
    export interface TabManagerEventMap {
        /**
         * Emitted when the selected world or nbt tab changes (the top tab bar).
         */
        switchTab: [TabManagerSwitchTabEvent];
        /**
         * Emitted when a tab is closed.
         */
        closeTab: [TabManagerClosedTabEvent];
        /**
         * Emitted when a tab is opened.
         */
        openTab: [TabManagerOpenTabEvent];
        /**
         * Emitted when tabs are reordered.
         */
        reorderTabs: [TabManagerReorderTabsEvent];
        /**
         * Emitted when a tab done initializing.
         */
        tabInitialized: [TabManagerInitializedTabEvent];
    }
    /**
     * Events emitted by the {@link TabManagerTab} class.
     */
    export interface TabManagerTabEventMap {
        /**
         * Emitted when the selected LevelDB entry changes (the bottom tab bar).
         */
        switchTab: [TabManagerTabSwitchTabEvent];
        /**
         * Emitted when the tab is closed.
         */
        closed: [];
        /**
         * Emitted when one of the tab's sub-tabs are closed.
         */
        closeTab: [TabManagerTabClosedTabEvent];
        /**
         * Emitted when one of the tab's sub-tabs are opened.
         */
        openTab: [TabManagerTabOpenTabEvent];
        /**
         * Emitted when the tab's sub-tabs are reordered.
         */
        reorderTabs: [TabManagerTabReorderTabsEvent];
        /**
         * Emitted when the modification status of the tab changes.
         */
        modificationStatusChanged: [TabManagerTabModificationStatusChangedEvent];
        /**
         * Emitted when a status of the tab which is used in the tab bar and not covered by another event changes.
         */
        otherStatusChanged: [TabManagerTabOtherStatusChangedEvent];
        /**
         * Emitted when a tab starts saving.
         */
        startedSaving: [TabManagerTabStartedSavingEvent];
        /**
         * Emitted when a tab stops saving.
         */
        stoppedSaving: [TabManagerTabStoppedSavingEvent];
        /**
         * Emitted when the modification status of one of the tab's sub-tabs changes.
         */
        subTabModificationStatusChanged: [TabManagerSubTabModificationStatusChangedEvent];
        /**
         * Emitted when the tab is done initializing (meaning the files have finished copying into the temp directory and other required initialization has finished).
         */
        initialized: [];
        /**
         * Emmitted to trigger a reload of the current sub-tab.
         */
        reloadCurrentSubTab: [];
        /**
         * Emitted after the tab's post-close cleanup is done (meaning the LevelDB is closed and the temp directory is deleted), this is the point at which it is safe to end the process (assuming all other tabs have finished cleanup as well).
         */
        cleanupComplete: [];
    }
    /**
     * Emitted when the selected world or nbt tab changes (the top tab bar).
     */
    export interface TabManagerSwitchTabEvent {
        /**
         * The previous tab.
         */
        previousTab: TabManagerTab | TabManagerGenericTabID | null;
        /**
         * The new tab.
         */
        newTab: TabManagerTab | TabManagerGenericTabID | null;
    }
    /**
     * Emitted when a tab is closed.
     */
    export interface TabManagerClosedTabEvent {
        /**
         * The closed tab.
         */
        tab: TabManagerTab;
    }
    /**
     * Emitted when a tab is opened.
     */
    export interface TabManagerOpenTabEvent {
        /**
         * The opened tab.
         */
        tab: TabManagerTab;
        /**
         * Whether the tab will be switched to after opening.
         */
        switchToTab: boolean;
    }
    /**
     * Emitted when tabs are reordered.
     */
    export interface TabManagerReorderTabsEvent {
        /**
         * The new order of tabs.
         */
        tabs: TabManagerTab[];
    }
    /**
     * Emitted when a tab is done initializing.
     */
    export interface TabManagerInitializedTabEvent {
        /**
         * The initialized tab.
         */
        tab: TabManagerTab;
    }
    /**
     * Emitted when the selected LevelDB entry changes (the bottom tab bar).
     */
    export interface TabManagerTabSwitchTabEvent {
        /**
         * The previous sub-tab.
         */
        previousTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
        /**
         * The new sub-tab.
         */
        newTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
    }
    /**
     * Emitted when one of the tab's sub-tabs are closed.
     */
    export interface TabManagerTabClosedTabEvent {
        /**
         * The closed sub-tab.
         */
        tab: TabManagerSubTab;
    }
    /**
     * Emitted when one of the tab's sub-tabs are opened.
     */
    export interface TabManagerTabOpenTabEvent {
        /**
         * The opened sub-tab.
         */
        tab: TabManagerSubTab;
    }
    /**
     * Emitted when the tab's sub-tabs are reordered.
     */
    export interface TabManagerTabReorderTabsEvent {
        /**
         * The new order of sub-tabs.
         */
        tabs: TabManagerSubTab[];
    }
    /**
     * Emitted when the modification status of the tab changes.
     */
    export interface TabManagerTabModificationStatusChangedEvent {
        /**
         * The tab that had its modification status changed.
         */
        tab: TabManagerTab;
        /**
         * The new modification status.
         */
        isModified: boolean;
    }
    /**
     * Emitted when a status of the tab which is used in the tab bar and not covered by another event changes.
     */
    export interface TabManagerTabOtherStatusChangedEvent {
        /**
         * The tab that had one of its statuses changed.
         */
        tab: TabManagerTab;
        /**
         * The status that was changed.
         */
        status: "hasFragileLevelDB" | "fragileLevelDBAlreadyShattered";
    }
    /**
     * Emitted when a tab starts saving.
     */
    export interface TabManagerTabStartedSavingEvent {
        /**
         * The tab that started saving.
         */
        tab: TabManagerTab;
    }
    /**
     * Emitted when a tab stops saving.
     */
    export interface TabManagerTabStoppedSavingEvent {
        /**
         * The tab that was saved.
         */
        tab: TabManagerTab;
        /**
         * Whether the save was successful.
         */
        successful: boolean;
        /**
         * The error that occurred while saving.
         */
        error?: unknown;
    }
    /**
     * Emitted when the modification status of one of the tab's sub-tabs changes.
     */
    export interface TabManagerSubTabModificationStatusChangedEvent {
        /**
         * The sug-tab that had its modification status changed.
         */
        tab: TabManagerSubTab;
        /**
         * The new modification status.
         */
        isModified: boolean;
    }

    export type TabManagerGenericTabID = "loading" | "settings";

    interface RecentsItem {
        /**
         * Description of the task (displayed in a tooltip). Maximum length 260 characters.
         */
        description?: string | undefined;
        /**
         * The index of the icon in the resource file. If a resource file contains multiple
         * icons this value can be used to specify the zero-based index of the icon that
         * should be displayed for this task. If a resource file contains only one icon,
         * this property should be set to zero.
         */
        iconIndex?: number | undefined;
        /**
         * The absolute path to an icon to be displayed in a Jump List, which can be an
         * arbitrary resource file that contains an icon (e.g. `.ico`, `.exe`, `.dll`). You
         * can usually specify `process.execPath` to show the program icon.
         */
        iconPath?: string | undefined;
        /**
         * Path of the item.
         */
        path?: string | undefined;
        /**
         * The text to be displayed for the item in the Jump List.
         */
        title?: string | undefined;
    }

    interface RecentsItem_File extends RecentsItem {
        /**
         * The type of the
         */
        type?: IpcRendererOpenFileType | undefined;
    }

    interface RecentsData {
        worlds: RecentsItem[];
        folders: RecentsItem[];
        files: RecentsItem_File[];
    }

    // IDEA: Add a way to open a LevelDB as a generic LevelDB, where it doesn't have any of the world-specific stuff.

    // IDEA: Maybe cache recents data.

    /**
     * Represents a tab manager.
     */
    export class TabManager extends EventEmitter<TabManagerEventMap> {
        #abortSetJumpListController: AbortController = new AbortController();
        /**
         * Promises that must be resolved before running the associated operation.
         */
        private readonly _requiredOperationPromises: Record<"addRecentItem" | "setJumpListData", Set<Promise<unknown>>> = {
            addRecentItem: new Set<Promise<unknown>>(),
            setJumpListData: new Set<Promise<unknown>>(),
        };
        public openTabs: TabManagerTab[] = [];
        public selectedTab: TabManagerTab | TabManagerGenericTabID | null = null;
        public constructor() {
            super();
            this.setMaxListeners(1000000);
            void this.setJumpListData();
            this.setDockMenuData();
        }
        /**
         * Creates a function that can be used to wrap a promise that is required to be completed before running the associated operation or the aborted operations can be treated as fully aborted.
         *
         * @param abortTarget The identifier of the target that is being aborted.
         * @returns The wrapper function.
         */
        // REVIEW: Make sure this doesnt't hide the error or mess up the stack.
        private _getRequiredOperationPromiseWrapperFunc(abortTarget: keyof typeof this._requiredOperationPromises): {
            /**
             * Wraps a promise that is required to be completed before running the associated operation or the aborted operations can be treated as fully aborted.
             *
             * @param promise The promise to wrap.
             * @returns The wrapped promise.
             *
             * @throws {unknown} If the promise throws an error.
             */
            // eslint-disable-next-line @typescript-eslint/prefer-function-type -- This allows for the returned function to have JSDoc.
            <T extends unknown = unknown>(promise: T | Promise<T>): Promise<T>;
        } {
            return async <T extends unknown = unknown>(promise: T | Promise<T>): Promise<T> => {
                if (!(promise instanceof Promise)) return promise;
                this._requiredOperationPromises[abortTarget].add(promise);
                try {
                    return await promise;
                } finally {
                    this._requiredOperationPromises[abortTarget].delete(promise);
                }
            };
        }
        /**
         * Checks using the `level.dat` file whether the world was last used on a version that is affected by the bug where if the LevelDB is touched, the game will freak out whenever it opens the world.
         *
         * - `true` - The version is affected.
         * - `"possible"` - It is unknown if this version is affected (currently only the 0.9.0 builds, as it still needs to be determined what build added the bug).
         * - `"unknown"` - The version is unknown.
         * - `false` - The version is not affected.
         *
         * @param levelDat The parsed `level.dat` file.
         * @returns Whether the world was last used on a version that is affected by the bug.
         */
        public checkWorldFragilityFromLevelDat(levelDat: NBTSchemas.NBTSchemaTypes.LevelDat): boolean | "possible" | "unknown" {
            let fragileLevelDB: boolean | "possible" | "unknown" = false;
            if (levelDat.value.StorageVersion?.type === "int" && levelDat.value.StorageVersion.value > 5) fragileLevelDB = false;
            else if (
                levelDat.value.lastOpenedWithVersion?.value.type === "int" &&
                levelDat.value.lastOpenedWithVersion.value.value.length >= 4 &&
                !(
                    levelDat.value.lastOpenedWithVersion.value.value.length === 4 &&
                    levelDat.value.lastOpenedWithVersion.value.value.every((v: number): v is 4 => v === 4)
                )
            ) {
                const [major, minor, patch, build] = levelDat.value.lastOpenedWithVersion.value.value;
                // TODO: Figure out what build added the bug.
                if (major === 0 && minor === 9 && patch === 0 /* && build < 16 */) fragileLevelDB = "possible";
                else if (major === 0 && minor > 9) fragileLevelDB = true;
                else if (major === 1 && minor < 2) fragileLevelDB = true;
                else if (major === 1 && minor === 2 && patch === 0 && build < 11) fragileLevelDB = true;
            } else if (levelDat.value.StorageVersion?.type === "int" && levelDat.value.StorageVersion.value === 5) fragileLevelDB = true;
            else if (levelDat.value.StorageVersion?.type === "int" && levelDat.value.StorageVersion.value === 4) fragileLevelDB = true;
            else if (levelDat.value.StorageVersion?.type === "int" && levelDat.value.StorageVersion.value < 4) fragileLevelDB = false;
            else fragileLevelDB = "unknown";
            return fragileLevelDB;
        }
        public openTab(props: Omit<ConstructorParameters<typeof TabManagerTab>[0], "tabManager">, switchToTab: boolean = true): TabManagerTab {
            const tab = new TabManagerTab({ tabManager: this, ...props });
            this.openTabs.push(tab);
            this.emit("openTab", { tab, switchToTab });
            if (switchToTab) this.switchTab(tab);
            void this.addRecentItem({ ...props, icon: tab.icon }, tab);
            return tab;
        }
        // TODO: Maybe move this to the main process (and have a copy inside of here that will be used for mobile in the future, as async file system operations are fine to have there without worrying about other windows, since mobile can only have 1 window (unless I add multi-window support in the future for some devices)).
        private addRecentItem(props: Parameters<this["openTab"]>[0], tab: TabManagerTab): void {
            // await allPromisesSettledUnhandled(this._requiredOperationPromises.setJumpListData.values());
            try {
                if (tab.path) app.addRecentDocument(tab.path);
            } catch {}
            let recentsData: RecentsData = { worlds: [], folders: [], files: [] };
            recentsReader: if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                try {
                    const data = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), "utf-8")) as RecentsData;
                    // IDEA: Add something to validate the recents data.
                    recentsData = data;
                } catch (e) {
                    console.error("Error reading recents.json:", e);
                    break recentsReader;
                }
            }
            if (tab.type === "world") {
                const existingWorldRecentEntryIndex: number = recentsData.worlds.findLastIndex((world: RecentsItem): boolean => world.path === tab.path);
                if (existingWorldRecentEntryIndex !== -1) recentsData.worlds.splice(existingWorldRecentEntryIndex, 1);
                recentsData.worlds.unshift({ path: tab.path, iconPath: tab.icon ?? undefined, title: tab.name, description: tab.path.slice(-196) });
                recentsData.worlds.splice(5);
            } else if (tab.type === "leveldb") {
                const existingLevelDBRecentEntryIndex: number = recentsData.folders.findLastIndex((folder: RecentsItem): boolean => folder.path === tab.path);
                if (existingLevelDBRecentEntryIndex !== -1) recentsData.folders.splice(existingLevelDBRecentEntryIndex, 1);
                recentsData.folders.unshift({ path: tab.path, iconPath: tab.icon ?? undefined, title: tab.name, description: tab.path.slice(-196) });
                recentsData.folders.splice(5);
            } else if (tab.type !== "other") {
                const existingFileRecentEntryIndex: number = recentsData.files.findLastIndex((file: RecentsItem_File): boolean => file.path === tab.path);
                if (existingFileRecentEntryIndex !== -1) recentsData.files.splice(existingFileRecentEntryIndex, 1);
                recentsData.files.unshift({
                    path: tab.path,
                    iconPath: tab.icon ?? undefined,
                    title: tab.name,
                    description: tab.path.slice(-196),
                    type: tab.type,
                });
                recentsData.worlds.splice(5);
            }
            writeFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), JSON.stringify(recentsData));
            void this.setJumpListData();
            this.setDockMenuData();
        }
        static {
            addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
                if (!(event.reason instanceof Error)) return;
                if (
                    (event.reason.name !== "AbortError" || event.reason.message !== "[TabManager::setJumpListData] Aborted due to new setJumpListData call.") &&
                    (!event.reason.cause ||
                        !(event.reason.cause instanceof Error) ||
                        event.reason.cause.name !== "AbortError" ||
                        event.reason.cause.message !== "[TabManager::setJumpListData] Aborted due to new setJumpListData call.")
                ) {
                    return;
                }
                event.preventDefault();
            });
        }
        // FIXME: This does not have handling for when multiple windows have setJumpListData calls simultaneously.
        private async setJumpListData(): Promise<void> {
            if (process.platform !== "win32") return;
            {
                const abortError = new Error("[TabManager::setJumpListData] Aborted due to new setJumpListData call.");
                abortError.name = "AbortError";
                this.#abortSetJumpListController.abort(abortError);
            }
            const signal: AbortSignal = (this.#abortSetJumpListController = new AbortController()).signal;
            await allPromisesSettledUnhandled(this._requiredOperationPromises.setJumpListData.values());
            signal.throwIfAborted();
            const _p = this._getRequiredOperationPromiseWrapperFunc("setJumpListData");
            let recentsData: RecentsData = { worlds: [], folders: [], files: [] };
            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                try {
                    const data = JSON.parse(await _p(readFile(path.join(APP_DATA_FOLDER_PATH, "recents.json"), { encoding: "utf-8", signal }))) as RecentsData;
                    // IDEA: Add something to validate the recents data.
                    recentsData = data;
                } catch (e) {
                    if (signal.aborted && (e === signal.reason || (e instanceof Error && e.cause === signal.reason))) return;
                    console.error("Error reading recents.json:", e);
                    return;
                }
            }
            const removedItems: Electron.JumpListItem[] = app.getJumpListSettings().removedItems;
            removedItems.forEach((item: Electron.JumpListItem): void => {
                if (item.type === "task") {
                    if (item.args?.startsWith("--allow-file-access-from-files --file-tab-type=world")) {
                        const itemPath: string | undefined = /(?<=\s").*(?=")/.exec(item.args)?.[0];
                        if (!itemPath) {
                            console.warn("Unable to find world path in removedItems:", item);
                            return;
                        }
                        const worldsIndex: number = recentsData.worlds.findIndex(
                            (world: RecentsItem): boolean =>
                                !!world.path && path.normalize(world.path).replace(/[\\/]$/, "") === path.normalize(itemPath).replace(/[\\/]$/, "")
                        );
                        if (worldsIndex !== -1) recentsData.worlds.splice(worldsIndex, 1);
                        else console.warn("Unable to find world task in removedItems:", item);
                    } else if (item.args?.startsWith("--allow-file-access-from-files --file-tab-type=leveldb")) {
                        const itemPath: string | undefined = /(?<=\s").*(?=")/.exec(item.args)?.[0];
                        if (!itemPath) {
                            console.warn("Unable to find world path in removedItems:", item);
                            return;
                        }
                        const foldersIndex: number = recentsData.folders.findIndex(
                            (folder: RecentsItem): boolean =>
                                !!folder.path && path.normalize(folder.path).replace(/[\\/]$/, "") === path.normalize(itemPath).replace(/[\\/]$/, "")
                        );
                        if (foldersIndex !== -1) recentsData.folders.splice(foldersIndex, 1);
                        else console.warn("Unable to find folder task in removedItems:", item);
                    } else console.warn("Unknown task in removedItems:", item);
                } else if (item.type === "file") {
                    const itemPath: string | undefined = item.path;
                    if (!itemPath) {
                        console.warn("Unable to find world path in removedItems:", item);
                        return;
                    }
                    const filesIndex: number = recentsData.files.findIndex(
                        (file: RecentsItem_File): boolean =>
                            !!file.path && path.normalize(file.path).replace(/[\\/]$/, "") === path.normalize(itemPath).replace(/[\\/]$/, "")
                    );
                    if (filesIndex !== -1) recentsData.files.splice(filesIndex, 1);
                    else console.warn("Unable to find file in removedItems:", item);
                } else console.warn("Unknown item in removedItems:", item);
            });
            if (removedItems.length) await _p(writeFile(path.join(APP_DATA_FOLDER_PATH, "recents.json"), JSON.stringify(recentsData)));
            signal.throwIfAborted();
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"))) return;
            try {
                var userTasksData: Electron.Task[] = JSON.parse(
                    await _p(readFile(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"), { encoding: "utf-8", signal }))
                ) as Electron.Task[];
            } catch (e) {
                if (signal.aborted && e === signal.reason) return;
                console.error("Error reading taskbar_user_tasks.json:", e);
                return;
            }
            const execPath: string | null =
                process.env.NODE_ENV === "development" ?
                    (userTasksData.find((task: Electron.Task): boolean => task.title === "New Window")?.program ?? null)
                :   process.execPath;
            if (!execPath) return;
            await _p(rm(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons"), { recursive: true, force: true }));
            signal.throwIfAborted();
            await _p(mkdir(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons"), { recursive: true }));
            signal.throwIfAborted();
            void (async function writeJumpListItemIcons(): Promise<void> {
                for (let i = 0; i < recentsData.worlds.length; i++) {
                    const world: RecentsItem | undefined = recentsData.worlds[i];
                    if (!world) continue;
                    signal.throwIfAborted();
                    if (world.iconPath && ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
                    if (!world.iconPath && !defaultWorldIconDataURI) return;
                    // TODO: Maybe move this to the main process or a worker.
                    const img: NativeImage = padNativeImageToSquare(
                        world.iconPath ?
                            checkIsURIOrPath(world.iconPath) === "Path" ?
                                electron.nativeImage.createFromPath(world.iconPath)
                            :   electron.nativeImage.createFromBuffer(Buffer.from(await (await fetch(world.iconPath, { signal })).arrayBuffer()))
                        : (defaultWorldIconDataURI ?? (await awaitDefaultWorldIconDataURI, signal.throwIfAborted(), defaultWorldIconDataURI!)) ?
                            electron.nativeImage.createFromDataURL(defaultWorldIconDataURI)
                        :   electron.nativeImage.createFromBuffer(
                                Buffer.from(await (await fetch("resource://images/ui/misc/CreateNewWorld.png", { signal })).arrayBuffer())
                            ),
                        256
                    );
                    signal.throwIfAborted();
                    const pngData: Buffer<ArrayBuffer> = await convertNativeImageToPngZlibAsync(img.resize({ width: 256, height: 256 }));
                    signal.throwIfAborted();
                    await _p(writeFile(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `w${i}.ico`), pngToIco(pngData)));
                }
                for (let i = 0; i < recentsData.folders.length; i++) {
                    const folder: RecentsItem | undefined = recentsData.folders[i];
                    if (!folder) continue;
                    if (!folder.iconPath || ["ico", "exe", "dll"].includes(path.extname(folder.iconPath).slice(1).toLowerCase())) return;
                    const img: NativeImage = padNativeImageToSquare(
                        checkIsURIOrPath(folder.iconPath) === "Path" ?
                            electron.nativeImage.createFromPath(folder.iconPath)
                        :   electron.nativeImage.createFromBuffer(Buffer.from(await (await fetch(folder.iconPath, { signal })).arrayBuffer())),
                        256
                    );
                    signal.throwIfAborted();
                    const pngData: Buffer<ArrayBuffer> = await convertNativeImageToPngZlibAsync(img.resize({ width: 256, height: 256 }));
                    signal.throwIfAborted();
                    await _p(writeFile(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `d${i}.ico`), pngToIco(pngData)));
                }
                for (let i = 0; i < recentsData.files.length; i++) {
                    const file: RecentsItem_File | undefined = recentsData.files[i];
                    if (!file) continue;
                    if (!file.iconPath || ["ico", "exe", "dll"].includes(path.extname(file.iconPath).slice(1).toLowerCase())) return;
                    const img: NativeImage = padNativeImageToSquare(
                        checkIsURIOrPath(file.iconPath) === "Path" ?
                            electron.nativeImage.createFromPath(file.iconPath)
                        :   electron.nativeImage.createFromBuffer(Buffer.from(await (await fetch(file.iconPath, { signal })).arrayBuffer())),
                        256
                    );
                    signal.throwIfAborted();
                    const pngData: Buffer<ArrayBuffer> = await convertNativeImageToPngZlibAsync(img.resize({ width: 256, height: 256 }));
                    signal.throwIfAborted();
                    await _p(writeFile(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `f${i}.ico`), pngToIco(pngData)));
                }
            })();
            try {
                const jumpListData: Electron.JumpListCategory[] = [
                    {
                        type: "custom",
                        name: "Recent Worlds",
                        items: recentsData.worlds.map(
                            (world: RecentsItem): Electron.JumpListItem => ({
                                type: "task",
                                description: world.description!,
                                iconPath:
                                    world.iconPath && ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase()) ?
                                        world.iconPath
                                    :   path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `w${recentsData.worlds.indexOf(world)}.ico`),
                                iconIndex: world.iconIndex ?? 0,
                                program: execPath,
                                title: world.title!,
                                args: `--allow-file-access-from-files --file-tab-type=world "${world.path!}"`,
                            })
                        ),
                    },
                    {
                        type: "custom",
                        name: "Recent Folders",
                        items: recentsData.folders.map(
                            (world: RecentsItem): Electron.JumpListItem => ({
                                type: "task",
                                description: world.description!,
                                iconPath:
                                    !world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase()) ?
                                        (world.iconPath ?? "C:/Windows/explorer.exe")
                                    :   path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `d${recentsData.folders.indexOf(world)}.ico`),
                                iconIndex: world.iconIndex ?? 0,
                                program: execPath,
                                title: world.title!,
                                args: `--allow-file-access-from-files --file-tab-type=leveldb "${world.path!}"`,
                            })
                        ),
                    },
                    {
                        type: "recent",
                    },
                    {
                        type: "tasks",
                        items: userTasksData.map(
                            (v: Electron.Task): Electron.JumpListItem => ({
                                args: v.arguments,
                                description: v.description,
                                iconIndex: v.iconIndex,
                                iconPath: v.iconPath,
                                program: v.program,
                                title: v.title,
                                type: "task",
                                workingDirectory: v.workingDirectory!,
                            })
                        ),
                    },
                ];
                const result: ReturnType<typeof app.setJumpList> = await _p(ipcRenderer.invoke<1>("set-jumplist", jumpListData));
                if (result !== "ok") console.error("Error setting jump list, jump list gave non-ok result:", result);
            } catch (e) {
                console.error("Error setting jump list:", e);
            }
        }
        private setDockMenuData(): void {
            if (process.platform !== "darwin") return;
            let recentsData: RecentsData = { worlds: [], folders: [], files: [] };
            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                try {
                    // TODO: Make this operation async.
                    const data = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), "utf-8")) as RecentsData;
                    // IDEA: Add something to validate the recents data.
                    recentsData = data;
                } catch (e) {
                    console.error("Error reading recents.json:", e);
                    return;
                }
            }
            const recentWorlds: MenuItemConstructorOptions[] = recentsData.worlds.map((world: RecentsItem): MenuItemConstructorOptions => {
                if (!world.iconPath && !defaultWorldIconDataURI) {
                    return {
                        label: world.title!,
                        sublabel: world.path!,
                        toolTip: world.description!,
                        click: (): void => {
                            this.openTab({ path: world.path!, type: "world", icon: undefined, name: world.title! });
                        },
                    };
                }
                const img: NativeImage =
                    world.iconPath ? electron.nativeImage.createFromPath(world.iconPath) : electron.nativeImage.createFromDataURL(defaultWorldIconDataURI!);
                return {
                    label: world.title!,
                    sublabel: world.path!,
                    toolTip: world.description!,
                    icon: img,
                    click: (): void => {
                        this.openTab({ path: world.path!, type: "world", icon: undefined, name: world.title! });
                    },
                };
            });
            // recentsData.folders.forEach(async (world: RecentsItem, index: number): Promise<void> => {
            //     if (!world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
            //     const img: NativeImage = await padNativeImageToSquare(
            //         checkIsURIOrPath(world.iconPath) === "Path" ?
            //             electron.nativeImage.createFromPath(world.iconPath)
            //         :   electron.nativeImage.createFromBuffer(Buffer.from(await (await fetch(world.iconPath)).arrayBuffer()))
            //     );
            //     writeFileSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `d${index}.ico`), pngToIco(img.resize({ width: 256, height: 256 }).toPNG()));
            // });
            // recentsData.files.forEach(async (world: RecentsItem, index: number): Promise<void> => {
            //     if (!world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
            //     const img: NativeImage = await padNativeImageToSquare(electron.nativeImage.createFromPath(world.iconPath));
            //     writeFileSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `f${index}.ico`), pngToIco(img.resize({ width: 256, height: 256 }).toPNG()));
            // });
            try {
                const dockMenu: Electron.Menu = Menu.buildFromTemplate([
                    {
                        type: "submenu",
                        label: "Recent Worlds",
                        submenu: [
                            ...recentWorlds,
                            { type: "separator" },
                            {
                                label: "Clear Recent Worlds",
                                click: (): void => {
                                    if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                                        try {
                                            // TODO: Make these operations async.
                                            const data = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), "utf-8")) as RecentsData;
                                            data.worlds.length = 0;
                                            writeFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), JSON.stringify(data));
                                        } catch (e) {
                                            console.error("Error reading recents.json:", e);
                                            return;
                                        }
                                    }
                                },
                            },
                        ],
                    },
                    // {
                    //     type: "custom",
                    //     name: "Recent Folders",
                    //     items: recentsData.folders.map(
                    //         (world: RecentsItem): Electron.JumpListItem => ({
                    //             type: "task",
                    //             description: world.description!,
                    //             iconPath:
                    //                 !world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase()) ?
                    //                     (world.iconPath ?? "C:/Windows/explorer.exe")
                    //                 :   path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `d${recentsData.folders.indexOf(world)}.ico`),
                    //             iconIndex: world.iconIndex ?? 0,
                    //             program: execPath,
                    //             title: world.title!,
                    //             args: `--allow-file-access-from-files --file-tab-type=leveldb "${world.path!}"`,
                    //         })
                    //     ),
                    // },
                    // {
                    //     type: "recent",
                    // },
                    // {
                    //     type: "tasks",
                    //     items: userTasksData.map(
                    //         (v: Electron.Task): Electron.JumpListItem => ({
                    //             args: v.arguments,
                    //             description: v.description,
                    //             iconIndex: v.iconIndex,
                    //             iconPath: v.iconPath,
                    //             program: v.program,
                    //             title: v.title,
                    //             type: "task",
                    //             workingDirectory: v.workingDirectory!,
                    //         })
                    //     ),
                    // },
                    {
                        type: "separator",
                    },
                    {
                        label: "New Window",
                        click(): void {
                            ipcRenderer.send("new-window");
                        },
                    },
                ]);
                app.dock!.setMenu(dockMenu);
                // electron.nativeImage.createFromBuffer(Buffer.from(await (await fetch("resource://icon.png")).arrayBuffer()))
            } catch (e) {
                console.error("Error setting dock menu:", e);
            }
        }
        public switchTab(tab: TabManagerTab | TabManagerGenericTabID | null): void {
            // console.log(new Error().stack);
            if (tab === this.selectedTab) return;
            if (tab === null || tab === "loading" || tab === "settings") getCurrentWindow().setTitle("Bedrock World Editor");
            else if (typeof tab === "string") getCurrentWindow().setTitle(tab);
            // IDEA: Add a config option to change the template string for the window title, like how it is done in VSCode.
            else getCurrentWindow().setTitle(tab.name);
            const previousTab: TabManagerTab | TabManagerGenericTabID | null = this.selectedTab;
            this.selectedTab = tab;
            this.emit("switchTab", { previousTab, newTab: tab });
        }
        /**
         * Move a tab to a specific index.
         *
         * @param tab The tab to move.
         * @param index The index to move the tab to, `-1` corresponds to the end of the list.
         */
        public moveTab(tab: TabManagerTab, index: number): void {
            if (!this.openTabs.includes(tab) || this.openTabs.at(index) === tab) return;
            if (Object.is(index, -0) || index === -1) index = Infinity;
            this.openTabs.splice(this.openTabs.indexOf(tab), 1);
            this.openTabs.splice(index < 0 ? index + 1 : index, 0, tab);
            this.emit("reorderTabs", { tabs: this.openTabs });
        }
    }

    /**
     * The global tab manager for this window.
     */
    export const tabManager = new TabManager();

    /**
     * An ID that corresponds to a specific sub-tab (these sub-tab types are ususally accessed directly from the left sidebar).
     */
    export type TabManagerTabGenericSubTabID =
        | "world-settings"
        | "packs"
        | "players"
        | "entities"
        | "block-entities"
        | "structures"
        | "world"
        | "maps"
        | "dynamic-properties"
        | "scoreboards"
        | "villages"
        | "portals"
        | "ticking-areas"
        | "ticks"
        | "schedulerwt"
        | "view-files"
        | "fun"
        | "integrations"
        | "repair-forced-world-corruption";

    /**
     * The mode of a tab.
     *
     * - `readonly`: The tab is read-only and none of its data can be modified.
     * - `direct`: The tab is read-write and actions inside the editor immediately affect the source files, so immediate saving.
     * - `copyUntilSave`: The tab is read-write and actions inside the editor affect a copy of the source files, and are copied to the source files when saving.
     * - `copy`: The tab is read-write and actions inside the editor affect a copy of the source files, but the source files are never modified.
     */
    export enum TabManagerTabMode {
        /**
         * The tab is read-only and none of its data can be modified, it is viewed through a copy of the source files to ensure immutability.
         */
        Readonly = "readonly",
        /**
         * The tab is read-only and none of its data can be modified, it is viewed through the source files, so when reading things such as leveldb,
         * the source files of the leveldb may be slightly modified, although they do not affect the world, it is just structured slightly differently.
         */
        ReadonlyDirect = "readonlyDirect",
        /**
         * The tab is read-write and actions inside the editor immediately affect the source files, so immediate saving.
         */
        Direct = "direct",
        /**
         * The tab is read-write and actions inside the editor affect a copy of the source files, and are copied to the source files when saving.
         */
        CopyUntilSave = "copyUntilSave",
        /**
         * The tab is read-write and actions inside the editor affect a copy of the source files, but the source files are never modified.
         */
        Copy = "copy",
    }

    type PinnedSubTabsJSONData = {
        [type in "world" | "leveldb"]?: {
            [worldPath: string]: {
                target: TabManagerSubTab["target"];
                contentType: MCEntryContentType;
                formatData?: TabManagerSubTab["formatData"] | undefined;
                name: string;
                icon?: string | undefined;
                specialTabID?: TabManagerTabGenericSubTabID | undefined;
                /**
                 * Whether the tab should be set as the active tab upon opening.
                 *
                 * @default false
                 */
                active?: boolean | undefined;
            }[];
        };
    };

    /**
     * The data stored in the {@link TabManagerTab.currentState | currentState} property of a {@link TabManagerTab}.
     */
    export interface TabManagerTabCurrentState {
        worldTab?: WorldEditorDataStorageObject;
    }

    // FIXME: Saving the level.dat tab marks the whole world as saved if that was the only thing that was modified.

    /**
     * The sub-paths of world folders that should never be copied.
     */
    // CAUTION: Currently some of the functions that use this only have handling for folder names here, not deeper paths.
    const WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY: readonly string[] = [".git", "behavior_packs", "resource_packs"];
    const WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY_APPLICABLE_MODES: readonly TabManagerTabMode[] = [TabManagerTabMode.CopyUntilSave];

    /**
     * Represents a tab in the tab manager.
     */
    export class TabManagerTab extends EventEmitter<TabManagerTabEventMap> {
        /**
         * The last recorded modification state of this tab.
         */
        #lastModificationState: boolean = false;
        /**
         * Whether this tab has finished initializing.
         */
        #isInitialized: boolean = false;
        /**
         * An abort controller that will be aborted just before cleanup.
         */
        private readonly _abortController: AbortController = new AbortController();
        /**
         * An abort signal that will be aborted just before cleanup.
         */
        private readonly _abortSignal: AbortSignal = this._abortController.signal;
        /**
         * Promises that must be resolved prior to cleanup.
         */
        private readonly _requiredPreCleanupPromises: Set<Promise<unknown>> = new Set<Promise<unknown>>();
        /**
         * The last ID used for a tab.
         */
        public static lastID: bigint = 0n;
        /**
         * The tab manager that this tab belongs to.
         */
        public tabManager: TabManager;
        /**
         * The sub-tabs that are open in this tab.
         */
        public openTabs: TabManagerSubTab[] = [];
        /**
         * The sub-tab that is currently selected.
         */
        public selectedTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null = null;
        /**
         * The path of the file or folder that this tab represents.
         */
        public path: string;
        /**
         * The database that this tab represents.
         *
         * If {@link type} is `world` and there is no `db` folder in the world, this will be `null`.
         *
         * Only used for the `world` and `leveldb` {@link type | types}.
         */
        public db?: LevelDB | null | undefined;
        /**
         * The search object that is used to search the database.
         */
        public dbSearch?: TabManagerTab_LevelDBSearch | undefined;
        /**
         * The keys of the database that are cached.
         */
        public cachedDBKeys?:
            | {
                  [key in MCDBEntryContentType]: Buffer[];
              }
            | undefined;
        /**
         * A promise that resolves when the database is open.
         *
         * It resolves with `true` if it was opened successfully and `false` if an error occurred.
         *
         * This is not removed after it is resolved or rejected.
         */
        public awaitDBOpen?: Promise<boolean>;
        /**
         * The error that occurred when the database was being opened.
         *
         * Only present if an error occurred while opening the database.
         */
        public errorOnDBOpen?: unknown;
        /**
         * If an error occurred while opening the database because it was encrypted.
         *
         * Only present if an error occurred while opening the database and the database is encrypted.
         */
        public errorDueToEncryptedLevelDB?: true;
        /**
         * The corruption error that occurred.
         *
         * This can appear after the LevelDB is loaded. For example the {@link refreshCachedDBKeys} method will set this if a corruption error occurs while reading the LevelDB.
         *
         * Only present if a corruption error has occurred.
         */
        public corruptedDBError?: Error;
        /**
         * A promise that resolves when the database keys cache is loaded.
         *
         * It resolves with `true` if it was loaded successfully and `false` if an error occurred.
         *
         * This is not removed after it is resolved or rejected.
         */
        public awaitCachedDBKeys?: Promise<boolean>;
        /**
         * The number of keys that have been cached so far.
         *
         * Only present while `awaitCachedDBKeys` is pending.
         */
        public loadedCachedDBKeysProgress?: number;
        /**
         * The object that stores certain data for the tab.
         */
        public currentState: TabManagerTabCurrentState = {};
        /**
         * The display name of the tab.
         */
        public name: string;
        /**
         * The file path or URI of the icon.
         */
        public icon: string | null;
        /**
         * The type of the tab.
         */
        public type: "world" | "leveldb" | "nbt" | "json" | "xml" | "text" | "binary" | "other";
        /**
         * The mode of the tab.
         *
         * @default `TabManagerTabMode.CopyUntilSave`
         */
        public mode: TabManagerTabMode = TabManagerTabMode.CopyUntilSave;
        /**
         * The path of the temporary copy of the source files, only used for {@link TabManagerTabMode.Readonly}, {@link TabManagerTabMode.CopyUntilSave}, and {@link TabManagerTabMode.Copy} modes.
         */
        public tempPath?: string;
        /**
         * The same as {@link tempPath} if {@link type} is `world` or `leveldb`, otherwise the path to the copied file within the {@link tempPath} directory.
         */
        public tempFilePath?: string;
        /**
         * Whether the world folder is not isolated from any Minecraft data folders or servers.
         *
         * If it was isolated, it would result infeatures that rely on accessing game data outside of the world data not working on the world.
         *
         * If this tab is not associated with a world folder, this will be `false`.
         */
        public isNonIsolatedWorld: boolean = false;
        /**
         * Whether the world was last used on a version that is affected by the bug where if the LevelDB is touched, the game will freak out whenever it opens the world.
         *
         * - `true` - The version is affected.
         * - `"possible"` - It is unknown if this version is affected (versions in the range Beta 1.2.0.2 < x < 1.2.0.81).
         * - `"unknown"` - The version is unknown.
         * - `false` - The version is not affected.
         * - `null` - The fragility state is not applicable to this tab type.
         * - `undefined` - The fragility state has not been checked yet.
         */
        public hasFragileLevelDB: ReturnType<typeof tabManager.checkWorldFragilityFromLevelDat> | null | undefined;
        /**
         * A promise that resolves when the fragility of the LevelDB has been checked.
         *
         * This is not removed after it is resolved or rejected.
         *
         * Only present if the fragility state was not passed to the constructor;
         */
        public awaitFragilityCheck?: Promise<void>;
        /**
         * If the fragile LevelDB has been accessed and saved to the original files.
         *
         * This is to hide subsequent warnings.
         */
        public fragileLevelDBAlreadyShattered: boolean = false;
        /**
         * Whether the tab is read-only.
         *
         * @readonly
         */
        public readonly readonly: boolean = false;
        /**
         * Whether saving is enabled for the tab.
         *
         * @readonly
         */
        public readonly saveEnabled: boolean = true;
        /**
         * The files that have been modified in the tab.
         */
        public modifiedFiles: {
            files: string[];
            leveldb: boolean;
        } = {
            files: [],
            leveldb: false,
        };
        /**
         * The list of relative paths of files and folders that should be removed from the original world folder on save.
         *
         * Make sure to use {@link normalizePathSlashes} on a path before adding it.
         *
         * Only used for the {@link TabManagerTabMode.CopyUntilSave} and {@link TabManagerTabMode.Copy} modes.
         *
         * Only used for the `world` {@link type}.
         */
        public pathsToRemoveOnSave: string[] = [];
        /**
         * Whether the tab is currently saving.
         */
        public isSaving: boolean = false;
        /**
         * The ID of the tab.
         *
         * @readonly
         */
        public readonly id: bigint = TabManagerTab.lastID++;
        /**
         * Whether the tab is valid.
         */
        public isValid: boolean = true;
        public constructor(props: {
            tabManager: TabManager;
            path: TabManagerTab["path"];
            name: TabManagerTab["name"];
            icon: TabManagerTab["icon"] | undefined;
            type: TabManagerTab["type"];
            mode?: TabManagerTabMode | undefined;
            isNonIsolatedWorld?: boolean | undefined;
            hasFragileLevelDB?: ReturnType<typeof tabManager.checkWorldFragilityFromLevelDat> | undefined;
            fragileLevelDBAlreadyShattered?: boolean | undefined;
            subTabs?: Parameters<TabManagerTab["openTab"]>[] | undefined;
            switchToTab?: Parameters<TabManagerTab["switchTab"]>[0] | undefined;
        }) {
            super();
            this.setMaxListeners(1000000);
            delete this.errorOnDBOpen;
            delete this.errorDueToEncryptedLevelDB;
            delete this.corruptedDBError;
            delete this.loadedCachedDBKeysProgress;
            delete this.awaitFragilityCheck;
            this.tabManager = props.tabManager;
            this.path = props.path;
            this.name = props.name;
            this.icon = props.icon ?? null;
            this.type = props.type;
            this.isNonIsolatedWorld = props.isNonIsolatedWorld ?? false;
            this.hasFragileLevelDB = props.hasFragileLevelDB;
            this.fragileLevelDBAlreadyShattered = props.fragileLevelDBAlreadyShattered ?? false;
            if (props.mode) this.mode = props.mode;
            switch (props.mode) {
                case TabManagerTabMode.Readonly:
                case TabManagerTabMode.ReadonlyDirect:
                    this.readonly = true;
                    this.saveEnabled = false;
                    break;
                case TabManagerTabMode.Copy:
                    this.saveEnabled = false;
                    break;
                case TabManagerTabMode.Direct:
                case TabManagerTabMode.CopyUntilSave:
                case undefined:
                default:
                    break;
            }
            this.#lastModificationState = this.isModified();
            this.on("closeTab", (event: TabManagerTabClosedTabEvent): void => {
                if (!this.#lastModificationState || !event.tab.hasUnsavedChanges || this.isModified()) return;
                this.#lastModificationState = false;
                this.emit("modificationStatusChanged", { tab: this, isModified: false });
            });
            this.on("subTabModificationStatusChanged", (event: TabManagerSubTabModificationStatusChangedEvent): void => {
                if (this.#lastModificationState === event.isModified || this.#lastModificationState === this.isModified()) return;
                this.#lastModificationState = event.isModified;
                this.emit("modificationStatusChanged", { tab: this, isModified: event.isModified });
            });
            void this.initAccess(props.mode ?? TabManagerTabMode.CopyUntilSave).then((): void => {
                if (props.hasFragileLevelDB === undefined) this.awaitFragilityCheck = this.checkFragility();
                else this.initFragilityState();
                if (props.subTabs) {
                    props.subTabs.forEach((tab) => this.openTab(tab[0], tab[1]));
                } else {
                    this.getPinnedTabs().forEach((tab, i, a) =>
                        this.openTab(
                            { ...tab, isPinned: true },
                            tab.active || (!a.some((tab) => tab.active) && i === a.length - 1 && props.switchToTab === undefined)
                        )
                    );
                }
                if (props.switchToTab !== undefined) this.switchTab(props.switchToTab);
            });
        }
        public get isInitialized(): boolean {
            return this.#isInitialized;
        }
        private set isInitialized(value: boolean) {
            const wasInitialized: boolean = this.#isInitialized;
            this.#isInitialized = value;
            if (value && wasInitialized !== this.#isInitialized) {
                this.tabManager.emit("tabInitialized", { tab: this });
                this.emit("initialized");
            }
        }
        /**
         * Whether the tab has a sub-tab bar.
         *
         * @readonly
         */
        public get hasTabBar(): boolean {
            return this.type === "world" || this.type === "leveldb";
        }
        /**
         * Whether the tab has a left sidebar.
         *
         * @readonly
         */
        public get hasLeftSidebar(): boolean {
            return this.type === "world" || this.type === "leveldb";
        }
        /**
         * Whether the tab is favorited.
         */
        public get isFavorited(): boolean {
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) return false;
            try {
                const favoritedWorldsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")) as string[];
                if (favoritedWorldsData.includes(this.path)) {
                    return true;
                }
            } catch (e) {
                console.error(e);
            }
            return false;
        }
        public set isFavorited(value: boolean) {
            if (value) {
                let favoritedWorldsData: string[] = [];
                if (existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) {
                    favoritedWorldsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")) as string[];
                }
                if (!favoritedWorldsData.includes(this.path)) {
                    favoritedWorldsData.push(this.path);
                    writeFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), JSON.stringify(favoritedWorldsData));
                }
            } else {
                if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) return;
                const favoritedWorldsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")) as string[];
                if (favoritedWorldsData.includes(this.path)) {
                    favoritedWorldsData.splice(favoritedWorldsData.indexOf(this.path), 1);
                    writeFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), JSON.stringify(favoritedWorldsData));
                }
            }
        }
        /**
         * The index of the tab.
         *
         * If the tab is not in the list of open tabs, the index will be `-1`.
         *
         * @readonly
         */
        public get index(): number {
            return this.tabManager.openTabs.indexOf(this);
        }
        /**
         * Wraps a promise that is required to be completed prior to cleanup.
         *
         * @param promise The promise to wrap.
         * @returns The wrapped promise.
         *
         * @throws {unknown} If the promise throws an error.
         */
        // REVIEW: Make sure this doesnt't hide the error or mess up the stack.
        private async _rqP<T extends unknown = unknown>(promise: T | Promise<T>): Promise<T> {
            if (!(promise instanceof Promise)) return promise;
            this._requiredPreCleanupPromises.add(promise);
            try {
                return await promise;
            } finally {
                this._requiredPreCleanupPromises.delete(promise);
            }
        }
        /**
         * Wraps a callback so that it's returned promise is automatically wrapped such that it is required to be completed prior to cleanup.
         *
         * @param callback The callback to wrap.
         * @returns The wrapped callback.
         */
        // REVIEW: Make sure this doesnt't hide the error or mess up the stack.
        private _rqC<TR extends unknown, TA extends unknown[]>(callback: (...args: TA) => TR | Promise<TR>): (...args: TA) => Promise<TR> {
            return async (...args: TA): Promise<TR> => {
                return await this._rqP(callback(...args));
            };
        }
        private async initAccess(mode: TabManagerTabMode): Promise<void> {
            switch (mode) {
                case TabManagerTabMode.Readonly:
                case TabManagerTabMode.Copy:
                case TabManagerTabMode.CopyUntilSave: {
                    if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "temp"))) {
                        // REVIEW: This may cause a race condition if multiple tabs try to create this simultaneously, make sure if that happens it won't cause any issues.
                        await this._rqP(mkdir(path.join(APP_DATA_FOLDER_PATH, "temp"), { recursive: true }));
                        this._abortSignal.throwIfAborted();
                    }
                    if (this.type === "world" || this.type === "leveldb") {
                        this.tempPath = await this._rqP(mkdtemp(path.join(APP_DATA_FOLDER_PATH, "temp/")));
                        this.tempFilePath = this.tempPath;
                        if (this.type === "world" && WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY_APPLICABLE_MODES.includes(this.mode)) {
                            await this._rqC(cp)(this.path, this.tempPath, {
                                recursive: true,
                                force: true,
                                preserveTimestamps: true,
                                dereference: true,
                                // WARNING: If this filter is ever removed, it must stay as `() => true` in order to make non-latin characters in file names work.
                                filter: (source: string, _destination: string): boolean => {
                                    this._abortSignal.throwIfAborted();
                                    if (
                                        WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY.includes(
                                            normalizePathSlashes(path.relative(normalizePathSlashes(this.path), normalizePathSlashes(source)))
                                        )
                                    ) {
                                        return false;
                                    }
                                    return true;
                                },
                            });
                            this._abortSignal.throwIfAborted();
                        } else {
                            await this._rqC(cp)(this.path, this.tempPath, {
                                recursive: true,
                                force: true,
                                preserveTimestamps: true,
                                dereference: true,
                                // NOTE: This is a workaround make non-latin characters in file names work (the AbortSignal is not part of the workaround).
                                filter: (): true => {
                                    this._abortSignal.throwIfAborted();
                                    return true;
                                },
                            });
                            this._abortSignal.throwIfAborted();
                        }
                    } else {
                        this.tempPath = await this._rqP(mkdtemp(path.join(APP_DATA_FOLDER_PATH, "temp/")));
                        this.tempFilePath = path.join(this.tempPath, path.basename(this.path));
                        this._abortSignal.throwIfAborted();
                        await this._rqP(copyFile(this.path, this.tempFilePath));
                        this._abortSignal.throwIfAborted();
                    }
                    break;
                }
                case TabManagerTabMode.ReadonlyDirect:
                case TabManagerTabMode.Direct:
                default:
                    break;
            }
            this._abortSignal.throwIfAborted();
            if (this.type === "world") {
                if (!existsSync(path.join(this.tempPath ?? this.path, "db"))) {
                    this.db = null;
                    this.dbSearch = new TabManagerTab_LevelDBSearch(this);
                } else {
                    this.db = new LevelDB(path.join(this.tempPath ?? this.path, "db"));
                    this.dbSearch = new TabManagerTab_LevelDBSearch(this);
                    this.awaitDBOpen = this._rqP(this.db.open()).then(
                        (): true => {
                            this._abortSignal.throwIfAborted();
                            void this.refreshCachedDBKeys();
                            return true;
                        },
                        async (err: unknown): Promise<false> => {
                            console.error(err);
                            this._abortSignal.throwIfAborted();
                            this.errorOnDBOpen = err;
                            if (err instanceof Error && err.message === "Error: Corruption: CURRENT file does not end with newline") {
                                if (
                                    existsSync(path.join(this.tempPath ?? this.path, "db", "CURRENT")) &&
                                    (await this._rqP(readFile(path.join(this.tempPath ?? this.path, "db", "CURRENT"), { signal: this._abortSignal })))
                                        .subarray(0, 17)
                                        .equals(Buffer.from("00000000fcb9cf9b000000000000000024", "hex"))
                                ) {
                                    this.errorDueToEncryptedLevelDB = true;
                                }
                            }
                            return false;
                        }
                    );
                }
            } else if (this.type === "leveldb") {
                this.db = new LevelDB(this.tempPath ?? this.path, { createIfMissing: false });
                this.dbSearch = new TabManagerTab_LevelDBSearch(this);
                this.awaitDBOpen = this.db.open().then(
                    (): true => {
                        void this.refreshCachedDBKeys();
                        return true;
                    },
                    async (err: unknown): Promise<false> => {
                        console.error(err);
                        this.errorOnDBOpen = err;
                        if (err instanceof Error && err.message === "Error: Corruption: CURRENT file does not end with newline") {
                            if (
                                existsSync(path.join(this.tempPath ?? this.path, "db", "CURRENT")) &&
                                (await this._rqP(readFile(path.join(this.tempPath ?? this.path, "db", "CURRENT"), { signal: this._abortSignal })))
                                    .subarray(0, 17)
                                    .equals(Buffer.from("00000000fcb9cf9b000000000000000024", "hex"))
                            ) {
                                this.errorDueToEncryptedLevelDB = true;
                            }
                        }
                        return false;
                    }
                );
            } else if (this.type === "nbt") {
                let contentType: MCEntryContentType;
                let formatData: EntryContentTypeFormatData | undefined;
                // BUG: This treats Java level.dat as Bedrock level.dat, what it should do is check if it is little-endian or big-endian and if it is little-endian, treat it as Bedrock and set the content type to LevelDat, or maybe just check for the existence of the Bedrock header.
                contentTypeGetter: if (
                    [
                        "level.dat",
                        "level.dat_old",
                        "level.dat_new", // level.dat_new only exists while saving level.dat, it writes to level.dat_new, deletes level.dat_old, renames level.dat to level.dat_old, and renames level.dat_new to level.dat.
                    ].includes(path.basename(this.path))
                ) {
                    contentType = "LevelDat";
                } else if (this.path.toLowerCase().endsWith(".mcstructure")) contentType = "StructureTemplate";
                else if (this.path.toLowerCase().endsWith(".snbt")) {
                    contentType = "StructureTemplate";
                    formatData = {
                        type: "SNBT",
                        rawFileExtension: "snbt",
                    };
                    // } else if (this.path.toLowerCase().endsWith(".schem")) { // TODO
                    // } else if (this.path.toLowerCase().endsWith(".schematic")) { // TODO
                } else {
                    const components: string[] = path.basename(this.path).split(".");
                    if (components.length > 2) {
                        const preExt: string = components.at(-2)!;
                        if (
                            MCEntryContentTypes.filter(
                                (contentType: MCEntryContentType): boolean =>
                                    entryContentTypeToFormatMap[contentType].type === "NBT" ||
                                    (entryContentTypeToFormatMap[contentType].type === "custom" &&
                                        entryContentTypeToFormatMap[contentType].resultType === "JSONNBT")
                            ).includes(preExt as MCEntryContentType)
                        ) {
                            contentType = preExt as MCEntryContentType;
                            break contentTypeGetter;
                        }
                    }
                    contentType = "Unknown";
                }
                if (this.icon === null && contentType !== "Unknown" && tabManagerSubTabContentTypeToDefaultIconMap[contentType]) {
                    this.icon = tabManagerSubTabContentTypeToDefaultIconMap[contentType]!;
                } else this.icon ??= "resource://images/ui/glyphs/NBT.png";
                if (contentType === "Unknown" && !formatData) {
                    void (async (): Promise<void> => {
                        try {
                            const data: Buffer = await this._rqP(readFile(this.path, { signal: this._abortSignal }));
                            this._abortSignal.throwIfAborted();
                            // TODO: Maybe make the player.dat detection more strict.
                            if (path.basename(this.path) === "player.dat" && data.readUInt32LE(0) === 1) {
                                contentType = "PlayerDat";
                                return;
                            }
                            if (path.basename(this.path) === "entities.dat" && data.readUInt32BE(0) === 0x454e5400) {
                                contentType = "EntitiesDat";
                                return;
                            }
                            // TODO: Maybe make the chunk.dat detection more strict.
                            if (path.basename(this.path) === "chunks.dat" && data.length >= 4096) {
                                contentType = "ChunksDat";
                                return;
                            }
                            // TODO: Add importedchunks.dat detection.
                            // TODO: Add players/<PlayerID>.dat detection.
                            const format: NBT.NBTFormat = (await NBT.parse(data)).type;
                            formatData = {
                                type: "NBT",
                                format:
                                    format === "big" ? "BE"
                                    : format === "littleVarint" ? "LEV"
                                    : "LE",
                                rawFileExtension: path.extname(this.path).slice(1),
                            };
                        } catch (e) {
                            console.error("Error while parsing NBT file:", e);
                        }
                        this.openTab({
                            contentType,
                            formatData,
                            icon: "auto",
                            name: path.basename(this.path),
                            parentTab: this,
                            target: {
                                path: "",
                                type: "File",
                            },
                        });
                    })();
                } else {
                    this.openTab({
                        contentType,
                        formatData,
                        icon: "auto",
                        name: path.basename(this.path),
                        parentTab: this,
                        target: {
                            path: "",
                            type: "File",
                        },
                    });
                }
            }
            this.isInitialized = true;
        }
        private initFragilityState(): void {
            switch (this.type) {
                case "world":
                case "leveldb":
                    break;
                case "nbt":
                case "json":
                case "xml":
                case "text":
                case "binary":
                case "other":
                default:
                    this.hasFragileLevelDB = null;
                    this.fragileLevelDBAlreadyShattered = false;
                    return;
            }
            if (this.hasFragileLevelDB === undefined) throw new TypeError("hasFragileLevelDB is undefined");
            if (this.hasFragileLevelDB !== false) {
                switch (this.mode) {
                    case TabManagerTabMode.Direct:
                    case TabManagerTabMode.ReadonlyDirect:
                        this.fragileLevelDBAlreadyShattered = true;
                        this.emit("otherStatusChanged", { tab: this, status: "fragileLevelDBAlreadyShattered" });
                        break;
                    case TabManagerTabMode.Readonly:
                    case TabManagerTabMode.CopyUntilSave:
                    case TabManagerTabMode.Copy:
                    default:
                        break;
                }
            }
        }
        // TODO: Make this check level.dat_old.
        private async checkFragility(): Promise<void> {
            switch (this.type) {
                case "world":
                case "leveldb":
                    break;
                case "nbt":
                case "json":
                case "xml":
                case "text":
                case "binary":
                case "other":
                default:
                    this.hasFragileLevelDB = null;
                    this.fragileLevelDBAlreadyShattered = false;
                    return;
            }
            const levelDatPath: string = path.join(this.tempPath ?? this.path, "level.dat");
            if (!existsSync(levelDatPath)) return;
            try {
                const levelDat = await entryContentTypeToFormatMap.LevelDat.parse(await this._rqP(readFile(levelDatPath, { signal: this._abortSignal })));
                this.hasFragileLevelDB = this.tabManager.checkWorldFragilityFromLevelDat(levelDat);
                this.initFragilityState();
                this.emit("otherStatusChanged", { tab: this, status: "hasFragileLevelDB" });
            } catch (e) {
                reportError(e);
                this.hasFragileLevelDB = "unknown";
                this.initFragilityState();
            }
        }
        private async getCachedDBKeys(): Promise<Record<MCDBEntryContentType, Buffer[]>> {
            const startTime: number = performance.now(); // DEBUG
            const generator = getKeysOfTypesG(this.db!, MCDBEntryContentTypes);

            // Put this is brackets to allow the first yield to be garbage collected.
            {
                const firstYield = await generator.next();
                var result = firstYield.done ? firstYield.value : firstYield.value.results;
                if (!firstYield.done) this.loadedCachedDBKeysProgress = firstYield.value.count;
            }

            for await (const key of generator) {
                this.loadedCachedDBKeysProgress = key.count;
            }

            const endTime: number = performance.now(); // DEBUG
            console.debug("[getCachedDBKeys]", endTime - startTime, "ms", this.id, this);
            return result;
        }
        public async refreshCachedDBKeys(): Promise<boolean | undefined> {
            if (!this.db) return;
            this.cachedDBKeys = undefined;
            this.loadedCachedDBKeysProgress = 0;
            return await (this.awaitCachedDBKeys = this.getCachedDBKeys().then(
                (keys: Record<MCDBEntryContentType, Buffer[]>): true => {
                    this.cachedDBKeys = keys;
                    return true;
                },
                (err: unknown): false => {
                    if (
                        err instanceof Error &&
                        err.name === "Error" &&
                        (err.message.startsWith("Corruption: ") || err.message.startsWith("Error: Corruption: "))
                    ) {
                        console.error(err);
                        this.corruptedDBError = err;
                    } else if (!(err instanceof Error && err.name === "Error" && err.message === "iterator has ended")) {
                        console.error(err);
                    }
                    return false;
                }
            )).finally((): void => {
                delete this.loadedCachedDBKeysProgress;
            });
        }
        public getPinnedTabs(): NonNullable<PinnedSubTabsJSONData[keyof PinnedSubTabsJSONData]>[string][number][] {
            if (this.type !== "world" && this.type !== "leveldb") return [];
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"))) return [];
            try {
                const pinnedTabsData = JSON.parse(
                    readFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), "utf-8"),
                    (_key: string, value: unknown): any => {
                        // BUG: This doesn't preserve the parse and serialize methods of custom formats.
                        if (typeof value === "object" && value && "type" in value && value.type === "Buffer" && "data" in value && Array.isArray(value.data)) {
                            return Buffer.from(value.data);
                        }
                        return value;
                    }
                ) as PinnedSubTabsJSONData;
                return pinnedTabsData[this.type]?.[this.path] ? pinnedTabsData[this.type]![this.path]! : [];
            } catch (e) {
                console.error(e);
                return [];
            }
        }
        public savePinnedTabsList(): void {
            if (this.type !== "world" && this.type !== "leveldb") return;
            let pinnedTabsData: PinnedSubTabsJSONData = {};
            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"))) {
                pinnedTabsData = JSON.parse(
                    readFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), "utf-8"),
                    (_key: string, value: unknown): any => {
                        if (typeof value === "object" && value && "type" in value && value.type === "Buffer" && "data" in value && Array.isArray(value.data)) {
                            return Buffer.from(value.data);
                        }
                        return value;
                    }
                ) as PinnedSubTabsJSONData;
            }
            pinnedTabsData[this.type] ??= {};
            const currentPinnedTabs = this.openTabs.filter((tab): boolean => tab.isPinned);
            const hasCurrentActivePinnedTab: boolean = currentPinnedTabs.includes(this.selectedTab as never);
            const wasLastPinnedTab = (tab: TabManagerSubTab): boolean => {
                const lastPinnedTabs = pinnedTabsData[this.type as "world" | "leveldb"]![this.path];
                if (!lastPinnedTabs) return false;
                return (
                    lastPinnedTabs.find((tabData: NonNullable<PinnedSubTabsJSONData[keyof PinnedSubTabsJSONData]>[string][number]): boolean => {
                        if (tabData.target.type !== tab.target.type) return false;
                        if (tabData.specialTabID !== tab.specialTabID) return false;
                        function fakeAssertTargetTypeMatches<T extends TabManagerSubTab["target"]>(a: TabManagerSubTab["target"], b: T): asserts a is T {
                            void a;
                            void b;
                        }
                        switch (tabData.target.type) {
                            case "File":
                                fakeAssertTargetTypeMatches(tab.target, tabData.target);
                                if (tabData.target.path !== tab.target.path) return false;
                                break;
                            case "LevelDBEntry":
                                fakeAssertTargetTypeMatches(tab.target, tabData.target);
                                if (!tabData.target.key.equals(tab.target.key)) return false;
                                break;
                            case "ChunksDatEntry":
                                fakeAssertTargetTypeMatches(tab.target, tabData.target);
                                if (tabData.target.chunk.x !== tab.target.chunk.x || tabData.target.chunk.z !== tab.target.chunk.z) return false;
                                break;
                            default:
                                return false;
                        }
                        return true;
                    })?.active === true
                );
            };
            pinnedTabsData[this.type]![this.path] = currentPinnedTabs.map(
                (tab): NonNullable<PinnedSubTabsJSONData[keyof PinnedSubTabsJSONData]>[string][number] => ({
                    target: tab.target,
                    contentType: tab.contentType,
                    // BUG: This doesn't preserve the parse and serialize methods of custom formats.
                    formatData: tab.formatData,
                    name: tab.name,
                    icon: tab.icon,
                    specialTabID: tab.specialTabID,
                    active: (hasCurrentActivePinnedTab ? this.selectedTab === tab : wasLastPinnedTab(tab)) || undefined,
                })
            );
            writeFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), JSON.stringify(pinnedTabsData));
        }
        public isModified(): boolean {
            return this.modifiedFiles.leveldb || this.modifiedFiles.files.length > 0 || this.openTabs.some((tab): boolean => tab.isModified());
        }
        public setModifications(modifications: typeof this.modifiedFiles): void {
            if (this.readonly || ![TabManagerTabMode.CopyUntilSave].includes(this.mode)) return;
            const wasModified: boolean = this.isModified();
            this.modifiedFiles = modifications;
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        /**
         * Marks a file as having changes written to disk in the copy of the files, that have not yet been copied to the original files.
         *
         * This is only for when the changes to the file have already been written to disk in the copy of the files.
         *
         * Only used for the {@link TabManagerTabMode.CopyUntilSave} mode.
         *
         * @param file The relative file path.
         * @param isModified Whether the file is modified.
         */
        public setFileAsModified(file: string, isModified: boolean = true): void {
            if (this.readonly || ![TabManagerTabMode.CopyUntilSave].includes(this.mode) || this.modifiedFiles.files.includes(file) === isModified) return;
            const wasModified: boolean = this.isModified();
            if (isModified) {
                this.modifiedFiles.files.push(file);
            } else {
                this.modifiedFiles.files.splice(this.modifiedFiles.files.indexOf(file), 1);
            }
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        /**
         * Marks the levelDB as having changes written to disk in the copy of the files, that have not yet been copied to the original files.
         *
         * This is only for when the changes to the LevelDB have already been written to disk in the copy of the files.
         *
         * Only used for the {@link TabManagerTabMode.CopyUntilSave} mode.
         *
         * @param isModified Whether the LevelDB is modified.
         */
        public setLevelDBIsModified(isModified: boolean = true): void {
            if (this.readonly || ![TabManagerTabMode.CopyUntilSave].includes(this.mode) || this.modifiedFiles.leveldb === isModified) return;
            const wasModified: boolean = this.isModified();
            this.modifiedFiles.leveldb = isModified;
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        /**
         * Saves the tab.
         *
         * @param ignoreFailedTabSaves Allows the function to continue even when an error occurs while saving a sub-tab.
         * @param unsafeMode Disables the protections that delete existing world files before saving, a side effect is that if a world is opened while this tab is open, data from before and after the save may be merged randomly.
         * @returns A promise that resolves when the tab has been saved.
         */
        // TODO: Maybe this shouldn't copy folders and files that are not necessary to copy, so that is there is a 60 GB development-related folder that isn't explicitly marked as never copy in WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY, then it won't try to copy 60 GB of data.
        // TODO: Add a way to abort saving.
        public async save(ignoreFailedTabSaves: boolean = false, unsafeMode: boolean = false): Promise<void> {
            if (this.isSaving || this.readonly || !this.saveEnabled || !this.tempPath || !this.tempFilePath) return;
            if (!this.fragileLevelDBAlreadyShattered) {
                switch (this.hasFragileLevelDB) {
                    case true:
                        switch (this.mode) {
                            case TabManagerTabMode.Readonly:
                            case TabManagerTabMode.CopyUntilSave:
                                if (
                                    (
                                        await dialog.showMessageBox({
                                            type: "warning",
                                            title: "Bedrock World Editor",
                                            message: `Are you sure you want to save this world? It has a fragile LevelDB and will appear corrupted to the version it was last used in if you save it.`,
                                            detail: "This world was last opened in a version that is affected by a bug where if you access the LevelDB on it, the world will be very broken (it will work fine on versions not affected by the bug, but the versions that are affected will behave very strangely). Some effects of the bug include: World data wipes, extremely slow chunk loading and lag spikes, instant crashes (on low-end devices), extremely long world loading using 100% CPU, rubberbanding, etc.",
                                            buttons: ["Proceed", "Cancel"],
                                            noLink: true,
                                        })
                                    ).response
                                ) {
                                    return;
                                }
                                this.fragileLevelDBAlreadyShattered = true;
                                this.emit("otherStatusChanged", { tab: this, status: "fragileLevelDBAlreadyShattered" });
                                break;
                            case TabManagerTabMode.ReadonlyDirect:
                            case TabManagerTabMode.Direct:
                            case TabManagerTabMode.Copy:
                            default:
                                break;
                        }
                        break;
                    case "possible":
                        switch (this.mode) {
                            case TabManagerTabMode.Readonly:
                            case TabManagerTabMode.CopyUntilSave:
                                if (
                                    (
                                        await dialog.showMessageBox({
                                            type: "warning",
                                            title: "Bedrock World Editor",
                                            message: `Are you sure you want to save this world? It might have a fragile LevelDB and may appear corrupted to the version it was last used in if you save it.`,
                                            detail: "This world was last opened in a version that might have been affected by a bug where if you access the LevelDB on it, the world will be very broken (it will work fine on versions not affected by the bug, but the versions that are affected will behave very strangely). Some effects of the bug include: World data wipes, extremely slow chunk loading and lag spikes, instant crashes (on low-end devices), extremely long world loading using 100% CPU, rubberbanding, etc.",
                                            buttons: ["Proceed", "Cancel"],
                                            noLink: true,
                                        })
                                    ).response
                                ) {
                                    return;
                                }
                                this.fragileLevelDBAlreadyShattered = true;
                                this.emit("otherStatusChanged", { tab: this, status: "fragileLevelDBAlreadyShattered" });
                                break;
                            case TabManagerTabMode.ReadonlyDirect:
                            case TabManagerTabMode.Direct:
                            case TabManagerTabMode.Copy:
                            default:
                                break;
                        }
                        break;
                    case undefined:
                        await this.awaitFragilityCheck;
                        if (this.hasFragileLevelDB === undefined) throw new TypeError("hasFragileLevelDB is still undefined after awaitFragilityCheck");
                        return void (await this.save(ignoreFailedTabSaves, unsafeMode));
                    case "unknown":
                    // TODO: Maybe add a warning here?
                    case false:
                    case null:
                    default:
                        break;
                }
            }
            this.isSaving = true;
            this.emit("startedSaving", { tab: this });
            const progressBar = new ProgressBar({
                indeterminate: true,
                title: "Saving...",
                text: `Saving ${this.name}...`,
                browserWindow: {
                    parent: getCurrentWindow(),
                    closable: false,
                },
            });
            await new Promise<void>((resolve: () => void): void => void progressBar.on("ready", resolve));
            let successful: boolean = true;
            let error: unknown;
            try {
                for (const tab of this.openTabs) {
                    try {
                        if (!tab.isModified()) continue;
                        progressBar.detail = `Saving tab: ${tab.name}`;
                        await tab.save();
                    } catch (e) {
                        if (ignoreFailedTabSaves) console.error(`Failed to save tab ${this.name} (${this.path})`, e);
                        else throw e;
                    }
                }
                progressBar.detail = `Copying modified files to ${
                    this.type === "world" ? "world"
                    : this.type === "leveldb" ? "LevelDB"
                    : "source"
                }...`;
                if (this.type === "world" || this.type === "leveldb") {
                    console.log(`Copying modified files from ${this.tempPath} to ${this.path}...`);
                    // await this.db?.close();
                    if (!unsafeMode && existsSync(this.path)) {
                        if (this.type === "world" && WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY_APPLICABLE_MODES.includes(this.mode)) {
                            for (const dirent of await readdir(this.path, { withFileTypes: true })) {
                                if (dirent.isDirectory() && WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY.includes(dirent.name)) continue;
                                await rm(path.join(this.path, dirent.name), { recursive: true, force: true });
                            }
                        } else await rm(this.path, { recursive: true, force: true });
                    }
                    let fileNumber: number = 0;
                    const tempPath: string = this.tempPath;
                    await cp(this.tempPath, this.path, {
                        recursive: true,
                        force: true,
                        preserveTimestamps: true,
                        filter: (source: string, _destination: string): true => {
                            // this._abortSignal.throwIfAborted(); // TODO: This should be a separate abortSignal for aborting the save.
                            progressBar.detail = `Copying modified files to ${
                                this.type === "world" ? "world"
                                : this.type === "leveldb" ? "LevelDB"
                                : "source"
                            }...\n\rFile ${++fileNumber}: ${path.relative(tempPath, source)}`;
                            return true;
                        },
                    });
                    if (this.type === "world" && WORLD_FOLDER_SUBPATHS_TO_NEVER_COPY_APPLICABLE_MODES.includes(this.mode)) {
                        let fileNumber: number = 0;
                        for (const pathToRemove of this.pathsToRemoveOnSave) {
                            progressBar.detail = `Deleting removed files from ${
                                this.type === "world" ? "world"
                                : this.type === "leveldb" ? "LevelDB"
                                : "source"
                            }...\n\rFile ${++fileNumber}: ${pathToRemove}`;
                            await rm(path.join(this.path, pathToRemove), { recursive: true, force: true });
                        }
                    }
                } else {
                    await copyFile(this.tempFilePath, this.path);
                }
                setTimeout((): void => {
                    this.modifiedFiles.files.length = 0;
                    this.modifiedFiles.leveldb = false;
                    progressBar._window?.setClosable(true);
                    progressBar.close();
                }, 1);
                this.#lastModificationState = false;
                this.emit("modificationStatusChanged", { tab: this, isModified: false });
            } catch (e) {
                successful = false;
                error = e;
                setTimeout((): void => {
                    progressBar._window?.setClosable(true);
                    progressBar.close();
                }, 1);
                dialog.showErrorBox("Error Saving", stringifyError(e));
                // progressBar.maxValue = 100;
                // progressBar.value = 100;
                throw e;
            } finally {
                this.isSaving = false;
                // if (this.db) {
                //     this.awaitDBOpen = this.db.open().then(
                //         (): true => {
                //             this.refreshCachedDBKeys();
                //             return true;
                //         },
                //         (err: unknown): false => {
                //             console.error(err);
                //             this.errorOnDBOpen = err;
                //             if (err instanceof Error && err.message === "Error: Corruption: CURRENT file does not end with newline") {
                //                 if (
                //                     existsSync(path.join(this.tempPath ?? this.path, "db", "CURRENT")) &&
                //                     readFileSync(path.join(this.tempPath ?? this.path, "db", "CURRENT"))
                //                         .subarray(0, 17)
                //                         .equals(Buffer.from("00000000fcb9cf9b000000000000000024", "hex"))
                //                 ) {
                //                     this.errorDueToEncryptedLevelDB = true;
                //                 }
                //             }
                //             return false;
                //         }
                //     );
                // }
                if (successful) this.emit("stoppedSaving", { tab: this, successful, error });
            }
        }
        public openTab(
            props: Omit<ConstructorParameters<typeof TabManagerSubTab>[0], "parentTab"> &
                Partial<Pick<ConstructorParameters<typeof TabManagerSubTab>[0], "parentTab">>,
            switchToTab: boolean = true
        ): TabManagerSubTab {
            const alreadyOpenEquivalentTab: TabManagerSubTab | undefined = this.openTabs.find(
                (tab: TabManagerSubTab): boolean =>
                    // BUG: This results in two copies of sub-tabs that are directly accessible via the left sidebar being able to be opened (one via the left sidebar, and one via the "View Files" tab).
                    (tab.specialTabID && tab.specialTabID === props.specialTabID) ||
                    (!tab.specialTabID &&
                        !props.specialTabID &&
                        tab.target.type === props.target.type &&
                        (tab.target.type === "File" && props.target.type === "File" ?
                            tab.target.path === props.target.path
                        :   tab.target.type === "LevelDBEntry" && props.target.type === "LevelDBEntry" && tab.target.key.equals(props.target.key)))
            );
            if (alreadyOpenEquivalentTab) {
                if (switchToTab && this.selectedTab !== alreadyOpenEquivalentTab) this.switchTab(alreadyOpenEquivalentTab);
                return alreadyOpenEquivalentTab;
            }
            const tab = new TabManagerSubTab({ parentTab: this, readonly: this.readonly, ...props });
            this.openTabs.push(tab);
            this.emit("openTab", { tab });
            if (switchToTab) this.switchTab(tab);
            return tab;
        }
        public switchTab(tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null): void {
            if (typeof tab === "string") {
                switch (tab) {
                    case "world-settings":
                        tab =
                            this.openTabs.find((tab) => tab.specialTabID === "world-settings") ??
                            this.openTab({
                                contentType: "LevelDat",
                                icon: "auto",
                                name: "level.dat",
                                parentTab: this,
                                specialTabID: "world-settings",
                                target: { type: "File", path: "level.dat" },
                            });
                        break;
                    case "dynamic-properties":
                        tab =
                            this.openTabs.find((tab) => tab.specialTabID === "dynamic-properties") ??
                            this.openTab({
                                contentType: "DynamicProperties",
                                icon: "auto",
                                name: "DynamicProperties",
                                parentTab: this,
                                specialTabID: "dynamic-properties",
                                target: { type: "LevelDBEntry", key: Buffer.from("DynamicProperties") },
                            });
                        break;
                    case "portals":
                        tab =
                            this.openTabs.find((tab) => tab.specialTabID === "portals") ??
                            this.openTab({
                                contentType: "Portals",
                                icon: "auto",
                                name: "portals",
                                parentTab: this,
                                specialTabID: "portals",
                                target: { type: "LevelDBEntry", key: Buffer.from("portals") },
                            });
                        break;
                    case "schedulerwt":
                        tab =
                            this.openTabs.find((tab) => tab.specialTabID === "schedulerwt") ??
                            this.openTab({
                                contentType: "SchedulerWT",
                                icon: "auto",
                                name: "schedulerWT",
                                parentTab: this,
                                specialTabID: "schedulerwt",
                                target: { type: "LevelDBEntry", key: Buffer.from("schedulerWT") },
                            });
                        break;
                    case "scoreboards":
                        tab =
                            this.openTabs.find((tab) => tab.specialTabID === "scoreboards") ??
                            this.openTab({
                                contentType: "Scoreboard",
                                icon: "auto",
                                name: "scoreboard",
                                parentTab: this,
                                specialTabID: "scoreboards",
                                target: { type: "LevelDBEntry", key: Buffer.from("scoreboard") },
                            });
                        break;

                    case "packs":
                    case "players":
                    case "entities":
                    case "block-entities":
                    case "structures":
                    case "world":
                    case "maps":
                    case "villages":
                    case "ticking-areas":
                    case "ticks":
                    case "view-files":
                    case "fun":
                    case "integrations":
                    case "repair-forced-world-corruption":
                    default:
                        break;
                }
            }
            if (tab === this.selectedTab) return;
            const previousTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null = this.selectedTab;
            this.selectedTab = tab;
            this.emit("switchTab", { previousTab, newTab: tab });
            if (tab instanceof TabManagerSubTab && tab.isPinned) this.savePinnedTabsList();
        }
        // FIXME: If the LevelDB is corrupted and the corruption is detected AFTER opening, for example by refreshCachedDBKeys, this will fail to remove the directory or close the LevelDB, maybe add a way to schedule the deletion for after the process ends.
        public async close(): Promise<void> {
            // this.db?.close();
            this.isValid = false;
            const isActiveTab = this.tabManager.selectedTab === this;
            const index: number = this.tabManager.openTabs.indexOf(this);
            if (this.tabManager.openTabs.includes(this)) {
                this.tabManager.openTabs.splice(this.tabManager.openTabs.indexOf(this), 1);
            }
            for (const tab of this.openTabs) {
                tab.close();
            }
            this.openTabs.length = 0;
            this.switchTab(null);
            if (isActiveTab) {
                this.tabManager.switchTab(index === -1 ? null : (this.tabManager.openTabs[index - 1] ?? this.tabManager.openTabs[0] ?? null));
            }
            this.tabManager.emit("closeTab", { tab: this });
            this.emit("closed");
            if (this.tempPath) {
                {
                    const abortError = new Error("[TabManagerTab preCleanup] Aborted due to tab close.");
                    abortError.name = "AbortError";
                    this._abortController.abort(abortError);
                }
                // TEST: Test closing a world while it is copying to the temp folder for a massive world.
                await allPromisesSettledUnhandled(this._requiredPreCleanupPromises.values());
                // TODO: Maybe add a timeout to this.db.close(), since if LevelDB corruption was detected after opening was completed, this will hang indefinitely.
                if (this.db?.isOpen()) await this.db.close();
                await rm(this.tempPath, { recursive: true, force: true });
                this.emit("cleanupComplete");
            }
        }
        static {
            addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
                if (!(event.reason instanceof Error)) return;
                if (
                    (event.reason.name !== "AbortError" || event.reason.message !== "[TabManagerTab preCleanup] Aborted due to tab close.") &&
                    (!event.reason.cause ||
                        !(event.reason.cause instanceof Error) ||
                        event.reason.cause.name !== "AbortError" ||
                        event.reason.cause.message !== "[TabManagerTab preCleanup] Aborted due to tab close.")
                ) {
                    return;
                }
                event.preventDefault();
            });
        }
        /**
         * Move a sub-tab to a specific index.
         *
         * @param tab The sub-tab to move.
         * @param index The index to move the sub-tab to, `-1` corresponds to the end of the list.
         */
        public moveTab(tab: TabManagerSubTab, index: number): void {
            if (!this.openTabs.includes(tab) || this.openTabs.at(index) === tab) return;
            if (Object.is(index, -0) || index === -1) index = Infinity;
            this.openTabs.splice(this.openTabs.indexOf(tab), 1);
            this.openTabs.splice(index < 0 ? index + 1 : index, 0, tab);
            this.emit("reorderTabs", { tabs: this.openTabs });
            if (tab.isPinned) this.savePinnedTabsList();
        }
    }

    /**
     * @todo
     */
    export interface TabManagerSubTabChange {
        type: "AddNBTKey";
        keyPath: string[];
        value: NBT.TagType[];
    }

    interface MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase {
        dataStorageObject?: DataStorageObject | undefined;
    }

    type MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase2 = {
        [key in Exclude<MCEntryContentType, keyof MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase>]: {
            type: key;
        } & MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase &
            ((typeof entryContentTypeToFormatMap)[key]["type"] extends "NBT" ? { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
            : (typeof entryContentTypeToFormatMap)[key]["type"] extends "custom" ?
                VerifyConstraint<(typeof entryContentTypeToFormatMap)[key], { type: "custom" }>["resultType"] extends "JSONNBT" ?
                    { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
                :   unknown
            :   unknown);
    } & MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase;

    interface MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase {
        StructureTemplate: {
            type: "StructureTemplate";
            viewMode?: "3D" | "2D" | "node" | "jsonnbt" | "snbt" | "raw";
        } & MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
        FlatWorldLayers: {
            type: "FlatWorldLayers";
            viewMode?: "FlatWorldLayers" | "node" | "jsonnbt" | "snbt" | "raw";
        } & MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
        Map: {
            type: "Map";
            viewMode?: "map" | "node" | "jsonnbt" | "snbt" | "raw";
        } & MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
    }

    export interface MCEntryContentTypeToTabManagerSubTabCurrentStateOptions
        extends MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase, MCEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase2 {}

    export interface TabManagerSubTabCurrentState<ContentType extends MCEntryContentType = MCEntryContentType> {
        scrollTop: number;
        options: MCEntryContentTypeToTabManagerSubTabCurrentStateOptions[ContentType];
    }

    export interface GenericDataStorageObjectBase {
        /**
         * The model ID of the model that was last used to edit this data object, or undefined if the last thing to edit it was not a model.
         */
        lastEditedInModel?: string | undefined;
        /**
         * A map of model IDs to WeakRefs of the data object they they last wrote, this is for if the data object is set to a different value, then it can be detected sometimes, this only is useful when the whole object is replaced.
         */
        lastSavedDataObjectForModel?: Map<string, WeakRef<object>> | undefined;
    }

    export interface GenericDataStorageObjectNBTCompound extends GenericDataStorageObjectBase {
        data: NBT.Compound;
        dataType: "NBTCompound";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectNBT extends GenericDataStorageObjectBase {
        data: Awaited<ReturnTypeWithArgs<(typeof NBT)["parse"], [data: Buffer, nbtType?: NBT.NBTFormat | undefined]>>;
        dataType: "NBT";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectJSON extends GenericDataStorageObjectBase {
        data: Record<string | number, GenericDataStorageObjectJSON_JSONNodeValue>;
        dataType: "JSON";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectJSONC extends GenericDataStorageObjectBase {
        data: CommentJSONValue;
        dataType: "JSONC";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectASCII extends GenericDataStorageObjectBase {
        data: string;
        dataType: "ASCII";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectUTF8 extends GenericDataStorageObjectBase {
        data: string;
        dataType: "UTF-8";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectHex extends GenericDataStorageObjectBase {
        data: string;
        dataType: "hex";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectBinaryPlainText extends GenericDataStorageObjectBase {
        data: string;
        dataType: "binaryPlainText";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectInt extends GenericDataStorageObjectBase {
        data: bigint;
        dataType: "int";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectBinary extends GenericDataStorageObjectBase {
        data: Buffer;
        dataType: "binary";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectUnknown extends GenericDataStorageObjectBase {
        data: any;
        dataType: "unknown";
        sourceType: EntryContentTypeFormatData;
    }

    export type GenericDataStorageObjectJSON_JSONNodeValue =
        | { [key: string | number]: GenericDataStorageObjectJSON_JSONNodeValue }
        | string
        | number
        | boolean
        | null
        | GenericDataStorageObjectJSON_JSONNodeValue[];

    export type GenericDataStorageObject =
        | GenericDataStorageObjectNBTCompound
        | GenericDataStorageObjectNBT
        | GenericDataStorageObjectJSON
        | GenericDataStorageObjectJSONC
        | GenericDataStorageObjectASCII
        | GenericDataStorageObjectUTF8
        | GenericDataStorageObjectHex
        | GenericDataStorageObjectBinaryPlainText
        | GenericDataStorageObjectInt
        | GenericDataStorageObjectBinary
        | GenericDataStorageObjectUnknown;

    export type DataStorageObject = GenericDataStorageObject &
        PartialWU<Omit<TreeEditorDataStorageObjectInput & MapEditorDataStorageObject & HexEditorDataStorageObject, KeysOfUnion<GenericDataStorageObject>>>;

    // TODO: Add icons for the content types that are missing icons.
    const tabManagerSubTabContentTypeToDefaultIconMap: Record<MCEntryContentType | "ChunksDatEntry", string | undefined> = {
        AABBVolumes: "resource://images/ui/glyphs/mob_spawner.png",
        ActorDigestVersion: "resource://images/ui/glyphs/icon_panda_2stack_history.png", // Maybe an entity icon with a list icon on it with a history icon on that? Or maybe a layered entity icon (as in a stack of entity icons) with a history icon on that? And it should somehow convey that it is entity UUIDs and not entity data.
        ActorPrefix: "resource://images/ui/glyphs/icon_panda.png",
        AutonomousEntities: undefined,
        BiomeData: "resource://images/ui/glyphs/icon_biome.png",
        BiomeIdsTable: "resource://images/ui/glyphs/icon_biome_config.png",
        BiomeState: undefined, // Something snow layer related.
        BlendingBiomeHeight: undefined,
        BlendingData: undefined,
        BlockEntity: undefined, // Maybe a chest icon? Or maybe a layered icon with multiple chests?
        BorderBlocks: "resource://images/ui/glyphs/BlockSprite_border.png",
        Checksums: "resource://images/ui/glyphs/checksum.png", // Made by @Aevarkan
        ChunkLoadedRequest: undefined,
        ConversionData: undefined,
        CustomDimension: "resource://images/ui/glyphs/portalBg.png",
        Data2D: undefined, // Maybe a 2D icon that indicates biome data somehow.
        Data2DLegacy: undefined, // Maybe a 2D icon that indicates biome data somehow, with something to indicate it is the legacy format, such as a cobweb.
        Data3D: undefined, // Maybe a 3D icon that indicates biome data somehow.
        Digest: "resource://images/ui/glyphs/icon_panda_2stack_uuid.png", // Something indicating this is a list of entity UUIDs in the chunk.
        DimensionNameIdTable: "resource://images/ui/glyphs/portalBg_config.png",
        DynamicProperties: "resource://images/ui/glyphs/Data-Empty_16x.png", // Maybe make this Data-Empty icon layered on top of the add-ons icon?
        Entity: "resource://images/ui/glyphs/icon_panda_2stack.png", // Something indicating this is a list of entities (including their data) in the chunk.
        FinalizedState: undefined, // This controls the finalization state of a chunk's data, with 0 being the chunk need to be ticked, 1 being the chunk need to be populated with mobs, and 2 being finalized. The icon should represent this somehow.
        FlatWorldLayers: "resource://images/ui/glyphs/flat_world_layers.png", // Made by @Aevarkan
        ForcedWorldCorruption: "resource://images/ui/glyphs/world_glyph_color_corrupted_1.png", // The other good option was world_glyph_desaturated_corrupted_8.png.
        GeneratedPreCavesAndCliffsBlending: undefined,
        GenerationSeed: "resource://images/ui/glyphs/seeds_wheat.png",
        HardcodedSpawners: "resource://images/ui/glyphs/mob_spawner_cobweb.png",
        ImportedChunksDat: "resource://images/ui/glyphs/EnvSprite_cliff.png",
        JigsawStructureBlueprint: "resource://images/ui/glyphs/jigsaw_front.png",
        LANPlayerDat: "resource://images/ui/glyphs/icon_steve_lan.png",
        LegacyBlockExtraData: "resource://images/ui/glyphs/BlockSprite_snowlogged-dandelion.png",
        LegacyConsolePlayer: "resource://images/ui/glyphs/icon_steve_console.png",
        LegacyNether: undefined, // Maybe the same icon as the Nether content type, but with something to indicate it is the legacy format, such as a cobweb?
        LegacyOverworld: undefined, // Maybe the same icon as the Overworld content type, but with something to indicate it is the legacy format, such as a cobweb?
        LegacyTerrain: "resource://images/ui/glyphs/grass_block_side_JE3_BE1.png",
        LegacyTheEnd: undefined, // Maybe the same icon as the TheEnd content type, but with something to indicate it is the legacy format, such as a cobweb?
        LegacyVersion: undefined, // Maybe a history icon, with something to indicate it is the legacy format, such as a cobweb?
        LevelChunkMetaDataDictionary: "resource://images/ui/glyphs/update_world_chunks_16x.png",
        LevelDat: "resource://images/ui/glyphs/settings_glyph_color_2x.png",
        LevelSpawnWasFixed: undefined,
        Map: "resource://images/ui/glyphs/icon_map.png",
        MCChinaDevDimension: "resource://images/ui/glyphs/portalBg.png",
        MetaDataHash: undefined,
        MobEvents: undefined,
        MVillages: undefined,
        NeteaseData: "resource://images/ui/glyphs/MCCN_Icon_16x.png",
        NeteaseScriptGid: "resource://images/ui/glyphs/MCCN_Icon_Python_16x.png",
        Nether: "resource://images/ui/glyphs/portalBg.png",
        Overworld: "resource://images/ui/glyphs/portalBg.png",
        PendingTicks: undefined, // Something clock related. Maybe somehow indicating that it is planned/scheduled? Maybe with a calendar?
        Player: "resource://images/ui/glyphs/icon_steve_server.png",
        PlayerClient: "resource://images/ui/glyphs/icon_steve_client.png",
        PlayerDat: "resource://images/ui/glyphs/icon_steve_dat.png",
        POIRegion: undefined,
        POIRegionRegistry: undefined,
        POITypes: undefined,
        Portals: "resource://images/ui/glyphs/realmPortalSmall.png",
        PositionTrackingDB: "resource://images/ui/glyphs/lodestone_side.png",
        PositionTrackingLastId: "resource://images/ui/glyphs/lodestonecompass_item.png",
        RandomTicks: "resource://images/ui/glyphs/random_ticks_1.png", // Made by @Aevarkan
        RealmsStoriesData: "resource://images/ui/glyphs/realmsStoriesIcon.png",
        SchedulerWT: "resource://images/ui/glyphs/icon_wandering_trader.png",
        Scoreboard: "resource://images/ui/glyphs/icon_best3.png",
        SSTCommandLog: undefined,
        SSTHashRegistry: undefined,
        StructureTemplate: "resource://images/ui/glyphs/structure_block.png",
        SubChunkPrefix: "resource://images/ui/glyphs/EnvSprite_chunk.png",
        TheEnd: "resource://images/ui/glyphs/portalBg.png",
        TickingArea: undefined, // Should be a clock icon. Maybe with an indication is is chunk loading related?
        Unknown: undefined, // Maybe a question mark icon? Or maybe leave it undefined?
        unknown0x70: undefined, // TEMP: Figure out what this is first.
        unknown0x71: undefined, // TEMP: Figure out what this is first.
        Version: undefined, // Maybe a history icon?
        VersionMarkInsert: undefined, // TEMP: Figure out what this is actually used for first.
        VersionEnchant: undefined, // TEMP: Figure out what this is actually used for first.
        VillageDwellers: undefined,
        VillageInfo: undefined,
        VillagePlayers: undefined,
        VillagePOI: undefined,
        VillageRaid: undefined,
        Villages: undefined,
        WorldClocks: "resource://images/ui/glyphs/icon_clock_17.png",
        ChunksDatEntry: "resource://images/ui/glyphs/brick_stairs_JE4_BE1.png",
    };

    export class TabManagerSubTab<ContentType extends MCEntryContentType = MCEntryContentType> {
        #hasUnsavedChanges: boolean = false;
        #isPinned: boolean = false;
        public static lastID: bigint = 0n;
        public readonly parentTab: TabManagerTab;
        public name: string;
        public icon?: LooseAutocomplete<"auto"> | undefined;
        public contentType: ContentType;
        /**
         * The format data of this sub-tab, if this is present is should be used instead of determining it from the {@link contentType}.
         */
        public formatData?: EntryContentTypeFormatData | undefined;
        public rawMode: boolean = false;
        public target:
            | {
                  type: "LevelDBEntry";
                  /**
                   * The raw key of the entry.
                   */
                  key: Buffer;
              }
            | {
                  type: "ChunksDatEntry";
                  /**
                   * The chunk indices of the entry.
                   */
                  chunk: VectorXZ;
              }
            | {
                  type: "File";
                  /**
                   * A relative path from the parent tab location to the file.
                   *
                   * If the parent tab is a file and this is `""`, then the file is the same as the parent tab.
                   */
                  path: LooseAutocomplete<"">;
              };
        /**
         * @todo
         */
        public activeChanges: TabManagerSubTabChange[] = [];
        public currentState: TabManagerSubTabCurrentState<ContentType>;
        public specialTabID?: TabManagerTabGenericSubTabID | undefined;
        public readonly readonly: boolean = false;
        public readonly id: bigint = TabManagerSubTab.lastID++;
        public isValid: boolean = true;
        public constructor(props: {
            parentTab: TabManagerTab;
            name: TabManagerSubTab<ContentType>["name"];
            icon?: TabManagerSubTab<ContentType>["icon"] | undefined;
            contentType: ContentType;
            formatData?: EntryContentTypeFormatData | undefined;
            target: TabManagerSubTab<ContentType>["target"];
            specialTabID?: TabManagerTabGenericSubTabID | undefined;
            isPinned?: boolean | undefined;
            readonly?: boolean | undefined;
        }) {
            this.parentTab = props.parentTab;
            this.name = props.name;
            if (props.icon === "auto") {
                if (props.contentType === "Unknown") {
                    if (props.target.type === "ChunksDatEntry") this.icon = tabManagerSubTabContentTypeToDefaultIconMap.ChunksDatEntry;
                    else this.icon = tabManagerSubTabContentTypeToDefaultIconMap.Unknown;
                } else this.icon = tabManagerSubTabContentTypeToDefaultIconMap[props.contentType];
            } else this.icon = props.icon;
            this.target = props.target;
            this.contentType = props.contentType;
            if (this.target.type === "ChunksDatEntry" && !props.formatData) {
                this.formatData = {
                    type: "custom",
                    resultType: "JSONNBT",
                    parse: ChunksDatUtils.parseRawChunksDatChunk,
                    serialize: ChunksDatUtils.chunksDatChunkToRaw,
                };
            } else this.formatData = props.formatData;
            this.specialTabID = props.specialTabID;
            this.currentState = {
                scrollTop: 0,
                options: {
                    type: props.contentType,
                } as MCEntryContentTypeToTabManagerSubTabCurrentStateOptions[ContentType],
            };
            this.#isPinned = props.isPinned ?? false;
            this.readonly = props.readonly ?? false;
        }
        public get isPinned(): boolean {
            return this.#isPinned;
        }
        public set isPinned(value: boolean) {
            this.#isPinned = value;
            if (value) {
                const firstUnpinnedIndex: number = this.parentTab.openTabs.findIndex((tab) => tab.isPinned);
                if (firstUnpinnedIndex !== -1 && this.parentTab.openTabs.indexOf(this) > firstUnpinnedIndex) {
                    this.parentTab.openTabs.splice(this.parentTab.openTabs.indexOf(this), 1);
                    this.parentTab.openTabs.splice(firstUnpinnedIndex, 0, this);
                }
            }
            this.parentTab.savePinnedTabsList();
        }
        public get hasUnsavedChanges(): boolean {
            return this.#hasUnsavedChanges;
        }
        public set hasUnsavedChanges(value: boolean) {
            if (this.readonly) return;
            const wasModified: boolean = this.isModified();
            this.#hasUnsavedChanges = value;
            if (wasModified !== this.isModified()) this.parentTab.emit("subTabModificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        /**
         * Marks this tab as having its changes written disk in the copy of the files, that have not yet been copied to the original files.
         *
         * This is only for when the changes in this tab have already been written to disk in the copy of the files.
         *
         * Only used for the {@link TabManagerTabMode.CopyUntilSave} mode.
         */
        public markChangesAsSavedToDiskInCopy(): void {
            if (![TabManagerTabMode.CopyUntilSave].includes(this.parentTab.mode)) return;
            if (this.target.type === "File" && ["world", "leveldb"].includes(this.parentTab.type)) {
                this.parentTab.setFileAsModified(this.target.path);
            } else if (this.target.type === "LevelDBEntry" && ["world", "leveldb"].includes(this.parentTab.type)) {
                this.parentTab.setLevelDBIsModified();
            } else if (this.target.type === "ChunksDatEntry" && ["world"].includes(this.parentTab.type)) {
                this.parentTab.setFileAsModified("chunks.dat");
            }
        }
        public isModified(): boolean {
            return this.hasUnsavedChanges || this.activeChanges.length > 0;
        }
        /**
         * Parse raw data into a partial data storage object.
         *
         * This method does not mutate the sub-tab's stored data storage object.
         *
         * @param rawData The raw data to parse.
         * @param format The format of the raw data. If not provided, it will be inferred from the content type.
         * @returns A promise that resolves with the parsed partial data storage object.
         *
         * @throws {Error} If the format type is not supported.
         * @throws {unknown} If the data cannot be parsed.
         */
        public async parseRawData(rawData: Buffer, format?: EntryContentTypeFormatData): Promise<Pick<DataStorageObject, "sourceType" | "dataType" | "data">> {
            if (this.target.type === "ChunksDatEntry") {
                return {
                    sourceType: {
                        type: "custom",
                        resultType: "JSONNBT",
                        parse: ChunksDatUtils.parseRawChunksDatChunk,
                        serialize: ChunksDatUtils.chunksDatChunkToRaw,
                    },
                    dataType: "NBTCompound",
                    data: ChunksDatUtils.parseRawChunksDatChunk(rawData),
                };
            }
            format ??= this.formatData ?? (entryContentTypeToFormatMap[this.currentState.options.type] as EntryContentTypeFormatData);
            switch (format.type) {
                case "NBT": {
                    return {
                        sourceType: format,
                        dataType: "NBT",
                        data: await NBT.parse(rawData),
                    } as const satisfies Pick<GenericDataStorageObjectNBT & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "SNBT": {
                    return {
                        sourceType: format,
                        dataType: "NBTCompound",
                        data: parseSNBTCompoundString(rawData.toString("binary")),
                    } as const satisfies Pick<GenericDataStorageObjectNBTCompound & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                // REVIEW: Make sure this actually works with other JSON data that doesn't have an object as the root.
                case "JSON": {
                    return {
                        sourceType: format,
                        dataType: "JSON",
                        data: JSON.parse(rawData.toString("binary")) as GenericDataStorageObjectJSON["data"],
                    } as const satisfies Pick<GenericDataStorageObjectJSON & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "JSONC": {
                    return {
                        sourceType: format,
                        dataType: "JSONC",
                        data: commentJSON.parse(rawData.toString("binary")),
                    } as const satisfies Pick<GenericDataStorageObjectJSONC & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "ASCII": {
                    return {
                        sourceType: format,
                        dataType: "ASCII",
                        data: rawData.toString("ascii"),
                    } as const satisfies Pick<GenericDataStorageObjectASCII & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "UTF-8": {
                    return {
                        sourceType: format,
                        dataType: "UTF-8",
                        data: rawData.toString("utf-8"),
                    } as const satisfies Pick<GenericDataStorageObjectUTF8 & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "hex": {
                    return {
                        sourceType: format,
                        dataType: "hex",
                        data: rawData.toString("hex"),
                    } as const satisfies Pick<GenericDataStorageObjectHex & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "binaryPlainText": {
                    return {
                        sourceType: format,
                        dataType: "binaryPlainText",
                        data: rawData.toString("binary"),
                    } as const satisfies Pick<GenericDataStorageObjectBinaryPlainText & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "int": {
                    return {
                        sourceType: format,
                        dataType: "int",
                        data: parseSpecificIntType(rawData, format.bytes, format.format, format.signed),
                    } as const satisfies Pick<GenericDataStorageObjectInt & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "unknown":
                case "binary": {
                    return {
                        sourceType: format,
                        dataType: "binary",
                        data: rawData,
                    } as const satisfies Pick<GenericDataStorageObjectBinary & DataStorageObject, "sourceType" | "dataType" | "data">;
                }
                case "custom": {
                    switch (format.resultType) {
                        case "JSONNBT": {
                            return {
                                sourceType: format,
                                dataType: "NBTCompound",
                                data: await format.parse(rawData),
                            } as const satisfies Pick<GenericDataStorageObjectNBTCompound & DataStorageObject, "sourceType" | "dataType" | "data">;
                        }
                        case "SNBT": {
                            return {
                                sourceType: format,
                                dataType: "NBTCompound",
                                data: parseSNBTCompoundString(await format.parse(rawData)),
                            } as const satisfies Pick<GenericDataStorageObjectNBTCompound & DataStorageObject, "sourceType" | "dataType" | "data">;
                        }
                        case "buffer": {
                            return {
                                sourceType: format,
                                dataType: "binary",
                                data: await format.parse(rawData),
                            } as const satisfies Pick<GenericDataStorageObjectBinary & DataStorageObject, "sourceType" | "dataType" | "data">;
                        }
                        case "unknown": {
                            return {
                                sourceType: format,
                                dataType: "unknown",
                                data: (await format.parse(rawData)) as unknown,
                            } as const satisfies Pick<GenericDataStorageObjectUnknown & DataStorageObject, "sourceType" | "dataType" | "data">;
                        }
                        default:
                            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                            throw new Error(`Unknown format type: ${format?.["type"]}.${format?.["resultType"]}`);
                    }
                }
                default:
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                    throw new Error(`Unknown format type: ${format?.["type"]}`);
            }
        }
        /**
         * Loads the data for this sub-tab.
         *
         * @param binary Whether to load the data as binary.
         * @returns A promise that resolves when the data has been loaded.
         *
         * @throws {Error} If the parent tab has no associated LevelDB.
         * @throws {Error} If the LevelDB is not open and this sub-tab is a LevelDB entry.
         * @throws {ReferenceError} If the LevelDB key or file associated with this sub-tab does not exist.
         * @throws {ReferenceError} If the `chunks.dat` file associated with this sub-tab does not exist.
         * @throws {Error} If the format type for this sub-tab's content type is not supported and `binary` is `false`.
         * @throws {unknown} If the LevelDB throws an error when trying to be read and this sub-tab is a LevelDB entry.
         * @throws {unknown} If the file throws an error when trying to be read and this sub-tab is a file.
         * @throws {unknown} If the data cannot be parsed.
         */
        public async loadData(binary: boolean = false): Promise<void> {
            switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");
                    if (binary) {
                        const rawData: Buffer | null = await this.parentTab.db.get(this.target.key);
                        if (rawData === null) {
                            throw new ReferenceError("The LevelDB key associated with this sub-tab does not exist.");
                        }
                        this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                        this.currentState.options.dataStorageObject.dataType = "binary";
                        this.currentState.options.dataStorageObject.data = rawData /* ?? Buffer.from([]) */;
                        break;
                    }
                    const format: EntryContentTypeFormatData =
                        this.currentState.options.dataStorageObject?.sourceType ??
                        (this.currentState.options.type === "Unknown" && this.currentState.options.type === this.contentType ? this.formatData : undefined) ??
                        (entryContentTypeToFormatMap[this.currentState.options.type] as EntryContentTypeFormatData);
                    const rawData: Buffer | null = await this.parentTab.db.get(this.target.key);
                    if (rawData === null) {
                        throw new ReferenceError("The LevelDB key associated with this sub-tab does not exist.");
                    }
                    this.currentState.options.dataStorageObject = {
                        hexEditor: this.currentState.options.dataStorageObject?.hexEditor,
                        mapEditor: this.currentState.options.dataStorageObject?.mapEditor,
                        treeEditor: this.currentState.options.dataStorageObject?.treeEditor,
                        ...(await this.parseRawData(rawData, format)),
                    } as const satisfies DataStorageObject;
                    break;
                }
                case "ChunksDatEntry": {
                    const chunksDatPath: string = path.join(this.parentTab.tempPath ?? this.parentTab.path, "chunks.dat");
                    if (!existsSync(chunksDatPath)) {
                        throw new ReferenceError(`The chunks.dat file associated with this sub-tab does not exist: ${chunksDatPath}.`);
                    }
                    if (binary) {
                        this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                        this.currentState.options.dataStorageObject.dataType = "binary";
                        this.currentState.options.dataStorageObject.data = ChunksDatUtils.readRawChunksDatChunk(
                            await readFile(chunksDatPath),
                            this.target.chunk
                        );
                        break;
                    }
                    this.currentState.options.dataStorageObject = {
                        hexEditor: this.currentState.options.dataStorageObject?.hexEditor,
                        mapEditor: this.currentState.options.dataStorageObject?.mapEditor,
                        treeEditor: this.currentState.options.dataStorageObject?.treeEditor,
                        sourceType: {
                            type: "custom",
                            resultType: "JSONNBT",
                            parse: ChunksDatUtils.parseRawChunksDatChunk,
                            serialize: ChunksDatUtils.chunksDatChunkToRaw,
                        },
                        dataType: "NBTCompound",
                        data: ChunksDatUtils.readChunksDatChunk(await readFile(chunksDatPath), this.target.chunk),
                    } as const satisfies DataStorageObject;
                    break;
                }
                case "File": {
                    let filePath: string;
                    pathGetter: {
                        switch (this.parentTab.type) {
                            case "nbt":
                            case "json":
                            case "xml":
                            case "text":
                            case "binary":
                                if (this.target.path === "") {
                                    switch (this.parentTab.mode) {
                                        case TabManagerTabMode.Copy:
                                        case TabManagerTabMode.CopyUntilSave:
                                        case TabManagerTabMode.Readonly:
                                            if (this.parentTab.tempFilePath === undefined) break;
                                            filePath = this.parentTab.tempFilePath;
                                            break pathGetter;
                                        case TabManagerTabMode.Direct:
                                        case TabManagerTabMode.ReadonlyDirect:
                                            filePath = this.parentTab.path;
                                            break pathGetter;
                                        default:
                                            break;
                                    }
                                }
                                break;
                            case "other":
                                // TODO
                                break;
                            case "world":
                            case "leveldb":
                            default:
                                break;
                        }
                        filePath = path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path);
                    }
                    if (!existsSync(filePath)) {
                        throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.target.path}`);
                    }
                    if (binary) {
                        this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                        this.currentState.options.dataStorageObject.dataType = "binary";
                        this.currentState.options.dataStorageObject.data = await readFile(filePath);
                        break;
                    }
                    const format: EntryContentTypeFormatData =
                        this.currentState.options.dataStorageObject?.sourceType ??
                        (this.currentState.options.type === "Unknown" && this.currentState.options.type === this.contentType ? this.formatData : undefined) ??
                        (entryContentTypeToFormatMap[this.currentState.options.type] as EntryContentTypeFormatData);
                    const rawData: Buffer = await readFile(filePath);
                    this.currentState.options.dataStorageObject = {
                        hexEditor: this.currentState.options.dataStorageObject?.hexEditor,
                        mapEditor: this.currentState.options.dataStorageObject?.mapEditor,
                        treeEditor: this.currentState.options.dataStorageObject?.treeEditor,
                        ...(await this.parseRawData(rawData, format)),
                    } as const satisfies DataStorageObject;
                    break;
                }
                default:
                    throw new Error(`Unknown target type: ${(this.target as this["target"])?.type}`);
            }
        }
        /**
         * Exports the raw data for this sub-tab.
         *
         * @param loadIfNotLoaded Whether to load the data if it is not already loaded.
         * @returns A promise that resolves with the raw data.
         *
         * @throws {Error} If the sub-tab has no data and `loadIfNotLoaded` is `false`.
         * @throws {Error} If the sub-tab has no data and the data fails to load.
         * @throws {Error} If the sub-tab has no data type and `loadIfNotLoaded` is `false`.
         * @throws {Error} If the conversion from the loaded data type to the format type for this sub-tab's content type is not supported.
         * @throws {Error} If the loaded data type is not supported.
         * @throws {Error} If the target type is not supported.
         * @throws {unknown} If the sub-tab has no data and an error occurs when trying to load the data.
         * @throws {unknown} If an error occurs when trying to convert the data to binary.
         */
        public async exportRawData(loadIfNotLoaded: boolean = false): Promise<Buffer> {
            if (!this.currentState.options.dataStorageObject) {
                if (!loadIfNotLoaded) throw new Error("This sub-tab has no data.");
                await this.loadData(true);
                if (!this.currentState.options.dataStorageObject) throw new Error("Failed to load data for this sub-tab.");
            }
            if (!this.currentState.options.dataStorageObject?.dataType) {
                if (!loadIfNotLoaded) throw new Error("This sub-tab has no data type.");
                await this.loadData(true);
                if (!this.currentState.options.dataStorageObject) throw new Error("Failed to load data for this sub-tab.");
            }
            switch (this.target.type) {
                case "LevelDBEntry": {
                    const format: EntryContentTypeFormatData | undefined = this.currentState.options.dataStorageObject.sourceType;

                    switch (this.currentState.options.dataStorageObject.dataType) {
                        case "NBTCompound": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            formatTypeSwitcher: switch (format.type) {
                                case "NBT": {
                                    rawData = NBT.writeUncompressed(
                                        { name: "", ...data },
                                        "format" in format ?
                                            format.format === "LE" ? "little"
                                            : format.format === "BE" ? "big"
                                            : format.format === "LEV" ? "littleVarint"
                                            : "little"
                                        :   "little"
                                    );
                                    break;
                                }
                                case "SNBT": {
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "JSON": {
                                    rawData = Buffer.from(JSON.stringify(data), "binary");
                                    break;
                                }
                                case "JSONC": {
                                    rawData = Buffer.from(commentJSON.stringify(data), "binary");
                                    break;
                                }
                                case "ASCII": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "ascii");
                                    break;
                                }
                                case "UTF-8": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "utf-8");
                                    break;
                                }
                                case "hex": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "hex");
                                    break;
                                }
                                case "binaryPlainText": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "binary": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "custom": {
                                    switch (format.resultType) {
                                        case "JSONNBT": {
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                            break formatTypeSwitcher;
                                        }
                                        case "buffer": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.key,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary"));
                                            break formatTypeSwitcher;
                                        }
                                        case "unknown": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.key,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        default:
                                            throw new Error(
                                                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
                                case "unknown":
                                default:
                                    throw new Error(
                                        `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format.type}.`
                                    );
                            }
                            return rawData;
                        }
                        case "NBT": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            formatTypeSwitcher: switch (format.type) {
                                case "NBT": {
                                    if (format.format && data.type !== ({ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format)) {
                                        console.warn(
                                            `NBT endianness mismatch. Data endianness is ${
                                                this.currentState.options.dataStorageObject.data.type
                                            }, but format endianness is ${{ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format}`,
                                            this.target.key,
                                            format,
                                            this.currentState.options.dataStorageObject,
                                            this
                                        );
                                    }
                                    rawData = NBT.writeUncompressed(data.parsed, data.type);
                                    break;
                                }
                                case "SNBT": {
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "JSON": {
                                    rawData = Buffer.from(JSON.stringify(data), "binary");
                                    break;
                                }
                                case "JSONC": {
                                    rawData = Buffer.from(commentJSON.stringify(data), "binary");
                                    break;
                                }
                                case "ASCII": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "ascii");
                                    break;
                                }
                                case "UTF-8": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "utf-8");
                                    break;
                                }
                                case "hex": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "hex");
                                    break;
                                }
                                case "binaryPlainText": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "binary": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.key,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "custom": {
                                    switch (format.resultType) {
                                        case "JSONNBT": {
                                            rawData = await format.serialize(data.parsed);
                                            break formatTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                            break formatTypeSwitcher;
                                        }
                                        case "buffer": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.key,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(
                                                Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary")
                                            );
                                            break formatTypeSwitcher;
                                        }
                                        case "unknown": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and the types are unverifyable and will probably throw an error.`,
                                                this.target.key,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        default:
                                            throw new Error(
                                                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
                                case "unknown":
                                default:
                                    throw new Error(
                                        `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format.type}.`
                                    );
                            }
                            return rawData;
                        }
                        case "JSON": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(JSON.stringify(data), "binary");
                        }
                        case "JSONC": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(commentJSON.stringify(data), "binary");
                        }
                        case "ASCII": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "ascii");
                        }
                        case "UTF-8": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "utf-8");
                        }
                        case "hex": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "hex");
                        }
                        case "binaryPlainText": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "binary");
                        }
                        case "int": {
                            if (format.type !== "int") {
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? `.${format.resultType}` : "")
                                    }.`
                                );
                            }
                            const data = this.currentState.options.dataStorageObject.data;
                            return writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true });
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return data;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data: unknown = this.currentState.options.dataStorageObject.data;
                                return await format.serialize(data);
                            }
                            throw new Error(
                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                    format.type + (format.type === "custom" ? `.${format.resultType}` : "")
                                }.`
                            );
                        }
                        default:
                            throw new Error(`Unsupported data type: ${format.type}`);
                    }
                }
                case "ChunksDatEntry": {
                    if (this.currentState.options.dataStorageObject.dataType === "NBTCompound") {
                        return ChunksDatUtils.chunksDatChunkToRaw(this.currentState.options.dataStorageObject.data as never);
                    }
                    if (this.currentState.options.dataStorageObject.dataType === "binary") return this.currentState.options.dataStorageObject.data;
                    throw new Error(`Unsupported data type for ChunksDatEntry: ${this.currentState.options.dataStorageObject.dataType}`);
                }
                case "File": {
                    const format: EntryContentTypeFormatData = this.currentState.options.dataStorageObject.sourceType;

                    switch (this.currentState.options.dataStorageObject.dataType) {
                        case "NBTCompound": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            formatTypeSwitcher: switch (format.type) {
                                case "NBT": {
                                    rawData = NBT.writeUncompressed(
                                        { name: "", ...data },
                                        "format" in format ?
                                            format.format === "LE" ? "little"
                                            : format.format === "BE" ? "big"
                                            : format.format === "LEV" ? "littleVarint"
                                            : "little"
                                        :   "little"
                                    );
                                    break;
                                }
                                case "SNBT": {
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "JSON": {
                                    rawData = Buffer.from(JSON.stringify(data), "binary");
                                    break;
                                }
                                case "JSONC": {
                                    rawData = Buffer.from(commentJSON.stringify(data), "binary");
                                    break;
                                }
                                case "ASCII": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "ascii");
                                    break;
                                }
                                case "UTF-8": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "utf-8");
                                    break;
                                }
                                case "hex": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "hex");
                                    break;
                                }
                                case "binaryPlainText": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "binary": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                    break;
                                }
                                case "custom": {
                                    switch (format.resultType) {
                                        case "JSONNBT": {
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                            break formatTypeSwitcher;
                                        }
                                        case "buffer": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.path,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary"));
                                            break formatTypeSwitcher;
                                        }
                                        case "unknown": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.path,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        default:
                                            throw new Error(
                                                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
                                case "unknown":
                                default:
                                    throw new Error(
                                        `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format.type}.`
                                    );
                            }
                            return rawData;
                        }
                        case "NBT": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            formatTypeSwitcher: switch (format.type) {
                                case "NBT": {
                                    if (format.format && data.type !== ({ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format)) {
                                        console.warn(
                                            `NBT endianness mismatch. Data endianness is ${
                                                this.currentState.options.dataStorageObject.data.type
                                            }, but format endianness is ${{ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format}`,
                                            this.target.path,
                                            format,
                                            this.currentState.options.dataStorageObject,
                                            this
                                        );
                                    }
                                    rawData = NBT.writeUncompressed(data.parsed, data.type);
                                    break;
                                }
                                case "SNBT": {
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "JSON": {
                                    rawData = Buffer.from(JSON.stringify(data), "binary");
                                    break;
                                }
                                case "JSONC": {
                                    rawData = Buffer.from(commentJSON.stringify(data), "binary");
                                    break;
                                }
                                case "ASCII": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "ascii");
                                    break;
                                }
                                case "UTF-8": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "utf-8");
                                    break;
                                }
                                case "hex": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "hex");
                                    break;
                                }
                                case "binaryPlainText": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "binary": {
                                    console.warn(
                                        `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}. This conversion is non-standard and may not work as expected.`,
                                        this.target.path,
                                        format,
                                        this.currentState.options.dataStorageObject,
                                        this
                                    );
                                    rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                    break;
                                }
                                case "custom": {
                                    switch (format.resultType) {
                                        case "JSONNBT": {
                                            rawData = await format.serialize(data.parsed);
                                            break formatTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                            break formatTypeSwitcher;
                                        }
                                        case "buffer": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and may not work as expected.`,
                                                this.target.path,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(
                                                Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary")
                                            );
                                            break formatTypeSwitcher;
                                        }
                                        case "unknown": {
                                            console.warn(
                                                `Data type is ${this.currentState.options.dataStorageObject.dataType}, but format type is ${format.type}.${format.resultType}. This conversion is non-standard and the types are unverifyable and will probably throw an error.`,
                                                this.target.path,
                                                format,
                                                this.currentState.options.dataStorageObject,
                                                this
                                            );
                                            rawData = await format.serialize(data);
                                            break formatTypeSwitcher;
                                        }
                                        default:
                                            throw new Error(
                                                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
                                case "unknown":
                                default:
                                    throw new Error(
                                        `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format.type}.`
                                    );
                            }
                            return rawData;
                        }
                        case "JSON": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(JSON.stringify(data), "binary");
                        }
                        case "JSONC": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(commentJSON.stringify(data), "binary");
                        }
                        case "ASCII": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "ascii");
                        }
                        case "UTF-8": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "utf-8");
                        }
                        case "hex": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "hex");
                        }
                        case "binaryPlainText": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return Buffer.from(data, "binary");
                        }
                        case "int": {
                            if (format.type !== "int") {
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? `.${format.resultType}` : "")
                                    }.`
                                );
                            }
                            const data = this.currentState.options.dataStorageObject.data;
                            return writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true });
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return data;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data: unknown = this.currentState.options.dataStorageObject.data;
                                return await format.serialize(data);
                            }
                            throw new Error(
                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                    format.type + (format.type === "custom" ? `.${format.resultType}` : "")
                                }.`
                            );
                        }
                        default:
                            throw new Error(`Unsupported data type: ${format.type}`);
                    }
                }
                default:
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                    throw new Error(`Unsupported target type: ${this.target["type"]}`);
            }
        }
        /**
         * Saves the data for this sub-tab.
         *
         * @returns A promise that resolves when the data has been saved.
         *
         * @throws {Error} If the parent tab has no associated LevelDB and this sub-tab is a LevelDB entry.
         * @throws {Error} If the LevelDB is not open and this sub-tab is a LevelDB entry.
         * @throws {Error} If the file associated with this sub-tab does not exist and this sub-tab is a file.
         * @throws {Error} If the target type is not supported.
         * @throws {unknown} If an error occurs while converting the loaded data to binary.
         * @throws {unknown} If an error occurs while writing to the LevelDB and this sub-tab is a LevelDB entry.
         * @throws {unknown} If an error occurs while writing to the file and this sub-tab is a file.
         */
        public async save(): Promise<void> {
            if (!this.hasUnsavedChanges) return;
            targetTypeSwitcher: switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");

                    await this.parentTab.db.put(this.target.key, await this.exportRawData(false));
                    break;
                }
                case "ChunksDatEntry": {
                    const chunksDatPath: string = path.join(this.parentTab.tempPath ?? this.parentTab.path, "chunks.dat");
                    if (!existsSync(chunksDatPath)) {
                        throw new ReferenceError(`The chunks.dat file associated with this sub-tab does not exist: ${chunksDatPath}`);
                    }
                    await writeFile(
                        chunksDatPath,
                        ChunksDatUtils.writeRawChunksDatChunk(await readFile(chunksDatPath), await this.exportRawData(false), this.target.chunk)
                    );
                    break;
                }
                case "File": {
                    switch (this.parentTab.type) {
                        case "nbt":
                        case "json":
                        case "xml":
                        case "text":
                        case "binary":
                            if (this.target.path === "") {
                                switch (this.parentTab.mode) {
                                    case TabManagerTabMode.Copy:
                                    case TabManagerTabMode.CopyUntilSave:
                                        if (this.parentTab.tempFilePath === undefined) break;
                                        if (!existsSync(this.parentTab.tempFilePath)) {
                                            // REVIEW: This may or may not need to be changed to allow saving newly created files.
                                            throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.parentTab.tempFilePath}`);
                                        }
                                        await writeFile(this.parentTab.tempFilePath, await this.exportRawData(false));
                                        break targetTypeSwitcher;
                                    case TabManagerTabMode.Direct:
                                        if (!existsSync(this.parentTab.path)) {
                                            // REVIEW: This may or may not need to be changed to allow saving newly created files.
                                            throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.parentTab.path}`);
                                        }
                                        await writeFile(this.parentTab.path, await this.exportRawData(false));
                                        break targetTypeSwitcher;
                                    case TabManagerTabMode.Readonly:
                                    case TabManagerTabMode.ReadonlyDirect:
                                        throw new Error("Cannot save a read-only tab.");
                                    default:
                                        break;
                                }
                            }
                            break;
                        case "other":
                            // TODO
                            break;
                        case "world":
                        case "leveldb":
                        default:
                            break;
                    }
                    if (!existsSync(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path))) {
                        // REVIEW: This may or may not need to be changed to allow saving newly created files.
                        throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.target.path}`);
                    }

                    await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), await this.exportRawData(false));
                    break;
                }
                default:
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/dot-notation
                    throw new Error(`Unsupported target type: ${this.target["type"]}`);
            }
            this.markChangesAsSavedToDiskInCopy();
            this.hasUnsavedChanges = false;
        }
        /**
         * Closes this sub-tab.
         */
        public close(): void {
            this.isValid = false;
            const index: number = this.parentTab.openTabs.indexOf(this);
            if (this.parentTab.openTabs.includes(this)) {
                this.parentTab.openTabs.splice(this.parentTab.openTabs.indexOf(this), 1);
            }
            if (this.parentTab.isValid && this.parentTab.selectedTab === this) {
                this.parentTab.switchTab(index === -1 ? null : (this.parentTab.openTabs[index - 1] ?? this.parentTab.openTabs[0] ?? null));
            }
            if (this.target.type === "File" && this.hasUnsavedChanges) {
                this.parentTab.setFileAsModified(this.target.path, false);
            }
            this.parentTab.emit("closeTab", { tab: this });
        }
    }
    export type TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery = {
        [TagType in NBT.TagType]: {
            /**
             * The path to the tag, as it would be in SNBT, not as it is in Prismarine JSON-NBT.
             *
             * @default undefined
             */
            path?: string[] | undefined;
            /**
             * Whether or not the path should be case-sensitive.
             *
             * @default true
             */
            caseSensitivePath?: boolean | undefined;
            /**
             * The key of the tag.
             *
             * @default undefined
             */
            key?: string | undefined;
            /**
             * Whether or not the key should be case-sensitive.
             *
             * @default true
             */
            caseSensitiveKey?: boolean | undefined;
            /**
             * The type of the tag.
             *
             * @default undefined
             */
            tagType?: `${TagType}` | undefined;
            /**
             * The value of the tag.
             *
             * Will be converted to a string before comparison, this can only match byte, short, int, long, float, double, and string tags.
             *
             * @default undefined
             */
            value?: NBT.Tags[TagType]["value"] | bigint | undefined;
            /**
             * Whether or not the value should be case-sensitive.
             *
             * @default true
             */
            caseSensitiveValue?: boolean | undefined;
        };
    }[NBT.TagType];
    /**
     *  @todo Implement this.
     */
    export interface TabManagerTab_LevelDBSearchQuery_AdvancedSearchConditionEntry {
        /**
         * The query to search for.
         */
        query: string;
        /**
         * Whether it should only match results where the query is equal to the entire data string.
         *
         * @default false
         */
        fullMatch?: boolean | undefined;
    }
    export interface TabManagerTab_LevelDBSearchQuery<AsyncMode extends boolean = false> {
        customDataFields?: Record<
            string,
            | {
                  allOf?: string[] | undefined;
                  anyOf?: string[] | undefined;
                  oneOf?: string[] | undefined;
                  noneOf?: string[] | undefined;
                  /**
                   * @todo
                   */
                  fuzzy?: boolean | undefined;
                  /**
                   * Whether or not the value should be case-sensitive.
                   *
                   * @default false
                   */
                  caseSensitive?: boolean;
              }
            | undefined
        >;
        contentsStringContents?:
            | {
                  allOf?: string[] | undefined;
                  anyOf?: string[] | undefined;
                  oneOf?: string[] | undefined;
                  noneOf?: string[] | undefined;
                  /**
                   * @todo
                   */
                  fuzzy?: boolean | undefined;
                  /**
                   * @default false
                   */
                  caseSensitive?: boolean | undefined;
              }
            | undefined;
        displayKeyContents?:
            | {
                  allOf?: string[] | undefined;
                  anyOf?: string[] | undefined;
                  oneOf?: string[] | undefined;
                  noneOf?: string[] | undefined;
                  /**
                   * @todo
                   */
                  fuzzy?: boolean | undefined;
                  /**
                   * @default false
                   */
                  caseSensitive?: boolean | undefined;
              }
            | undefined;
        /**
         * @todo
         */
        rawKeyContents?:
            | {
                  allOf?: (string | Buffer)[] | undefined;
                  anyOf?: (string | Buffer)[] | undefined;
                  oneOf?: (string | Buffer)[] | undefined;
                  noneOf?: (string | Buffer)[] | undefined;
                  /**
                   * @todo
                   */
                  fuzzy?: boolean | undefined;
                  /**
                   * @todo
                   */
                  caseSensitive?: boolean | undefined;
              }
            | undefined;
        /**
         * @todo
         */
        rawValueContents?:
            | {
                  allOf?: (string | Buffer)[];
                  anyOf?: (string | Buffer)[];
                  oneOf?: (string | Buffer)[];
                  noneOf?: (string | Buffer)[];
                  fuzzy?: boolean | undefined;
              }
            | undefined;
        nbtTags?:
            | {
                  allOf?: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] | undefined;
                  anyOf?: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] | undefined;
                  oneOf?: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] | undefined;
                  noneOf?: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] | undefined;
                  fuzzy?: boolean | undefined;
                  /**
                   * Whether to exclude all results that do not have NBT tags.
                   *
                   * If false, results without NBT tags will be included without being checked against this query filter.
                   *
                   * @default true
                   */
                  excludeNonNBTResults?: boolean | undefined;
              }
            | undefined;
        contentTypes?: MCEntryContentType[] | undefined;
        excludeContentTypes?: MCEntryContentType[] | undefined;
        searchTargets?:
            | (
                  | {
                        key: Buffer;
                        contentType?: MCEntryContentType;
                        displayKey?: string;
                        valueType: EntryContentTypeFormatData;
                        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- This is for documentation purposes.
                        value: unknown | (AsyncMode extends true ? () => unknown | Promise<unknown> : never);
                        data?: unknown;
                        searchableContents?: string[];
                        customDataFields?: Record<
                            string,
                            | string
                            | string[]
                            | (AsyncMode extends true ? () => string | string[] | Promise<string | string[] | undefined> | undefined
                              :   () => string | string[] | undefined)
                            | undefined
                        >;
                    }
                  | {
                        key: Buffer;
                        contentType?: MCEntryContentType;
                        displayKey?: string;
                        valueType?: undefined;
                        value?: undefined;
                        data?: unknown;
                        searchableContents?: string[];
                        customDataFields?: Record<
                            string,
                            | string
                            | string[]
                            | (AsyncMode extends true ? () => string | string[] | Promise<string | string[] | undefined> | undefined
                              :   () => string | string[] | undefined)
                            | undefined
                        >;
                    }
              )[]
            | undefined;
    }
    export interface TabManagerTab_LevelDBSearchResult<
        OriginalObject extends NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number] | undefined = undefined,
    > {
        /**
         * The tab associated with the search.
         */
        readonly tab: TabManagerTab;
        /**
         * The raw key of the entry.
         */
        readonly key: Buffer;
        /**
         * The quality of the result.
         *
         * @todo
         */
        readonly quality?: number | undefined;
        /**
         * The orginal object.
         *
         * If {@link TabManagerTab_LevelDBSearchQuery.searchTargets} was not provided in the search query, this will be `undefined`.
         */
        readonly originalObject: OriginalObject;
    }
    export class TabManagerTab_LevelDBSearch {
        public readonly tab: TabManagerTab;
        public constructor(tab: TabManagerTab) {
            this.tab = tab;
        }
        private findMatchingNBTTag(
            nbt: NBT.Tags[NBT.TagType] | NBT.NBT,
            query: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery,
            path: string[] = [],
            key?: string
        ): boolean {
            function compareNBTTagValues(
                a: NBT.Tags[NBT.TagType]["value"] | bigint,
                b: NBT.Tags[NBT.TagType]["value"] | bigint,
                caseSensitive: boolean
            ): boolean {
                if (
                    typeof a === "object" ||
                    typeof b === "object" ||
                    typeof a === "symbol" ||
                    typeof b === "symbol" ||
                    typeof a === "function" ||
                    typeof b === "function"
                ) {
                    return false;
                }
                return cmpStrCS(String(a), String(b), caseSensitive);
            }
            function cmpStrCS(a: string, b: string, caseSensitive: boolean): boolean {
                if (caseSensitive) return a === b;
                return a.toLowerCase() === b.toLowerCase();
            }
            function doesThisMatch(): boolean {
                if (
                    query.path &&
                    !query.path.every(
                        (v: string, i: number): boolean =>
                            v === "*?" || (i in path && (v === "*" || cmpStrCS(v, path[i]!.replaceAll(/\\\*\??/g, "*?"), query.caseSensitivePath ?? true)))
                    )
                ) {
                    return false;
                }
                if (
                    query.key !== undefined &&
                    (key !== undefined ?
                        !cmpStrCS(key, query.key, query.caseSensitiveKey ?? true)
                    :   "name" in nbt && !cmpStrCS(query.key, nbt.name, query.caseSensitiveKey ?? true))
                ) {
                    return false;
                }
                if (query.tagType && !cmpStrCS(query.tagType, nbt.type, false)) return false;
                if (
                    query.value !== undefined &&
                    !compareNBTTagValues(
                        query.value,
                        nbt.type === "long" && typeof nbt.value === "object" ? toLong(nbt.value) : nbt.value,
                        query.caseSensitiveValue ?? true
                    )
                ) {
                    return false;
                }
                return true;
            }
            if (doesThisMatch()) return true;
            switch (nbt.type) {
                case NBT.TagType.Compound as `${NBT.TagType.Compound}`:
                    return Object.entries(nbt.value).some((v): boolean =>
                        v[1] === undefined ? false : this.findMatchingNBTTag(v[1], query, [...path, v[0]], v[0])
                    );
                case NBT.TagType.List as `${NBT.TagType.List}`:
                    return nbt.value.value.some((v, i): boolean => {
                        if (v === undefined) return false;
                        return this.findMatchingNBTTag(
                            {
                                type: nbt.value.type,
                                value: v,
                            } as NBT.Tags[NBT.TagType] | NBT.NBT,
                            query,
                            [...path, String(i)],
                            String(i)
                        );
                    });
                case NBT.TagType.ByteArray as `${NBT.TagType.ByteArray}`:
                case NBT.TagType.ShortArray as `${NBT.TagType.ShortArray}`:
                case NBT.TagType.IntArray as `${NBT.TagType.IntArray}`:
                case NBT.TagType.LongArray as `${NBT.TagType.LongArray}`:
                    if (query.tagType) {
                        if (nbt.type === NBT.TagType.ByteArray && query.tagType !== NBT.TagType.Byte) return false;
                        if (nbt.type === NBT.TagType.ShortArray && query.tagType !== NBT.TagType.Short) return false;
                        if (nbt.type === NBT.TagType.IntArray && query.tagType !== NBT.TagType.Int) return false;
                        if (nbt.type === NBT.TagType.LongArray && query.tagType !== NBT.TagType.Long) return false;
                    }
                    return nbt.value.some((v: number | [high: number, low: number], i: number): boolean => {
                        const currentPath: string[] = [...path, String(i)];
                        if (
                            query.path &&
                            (!query.path.every(
                                (v: string, i: number): boolean =>
                                    v === "*?" ||
                                    (i in currentPath &&
                                        (v === "*" || cmpStrCS(v, currentPath[i]!.replaceAll(/\\\*\??/g, "*?"), query.caseSensitivePath ?? true)))
                            ) ||
                                query.path.length !== currentPath.length)
                        ) {
                            return false;
                        }
                        if (query.key && cmpStrCS(query.key, i.toString(), query.caseSensitiveKey ?? true)) return false;
                        if (query.value && !compareNBTTagValues(query.value, typeof v === "number" ? v : toLong(v), query.caseSensitiveValue ?? true)) {
                            return false;
                        }
                        return true;
                    });
                case NBT.TagType.String as `${NBT.TagType.String}`:
                case NBT.TagType.Byte as `${NBT.TagType.Byte}`:
                case NBT.TagType.Short as `${NBT.TagType.Short}`:
                case NBT.TagType.Int as `${NBT.TagType.Int}`:
                case NBT.TagType.Long as `${NBT.TagType.Long}`:
                case NBT.TagType.Float as `${NBT.TagType.Float}`:
                case NBT.TagType.Double as `${NBT.TagType.Double}`:
                default:
                    return false;
            }
        }
        // IDEA: New search syntax idea:
        // Allow for putting an asterisk (*) before and/or after a value in a search query parameter to allow partial matches (ex. dbkey:*ab* would match "ab",
        // "abc", "qab", and "qabc"; dbkey:ab* would match "ab" and "abc"; dbkey:*ab would match "ab" and "qab"), you should be able to put a backslash before
        // the asterisk to make it be parsed as a literal asterisk.
        // IDEA: Get some ideas from the Everything search query syntax.
        // IDEA: Look at search syntaxes for many things to find new advanced search syntax ideas.
        // IDEA: Add some form of parameter grouping with parentheses, where you can use the prefixes (ex. &/|/^) on those groups.
        public *search<T extends TabManagerTab_LevelDBSearchQuery, YU extends boolean = false>(
            query: T,
            yieldUndefined?: YU
        ): Generator<
            | TabManagerTab_LevelDBSearchResult<
                  T["searchTargets"] extends any[] ? T["searchTargets"][number]
                  :   {
                          key: Buffer<ArrayBufferLike>;
                          contentType: MCEntryContentType;
                      }
              >
            | (YU extends true ? undefined : never),
            void
        > {
            if (!query.searchTargets) {
                if (!this.tab.db) {
                    throw new Error("This tab has no associated LevelDB.");
                }
                if (!this.tab.cachedDBKeys) {
                    throw new Error("LevelDB key cache not loaded.");
                }
            }
            const searchTargets: TabManagerTab_LevelDBSearchQuery["searchTargets"] & { contentType: MCEntryContentType; displayKey: string }[] =
                query.searchTargets
                    ?.map((v) =>
                        v.contentType ?
                            (v as typeof v & { contentType: MCEntryContentType; displayKey: string })
                        :   { ...v, contentType: getContentTypeFromDBKey(v.key), displayKey: v.displayKey ?? getKeyDisplayName(v.key) }
                    )
                    .filter(
                        ({ contentType }): boolean =>
                            !query.excludeContentTypes?.includes(contentType) && (query.contentTypes ? query.contentTypes.includes(contentType) : true)
                    ) ??
                (Object.entries(this.tab.cachedDBKeys!) as [MCEntryContentType, Buffer[]][])
                    .filter(
                        ([contentType]): boolean =>
                            !query.excludeContentTypes?.includes(contentType) && (query.contentTypes ? query.contentTypes.includes(contentType) : true)
                    )
                    .flatMap(([contentType, keys]) => keys.map((key) => ({ key, contentType, displayKey: getKeyDisplayName(key) })));
            // console.log(5);
            searchLoop: for (const searchTarget of searchTargets) {
                const searchableContents: string[] = searchTarget.searchableContents ?? [searchTarget.displayKey];
                if (query.displayKeyContents) {
                    const caseSensitive: boolean = query.displayKeyContents.caseSensitive ?? false;
                    const displayKey: string =
                        caseSensitive ?
                            (searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key))
                        :   (searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key)).toLowerCase();
                    if (
                        query.displayKeyContents.allOf &&
                        query.displayKeyContents.allOf.length > 0 &&
                        !query.displayKeyContents.allOf.every((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.displayKeyContents.anyOf &&
                        query.displayKeyContents.anyOf.length > 0 &&
                        !query.displayKeyContents.anyOf.some((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.displayKeyContents.oneOf && query.displayKeyContents.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.displayKeyContents.oneOf) {
                            if (displayKey.includes(caseSensitive ? v : v.toLowerCase())) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                    }
                    if (
                        query.displayKeyContents.noneOf &&
                        query.displayKeyContents.noneOf.length > 0 &&
                        query.displayKeyContents.noneOf.some((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }
                if (query.nbtTags) {
                    if (
                        (query.nbtTags.excludeNonNBTResults ?? true) &&
                        (!searchTarget.valueType ||
                            !searchTarget.value ||
                            !(
                                searchTarget.valueType.type === "NBT" ||
                                (searchTarget.valueType.type === "custom" && searchTarget.valueType.resultType === "JSONNBT")
                            ))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.nbtTags.allOf &&
                        query.nbtTags.allOf.length > 0 &&
                        !query.nbtTags.allOf.every((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean =>
                            this.findMatchingNBTTag(
                                (typeof searchTarget.value === "object" && searchTarget.value && "parsed" in searchTarget.value ?
                                    searchTarget.value.parsed
                                :   searchTarget.value) as NBT.Tags[NBT.TagType] | NBT.NBT,
                                v
                            )
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.nbtTags.anyOf &&
                        query.nbtTags.anyOf.length > 0 &&
                        !query.nbtTags.anyOf.some((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean =>
                            this.findMatchingNBTTag(
                                (typeof searchTarget.value === "object" && searchTarget.value && "parsed" in searchTarget.value ?
                                    searchTarget.value.parsed
                                :   searchTarget.value) as NBT.Tags[NBT.TagType] | NBT.NBT,
                                v
                            )
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.nbtTags.oneOf && query.nbtTags.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.nbtTags.oneOf) {
                            if (
                                this.findMatchingNBTTag(
                                    (typeof searchTarget.value === "object" && searchTarget.value && "parsed" in searchTarget.value ?
                                        searchTarget.value.parsed
                                    :   searchTarget.value) as NBT.Tags[NBT.TagType] | NBT.NBT,
                                    v
                                )
                            ) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                        if (!foundMatchingOneOf) {
                            if (yieldUndefined) yield undefined!;
                            continue;
                        }
                    }
                    if (
                        query.nbtTags.noneOf &&
                        query.nbtTags.noneOf.length > 0 &&
                        query.nbtTags.noneOf.some((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean =>
                            this.findMatchingNBTTag(
                                (typeof searchTarget.value === "object" && searchTarget.value && "parsed" in searchTarget.value ?
                                    searchTarget.value.parsed
                                :   searchTarget.value) as NBT.Tags[NBT.TagType] | NBT.NBT,
                                v
                            )
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }
                if (query.contentsStringContents) {
                    const caseSensitive: boolean = query.contentsStringContents.caseSensitive ?? false;
                    if (
                        query.contentsStringContents.allOf &&
                        query.contentsStringContents.allOf.length > 0 &&
                        !query.contentsStringContents.allOf.every((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.contentsStringContents.anyOf &&
                        query.contentsStringContents.anyOf.length > 0 &&
                        !query.contentsStringContents.anyOf.some((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.contentsStringContents.oneOf && query.contentsStringContents.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.contentsStringContents.oneOf) {
                            if (searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                    }
                    if (
                        query.contentsStringContents.noneOf &&
                        query.contentsStringContents.noneOf.length > 0 &&
                        query.contentsStringContents.noneOf.some((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }

                // TODO: Implement advanced query entry support (as in entries that are an object).
                if (query.customDataFields) {
                    for (const customDataField in query.customDataFields) {
                        if (!Object.hasOwn(query.customDataFields, customDataField)) continue;
                        if (query.customDataFields[customDataField] === undefined) {
                            if (yieldUndefined) yield undefined!;
                            continue;
                        }
                        const fieldValue_1: string | string[] | undefined =
                            searchTarget.customDataFields?.[customDataField] instanceof Function ?
                                searchTarget.customDataFields[customDataField]()
                            :   searchTarget.customDataFields?.[customDataField];
                        const fieldValue: string[] | undefined =
                            fieldValue_1 === undefined ? undefined
                            : fieldValue_1 instanceof Array ? fieldValue_1
                            : [fieldValue_1];
                        const caseSensitive: boolean = query.customDataFields[customDataField].caseSensitive ?? false;
                        if (
                            query.customDataFields[customDataField].allOf &&
                            query.customDataFields[customDataField].allOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].allOf.every((v: string): boolean =>
                                    /* caseSensitive ?
                                        fieldValue === v
                                    :   fieldValue?.toLowerCase() === v.toLowerCase() */
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].anyOf &&
                            query.customDataFields[customDataField].anyOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].anyOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     fieldValue === v
                                    // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].oneOf &&
                            query.customDataFields[customDataField].oneOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].oneOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     fieldValue === v
                                    // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].noneOf &&
                            query.customDataFields[customDataField].noneOf.length > 0 &&
                            fieldValue !== undefined &&
                            query.customDataFields[customDataField].noneOf.some((v: string): boolean =>
                                // caseSensitive ?
                                //     fieldValue === v
                                // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                caseSensitive ?
                                    fieldValue.some((s: string): boolean => s.includes(v))
                                :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                            )
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                    }
                }

                yield {
                    tab: this.tab,
                    key: searchTarget.key,
                    originalObject: searchTarget,
                };
            }
        }
        public async *searchAsync<T extends TabManagerTab_LevelDBSearchQuery<true>, YU extends boolean = false>(
            query: T,
            yieldUndefined?: YU
        ): AsyncGenerator<
            | TabManagerTab_LevelDBSearchResult<
                  T["searchTargets"] extends any[] ? T["searchTargets"][number]
                  :   {
                          key: Buffer<ArrayBufferLike>;
                          contentType: MCEntryContentType;
                      }
              >
            | (YU extends true ? undefined : never),
            void
        > {
            if (!query.searchTargets) {
                if (!this.tab.db) {
                    throw new Error("This tab has no associated LevelDB.");
                }
                if (!this.tab.cachedDBKeys) {
                    throw new Error("LevelDB key cache not loaded.");
                }
            }
            const searchTargets: TabManagerTab_LevelDBSearchQuery<true>["searchTargets"] & { contentType: MCEntryContentType; displayKey: string }[] =
                query.searchTargets
                    ?.map((v) =>
                        v.contentType ?
                            (v as typeof v & { contentType: MCEntryContentType; displayKey: string })
                        :   { ...v, contentType: getContentTypeFromDBKey(v.key), displayKey: v.displayKey ?? getKeyDisplayName(v.key) }
                    )
                    .filter(
                        ({ contentType }): boolean =>
                            !query.excludeContentTypes?.includes(contentType) && (query.contentTypes ? query.contentTypes.includes(contentType) : true)
                    ) ??
                (Object.entries(this.tab.cachedDBKeys!) as [MCEntryContentType, Buffer[]][])
                    .filter(
                        ([contentType]): boolean =>
                            !query.excludeContentTypes?.includes(contentType) && (query.contentTypes ? query.contentTypes.includes(contentType) : true)
                    )
                    .flatMap(([contentType, keys]) => keys.map((key) => ({ key, contentType, displayKey: getKeyDisplayName(key) })));
            // console.log(5);
            searchLoop: for (const searchTarget of searchTargets) {
                const searchableContents: string[] = searchTarget.searchableContents ?? [searchTarget.displayKey];
                if (query.displayKeyContents) {
                    const caseSensitive: boolean = query.displayKeyContents.caseSensitive ?? false;
                    const displayKey: string =
                        caseSensitive ?
                            (searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key))
                        :   (searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key)).toLowerCase();
                    if (
                        query.displayKeyContents.allOf &&
                        query.displayKeyContents.allOf.length > 0 &&
                        !query.displayKeyContents.allOf.every((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.displayKeyContents.anyOf &&
                        query.displayKeyContents.anyOf.length > 0 &&
                        !query.displayKeyContents.anyOf.some((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.displayKeyContents.oneOf && query.displayKeyContents.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.displayKeyContents.oneOf) {
                            if (displayKey.includes(caseSensitive ? v : v.toLowerCase())) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                    }
                    if (
                        query.displayKeyContents.noneOf &&
                        query.displayKeyContents.noneOf.length > 0 &&
                        query.displayKeyContents.noneOf.some((v: string): boolean => displayKey.includes(caseSensitive ? v : v.toLowerCase()))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }
                if (query.nbtTags) {
                    if (
                        (query.nbtTags.excludeNonNBTResults ?? true) &&
                        (!searchTarget.valueType ||
                            !searchTarget.value ||
                            !(
                                searchTarget.valueType.type === "NBT" ||
                                (searchTarget.valueType.type === "custom" && searchTarget.valueType.resultType === "JSONNBT")
                            ))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    const rawTargetValue: unknown = searchTarget.value instanceof Function ? await (searchTarget.value as () => unknown)() : searchTarget.value;
                    const targetValue: NBT.NBT | NBT.Compound =
                        typeof rawTargetValue === "object" && rawTargetValue && "parsed" in rawTargetValue ?
                            (rawTargetValue.parsed as NBT.NBT)
                        :   (rawTargetValue as NBT.NBT | NBT.Compound);
                    if (
                        query.nbtTags.allOf &&
                        query.nbtTags.allOf.length > 0 &&
                        !query.nbtTags.allOf.every((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean => this.findMatchingNBTTag(targetValue, v))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.nbtTags.anyOf &&
                        query.nbtTags.anyOf.length > 0 &&
                        !query.nbtTags.anyOf.some((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean => this.findMatchingNBTTag(targetValue, v))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.nbtTags.oneOf && query.nbtTags.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.nbtTags.oneOf) {
                            if (this.findMatchingNBTTag(targetValue, v)) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                        if (!foundMatchingOneOf) {
                            if (yieldUndefined) yield undefined!;
                            continue;
                        }
                    }
                    if (
                        query.nbtTags.noneOf &&
                        query.nbtTags.noneOf.length > 0 &&
                        query.nbtTags.noneOf.some((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean => this.findMatchingNBTTag(targetValue, v))
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }
                if (query.contentsStringContents) {
                    const caseSensitive: boolean = query.contentsStringContents.caseSensitive ?? false;
                    if (
                        query.contentsStringContents.allOf &&
                        query.contentsStringContents.allOf.length > 0 &&
                        !query.contentsStringContents.allOf.every((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.contentsStringContents.anyOf &&
                        query.contentsStringContents.anyOf.length > 0 &&
                        !query.contentsStringContents.anyOf.some((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.contentsStringContents.oneOf && query.contentsStringContents.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.contentsStringContents.oneOf) {
                            if (searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))) {
                                if (foundMatchingOneOf) {
                                    if (yieldUndefined) yield undefined!;
                                    continue searchLoop;
                                }
                                foundMatchingOneOf = true;
                            }
                        }
                    }
                    if (
                        query.contentsStringContents.noneOf &&
                        query.contentsStringContents.noneOf.length > 0 &&
                        query.contentsStringContents.noneOf.some((v: string): boolean =>
                            searchableContents.some((c: string): boolean => (caseSensitive ? c.includes(v) : c.toLowerCase().includes(v.toLowerCase())))
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                }

                // TODO: Implement advanced query entry support (as in entries that are an object).
                if (query.customDataFields) {
                    for (const customDataField in query.customDataFields) {
                        if (!Object.hasOwn(query.customDataFields, customDataField)) continue;
                        if (query.customDataFields[customDataField] === undefined) {
                            if (yieldUndefined) yield undefined!;
                            continue;
                        }
                        const fieldValue_1: string | string[] | undefined =
                            searchTarget.customDataFields?.[customDataField] instanceof Function ?
                                await searchTarget.customDataFields[customDataField]()
                            :   searchTarget.customDataFields?.[customDataField];
                        const fieldValue: string[] | undefined =
                            fieldValue_1 === undefined ? undefined
                            : fieldValue_1 instanceof Array ? fieldValue_1
                            : [fieldValue_1];
                        const caseSensitive: boolean = query.customDataFields[customDataField].caseSensitive ?? false;
                        if (
                            query.customDataFields[customDataField].allOf &&
                            query.customDataFields[customDataField].allOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].allOf.every((v: string): boolean =>
                                    /* caseSensitive ?
                                        fieldValue === v
                                    :   fieldValue?.toLowerCase() === v.toLowerCase() */
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].anyOf &&
                            query.customDataFields[customDataField].anyOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].anyOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     fieldValue === v
                                    // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].oneOf &&
                            query.customDataFields[customDataField].oneOf.length > 0 &&
                            (fieldValue === undefined ||
                                !query.customDataFields[customDataField].oneOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     fieldValue === v
                                    // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        fieldValue.some((s: string): boolean => s.includes(v))
                                    :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].noneOf &&
                            query.customDataFields[customDataField].noneOf.length > 0 &&
                            fieldValue !== undefined &&
                            query.customDataFields[customDataField].noneOf.some((v: string): boolean =>
                                // caseSensitive ?
                                //     fieldValue === v
                                // :   fieldValue?.toLowerCase() === v.toLowerCase()
                                caseSensitive ?
                                    fieldValue.some((s: string): boolean => s.includes(v))
                                :   fieldValue.some((s: string): boolean => s.toLowerCase().includes(v.toLowerCase()))
                            )
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                    }
                }

                yield {
                    tab: this.tab,
                    key: searchTarget.key,
                    originalObject: searchTarget,
                };
            }
        }
    }
}

Object.defineProperties(globalThis, {
    TabManager: {
        value: exports.TabManager,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    TabManagerTab: {
        value: exports.TabManagerTab,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    TabManagerSubTab: {
        value: exports.TabManagerSubTab,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    tabManager: {
        value: exports.tabManager,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    TabManagerTab_LevelDBSearch: {
        value: exports.TabManagerTab_LevelDBSearch,
        configurable: true,
        enumerable: true,
        writable: false,
    },
    TabManagerTabMode: {
        value: exports.TabManagerTabMode,
        configurable: true,
        enumerable: true,
        writable: false,
    },
});

declare global {
    export import TabManagerEventMap = exports.TabManagerEventMap;
    export import TabManagerTabEventMap = exports.TabManagerTabEventMap;
    export import TabManagerSwitchTabEvent = exports.TabManagerSwitchTabEvent;
    export import TabManagerClosedTabEvent = exports.TabManagerClosedTabEvent;
    export import TabManagerOpenTabEvent = exports.TabManagerOpenTabEvent;
    export import TabManagerReorderTabsEvent = exports.TabManagerReorderTabsEvent;
    export import TabManagerInitializedTabEvent = exports.TabManagerInitializedTabEvent;
    export import TabManagerTabSwitchTabEvent = exports.TabManagerTabSwitchTabEvent;
    export import TabManagerTabClosedTabEvent = exports.TabManagerTabClosedTabEvent;
    export import TabManagerTabOpenTabEvent = exports.TabManagerTabOpenTabEvent;
    export import TabManagerTabReorderTabsEvent = exports.TabManagerTabReorderTabsEvent;
    export import TabManagerTabModificationStatusChangedEvent = exports.TabManagerTabModificationStatusChangedEvent;
    export import TabManagerTabOtherStatusChangedEvent = exports.TabManagerTabOtherStatusChangedEvent;
    export import TabManagerTabStartedSavingEvent = exports.TabManagerTabStartedSavingEvent;
    export import TabManagerTabStoppedSavingEvent = exports.TabManagerTabStoppedSavingEvent;
    export import TabManagerSubTabModificationStatusChangedEvent = exports.TabManagerSubTabModificationStatusChangedEvent;
    export import TabManager = exports.TabManager;
    export import tabManager = exports.tabManager;
    export import TabManagerTab = exports.TabManagerTab;
    export import TabManagerSubTab = exports.TabManagerSubTab;
    export import DBEntryContentTypeToTabManagerSubTabCurrentStateOptions = exports.MCEntryContentTypeToTabManagerSubTabCurrentStateOptions;
    export import TabManagerSubTabCurrentState = exports.TabManagerSubTabCurrentState;
    export import TabManagerTabGenericSubTabID = exports.TabManagerTabGenericSubTabID;
    export import TabManagerGenericTabID = exports.TabManagerGenericTabID;
    export import DataStorageObject = exports.DataStorageObject;
    export import GenericDataStorageObjectNBTCompound = exports.GenericDataStorageObjectNBTCompound;
    export import GenericDataStorageObjectNBT = exports.GenericDataStorageObjectNBT;
    export import GenericDataStorageObjectJSON = exports.GenericDataStorageObjectJSON;
    export import GenericDataStorageObjectJSON_JSONNodeValue = exports.GenericDataStorageObjectJSON_JSONNodeValue;
    export import GenericDataStorageObject = exports.GenericDataStorageObject;
    export import TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery = exports.TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery;
    export import TabManagerTab_LevelDBSearchQuery = exports.TabManagerTab_LevelDBSearchQuery;
    export import TabManagerTab_LevelDBSearchResult = exports.TabManagerTab_LevelDBSearchResult;
    export import TabManagerTab_LevelDBSearch = exports.TabManagerTab_LevelDBSearch;
    export import TabManagerTabMode = exports.TabManagerTabMode;
}
