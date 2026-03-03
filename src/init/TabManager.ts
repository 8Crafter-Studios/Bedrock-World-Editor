import { EventEmitter } from "node:events";
import {
    DBEntryContentTypes,
    entryContentTypeToFormatMap,
    getContentTypeFromDBKey,
    getKeyDisplayName,
    getKeysOfTypes,
    parseSNBTCompoundString,
    parseSpecificIntType,
    prettyPrintSNBT,
    prismarineToSNBT,
    toLong,
    writeSpecificIntType,
    type DBEntryContentType,
    type EntryContentTypeFormatData,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import type { TreeEditorDataStorageObjectInput } from "../../app/components/TreeEditor";
import { LevelDB } from "@8crafter/leveldb-zlib";
import path from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { copyFile, cp, readFile, rm, writeFile } from "node:fs/promises";
import { APP_DATA_FOLDER_PATH } from "../utils/URLs";
import type { MapEditorDataStorageObject } from "../../app/components/MapEditor";
import { app, dialog, nativeImage } from "@electron/remote";
import type { NativeImage } from "electron";
import { padNativeImageToSquare, pngToIco } from "../utils/imageUtils";
import { defaultWorldIconDataURI } from "../utils/preloadImages";
import { checkIsURIOrPath } from "../utils/pathUtils";

namespace exports {
    type DefaultEventMap = [never];
    type Listener<K, T, F> =
        T extends DefaultEventMap ? F
        : K extends keyof T ?
            T[K] extends unknown[] ?
                (...args: T[K]) => void
            :   never
        :   never;
    type Listener1<K extends keyof T, T> = Listener<K, T, (...args: any[]) => void>;
    type EventMap<T> = Record<keyof T, any[]> | DefaultEventMap;
    type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T;
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
    }
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
    }
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
    export interface TabManagerClosedTabEvent {
        /**
         * The closed tab.
         */
        tab: TabManagerTab;
    }
    export interface TabManagerOpenTabEvent {
        /**
         * The opened tab.
         */
        tab: TabManagerTab;
    }
    export interface TabManagerReorderTabsEvent {
        /**
         * The new order of tabs.
         */
        tabs: TabManagerTab[];
    }
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
    export interface TabManagerTabClosedTabEvent {
        /**
         * The closed sub-tab.
         */
        tab: TabManagerSubTab;
    }
    export interface TabManagerTabOpenTabEvent {
        /**
         * The opened sub-tab.
         */
        tab: TabManagerSubTab;
    }
    export interface TabManagerTabReorderTabsEvent {
        /**
         * The new order of sub-tabs.
         */
        tabs: TabManagerSubTab[];
    }
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
    export interface TabManagerTabStartedSavingEvent {
        /**
         * The tab that started saving.
         */
        tab: TabManagerTab;
    }
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

    /**
     * Represents a tab manager.
     */
    export class TabManager extends EventEmitter<TabManagerEventMap> {
        public openTabs: TabManagerTab[] = [];
        public selectedTab: TabManagerTab | TabManagerGenericTabID | null = null;
        public constructor() {
            super();
            this.setMaxListeners(1000000);
            this.setJumpListData();
        }
        public openTab(props: Omit<ConstructorParameters<typeof TabManagerTab>[0], "tabManager">): TabManagerTab {
            const tab = new TabManagerTab({ tabManager: this, ...props });
            this.openTabs.push(tab);
            this.emit("openTab", { tab });
            this.switchTab(tab);
            this.addRecentItem(props, tab);
            return tab;
        }
        private addRecentItem(props: Parameters<this["openTab"]>[0], tab: TabManagerTab): void {
            try {
                if (tab.path) app.addRecentDocument(tab.path);
            } catch {}
            let recentsData: RecentsData = { worlds: [], folders: [], files: [] };
            recentsReader: if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                try {
                    const data: RecentsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), "utf-8"));
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
            this.setJumpListData();
        }
        private setJumpListData(): void {
            if (process.platform !== "win32") return;
            let recentsData: RecentsData = { worlds: [], folders: [], files: [] };
            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"))) {
                try {
                    const data: RecentsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), "utf-8"));
                    // IDEA: Add something to validate the recents data.
                    recentsData = data;
                } catch (e) {
                    console.error("Error reading recents.json:", e);
                    return;
                }
            }
            const removedItems: Electron.JumpListItem[] = app.getJumpListSettings().removedItems;
            removedItems.forEach((item: Electron.JumpListItem): void => {
                if (item.type === "task") {
                    if (item.args?.startsWith("--allow-file-access-from-files --file-tab-type=world")) {
                        const itemPath: string | undefined = item.args.match(/(?<=\s").*(?=")/)?.[0];
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
                        const itemPath: string | undefined = item.args.match(/(?<=\s").*(?=")/)?.[0];
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
                    const worldsIndex: number = recentsData.worlds.findIndex(
                        (world: RecentsItem): boolean =>
                            !!world.path && path.normalize(world.path).replace(/[\\/]$/, "") === path.normalize(itemPath).replace(/[\\/]$/, "")
                    );
                    const filesIndex: number = recentsData.files.findIndex(
                        (file: RecentsItem_File): boolean =>
                            !!file.path && path.normalize(file.path).replace(/[\\/]$/, "") === path.normalize(itemPath).replace(/[\\/]$/, "")
                    );
                    if (filesIndex !== -1) recentsData.files.splice(filesIndex, 1);
                    else console.warn("Unable to find file in removedItems:", item);
                } else console.warn("Unknown item in removedItems:", item);
            });
            if (removedItems.length) writeFileSync(path.join(APP_DATA_FOLDER_PATH, "recents.json"), JSON.stringify(recentsData));
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"))) return;
            try {
                var userTasksData: Electron.Task[] = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "taskbar_user_tasks.json"), "utf-8"));
            } catch (e) {
                console.error("Error reading taskbar_user_tasks.json:", e);
                return;
            }
            const execPath: string | null =
                process.env.NODE_ENV === "development" ?
                    (userTasksData.find((task: Electron.Task): boolean => task.title === "New Window")?.program ?? null)
                :   process.execPath;
            if (!execPath) return;
            rmSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons"), { recursive: true, force: true });
            mkdirSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons"), { recursive: true });
            recentsData.worlds.forEach(async (world: RecentsItem, index: number): Promise<void> => {
                if (world.iconPath && ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
                if (!world.iconPath && !defaultWorldIconDataURI) return;
                const img: NativeImage = await padNativeImageToSquare(
                    world.iconPath ? nativeImage.createFromPath(world.iconPath) : nativeImage.createFromDataURL(defaultWorldIconDataURI!)
                );
                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `w${index}.ico`), pngToIco(img.resize({ width: 256, height: 256 }).toPNG()));
            });
            recentsData.folders.forEach(async (world: RecentsItem, index: number): Promise<void> => {
                if (!world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
                const img: NativeImage = await padNativeImageToSquare(
                    checkIsURIOrPath(world.iconPath) === "Path" ?
                        nativeImage.createFromPath(world.iconPath)
                    :   nativeImage.createFromBuffer(Buffer.from(await (await fetch(world.iconPath)).arrayBuffer()))
                );
                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `d${index}.ico`), pngToIco(img.resize({ width: 256, height: 256 }).toPNG()));
            });
            recentsData.files.forEach(async (world: RecentsItem, index: number): Promise<void> => {
                if (!world.iconPath || ["ico", "exe", "dll"].includes(path.extname(world.iconPath).slice(1).toLowerCase())) return;
                const img: NativeImage = await padNativeImageToSquare(nativeImage.createFromPath(world.iconPath));
                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "jumplist_icons", `f${index}.ico`), pngToIco(img.resize({ width: 256, height: 256 }).toPNG()));
            });
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
                app.setJumpList(jumpListData);
            } catch (e) {
                console.error("Error setting jump list:", e);
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
                contentType: DBEntryContentType;
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
     * Represents a tab in the tab manager.
     */
    export class TabManagerTab extends EventEmitter<TabManagerTabEventMap> {
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
         */
        public db?: LevelDB | undefined;
        /**
         * The search object that is used to search the database.
         */
        public dbSearch?: TabManagerTab_LevelDBSearch | undefined;
        /**
         * The keys of the database that are cached.
         */
        public cachedDBKeys?:
            | {
                  [key in DBEntryContentType]: Buffer[];
              }
            | undefined;
        /**
         * A promise that resolves when the database is open.
         *
         * It resolves with `true` if it was opened successfully and `false` if an error occurred.
         */
        public awaitDBOpen?: Promise<boolean>;
        /**
         * A promise that resolves when the database keys cache is loaded.
         *
         * It resolves with `true` if it was loaded successfully and `false` if an error occurred.
         */
        public awaitCachedDBKeys?: Promise<boolean>;
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
        }) {
            super();
            this.setMaxListeners(1000000);
            this.tabManager = props.tabManager;
            this.path = props.path;
            this.name = props.name;
            this.icon = props.icon ?? null;
            this.type = props.type;
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
            }
            this.initAccess(props.mode ?? TabManagerTabMode.CopyUntilSave);
            this.getPinnedTabs().forEach((tab, i, a) =>
                this.openTab({ ...tab, isPinned: true }, tab.active || (!a.some((tab) => tab.active) && i === a.length - 1))
            );
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
         * Whether the tab is favorited.
         */
        public get isFavorited(): boolean {
            return existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")) ?
                    ((): boolean => {
                        try {
                            const favoritedWorldsData: string[] = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8"));
                            if (favoritedWorldsData.includes(this.path)) {
                                return true;
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        return false;
                    })()
                :   false;
        }
        public set isFavorited(value: boolean) {
            if (value) {
                let favoritedWorldsData: string[] = [];
                if (existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")))
                    favoritedWorldsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8"));
                if (!favoritedWorldsData.includes(this.path)) {
                    favoritedWorldsData.push(this.path);
                    writeFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), JSON.stringify(favoritedWorldsData));
                }
            } else {
                if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) return;
                const favoritedWorldsData: string[] = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8"));
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
        private initAccess(mode: TabManagerTabMode): void {
            switch (mode) {
                case TabManagerTabMode.Readonly:
                case TabManagerTabMode.Copy:
                case TabManagerTabMode.CopyUntilSave: {
                    if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "temp"))) mkdirSync(path.join(APP_DATA_FOLDER_PATH, "temp"), { recursive: true });
                    if (this.type === "world" || this.type === "leveldb") {
                        this.tempPath = mkdtempSync(path.join(APP_DATA_FOLDER_PATH, "temp/"));
                        this.tempFilePath = this.tempPath;
                        cpSync(this.path, this.tempPath, { recursive: true, force: true, preserveTimestamps: true, dereference: true });
                    } else {
                        this.tempPath = mkdtempSync(path.join(APP_DATA_FOLDER_PATH, "temp/"));
                        this.tempFilePath = path.join(this.tempPath, path.basename(this.path));
                        copyFileSync(this.path, this.tempFilePath);
                    }
                }
            }
            if (this.type === "world") {
                this.db = new LevelDB(path.join(this.tempPath ?? this.path, "db"));
                this.dbSearch = new TabManagerTab_LevelDBSearch(this);
                this.awaitDBOpen = this.db.open().then(
                    (): true => {
                        this.awaitCachedDBKeys = getKeysOfTypes(this.db!, DBEntryContentTypes).then(
                            (keys: Record<DBEntryContentType, Buffer[]>): true => {
                                this.cachedDBKeys = keys;
                                return true;
                            },
                            (err: unknown): false => {
                                if (!(err instanceof Error && err.name === "Error" && err.message === "iterator has ended")) {
                                    console.error(err);
                                }
                                return false;
                            }
                        );
                        return true;
                    },
                    (err: unknown): false => {
                        console.error(err);
                        return false;
                    }
                );
            } else if (this.type === "leveldb") {
                this.db = new LevelDB(this.tempPath ?? this.path);
                this.dbSearch = new TabManagerTab_LevelDBSearch(this);
                this.awaitDBOpen = this.db.open().then();
            }
        }
        public async refreshCachedDBKeys(): Promise<boolean | void> {
            if (!this.db) return;
            this.cachedDBKeys = undefined;
            return (this.awaitCachedDBKeys = getKeysOfTypes(this.db!, DBEntryContentTypes).then(
                (keys: Record<DBEntryContentType, Buffer[]>): true => {
                    this.cachedDBKeys = keys;
                    return true;
                },
                (err: unknown): false => {
                    if (!(err instanceof Error && err.name === "Error" && err.message === "iterator has ended")) {
                        console.error(err);
                    }
                    return false;
                }
            ));
        }
        public getPinnedTabs(): NonNullable<PinnedSubTabsJSONData[keyof PinnedSubTabsJSONData]>[string][number][] {
            if (this.type !== "world" && this.type !== "leveldb") return [];
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"))) return [];
            try {
                const pinnedTabsData: PinnedSubTabsJSONData = JSON.parse(
                    readFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), "utf-8"),
                    (_key: string, value: any): any => {
                        if (typeof value === "object" && "type" in value && value.type === "Buffer" && "data" in value && Array.isArray(value.data)) {
                            return Buffer.from(value.data);
                        }
                        return value;
                    }
                );
                return pinnedTabsData[this.type]?.[this.path] ? pinnedTabsData[this.type]![this.path]! : [];
            } catch (e) {
                console.error(e);
                return [];
            }
        }
        public savePinnedTabsList(): void {
            if (this.type !== "world" && this.type !== "leveldb") return;
            let pinnedTabsData: PinnedSubTabsJSONData = {};
            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json")))
                pinnedTabsData = JSON.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), "utf-8"));
            pinnedTabsData[this.type] ??= {};
            pinnedTabsData[this.type]![this.path] = this.openTabs
                .filter((tab): boolean => tab.isPinned)
                .map((tab): NonNullable<PinnedSubTabsJSONData[keyof PinnedSubTabsJSONData]>[string][number] => ({
                    target: tab.target,
                    contentType: tab.contentType,
                    name: tab.name,
                    icon: tab.icon,
                    specialTabID: tab.specialTabID,
                    active: this.selectedTab === tab || undefined,
                }));
            writeFileSync(path.join(APP_DATA_FOLDER_PATH, "pinned_subtabs.json"), JSON.stringify(pinnedTabsData));
        }
        public isModified(): boolean {
            return this.modifiedFiles.files.length > 0 || this.modifiedFiles.leveldb;
        }
        public setModifications(modifications: typeof this.modifiedFiles): void {
            if (this.readonly) return;
            this.modifiedFiles = modifications;
        }
        public setFileAsModified(file: string, isModified: boolean = true): void {
            if (this.readonly || (this.modifiedFiles.files.includes(file) && isModified) || (!this.modifiedFiles.files.includes(file) && !isModified)) return;
            const wasModified: boolean = this.isModified();
            if (isModified) {
                this.modifiedFiles.files.push(file);
            } else {
                this.modifiedFiles.files.splice(this.modifiedFiles.files.indexOf(file), 1);
            }
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        public setLevelDBIsModified(isModified: boolean = true): void {
            if (this.readonly || this.modifiedFiles.leveldb === isModified) return;
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
        public async save(ignoreFailedTabSaves: boolean = false, unsafeMode: boolean = false): Promise<void> {
            if (this.isSaving || this.readonly || !this.saveEnabled || !this.tempPath || !this.tempFilePath) return;
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
            let error: unknown = undefined;
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
                    if (!unsafeMode && existsSync(this.path)) await rm(this.path, { recursive: true, force: true });
                    await cp(this.tempPath, this.path, { recursive: true, force: true, preserveTimestamps: true });
                } else {
                    await copyFile(this.tempFilePath, this.path);
                }
                setTimeout((): void => {
                    this.modifiedFiles.files.length = 0;
                    this.modifiedFiles.leveldb = false;
                    progressBar._window?.setClosable(true);
                    progressBar.close();
                }, 1);
                this.emit("modificationStatusChanged", { tab: this, isModified: false });
            } catch (e) {
                successful = false;
                error = e;
                setTimeout((): void => {
                    progressBar._window?.setClosable(true);
                    progressBar.close();
                }, 1);
                dialog.showErrorBox("Error Saving", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
                // progressBar.maxValue = 100;
                // progressBar.value = 100;
                throw e;
            } finally {
                this.isSaving = false;
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
            if (typeof tab === "string")
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
                }
            if (tab === this.selectedTab) return;
            const previousTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null = this.selectedTab;
            this.selectedTab = tab;
            this.emit("switchTab", { previousTab, newTab: tab });
        }
        public async close(): Promise<void> {
            this.db?.close();
            this.isValid = false;
            const index: number = this.tabManager.openTabs.indexOf(this);
            if (this.tabManager.openTabs.includes(this)) {
                this.tabManager.openTabs.splice(this.tabManager.openTabs.indexOf(this), 1);
            }
            for (const tab of this.openTabs) {
                tab.close();
            }
            this.openTabs.length = 0;
            this.switchTab(null);
            this.tabManager.switchTab(index === -1 ? null : (this.tabManager.openTabs[index - 1] ?? this.tabManager.openTabs[0] ?? null));
            this.tabManager.emit("closeTab", { tab: this });
            this.emit("closed");
            if (this.tempPath) {
                if (this.db && this.db.isOpen()) await this.db.close();
                await rm(this.tempPath, { recursive: true, force: true });
            }
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
        }
    }

    /**
     * @todo
     */
    export type TabManagerSubTabChange = {
        type: "AddNBTKey";
        keyPath: string[];
        value: NBT.TagType[];
    };

    interface DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase {
        dataStorageObject?: DataStorageObject | undefined;
    }

    type DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase2 = {
        [key in Exclude<DBEntryContentType, keyof DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase>]: {
            type: key;
        } & DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase &
            ((typeof entryContentTypeToFormatMap)[key]["type"] extends "NBT" ? { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
            : (typeof entryContentTypeToFormatMap)[key]["type"] extends "custom" ?
                VerifyConstraint<(typeof entryContentTypeToFormatMap)[key], { type: "custom" }>["resultType"] extends "JSONNBT" ?
                    { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
                :   unknown
            :   unknown);
    } & DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase;

    interface DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase {
        StructureTemplate: {
            type: "StructureTemplate";
            viewMode?: "3D" | "2D" | "node" | "jsonnbt" | "snbt" | "raw";
        } & DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
        FlatWorldLayers: {
            type: "FlatWorldLayers";
            viewMode?: "FlatWorldLayers" | "node" | "jsonnbt" | "snbt" | "raw";
        } & DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
        Map: {
            type: "Map";
            viewMode?: "map" | "node" | "jsonnbt" | "snbt" | "raw";
        } & DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsOptionBase;
    }

    export interface DBEntryContentTypeToTabManagerSubTabCurrentStateOptions
        extends DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase, DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase2 {}

    export type TabManagerSubTabCurrentState<ContentType extends DBEntryContentType = DBEntryContentType> = {
        scrollTop: number;
        options: DBEntryContentTypeToTabManagerSubTabCurrentStateOptions[ContentType];
    };

    export interface GenericDataStorageObjectNBTCompound {
        data: NBT.Compound;
        dataType: "NBTCompound";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectNBT {
        data: Awaited<ReturnTypeWithArgs<(typeof NBT)["parse"], [data: Buffer, nbtType?: NBT.NBTFormat | undefined]>>;
        dataType: "NBT";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectJSON {
        data: Record<string | number, GenericDataStorageObjectJSON_JSONNodeValue>;
        dataType: "JSON";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectASCII {
        data: string;
        dataType: "ASCII";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectUTF8 {
        data: string;
        dataType: "UTF-8";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectHex {
        data: string;
        dataType: "hex";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectBinaryPlainText {
        data: string;
        dataType: "binaryPlainText";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectInt {
        data: bigint;
        dataType: "int";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectBinary {
        data: Buffer;
        dataType: "binary";
        sourceType: EntryContentTypeFormatData;
    }

    export interface GenericDataStorageObjectUnknown {
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
        | GenericDataStorageObjectASCII
        | GenericDataStorageObjectUTF8
        | GenericDataStorageObjectHex
        | GenericDataStorageObjectBinaryPlainText
        | GenericDataStorageObjectInt
        | GenericDataStorageObjectBinary
        | GenericDataStorageObjectUnknown;

    export type DataStorageObject = GenericDataStorageObject &
        PartialWU<Omit<TreeEditorDataStorageObjectInput & MapEditorDataStorageObject, KeysOfUnion<GenericDataStorageObject>>>;

    const tabManagerSubTabContentTypeToDefaultIconMap: Record<DBEntryContentType, string | undefined> = {
        AABBVolumes: undefined,
        ActorDigestVersion: undefined,
        ActorPrefix: "resource://images/ui/glyphs/icon_panda.png",
        AutonomousEntities: undefined,
        BiomeData: "resource://images/ui/glyphs/icon_biome.png",
        BiomeIdsTable: undefined,
        BiomeState: undefined,
        BlendingBiomeHeight: undefined,
        BlendingData: undefined,
        BlockEntity: undefined,
        BorderBlocks: undefined,
        Checksums: undefined,
        ChunkLoadedRequest: undefined,
        ConversionData: undefined,
        Data2D: undefined,
        Data2DLegacy: undefined,
        Data3D: undefined,
        Digest: undefined,
        DynamicProperties: undefined,
        Entity: undefined,
        FinalizedState: undefined,
        FlatWorldLayers: undefined,
        ForcedWorldCorruption: undefined,
        GeneratedPreCavesAndCliffsBlending: undefined,
        GenerationSeed: undefined,
        HardcodedSpawners: undefined,
        LegacyBlockExtraData: undefined,
        LegacyNether: undefined,
        LegacyOverworld: undefined,
        LegacyTerrain: undefined,
        LegacyTheEnd: undefined,
        LegacyVersion: undefined,
        LevelChunkMetaDataDictionary: undefined,
        LevelDat: "resource://images/ui/glyphs/settings_glyph_color_2x.png",
        LevelSpawnWasFixed: undefined,
        Map: "resource://images/ui/glyphs/icon_map.png",
        MetaDataHash: undefined,
        MobEvents: undefined,
        MVillages: undefined,
        Nether: undefined,
        Overworld: undefined,
        PendingTicks: undefined,
        Player: "resource://images/ui/glyphs/icon_steve_server.png",
        PlayerClient: "resource://images/ui/glyphs/icon_steve_client.png",
        Portals: "resource://images/ui/glyphs/realmPortalSmall.png",
        PositionTrackingDB: undefined,
        PositionTrackingLastId: undefined,
        RandomTicks: undefined,
        RealmsStoriesData: undefined,
        SchedulerWT: "resource://images/ui/glyphs/icon_wandering_trader.png",
        Scoreboard: "resource://images/ui/glyphs/icon_best3.png",
        StructureTemplate: "resource://images/ui/glyphs/structure_block.png",
        SubChunkPrefix: undefined,
        TheEnd: undefined,
        TickingArea: undefined,
        Unknown: undefined,
        Version: undefined,
        VillageDwellers: undefined,
        VillageInfo: undefined,
        VillagePlayers: undefined,
        VillagePOI: undefined,
        VillageRaid: undefined,
        Villages: undefined,
    };

    export class TabManagerSubTab<ContentType extends DBEntryContentType = DBEntryContentType> {
        #hasUnsavedChanges: boolean = false;
        #isPinned: boolean = false;
        public static lastID: bigint = 0n;
        public readonly parentTab: TabManagerTab;
        public name: string;
        public icon?: LooseAutocomplete<"auto"> | undefined;
        public contentType: ContentType;
        public target:
            | {
                  type: "LevelDBEntry";
                  /**
                   * The raw key of the entry.
                   */
                  key: Buffer;
              }
            | {
                  type: "File";
                  /**
                   * A relative path from the parent tab location to the file.
                   */
                  path: string;
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
            target: TabManagerSubTab<ContentType>["target"];
            specialTabID?: TabManagerTabGenericSubTabID | undefined;
            isPinned?: boolean | undefined;
            readonly?: boolean | undefined;
        }) {
            this.parentTab = props.parentTab;
            this.name = props.name;
            this.icon = props.icon === "auto" ? tabManagerSubTabContentTypeToDefaultIconMap[props.contentType] : props.icon;
            this.target = props.target;
            this.contentType = props.contentType;
            this.specialTabID = props.specialTabID;
            this.currentState = {
                scrollTop: 0,
                options: {
                    type: props.contentType,
                } as DBEntryContentTypeToTabManagerSubTabCurrentStateOptions[ContentType],
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
            if (this.target.type === "File") this.parentTab.setFileAsModified(this.target.path);
        }
        public isModified(): boolean {
            return this.hasUnsavedChanges || this.activeChanges.length > 0;
        }
        public async loadData(binary: boolean = false): Promise<void> {
            targetTypeSwitcher: switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");
                    if (binary) {
                        this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                        this.currentState.options.dataStorageObject.dataType = "binary";
                        this.currentState.options.dataStorageObject.data = (await this.parentTab.db!.get(this.target.key)) ?? Buffer.from([]);
                        break;
                    }
                    const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[this.currentState.options.type] as EntryContentTypeFormatData;
                    const rawData = await this.parentTab.db!.get(this.target.key);
                    if (rawData === null) {
                        throw new Error("The LevelDB key associated with this sub-tab does not exist.");
                    }
                    this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                    switch (format.type) {
                        case "NBT": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "NBT",
                                data: await NBT.parse(rawData),
                            } as const satisfies GenericDataStorageObjectNBT & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "SNBT": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "NBTCompound",
                                data: parseSNBTCompoundString(rawData.toString("binary")),
                            } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "JSON": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "JSON",
                                data: JSON.parse(rawData.toString("binary")),
                            } as const satisfies GenericDataStorageObjectJSON & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "ASCII": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "ASCII",
                                data: rawData.toString("ascii"),
                            } as const satisfies GenericDataStorageObjectASCII & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "UTF-8": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "UTF-8",
                                data: rawData.toString("utf-8"),
                            } as const satisfies GenericDataStorageObjectUTF8 & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "hex": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "hex",
                                data: rawData.toString("hex"),
                            } as const satisfies GenericDataStorageObjectHex & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "binaryPlainText": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "binaryPlainText",
                                data: rawData.toString("binary"),
                            } as const satisfies GenericDataStorageObjectBinaryPlainText & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "int": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "int",
                                data: parseSpecificIntType(rawData, format.bytes, format.format, format.signed),
                            } as const satisfies GenericDataStorageObjectInt & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "unknown":
                        case "binary": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "binary",
                                data: rawData,
                            } as const satisfies GenericDataStorageObjectBinary & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "custom": {
                            switch (format.resultType) {
                                case "JSONNBT": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "NBTCompound",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "SNBT": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "NBTCompound",
                                        data: parseSNBTCompoundString(await format.parse(rawData)),
                                    } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "buffer": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "binary",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectBinary & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "unknown": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "unknown",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectUnknown & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                default:
                                    throw new Error(`Unknown format type: ${format?.["type"]}.${format?.["resultType"]}`);
                            }
                        }
                        default:
                            throw new Error(`Unknown format type: ${format?.["type"]}`);
                    }
                }
                case "File": {
                    if (!existsSync(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path)))
                        throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.target.path}`);
                    if (binary) {
                        this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                        this.currentState.options.dataStorageObject.dataType = "binary";
                        this.currentState.options.dataStorageObject.data = await readFile(
                            path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path)
                        );
                        break;
                    }
                    const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[this.currentState.options.type] as EntryContentTypeFormatData;
                    const rawData: Buffer = await readFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path));
                    this.currentState.options.dataStorageObject ??= {} as DataStorageObject;
                    switch (format.type) {
                        case "NBT": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "NBT",
                                data: await NBT.parse(rawData),
                            } as const satisfies GenericDataStorageObjectNBT & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "SNBT": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "NBTCompound",
                                data: parseSNBTCompoundString(rawData.toString("binary")),
                            } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "JSON": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "JSON",
                                data: JSON.parse(rawData.toString("binary")),
                            } as const satisfies GenericDataStorageObjectJSON & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "ASCII": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "ASCII",
                                data: rawData.toString("ascii"),
                            } as const satisfies GenericDataStorageObjectASCII & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "UTF-8": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "UTF-8",
                                data: rawData.toString("utf-8"),
                            } as const satisfies GenericDataStorageObjectUTF8 & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "hex": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "hex",
                                data: rawData.toString("hex"),
                            } as const satisfies GenericDataStorageObjectHex & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "binaryPlainText": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "binaryPlainText",
                                data: rawData.toString("binary"),
                            } as const satisfies GenericDataStorageObjectBinaryPlainText & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "int": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "int",
                                data: parseSpecificIntType(rawData, format.bytes, format.format, format.signed),
                            } as const satisfies GenericDataStorageObjectInt & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "unknown":
                        case "binary": {
                            this.currentState.options.dataStorageObject = {
                                treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                sourceType: format,
                                dataType: "binary",
                                data: rawData,
                            } as const satisfies GenericDataStorageObjectBinary & DataStorageObject;
                            break targetTypeSwitcher;
                        }
                        case "custom": {
                            switch (format.resultType) {
                                case "JSONNBT": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "NBTCompound",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "SNBT": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "NBTCompound",
                                        data: parseSNBTCompoundString(await format.parse(rawData)),
                                    } as const satisfies GenericDataStorageObjectNBTCompound & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "buffer": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "binary",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectBinary & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                case "unknown": {
                                    this.currentState.options.dataStorageObject = {
                                        treeEditor: this.currentState.options.dataStorageObject.treeEditor,
                                        sourceType: format,
                                        dataType: "unknown",
                                        data: await format.parse(rawData),
                                    } as const satisfies GenericDataStorageObjectUnknown & DataStorageObject;
                                    break targetTypeSwitcher;
                                }
                                default:
                                    throw new Error(`Unknown format type: ${format?.["type"]}.${format?.["resultType"]}`);
                            }
                        }
                        default:
                            throw new Error(`Unknown format type: ${format?.["type"]}`);
                    }
                }
            }
        }
        public async exportRawData(loadIfNotLoaded: boolean = false): Promise<Buffer> {
            if (!this.currentState.options.dataStorageObject) {
                if (!loadIfNotLoaded) throw new Error("This sub-tab has no data.");
                await this.loadData();
                if (!this.currentState.options.dataStorageObject) throw new Error("Failed to load data for this sub-tab.");
            }
            switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");

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
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
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
                                    if (format.format && data.type !== ({ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format))
                                        console.warn(
                                            `NBT endianness mismatch. Data endianness is ${
                                                this.currentState.options.dataStorageObject.data.type
                                            }, but format endianness is ${{ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format}`,
                                            this.target.key,
                                            format,
                                            this.currentState.options.dataStorageObject,
                                            this
                                        );
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
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
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
                            if (format.type !== "int")
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? "." + format.resultType : "")
                                    }.`
                                );
                            const data = this.currentState.options.dataStorageObject.data;
                            return writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true });
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return data;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data = this.currentState.options.dataStorageObject.data;
                                return await format.serialize(data);
                            }
                            throw new Error(
                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                    format.type + (format.type === "custom" ? "." + format.resultType : "")
                                }.`
                            );
                        }
                        default:
                            throw new Error(`Unsupported data type: ${format.type}`);
                    }
                }
                case "File": {
                    if (!existsSync(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path)))
                        throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.target.path}`);

                    if (!this.currentState.options.dataStorageObject) throw new Error("This sub-tab has no data.");

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
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
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
                                    if (format.format && data.type !== ({ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format))
                                        console.warn(
                                            `NBT endianness mismatch. Data endianness is ${
                                                this.currentState.options.dataStorageObject.data.type
                                            }, but format endianness is ${{ LE: "little", BE: "big", LEV: "littleVarint" }[format.format] ?? format.format}`,
                                            this.target.path,
                                            format,
                                            this.currentState.options.dataStorageObject,
                                            this
                                        );
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
                                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${format?.["type"]}.${format?.["resultType"]}.`
                                            );
                                    }
                                }
                                case "int":
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
                            if (format.type !== "int")
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? "." + format.resultType : "")
                                    }.`
                                );
                            const data = this.currentState.options.dataStorageObject.data;
                            return writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true });
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            return data;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data = this.currentState.options.dataStorageObject.data;
                                return await format.serialize(data);
                            }
                            throw new Error(
                                `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                    format.type + (format.type === "custom" ? "." + format.resultType : "")
                                }.`
                            );
                        }
                        default:
                            throw new Error(`Unsupported data type: ${format.type}`);
                    }
                }
                default:
                    throw new Error(`Unsupported target type: ${this.target["type"]}`);
            }
        }
        public async save(): Promise<void> {
            if (!this.hasUnsavedChanges) return;
            switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");

                    await this.parentTab.db!.put(this.target.key, await this.exportRawData(false));
                    break;
                }
                case "File": {
                    if (!existsSync(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path))) {
                        throw new ReferenceError(`The file associated with this sub-tab does not exist: ${this.target.path}`);
                    }

                    await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), await this.exportRawData(false));
                    break;
                }
                default:
                    throw new Error(`Unsupported target type: ${this.target["type"]}`);
            }
            this.hasUnsavedChanges = false;
            if (
                this.target.type === "File" &&
                ![TabManagerTabMode.CopyUntilSave].includes(this.parentTab.mode) &&
                ["world", "leveldb"].includes(this.parentTab.type)
            )
                this.parentTab.setFileAsModified(this.target.path, false);
        }
        public close(): void {
            this.isValid = false;
            const index: number = this.parentTab.openTabs.indexOf(this);
            if (this.parentTab.openTabs.includes(this)) {
                this.parentTab.openTabs.splice(this.parentTab.openTabs.indexOf(this), 1);
            }
            if (this.parentTab.selectedTab === this)
                this.parentTab.switchTab(index === -1 ? null : (this.parentTab.openTabs[index - 1] ?? this.parentTab.openTabs[0] ?? null));
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
    export interface TabManagerTab_LevelDBSearchQuery {
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
        contentTypes?: DBEntryContentType[] | undefined;
        excludeContentTypes?: DBEntryContentType[] | undefined;
        searchTargets?:
            | (
                  | {
                        key: Buffer;
                        contentType?: DBEntryContentType;
                        displayKey?: string;
                        valueType: (typeof entryContentTypeToFormatMap)[DBEntryContentType];
                        value: any;
                        data?: unknown;
                        searchableContents?: string[];
                        customDataFields?: Record<string, string | undefined>;
                    }
                  | {
                        key: Buffer;
                        contentType?: DBEntryContentType;
                        displayKey?: string;
                        valueType?: undefined;
                        value?: undefined;
                        data?: unknown;
                        searchableContents?: string[];
                        customDataFields?: Record<string, string | undefined>;
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
         */
        readonly quality?: number | undefined;
        /**
         * The orginal object.
         *
         * Only present of {@link TabManagerTab_LevelDBSearchQuery.searchTargets} was provided in the search query.
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
                )
                    return false;
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
                )
                    return false;
                if (
                    query.key &&
                    (key !== undefined ?
                        !cmpStrCS(key, query.key, query.caseSensitiveKey ?? true)
                    :   "name" in nbt && !cmpStrCS(query.key, nbt.name, query.caseSensitiveKey ?? true))
                )
                    return false;
                if (query.tagType && !cmpStrCS(query.tagType, nbt.type, false)) return false;
                if (
                    query.value &&
                    !compareNBTTagValues(
                        query.value,
                        nbt.type === "long" && typeof nbt.value === "object" ? toLong(nbt.value) : nbt.value,
                        query.caseSensitiveValue ?? true
                    )
                )
                    return false;
                return true;
            }
            if (doesThisMatch()) return true;
            switch (nbt.type) {
                case NBT.TagType.Compound:
                    return Object.entries(nbt.value).some((v): boolean =>
                        v[1] === undefined ? false : this.findMatchingNBTTag(v[1], query, [...path, v[0]], v[0])
                    );
                case NBT.TagType.List:
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
                case NBT.TagType.ByteArray:
                case NBT.TagType.ShortArray:
                case NBT.TagType.IntArray:
                case NBT.TagType.LongArray:
                    if (query.tagType) {
                        if (nbt.type === NBT.TagType.ByteArray && query.tagType !== NBT.TagType.Byte) return false;
                        if (nbt.type === NBT.TagType.ShortArray && query.tagType !== NBT.TagType.Short) return false;
                        if (nbt.type === NBT.TagType.IntArray && query.tagType !== NBT.TagType.Int) return false;
                        if (nbt.type === NBT.TagType.LongArray && query.tagType !== NBT.TagType.Long) return false;
                    }
                    return nbt.value.some((v: number | [high: number, low: number], i: number): boolean => {
                        if (query.key && cmpStrCS(query.key, i.toString(), query.caseSensitiveKey ?? true)) return false;
                        if (query.value && !compareNBTTagValues(query.value, typeof v === "number" ? v : toLong(v), query.caseSensitiveValue ?? true))
                            return false;
                        return true;
                    });
                default:
                    return false;
            }
        }
        public *serach<T extends TabManagerTab_LevelDBSearchQuery, YU extends boolean = false>(
            query: T,
            yieldUndefined?: YU
        ): Generator<
            | TabManagerTab_LevelDBSearchResult<
                  T["searchTargets"] extends any[] ? T["searchTargets"][number]
                  :   {
                          key: Buffer<ArrayBufferLike>;
                          contentType: DBEntryContentType;
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
            const searchTargets: TabManagerTab_LevelDBSearchQuery["searchTargets"] & { contentType: DBEntryContentType; displayKey: string }[] =
                query.searchTargets
                    ?.map((v) =>
                        v.contentType ?
                            (v as typeof v & { contentType: DBEntryContentType; displayKey: string })
                        :   { ...v, contentType: getContentTypeFromDBKey(v.key), displayKey: v.displayKey ?? getKeyDisplayName(v.key) }
                    )
                    .filter(({ contentType }): boolean =>
                        !query.excludeContentTypes?.includes(contentType) && query.contentTypes ? query.contentTypes.includes(contentType) : true
                    ) ??
                (Object.entries(this.tab.cachedDBKeys!) as [DBEntryContentType, Buffer[]][])
                    .filter(([contentType]): boolean =>
                        !query.excludeContentTypes?.includes(contentType) && query.contentTypes ? query.contentTypes.includes(contentType) : true
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
                            this.findMatchingNBTTag("parsed" in searchTarget.value ? searchTarget.value.parsed : searchTarget.value, v)
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (
                        query.nbtTags.anyOf &&
                        query.nbtTags.anyOf.length > 0 &&
                        !query.nbtTags.anyOf.some((v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery): boolean =>
                            this.findMatchingNBTTag("parsed" in searchTarget.value ? searchTarget.value.parsed : searchTarget.value, v)
                        )
                    ) {
                        if (yieldUndefined) yield undefined!;
                        continue;
                    }
                    if (query.nbtTags.oneOf && query.nbtTags.oneOf.length > 0) {
                        let foundMatchingOneOf: boolean = false;
                        for (const v of query.nbtTags.oneOf) {
                            if (this.findMatchingNBTTag("parsed" in searchTarget.value ? searchTarget.value.parsed : searchTarget.value, v)) {
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
                            this.findMatchingNBTTag("parsed" in searchTarget.value ? searchTarget.value.parsed : searchTarget.value, v)
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
                        if (query.customDataFields[customDataField] === undefined) {
                            if (yieldUndefined) yield undefined!;
                            continue;
                        }
                        const caseSensitive: boolean = query.customDataFields[customDataField].caseSensitive ?? false;
                        if (
                            query.customDataFields[customDataField].allOf &&
                            query.customDataFields[customDataField].allOf.length > 0 &&
                            (searchTarget.customDataFields?.[customDataField] === undefined ||
                                !query.customDataFields[customDataField].allOf.every((v: string): boolean =>
                                    /* caseSensitive ?
                                        searchTarget.customDataFields?.[customDataField] === v
                                    :   searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase() */
                                    caseSensitive ?
                                        !!searchTarget.customDataFields?.[customDataField]?.includes(v)
                                    :   !!searchTarget.customDataFields?.[customDataField]?.toLowerCase()?.includes(v.toLowerCase())
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].anyOf &&
                            query.customDataFields[customDataField].anyOf.length > 0 &&
                            (searchTarget.customDataFields?.[customDataField] === undefined ||
                                !query.customDataFields[customDataField].anyOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     searchTarget.customDataFields?.[customDataField] === v
                                    // :   searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        !!searchTarget.customDataFields?.[customDataField]?.includes(v)
                                    :   !!searchTarget.customDataFields?.[customDataField]?.toLowerCase()?.includes(v.toLowerCase())
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].oneOf &&
                            query.customDataFields[customDataField].oneOf.length > 0 &&
                            (searchTarget.customDataFields?.[customDataField] === undefined ||
                                !query.customDataFields[customDataField].oneOf.some((v: string): boolean =>
                                    // caseSensitive ?
                                    //     searchTarget.customDataFields?.[customDataField] === v
                                    // :   searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
                                    caseSensitive ?
                                        !!searchTarget.customDataFields?.[customDataField]?.includes(v)
                                    :   !!searchTarget.customDataFields?.[customDataField]?.toLowerCase()?.includes(v.toLowerCase())
                                ))
                        ) {
                            if (yieldUndefined) yield undefined!;
                            continue searchLoop;
                        }
                        if (
                            query.customDataFields[customDataField].noneOf &&
                            query.customDataFields[customDataField].noneOf.length > 0 &&
                            searchTarget.customDataFields?.[customDataField] !== undefined &&
                            query.customDataFields[customDataField].noneOf.some((v: string): boolean =>
                                // caseSensitive ?
                                //     searchTarget.customDataFields?.[customDataField] === v
                                // :   searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
                                caseSensitive ?
                                    !!searchTarget.customDataFields?.[customDataField]?.includes(v)
                                :   !!searchTarget.customDataFields?.[customDataField]?.toLowerCase()?.includes(v.toLowerCase())
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
    export import TabManagerTabSwitchTabEvent = exports.TabManagerTabSwitchTabEvent;
    export import TabManagerTabModificationStatusChangedEvent = exports.TabManagerTabModificationStatusChangedEvent;
    export import TabManagerTabStartedSavingEvent = exports.TabManagerTabStartedSavingEvent;
    export import TabManagerTabStoppedSavingEvent = exports.TabManagerTabStoppedSavingEvent;
    export import TabManagerSubTabModificationStatusChangedEvent = exports.TabManagerSubTabModificationStatusChangedEvent;
    export import TabManager = exports.TabManager;
    export import tabManager = exports.tabManager;
    export import TabManagerTab = exports.TabManagerTab;
    export import TabManagerSubTab = exports.TabManagerSubTab;
    export import DBEntryContentTypeToTabManagerSubTabCurrentStateOptions = exports.DBEntryContentTypeToTabManagerSubTabCurrentStateOptions;
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
