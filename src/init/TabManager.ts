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
import type { TreeEditorDataStorageObject } from "../../app/components/TreeEditor";
import { LevelDB } from "@8crafter/leveldb-zlib";
import path from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { copyFile, cp, readFile, rm, writeFile } from "node:fs/promises";
import { APP_DATA_FOLDER_PATH } from "../utils/URLs";
import type { MapEditorDataStorageObject } from "../../app/components/MapEditor";
import { app, dialog } from "@electron/remote";

namespace exports {
    type DefaultEventMap = [never];
    type Listener<K, T, F> = T extends DefaultEventMap ? F : K extends keyof T ? (T[K] extends unknown[] ? (...args: T[K]) => void : never) : never;
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

    export type TabManagerGenericTabID = "loading";

    export class TabManager extends EventEmitter<TabManagerEventMap> {
        public openTabs: TabManagerTab[] = [];
        public selectedTab: TabManagerTab | TabManagerGenericTabID | null = null;
        public constructor() {
            super();
            this.setMaxListeners(1000000);
        }
        public openTab(props: Omit<ConstructorParameters<typeof TabManagerTab>[0], "tabManager">): TabManagerTab {
            const tab = new TabManagerTab({ tabManager: this, ...props });
            this.openTabs.push(tab);
            this.emit("openTab", { tab });
            this.switchTab(tab);
            if (tab.path) app.addRecentDocument(tab.path);
            return tab;
        }
        public switchTab(tab: TabManagerTab | TabManagerGenericTabID | null): void {
            console.log(new Error().stack);
            if (tab === this.selectedTab) return;
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

    export const tabManager = new TabManager();

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
        | "search"
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

    export class TabManagerTab extends EventEmitter<TabManagerTabEventMap> {
        public static lastID: bigint = 0n;
        public tabManager: TabManager;
        public openTabs: TabManagerSubTab[] = [];
        public selectedTab: TabManagerSubTab | TabManagerTabGenericSubTabID | null = null;
        public path: string;
        public db?: LevelDB;
        public dbSearch?: TabManagerTab_LevelDBSearch;
        public cachedDBKeys?: {
            [key in DBEntryContentType]: Buffer[];
        };
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
        public name: string;
        /**
         * The file path or URI of the icon.
         */
        public icon: string;
        public type: "world" | "leveldb" | "nbt" | "json" | "other";
        public mode: TabManagerTabMode = TabManagerTabMode.Direct;
        /**
         * The path of the temporary copy of the source files, only used for {@link TabManagerTabMode.Readonly}, {@link TabManagerTabMode.CopyUntilSave}, and {@link TabManagerTabMode.Copy} modes.
         */
        public tempPath?: string;
        /**
         * The same as {@link tempPath} if {@link type} is `world` or `leveldb`, otherwise the path to the copied file within the {@link tempPath} directory.
         */
        public tempFilePath?: string;
        public readonly readonly: boolean = false;
        public readonly saveEnabled: boolean = true;
        public modifiedFiles: {
            files: string[];
            leveldb: boolean;
        } = {
            files: [],
            leveldb: false,
        };
        public isSaving: boolean = false;
        public readonly id: bigint = TabManagerTab.lastID++;
        public isValid: boolean = true;
        public constructor(props: {
            tabManager: TabManager;
            path: TabManagerTab["path"];
            name: TabManagerTab["name"];
            icon: TabManagerTab["icon"];
            type: TabManagerTab["type"];
            mode?: TabManagerTabMode;
        }) {
            super();
            this.setMaxListeners(1000000);
            this.tabManager = props.tabManager;
            this.path = props.path;
            this.name = props.name;
            this.icon = props.icon;
            this.type = props.type;
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
        }
        public get hasTabBar(): boolean {
            return this.type === "world" || this.type === "leveldb";
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
        public isModified(): boolean {
            return this.modifiedFiles.files.length > 0 || this.modifiedFiles.leveldb;
        }
        public setModifications(modifications: typeof this.modifiedFiles): void {
            this.modifiedFiles = modifications;
        }
        public setFileAsModified(file: string, isModified: boolean = true): void {
            if ((this.modifiedFiles.files.includes(file) && isModified) || (!this.modifiedFiles.files.includes(file) && !isModified)) return;
            const wasModified: boolean = this.isModified();
            if (isModified) {
                this.modifiedFiles.files.push(file);
            } else {
                this.modifiedFiles.files.splice(this.modifiedFiles.files.indexOf(file), 1);
            }
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        public setLevelDBIsModified(isModified: boolean = true): void {
            if (this.modifiedFiles.leveldb === isModified) return;
            const wasModified: boolean = this.isModified();
            this.modifiedFiles.leveldb = isModified;
            if (wasModified !== this.isModified()) this.emit("modificationStatusChanged", { tab: this, isModified: this.isModified() });
        }
        public async save(ignoreFailedTabSaves: boolean = false): Promise<void> {
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
                progressBar.detail = `Copying modified files to ${this.type === "world" ? "world" : this.type === "leveldb" ? "LevelDB" : "source"}...`;
                if (this.type === "world" || this.type === "leveldb") {
                    console.log(this.tempPath, this.path);
                    await cp(this.tempPath, this.path, { recursive: true, force: true, preserveTimestamps: true });
                } else {
                    await copyFile(this.tempFilePath, this.path);
                }
                this.modifiedFiles.files.length = 0;
                this.modifiedFiles.leveldb = false;
                progressBar._window?.setClosable(true);
                progressBar.close();
                this.emit("modificationStatusChanged", { tab: this, isModified: false });
            } catch (e) {
                successful = false;
                error = e;
                progressBar._window?.setClosable(true);
                progressBar.close();
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
            const tab = new TabManagerSubTab({ parentTab: this, ...props });
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
            this.tabManager.switchTab(index === -1 ? null : this.tabManager.openTabs[index - 1] ?? this.tabManager.openTabs[0] ?? null);
            this.tabManager.emit("closeTab", { tab: this });
            this.emit("closed");
            if (this.tempPath) {
                this.db && this.db.isOpen() && (await this.db.close());
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
            ((typeof entryContentTypeToFormatMap)[key]["type"] extends "NBT"
                ? { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
                : (typeof entryContentTypeToFormatMap)[key]["type"] extends "custom"
                ? VerifyConstraint<(typeof entryContentTypeToFormatMap)[key], { type: "custom" }>["resultType"] extends "JSONNBT"
                    ? { viewMode?: "node" | "jsonnbt" | "snbt" | "raw" }
                    : unknown
                : unknown);
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
        extends DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase,
            DBEntryContentTypeToTabManagerSubTabCurrentStateOptionsBase2 {}

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
        data: Awaited<ReturnTypeWithArgs<(typeof NBT)["parse"], [data: Buffer, nbtType?: NBT.NBTFormat]>>;
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
        Partial<Omit<TreeEditorDataStorageObject & MapEditorDataStorageObject, KeysOfUnion<GenericDataStorageObject>>>;

    const tabManagerSubTabContentTypeToDefaultIconMap: Record<DBEntryContentType, string | undefined> = {
        AABBVolumes: undefined,
        ActorDigestVersion: undefined,
        ActorPrefix: "resource://images/ui/glyphs/icon_panda.png",
        AutonomousEntities: undefined,
        BiomeData: undefined,
        BiomeState: undefined,
        BlendingBiomeHeight: undefined,
        BlendingData: undefined,
        BlockEntity: undefined,
        BorderBlocks: undefined,
        Checksums: undefined,
        ConversionData: undefined,
        Data2D: undefined,
        Data2DLegacy: undefined,
        Data3D: undefined,
        Digest: undefined,
        Dimension: undefined,
        DynamicProperties: undefined,
        Entity: undefined,
        FinalizedState: undefined,
        FlatWorldLayers: undefined,
        ForcedWorldCorruption: undefined,
        GeneratedPreCavesAndCliffsBlending: undefined,
        HardcodedSpawners: undefined,
        LegacyBlockExtraData: undefined,
        LegacyTerrain: undefined,
        LegacyVersion: undefined,
        LevelChunkMetaDataDictionary: undefined,
        LevelDat: "resource://images/ui/glyphs/settings_glyph_color_2x.png",
        Map: "resource://images/ui/glyphs/icon_map.png",
        MetaDataHash: undefined,
        MobEvents: undefined,
        PendingTicks: undefined,
        Player: "resource://images/ui/glyphs/icon_steve_server.png",
        PlayerClient: "resource://images/ui/glyphs/icon_steve_client.png",
        Portals: "resource://images/ui/glyphs/realmPortalSmall.png",
        RandomTicks: undefined,
        RealmsStoriesData: undefined,
        SchedulerWT: undefined,
        Scoreboard: "resource://images/ui/glyphs/icon_best3.png",
        StructureTemplate: undefined,
        SubChunkPrefix: undefined,
        TickingArea: undefined,
        Unknown: undefined,
        Version: undefined,
        VillageDwellers: undefined,
        VillageInfo: undefined,
        VillagePlayers: undefined,
        VillagePOI: undefined,
    };

    export class TabManagerSubTab<ContentType extends DBEntryContentType = DBEntryContentType> {
        #hasUnsavedChanges: boolean = false;
        public static lastID: bigint = 0n;
        public readonly parentTab: TabManagerTab;
        public name: string;
        public icon?: LooseAutocomplete<"auto">;
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
        public specialTabID?: TabManagerTabGenericSubTabID;
        /**
         * @todo
         */
        public readonly readonly: boolean = false;
        public readonly id: bigint = TabManagerSubTab.lastID++;
        public isValid: boolean = true;
        public constructor(props: {
            parentTab: TabManagerTab;
            name: TabManagerSubTab<ContentType>["name"];
            icon?: TabManagerSubTab<ContentType>["icon"];
            contentType: ContentType;
            target: TabManagerSubTab<ContentType>["target"];
            specialTabID?: TabManagerTabGenericSubTabID;
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
        }
        public get hasUnsavedChanges(): boolean {
            return this.#hasUnsavedChanges;
        }
        public set hasUnsavedChanges(value: boolean) {
            const wasModified: boolean = this.isModified();
            this.#hasUnsavedChanges = value;
            if (wasModified !== this.isModified()) this.parentTab.emit("modificationStatusChanged", { tab: this.parentTab, isModified: this.isModified() });
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
        public async save(): Promise<void> {
            if (!this.hasUnsavedChanges) return;
            targetTypeSwitcher: switch (this.target.type) {
                case "LevelDBEntry": {
                    if (!this.parentTab.db) throw new Error("The parent tab has no associated LevelDB.");
                    if (!this.parentTab.db.isOpen()) throw new Error("LevelDB is not open.");

                    if (!this.currentState.options.dataStorageObject) throw new Error("This sub-tab has no data.");

                    const format: EntryContentTypeFormatData = this.currentState.options.dataStorageObject.sourceType;

                    switch (this.currentState.options.dataStorageObject.dataType) {
                        case "NBTCompound": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            switch (format.type) {
                                case "NBT": {
                                    rawData = NBT.writeUncompressed(
                                        { name: "", ...data },
                                        "format" in format
                                            ? format.format === "LE"
                                                ? "little"
                                                : format.format === "BE"
                                                ? "big"
                                                : format.format === "LEV"
                                                ? "littleVarint"
                                                : "little"
                                            : "little"
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
                                            break targetTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                            await this.parentTab.db!.put(this.target.key, rawData);
                            break targetTypeSwitcher;
                        }
                        case "NBT": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            switch (format.type) {
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
                                            break targetTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                            await this.parentTab.db!.put(this.target.key, rawData);
                            break targetTypeSwitcher;
                        }
                        case "JSON": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, JSON.stringify(data));
                            break targetTypeSwitcher;
                        }
                        case "ASCII": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, Buffer.from(data, "ascii"));
                            break targetTypeSwitcher;
                        }
                        case "UTF-8": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, Buffer.from(data, "utf-8"));
                            break targetTypeSwitcher;
                        }
                        case "hex": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, Buffer.from(data, "hex"));
                            break targetTypeSwitcher;
                        }
                        case "binaryPlainText": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, Buffer.from(data, "binary"));
                            break targetTypeSwitcher;
                        }
                        case "int": {
                            if (format.type !== "int")
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? "." + format.resultType : "")
                                    }.`
                                );
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(
                                this.target.key,
                                writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true })
                            );
                            break targetTypeSwitcher;
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await this.parentTab.db!.put(this.target.key, data);
                            break targetTypeSwitcher;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data = this.currentState.options.dataStorageObject.data;
                                await this.parentTab.db!.put(this.target.key, await format.serialize(data));
                                break targetTypeSwitcher;
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
                            switch (format.type) {
                                case "NBT": {
                                    rawData = NBT.writeUncompressed(
                                        { name: "", ...data },
                                        "format" in format
                                            ? format.format === "LE"
                                                ? "little"
                                                : format.format === "BE"
                                                ? "big"
                                                : format.format === "LEV"
                                                ? "littleVarint"
                                                : "little"
                                            : "little"
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
                                            break targetTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data), { indent: 0 }), "binary");
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), rawData);
                            break targetTypeSwitcher;
                        }
                        case "NBT": {
                            const data = this.currentState.options.dataStorageObject.data;
                            let rawData: Buffer;
                            switch (format.type) {
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
                                            break targetTypeSwitcher;
                                        }
                                        case "SNBT": {
                                            rawData = Buffer.from(prettyPrintSNBT(prismarineToSNBT(data.parsed), { indent: 0 }), "binary");
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                                            break targetTypeSwitcher;
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
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), rawData);
                            break targetTypeSwitcher;
                        }
                        case "JSON": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), JSON.stringify(data));
                            break targetTypeSwitcher;
                        }
                        case "ASCII": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), Buffer.from(data, "ascii"));
                            break targetTypeSwitcher;
                        }
                        case "UTF-8": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), Buffer.from(data, "utf-8"));
                            break targetTypeSwitcher;
                        }
                        case "hex": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), Buffer.from(data, "hex"));
                            break targetTypeSwitcher;
                        }
                        case "binaryPlainText": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), Buffer.from(data, "binary"));
                            break targetTypeSwitcher;
                        }
                        case "int": {
                            if (format.type !== "int")
                                throw new Error(
                                    `Unsupported conversion from data type ${this.currentState.options.dataStorageObject.dataType} to ${
                                        format.type + (format.type === "custom" ? "." + format.resultType : "")
                                    }.`
                                );
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(
                                path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path),
                                writeSpecificIntType(Buffer.alloc(format.bytes), data, format.bytes, format.format, format.signed, 0, { wrap: true })
                            );
                            break targetTypeSwitcher;
                        }
                        case "binary": {
                            const data = this.currentState.options.dataStorageObject.data;
                            await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), data);
                            break targetTypeSwitcher;
                        }
                        case "unknown": {
                            if (format.type === "custom" && format.resultType === "unknown") {
                                const data = this.currentState.options.dataStorageObject.data;
                                await writeFile(path.join(this.parentTab.tempPath ?? this.parentTab.path, this.target.path), await format.serialize(data));
                                break targetTypeSwitcher;
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
            }
            this.hasUnsavedChanges = false;
            if (this.target.type === "File") this.parentTab.setFileAsModified(this.target.path, false);
        }
        public close(): void {
            this.isValid = false;
            const index: number = this.parentTab.openTabs.indexOf(this);
            if (this.parentTab.openTabs.includes(this)) {
                this.parentTab.openTabs.splice(this.parentTab.openTabs.indexOf(this), 1);
            }
            this.parentTab.switchTab(index === -1 ? null : this.parentTab.openTabs[index - 1] ?? this.parentTab.openTabs[0] ?? null);
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
            path?: string[];
            /**
             * Whether or not the path should be case-sensitive.
             *
             * @default true
             */
            caseSensitivePath?: boolean;
            /**
             * The key of the tag.
             *
             * @default undefined
             */
            key?: string;
            /**
             * Whether or not the key should be case-sensitive.
             *
             * @default true
             */
            caseSensitiveKey?: boolean;
            /**
             * The type of the tag.
             *
             * @default undefined
             */
            tagType?: `${TagType}`;
            /**
             * The value of the tag.
             *
             * Will be converted to a string before comparison, this can only match byte, short, int, long, float, double, and string tags.
             *
             * @default undefined
             */
            value?: NBT.Tags[TagType]["value"] | bigint;
            /**
             * Whether or not the value should be case-sensitive.
             *
             * @default true
             */
            caseSensitiveValue?: boolean;
        };
    }[NBT.TagType];
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
        OriginalObject extends NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number] | undefined = undefined
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
                    (key !== undefined
                        ? !cmpStrCS(key, query.key, query.caseSensitiveKey ?? true)
                        : "name" in nbt && !cmpStrCS(query.key, nbt.name, query.caseSensitiveKey ?? true))
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
                  T["searchTargets"] extends any[]
                      ? T["searchTargets"][number]
                      : {
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
                        v.contentType
                            ? (v as typeof v & { contentType: DBEntryContentType; displayKey: string })
                            : { ...v, contentType: getContentTypeFromDBKey(v.key), displayKey: v.displayKey ?? getKeyDisplayName(v.key) }
                    )
                    .filter(({ contentType }): boolean =>
                        !query.excludeContentTypes?.includes(contentType) && query.contentTypes ? query.contentTypes.includes(contentType) : true
                    ) ??
                (Object.entries(this.tab.cachedDBKeys!) as [DBEntryContentType, Buffer[]][])
                    .filter(([contentType]): boolean =>
                        !query.excludeContentTypes?.includes(contentType) && query.contentTypes ? query.contentTypes.includes(contentType) : true
                    )
                    .flatMap(([contentType, keys]) => keys.map((key) => ({ key, contentType, displayKey: getKeyDisplayName(key) })));
            console.log(5);
            searchLoop: for (const searchTarget of searchTargets) {
                const searchableContents: string[] = searchTarget.searchableContents ?? [searchTarget.displayKey];
                if (query.displayKeyContents) {
                    const caseSensitive: boolean = query.displayKeyContents.caseSensitive ?? false;
                    const displayKey: string = caseSensitive
                        ? searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key)
                        : (searchTarget.displayKey ?? getKeyDisplayName(searchTarget.key)).toLowerCase();
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
                                    caseSensitive
                                        ? searchTarget.customDataFields?.[customDataField] === v
                                        : searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
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
                                    caseSensitive
                                        ? searchTarget.customDataFields?.[customDataField] === v
                                        : searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
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
                                    caseSensitive
                                        ? searchTarget.customDataFields?.[customDataField] === v
                                        : searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
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
                                caseSensitive
                                    ? searchTarget.customDataFields?.[customDataField] === v
                                    : searchTarget.customDataFields?.[customDataField]?.toLowerCase() === v.toLowerCase()
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
    export import GenericDataStorageObjectNBTCompound = exports.GenericDataStorageObjectNBTCompound;
    export import GenericDataStorageObjectNBT = exports.GenericDataStorageObjectNBT;
    export import GenericDataStorageObjectJSON = exports.GenericDataStorageObjectJSON;
    export import GenericDataStorageObjectJSON_JSONNodeValue = exports.GenericDataStorageObjectJSON_JSONNodeValue;
    export import GenericDataStorageObject = exports.GenericDataStorageObject;
    export import TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery = exports.TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery;
    export import TabManagerTab_LevelDBSearchQuery = exports.TabManagerTab_LevelDBSearchQuery;
    export import TabManagerTab_LevelDBSearchResult = exports.TabManagerTab_LevelDBSearchResult;
    export import TabManagerTab_LevelDBSearch = exports.TabManagerTab_LevelDBSearch;
}
