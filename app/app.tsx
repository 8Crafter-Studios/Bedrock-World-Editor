import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import { render } from "preact/compat";
import LeftSidebar from "./components/LeftSidebar";
import DebugOverlay from "./components/DebugOverlay";
import TabBar from "./components/TabBar";
import {
    entryContentTypeToFormatMap,
    gameModes,
    generatorTypes,
    levelDatStorageVersionToMCVersionRangeMap,
    toLong,
    type EntryContentTypeFormatData,
    type LevelDatStorageVersionToMCVersionRangeMapType,
    type NBTSchemas,
} from "mcbe-leveldb";
import { Dirent, existsSync, globSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import WorldSettingsTab from "./tabs/worldSettings";
import SubTabBar from "./components/SubTabBar";
import PlayersTab from "./tabs/players";
import GenericNBTEditorTab from "./tabs/genericNBTEditor";
import HexEditorTab from "./tabs/hexEditor";
import * as monaco from "monaco-editor";
import EntitiesTab from "./tabs/entities";
import ViewFilesTab from "./tabs/viewFiles";
import RepairForcedWorldCorruptionTab from "./tabs/repairForcedWorldCorruption";
import MapsTab from "./tabs/maps";
import { app, dialog, shell } from "@electron/remote";
import MapEditorTab from "./tabs/mapNBTEditor";
import NoneTab from "./tabs/none";
import TickingAreasTab from "./tabs/tickingAreas";
import StructuresTab from "./tabs/structures";
import FunTab from "./tabs/fun";
import { ControlledMenu, MenuDivider, MenuItem, SubMenu, type ClickEvent, type MenuDirection } from "@szhsin/react-menu";
import { APP_DATA_FOLDER_PATH } from "../src/utils/URLs";
import TicksTab from "./tabs/ticks";
import { readdir, readFile, stat } from "node:fs/promises";
import { formatFileSizeBinary, formatFileSizeMetric } from "../src/utils/fileSizeUtils";
import IntegrationsTab from "./tabs/integrations";
import TextEditorTab from "./tabs/textEditor";
import UnderConstruction from "./components/UnderConstruction";
import { defaultWorldIconDataURI } from "../src/utils/preloadImages";
import SettingsPage from "./pages/settings";
import { normalizePath } from "../src/utils/pathUtils";
import Notice from "./components/Notice";
import WorldEditorTab from "./tabs/worldEditor";
import PacksTab from "./tabs/packs";
import type { OpenDialogReturnValue } from "electron";
// import { Renderer3D } from "./3DRendererV1/3DRenderer";
const mime = require("mime-types") as typeof import("mime-types");

monaco.languages.register({ id: "snbt", extensions: [".snbt"] });

let isClosing: boolean = false;
let closeCanceled: boolean = false;
getCurrentWindow().on("close", async (_event: Electron.Event): Promise<void> => {
    isClosing = true;
    if (tabManager.openTabs.length > 0) {
        closeCanceled = true;
        const unsavedTabs: TabManagerTab[] = tabManager.openTabs.filter((tab: TabManagerTab): boolean => tab.isModified());
        if (unsavedTabs.length > 0) {
            const result: number = dialog.showMessageBoxSync(getCurrentWindow(), {
                type: "warning",
                title: "Unsaved Changes",
                ...(unsavedTabs.length === 1 ?
                    {
                        message: `Do you want to save the changes you made to ${unsavedTabs[0]!.name}?`,
                        detail: "Your changes will be lost if you don't save them.",
                    }
                :   {
                        message: `Do you want to save the changes to the following ${unsavedTabs.length} tab${unsavedTabs.length === 1 ? "" : "s"}?`,
                        detail: `${unsavedTabs.map((tab: TabManagerTab): string => tab.name).join("\n")}\n\nYour changes will be lost if you don't save them.`,
                    }),
                buttons: ["Save", "Don't Save", "Cancel"],
                noLink: true,
                defaultId: 0,
                cancelId: 2,
            });
            switch (result) {
                case 0:
                    try {
                        await Promise.all(
                            unsavedTabs.map(
                                async (tab: TabManagerTab): Promise<void> => void (await tab.save().then(async (): Promise<void> => void (await tab.close())))
                            )
                        );
                    } catch (e) {
                        console.error(e);
                    }
                    isClosing = true;
                    closeCanceled = false;
                    getCurrentWindow().close();
                    return;
                case 1:
                    try {
                        await Promise.all(unsavedTabs.map(async (tab: TabManagerTab): Promise<void> => void (await tab.close())));
                    } catch (e) {
                        console.error(e);
                    }
                    isClosing = true;
                    closeCanceled = false;
                    getCurrentWindow().close();
                    return;
                case 2:
                    return;
                default:
                    return;
            }

            // event.preventDefault();
            // event.returnValue = "";
            /* [Window Title]
Visual Studio Code

[Main Instruction]
Do you want to save the changes to the following 2 files?

[Content]
TabManager.ts
app.tsx

Your changes will be lost if you don't save them.

[Save All] [Don't Save] [Cancel] */
        } else {
            try {
                await Promise.all(unsavedTabs.map(async (tab: TabManagerTab): Promise<void> => void (await tab.close())));
            } catch (e) {
                console.error(e);
            }
            isClosing = true;
            closeCanceled = false;
            getCurrentWindow().close();
        }
    }
});
window.addEventListener("beforeunload", async (event: BeforeUnloadEvent): Promise<void> => {
    if (isClosing) {
        isClosing = false;
        if (closeCanceled) {
            event.preventDefault();
            closeCanceled = false;
        }
        return;
    }
    if (!isClosing && tabManager.openTabs.length > 0) {
        const unsavedTabs: TabManagerTab[] = tabManager.openTabs.filter((tab: TabManagerTab): boolean => tab.isModified());
        if (unsavedTabs.length > 0) {
            const result: number = dialog.showMessageBoxSync(getCurrentWindow(), {
                type: "warning",
                title: "Unsaved Changes",
                ...(unsavedTabs.length === 1 ?
                    {
                        message: `Do you want to save the changes you made to ${unsavedTabs[0]!.name}?`,
                        detail: "Your changes will be lost if you don't save them.",
                    }
                :   {
                        message: `Do you want to save the changes to the following ${unsavedTabs.length} tab${unsavedTabs.length === 1 ? "" : "s"}?`,
                        detail: `${unsavedTabs.map((tab: TabManagerTab): string => tab.name).join("\n")}\n\nYour changes will be lost if you don't save them.`,
                    }),
                buttons: ["Save", "Don't Save", "Cancel"],
                noLink: true,
                defaultId: 0,
                cancelId: 2,
            });
            switch (result) {
                case 0:
                    event.preventDefault();
                    try {
                        await Promise.all(
                            unsavedTabs.map(
                                async (tab: TabManagerTab): Promise<void> => void (await tab.save().then(async (): Promise<void> => void (await tab.close())))
                            )
                        );
                    } catch (e) {
                        console.error(e);
                    }
                    location.reload();
                    break;
                case 1:
                    event.preventDefault();
                    try {
                        await Promise.all(unsavedTabs.map(async (tab: TabManagerTab): Promise<void> => void (await tab.close())));
                    } catch (e) {
                        console.error(e);
                    }
                    location.reload();
                    break;
                case 2:
                    event.preventDefault();
                    break;
                default:
                    break;
            }

            // event.preventDefault();
            // event.returnValue = "";
            /* [Window Title]
Visual Studio Code

[Main Instruction]
Do you want to save the changes to the following 2 files?

[Content]
TabManager.ts
app.tsx

Your changes will be lost if you don't save them.

[Save All] [Don't Save] [Cancel] */
        } else {
            event.preventDefault();
            try {
                await Promise.all(tabManager.openTabs.map(async (tab: TabManagerTab): Promise<void> => void (await tab.close())));
            } catch (e) {
                console.error(e);
            }
            location.reload();
        }
    }
});

/**
 * Sets the active page of the app to the specified page.
 *
 * @param activePage The page to set as active.
 */
export function setActivePage(activePage: string): void {
    $(`.app-tab:not(#app-tab-${activePage})`).hide();
    $(`#app-tab-${activePage}`).show();
    $(`.sidebar_button[data-path-id]:not([data-path-id="${activePage}"])`).removeClass("active");
    $(`.sidebar_button[data-path-id="${activePage}"]`).addClass("active");
}

/**
 * The root component for the app.
 *
 * @returns The JSX element for the app.
 */
export default function App(): JSX.Element {
    useLayoutEffect((): void => {
        const tabContentsElement: HTMLDivElement | null = document.getElementById("tab-contents-container") as HTMLDivElement | null;
        if (!tabContentsElement) return;
        renderTabContents({ newTab: tabManager.selectedTab, tabContentsElement });
    });
    return (
        <>
            {/* TODO (Important): This element needs to have the "inert" attribute added to it whenever an overlay page is open. */}
            <div id="app-contents">
                <MainEditor />
            </div>
            <div id="page-overlay-container" style="display: contents;" />
            <div id="drop-overlays" style="display: contents;">
                <div id="file-drop-open-overlay" class="fullscreen-drop-overlay" style="display: none;">
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/upload_glyph.png"
                        class="nsel ndrg piximg drop-overlay-icon"
                        style={{
                            width: `max(16px, min(50% - mod(50%, 16px), 128px))`,
                        }}
                    />
                    <p
                        class="nsel ndrg drop-overlay-message"
                        style={{
                            fontSize: "calc(max(16px, min(50vw - mod(50vw, 16px), 128px)) / 5)",
                            margin: "0.5em 0",
                        }}
                    >
                        Open file<span class="drop-overlay-message-plural">s</span>
                    </p>
                </div>
                <div id="file-drop-import-overlay" class="fullscreen-drop-overlay" style="display: none;">
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/upload_glyph.png"
                        class="nsel ndrg piximg drop-overlay-icon"
                        style={{
                            width: `max(16px, min(50% - mod(50%, 16px), 128px))`,
                        }}
                    />
                    <p
                        class="nsel ndrg drop-overlay-message"
                        style={{
                            fontSize: "calc(max(16px, min(50vw - mod(50vw, 16px), 128px)) / 5)",
                            margin: "0.5em 0",
                        }}
                    >
                        Import file<span class="drop-overlay-message-plural">s</span>
                    </p>
                </div>
            </div>
            <DebugOverlay />
            {/* This svg is used to completely disable anti-aliasing on fonts, please ignore it. */}
            <svg class="offscreen" width="0" height="0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="crispify">
                        <feComponentTransfer>
                            {/* <feFuncA type="discrete" tableValues="0 1" /> */}{" "}
                            {/* This one mostly works for Mojangles, though sometimes a V will be 3px thick instead of 2px. */}
                            <feFuncA type="gamma" exponent="40" amplitude="200" offset="0"></feFuncA> {/* This one works flawlessly for Minecraft-Seven. */}
                        </feComponentTransfer>
                    </filter>
                </defs>
            </svg>
        </>
    );
}

/**
 * The details of a Minecraft world to be used for displaying a world in the world selection menu.
 */
export interface MinecraftWorldDisplayDetails {
    name: string;
    path: string;
    thumbnailPath?: string | undefined;
    thumbnailObjectURL?: string | undefined;
    lastOpenedWithVerison: `v${string}` | null;
    createdInVersion: `v${string}` | null;
    minimumCompatibleClientVersion: `v${string}` | null;
    storageVersion: number | null;
    lastPlayed: Date | null;
    favorited: boolean;
    /**
     * The size of the world folder in bytes.
     *
     * If the size cannot be determined, it will be `NaN`.
     *
     * If getting the sizes was disabled, it will be `undefined`.
     */
    size?: Promise<number> | number | undefined;
    startCount: bigint;
    playTime: bigint | null;
    gameMode: number;
    generator: number;
    hardcore: boolean;
    multiplayer: boolean;
    fromLockedTemplate: boolean;
    fromWorldTemplate: boolean;
    singleUseWorld: boolean;
    editorOnly: boolean;
    createdInEditor: boolean;
    isolated: boolean;
    /**
     * Whether the world was last used on a version that is affected by the bug where if the LevelDB is touched, the game will freak out whenever it opens the world.
     *
     * @see {@link tabManager.checkWorldFragilityFromLevelDat}
     */
    fragileLevelDB: ReturnType<typeof tabManager.checkWorldFragilityFromLevelDat>;
}

// TODO (Config): Maybe add a config option for this.
const WORLD_FOLDER_LOCATIONS_CACHE_MAX_AGE: number = 30_000; /* 30 seconds */

/**
 * The cache for world folder locations.
 */
export const worldFolderLocationsCache = {
    _lastForceReload: -1,
    _lastCheck: {
        parsed: -1,
        parsedIsolated: -1,
        parsedExtra: -1,
        parsedExtraIsolated: -1,
    },
    cachedPaths: {
        parsed: [] as string[],
        parsedIsolated: [] as string[],
        parsedExtra: [] as string[],
        parsedExtraIsolated: [] as string[],
    },
    _loadPromises: {
        parsed: undefined as Promise<string[]> | undefined,
        parsedIsolated: undefined as Promise<string[]> | undefined,
        parsedExtra: undefined as Promise<string[]> | undefined,
        parsedExtraIsolated: undefined as Promise<string[]> | undefined,
    },
    // REVIEW
    /**
     * Loads the world folder locations of the specified types from the config and returns them, or the cached ones.
     *
     * @param types The types of world folder locations to load.
     * @param force Whether to forcefully reload the world folder locations.
     * @param skipLastForceReloadAssignment Whether to skip assigning the last reload time. This will prevent other types from being force reloaded when they are next fetched.
     * @returns The world folder locations of the specified types.
     */
    async loadPaths<T extends "parsed" | "parsedIsolated" | "parsedExtra" | "parsedExtraIsolated">(
        types: T[],
        force = false,
        skipLastForceReloadAssignment = false
    ): Promise<Pick<typeof this.cachedPaths, T>> {
        if (force && !skipLastForceReloadAssignment) this._lastForceReload = Date.now();
        const result: Pick<typeof this.cachedPaths, T> = {} as Pick<typeof this.cachedPaths, T>;
        await Promise.all(
            types.map(async (type: T): Promise<void> => {
                if (!(force || Date.now() - this._lastCheck[type] > WORLD_FOLDER_LOCATIONS_CACHE_MAX_AGE) || this._lastForceReload > this._lastCheck[type]) {
                    if (this._loadPromises[type]) await this._loadPromises[type].catch((): void => {});
                    if (this._lastCheck[type] !== -1) {
                        result[type] = this.cachedPaths[type];
                        return;
                    }
                }
                const startTime: number = Date.now();
                this._lastCheck[type] = startTime;
                try {
                    const promise: Promise<string[]> =
                        config[
                            type === "parsed" ? ("getParsedMinecraftDataFolders" satisfies keyof typeof config)
                            : type === "parsedIsolated" ? ("getParsedIsolatedMinecraftWorldsFolders" satisfies keyof typeof config)
                            : type === "parsedExtra" ? ("getParsedExtraMinecraftDataFolders" satisfies keyof typeof config)
                            : ("getParsedExtraIsolatedMinecraftWorldsFolders" satisfies keyof typeof config)
                        ]();
                    this._loadPromises[type] = promise;
                    const paths: string[] = await promise;
                    if (this._loadPromises[type] === promise) this._loadPromises[type] = undefined;
                    result[type] = paths;
                    if (this._lastCheck[type] > startTime) return;
                    this.cachedPaths[type] = paths;
                } catch (e) {
                    if (this._lastCheck[type] <= startTime) this._lastCheck[type] = -1;
                    throw e;
                }
            })
        );
        return result;
    },
    /**
     * Loads the world folder locations of the specified types from the config and returns them as a single flat array, or the cached ones.
     *
     * @param types The types of world folder locations to load.
     * @param force Whether to forcefully reload the world folder locations.
     * @param skipLastForceReloadAssignment Whether to skip assigning the last forced reload time. This will prevent other types from being force reloaded when they are next fetched.
     * @returns The world folder locations of the specified types as a single flat array.
     */
    async loadPathsAsList<T extends "parsed" | "parsedIsolated" | "parsedExtra" | "parsedExtraIsolated">(
        types: T[],
        force = false,
        skipLastForceReloadAssignment = false
    ): Promise<string[]> {
        if (force && !skipLastForceReloadAssignment) this._lastForceReload = Date.now();
        const paths = await this.loadPaths(types, force, true);
        return types.flatMap((type: T): string[] => paths[type]);
    },
    /**
     * Loads the world folder locations of the specified types from the config or uses the cached ones, and either returns true as soon as a location if found, or false after all have been checked and there are no matches.
     *
     * This continues to load the folders even after a match is found and the function returns true.
     *
     * @param types The types of world folder locations to load.
     * @param force Whether to forcefully reload the world folder locations.
     * @param skipLastForceReloadAssignment Whether to skip assigning the last reload time. This will prevent other types from being force reloaded when they are next fetched.
     * @returns A promise that resolves with true if a match is found, false otherwise.
     */
    async loadAndCheckForPathsEntries(
        types: ("parsed" | "parsedIsolated" | "parsedExtra" | "parsedExtraIsolated")[],
        force = false,
        skipLastForceReloadAssignment = false
    ): Promise<boolean> {
        if (force && !skipLastForceReloadAssignment) this._lastForceReload = Date.now();
        const result: PromiseWithResolvers<boolean> = Promise.withResolvers<boolean>();
        Promise.all(
            types.map(async (type: "parsed" | "parsedIsolated" | "parsedExtra" | "parsedExtraIsolated"): Promise<void> => {
                const paths: string[] = await this.loadPathsAsList([type], force, true);
                if (paths.length) result.resolve(true);
            })
        ).then(result.resolve.bind(void 0, false), result.reject);
        return await result.promise;
    },
};

/**
 * Gets the Minecraft worlds that should be displayed on app's world selection menu.
 *
 * @param all Whether to include worlds from the extra search locations.
 * @param getSizes Whether to get the sizes of the world folders.
 * @returns A promise resolving with an array of {@link MinecraftWorldDisplayDetails}.
 */
export async function getMinecraftWorlds(all: boolean = false, getSizes: boolean = false): Promise<MinecraftWorldDisplayDetails[]> {
    /**
     * The cached resolved normalized real paths of the world folders.
     */
    const cachedRealPaths: string[] = [];
    /**
     * The cached normalized paths of the world folders.
     */
    const cachedNormalizedPaths: string[] = [];
    /**
     * An array of file paths of favorited worlds normalized using {@link normalizePath}.
     */
    const favoritedWorldsData: readonly string[] | null =
        existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")) ?
            await (async (): Promise<string[] | null> => {
                try {
                    const favoritedWorldsData = JSON.parse(await readFile(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")) as string[];
                    // Verify that the data is an array.
                    if (!(favoritedWorldsData instanceof Array)) {
                        throw new TypeError(
                            `The favorited_worlds.json file is not an array. path: ${path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")}`,
                            {
                                cause: { path: path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), data: favoritedWorldsData },
                            }
                        );
                    }
                    // Verify that the array contains only strings.
                    const nonStringIndex: number = favoritedWorldsData.findIndex((path: string): boolean => typeof path !== "string");
                    if (nonStringIndex !== -1) {
                        throw new TypeError(
                            `The favorited_worlds.json file contains non-string values. path: ${path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")} index: ${nonStringIndex}`,
                            {
                                cause: { path: path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), data: favoritedWorldsData, badIndex: nonStringIndex },
                            }
                        );
                    }
                    return favoritedWorldsData.map(normalizePath);
                } catch (e) {
                    console.error("Error reading favorited_worlds.json:", e);
                }
                return null;
            })()
        :   null;
    interface FolderPathIsolationDetails {
        folderPath: string;
        isolated: boolean;
    }
    const failedWorldReadLogs: {
        type: "failed" | "usedFallback";
        consoleLogItems: unknown[];
    }[] = [];
    return (
        await Promise.all(
            [
                ...[...new Set(await worldFolderLocationsCache.loadPathsAsList(all ? ["parsed", "parsedExtra"] : ["parsed"]))]
                    .filter(
                        (folderPath: string): boolean => existsSync(path.join(folderPath, "minecraftWorlds")) || existsSync(path.join(folderPath, "worlds"))
                    )
                    .map((folderPath: string): string[] => {
                        const usesMinecraftWorlds: boolean = existsSync(path.join(folderPath, "minecraftWorlds"));
                        return readdirSync(usesMinecraftWorlds ? path.join(folderPath, "minecraftWorlds") : path.join(folderPath, "worlds"), {
                            withFileTypes: true,
                        })
                            .filter((dirent: Dirent<string>): boolean => dirent.isDirectory())
                            .map((dirent: Dirent<string>): string =>
                                usesMinecraftWorlds ? path.join(folderPath, "minecraftWorlds", dirent.name) : path.join(folderPath, "worlds", dirent.name)
                            );
                    })
                    .flat()
                    .map((v: string): FolderPathIsolationDetails => ({ folderPath: v, isolated: false })),
                ...[...new Set(await worldFolderLocationsCache.loadPathsAsList(all ? ["parsedIsolated", "parsedExtraIsolated"] : ["parsedIsolated"]))]
                    .filter((folderPath: string): boolean => existsSync(folderPath))
                    .map((folderPath: string): string[] => {
                        return readdirSync(folderPath, {
                            withFileTypes: true,
                        })
                            .filter((dirent: Dirent<string>): boolean => dirent.isDirectory())
                            .map((dirent: Dirent<string>): string => path.join(folderPath, dirent.name));
                    })
                    .flat()
                    .map((v: string): FolderPathIsolationDetails => ({ folderPath: v, isolated: true })),
            ]
                // Use this filter instead of [...new Set([...])] to allow keeping track of which folders are isolated.
                .filter(
                    ({ folderPath }: FolderPathIsolationDetails, i: number, a: FolderPathIsolationDetails[]): boolean =>
                        !a.slice(0, i).some((v: FolderPathIsolationDetails): boolean => v.folderPath === folderPath)
                )
                .filter((_arg0: FolderPathIsolationDetails, i: number, a: FolderPathIsolationDetails[]): boolean => {
                    if (i === 0) {
                        cachedRealPaths.push(...a.map(({ folderPath }: FolderPathIsolationDetails): string => normalizePath(realpathSync(folderPath))));
                        cachedNormalizedPaths.push(...a.map(({ folderPath }: FolderPathIsolationDetails): string => normalizePath(folderPath)));
                    }
                    return (
                        !(
                            // Don't include if another world with the same real path has already been included.
                            (
                                cachedRealPaths.slice(0, i).includes(cachedRealPaths[i]!) ||
                                // Don't include if this world shares a real path with a favorited world, as favorited worlds have priority.
                                cachedRealPaths.some(
                                    (realPath: string, j: number): boolean =>
                                        i !== j &&
                                        realPath.split("\\").join("/") === cachedRealPaths[i]! &&
                                        !!favoritedWorldsData?.includes(cachedNormalizedPaths[j]!)
                                )
                            )
                        ) ||
                        // If the world is favorited, include it.
                        (!!favoritedWorldsData?.includes(cachedNormalizedPaths[i]!) &&
                            // If the world shared an exact path with an already included favorited world, don't include it (this only applies to favorite
                            // worlds sharing the same normalized path, not real paths, e.g. two symbolic links to the same folder would both be included if
                            // they are favorited, but two paths to the same folder or symbolic link would only include the first).
                            // Checking each path to make sure it is in the list of favorited worlds is not necessary here as the normalized path would be
                            // identical to the current normalized path which has already been checked.
                            !cachedNormalizedPaths.slice(0, i).includes(cachedNormalizedPaths[i]!))
                        // This is left here in case favorited worlds sharing the same normalized real path need to be excluded.
                        // IDEA: Maybe add a config option to enable this check.
                        /*  &&
                            !cachedRealPaths
                                .slice(0, i)
                                .some(
                                    (realPath: string, j: number): boolean =>
                                        realPath.split("\\").join("/") === cachedRealPaths[i]! && !!favoritedWorldsData?.includes(cachedNormalizedPaths[j]!)
                                ) */
                    );
                })
                .map(async ({ folderPath, isolated }: FolderPathIsolationDetails): Promise<MinecraftWorldDisplayDetails | undefined> => {
                    if (!existsSync(path.join(folderPath, "level.dat"))) return;
                    try {
                        const levelDat: NBTSchemas.NBTSchemaTypes.LevelDat | undefined = await (async (): Promise<
                            NBTSchemas.NBTSchemaTypes.LevelDat | undefined
                        > => {
                            try {
                                return await entryContentTypeToFormatMap.LevelDat.parse(await readFile(path.join(folderPath, "level.dat"), { encoding: null }));
                            } catch (e) {
                                let levelDatOldFailure: boolean = false;
                                try {
                                    if (existsSync(path.join(folderPath, "level.dat_old"))) {
                                        return await entryContentTypeToFormatMap.LevelDat.parse(
                                            await readFile(path.join(folderPath, "level.dat_old"), { encoding: null })
                                        );
                                    }
                                    levelDatOldFailure = true;
                                    failedWorldReadLogs.push({
                                        type: "failed",
                                        consoleLogItems: [
                                            "Unable to load details for world; Error while reading level.dat, and level.dat_old not found. level.dat error:",
                                            e,
                                            "folderPath:",
                                            folderPath,
                                        ],
                                    });
                                } catch (e2) {
                                    levelDatOldFailure = true;
                                    failedWorldReadLogs.push({
                                        type: "failed",
                                        consoleLogItems: [
                                            "Unable to load details for world; Error while reading both level.dat and level.dat_old. level.dat error:",
                                            e,
                                            "level.dat_old error:",
                                            e2,
                                            "folderPath:",
                                            folderPath,
                                        ],
                                    });
                                } finally {
                                    if (!levelDatOldFailure) {
                                        failedWorldReadLogs.push({
                                            type: "usedFallback",
                                            consoleLogItems: [
                                                "Used level.dat_old as fallback for world due to an error while reading level.dat:",
                                                e,
                                                "folderPath:",
                                                folderPath,
                                            ],
                                        });
                                    }
                                }
                            }
                            return undefined;
                        })();
                        if (!levelDat) return;
                        const name: string =
                            levelDat.value.LevelName?.value ??
                            (existsSync(path.join(folderPath, "levelname.txt")) ?
                                await readFile(path.join(folderPath, "levelname.txt"), { encoding: "utf-8" })
                            :   "Unknown Name");
                        const size: Promise<number> | undefined =
                            getSizes ?
                                readdir(folderPath, { recursive: true, withFileTypes: true }).then(
                                    async (folderContents: Dirent[]): Promise<number> =>
                                        await Promise.all(
                                            folderContents.map(
                                                async (file: Dirent): Promise<number> =>
                                                    file.isFile() ? (await stat(path.join(file.parentPath, file.name))).size : 0
                                            )
                                        )
                                            .then((sizes: number[]): number => sizes.reduce((total: number, size: number): number => total + size, 0))
                                            .catch((e: unknown): number => (console.error(`Error while reading size of world folder ${folderPath}:`, e), NaN))
                                )
                            :   undefined;
                        const thumbnailPath: string | undefined =
                            existsSync(path.join(folderPath, "world_icon.jpeg")) ?
                                path.join(folderPath, "world_icon.jpeg")
                            :   globSync(path.join(folderPath, "world_icon.*"))[0];
                        return {
                            name,
                            path: folderPath,
                            thumbnailPath,
                            thumbnailObjectURL:
                                thumbnailPath &&
                                URL.createObjectURL(
                                    new Blob([await readFile(thumbnailPath)], { type: mime.lookup(path.extname(thumbnailPath)) || undefined! })
                                ),
                            lastOpenedWithVerison:
                                levelDat.value.lastOpenedWithVersion ? `v${levelDat.value.lastOpenedWithVersion.value.value.join(".")}` : null,
                            minimumCompatibleClientVersion:
                                levelDat.value.MinimumCompatibleClientVersion ?
                                    `v${levelDat.value.MinimumCompatibleClientVersion.value.value.join(".")}`
                                :   null,
                            createdInVersion: levelDat.value.InventoryVersion ? `v${levelDat.value.InventoryVersion.value}` : null,
                            storageVersion: levelDat.value.StorageVersion?.value ?? null,
                            lastPlayed:
                                levelDat.value.LastPlayed ? new Date(Number(toLong(levelDat.value.LastPlayed.value) * 1000n))
                                : levelDat.value.LegacyLastPlayed ? new Date(levelDat.value.LegacyLastPlayed.value * 1000)
                                : null,
                            favorited: favoritedWorldsData?.includes(normalizePath(folderPath)) ?? false,
                            size,
                            startCount: 0xffffffffn - toLong(levelDat.value.worldStartCount?.value ?? [0, -1]),
                            playTime:
                                (levelDat.value.currentTick?.value ?? levelDat.value.Time?.value) === undefined ?
                                    null
                                :   toLong((levelDat.value.currentTick?.value ?? levelDat.value.Time?.value)!),
                            gameMode: levelDat.value.GameType?.value ?? ((levelDat.value.StorageVersion?.value ?? NaN) <= 1 ? 1 : -1),
                            generator: (levelDat.value.StorageVersion?.value ?? NaN) < 4 ? 0 : (levelDat.value.Generator?.value ?? NaN),
                            hardcore: levelDat.value.IsHardcore?.value === 1,
                            multiplayer:
                                (levelDat.value.MultiplayerGameIntent?.value ?? 1) ===
                                // TODO: Once XBLBroadcast is added to the schema, uncomment this.
                                /* levelDat.value.MultiplayerGame?.value ??
                                    ((
                                        (levelDat.value.LANBroadcastIntent?.value ?? levelDat.value.LANBroadcast?.value) === 1 ||
                                        (levelDat.value.XBLBroadcastIntent?.value ?? levelDat.value.XBLBroadcast?.value ?? 0) >= 1 ||
                                        (levelDat.value.LANBroadcastIntent?.value ??
                                            levelDat.value.LANBroadcast?.value ??
                                            levelDat.value.XBLBroadcastIntent?.value ??
                                            levelDat.value.XBLBroadcast?.value) === undefined
                                    ) ?
                                        1
                                    :   0) */ 1,
                            fromLockedTemplate: levelDat.value.isFromLockedTemplate?.value === 1,
                            fromWorldTemplate: levelDat.value.isFromWorldTemplate?.value === 1,
                            singleUseWorld: levelDat.value.isSingleUseWorld?.value === 1,
                            editorOnly: levelDat.value.editorWorldType?.value === 1,
                            createdInEditor: levelDat.value.isCreatedInEditor?.value === 1,
                            isolated,
                            fragileLevelDB: tabManager.checkWorldFragilityFromLevelDat(levelDat),
                        };
                    } catch (e) {
                        console.error(e);
                        return;
                    }
                })
        ).finally((): void => {
            if (!failedWorldReadLogs.length) return;
            console.groupCollapsed("World read failures and warnings:");
            const failedLogs = failedWorldReadLogs.filter((log): log is { type: "failed"; consoleLogItems: string[] } => log.type === "failed");
            const fallbackLogs = failedWorldReadLogs.filter((log): log is { type: "usedFallback"; consoleLogItems: string[] } => log.type === "usedFallback");
            if (failedLogs.length) {
                console.groupCollapsed("World read failures:");
                for (const failedLog of failedLogs) {
                    console.error(...failedLog.consoleLogItems);
                }
                console.groupEnd();
            }
            if (fallbackLogs.length) {
                console.groupCollapsed("World read fallbacks:");
                for (const fallbackLog of fallbackLogs) {
                    console.warn(...fallbackLog.consoleLogItems);
                }
                console.groupEnd();
            }
            console.groupEnd();
        })
    ).filter((world: MinecraftWorldDisplayDetails | undefined): world is MinecraftWorldDisplayDetails => !!world);
}

interface PreloadedIconsObject {
    [key: PropertyKey]: PreloadedIconsObject | string;
}

export const preloadedIcons = {
    back: "resource://images/ui/glyphs/Chevron-Left.png",
} as const satisfies PreloadedIconsObject;

// Preloads the icons.
{
    /**
     * Preloads the specified icons.
     *
     * @param object The icons to preload.
     */
    function preloadIcons(object: PreloadedIconsObject): void {
        Object.entries(object).forEach(([key, value]: [key: PropertyKey, value: PreloadedIconsObject | string]): void => {
            if (typeof value === "object") {
                preloadIcons(value);
                return;
            }

            fetch(value)
                .then(async (response: Response): Promise<Blob> => await response.blob())
                .then(
                    async (blob: Blob): Promise<void> =>
                        void (object[key] = `data:${mime.lookup(value)};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`)
                )
                .catch((): void => {});
        });
    }
    preloadIcons(preloadedIcons);
}

/**
 * Props for the {@link WorldSelector} component.
 */
export interface WorldSelectorProps {
    forceTriggerUpdateRef?: RefObject<() => Promise<void>>;
}

/**
 * The world selector component.
 *
 * @param props The props for the component.
 * @returns The JSX element for the component.
 */
export function WorldSelector(props: WorldSelectorProps): JSX.SpecificElement<"div"> {
    const renderWorldsContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const viewMode: "compact" | "detailed" | "grid" = "detailed";
    const [data, updateData] = useState<MinecraftWorldDisplayDetails[]>([]);
    const [showingMore, updateShowingMore] = useState(false);
    function refreshData(data: MinecraftWorldDisplayDetails[]): void {
        if (config.showWorldSizesOnWorldList) {
            data.forEach((v: MinecraftWorldDisplayDetails): void =>
                typeof v.size === "number" ? void 0 : void v.size?.then((size: number): void => void ((v.size = size), void updateData([...data])))
            );
        }
        updateData(data);
    }
    useEffect((): void => void getMinecraftWorlds(false, config.showWorldSizesOnWorldList).then(refreshData), []);
    if (props.forceTriggerUpdateRef) {
        props.forceTriggerUpdateRef.current = async (): Promise<void> => {
            // Force reload the cached world folder locations.
            await worldFolderLocationsCache.loadPaths(["parsed", "parsedIsolated", "parsedExtra", "parsedExtraIsolated"], true);
            refreshData(await getMinecraftWorlds(showingMore, config.showWorldSizesOnWorldList));
        };
    }
    if (
        data.length === 0 &&
        // Check each group individually so if one of groups contains folders, we don't need to parse the other groups.
        !worldFolderLocationsCache.loadAndCheckForPathsEntries(["parsed", "parsedIsolated"], true, true) &&
        !worldFolderLocationsCache.loadAndCheckForPathsEntries(["parsedExtra", "parsedExtraIsolated"], true, true)
    ) {
        return (
            <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
                <Notice
                    title={null}
                    subtitle={null}
                    detail="There don't seem to be any worlds here... None of the known world locations seem to exist... You should head over to settings and tell the app where your worlds are."
                    image="no_worlds_yet"
                    style={{ height: "auto" }}
                />
                <button
                    type="button"
                    class="genericRoundButton"
                    onClick={(): void => {
                        tabManager.switchTab("settings");
                    }}
                >
                    Open Settings
                </button>
            </div>
        );
    }
    function StorageVersionMCVersionRangeToDisplayVersion({ storageVersion }: { storageVersion: number | null }): JSX.Element | undefined {
        if (storageVersion === null) return <span style="color: red;">null</span>;
        const versionRange = (levelDatStorageVersionToMCVersionRangeMap as LevelDatStorageVersionToMCVersionRangeMapType)[
            storageVersion as keyof typeof levelDatStorageVersionToMCVersionRangeMap
        ];
        if (!versionRange) return <span style="color: red;">null</span>;
        if (versionRange === "?") return <span style={{ color: "red" }}>Unknown version range</span>;
        function stringifyVersionSegment(
            segment: Extract<LevelDatStorageVersionToMCVersionRangeMapType[keyof LevelDatStorageVersionToMCVersionRangeMapType], unknown[]>[number]
        ): string | undefined {
            if (segment === "N/A") return undefined;
            if (segment === "?") return "?";
            return `v${segment.slice(0, 3).join(".")}.${Array.isArray(segment[3]) ? segment[3].join("/") : segment[3]}`;
        }
        const startSegment: string | undefined = stringifyVersionSegment(versionRange[0]);
        const endSegment: string | undefined = stringifyVersionSegment(versionRange[1]);
        if (startSegment) {
            if (endSegment) {
                return (
                    <span>
                        {startSegment}-{endSegment}
                    </span>
                );
            }
            return <span>&gt;= {startSegment}</span>;
        } else if (endSegment) return <span>&lt; {endSegment}</span>;
        return <span style="color: red;">null</span>;
    }
    function RenderWorlds(): JSX.SpecificElement<"div">[] {
        const mcAppName: string = app.getApplicationNameForProtocol("minecraft:");
        const mcPreviewAppName: string = app.getApplicationNameForProtocol("minecraft-preview:");
        return data
            .toSorted((a: MinecraftWorldDisplayDetails, b: MinecraftWorldDisplayDetails): number =>
                a.favorited && !b.favorited ? -1
                : b.favorited && !a.favorited ? 1
                : (b.lastPlayed?.getTime() ?? 0) - (a.lastPlayed?.getTime() ?? 0)
            )
            .map((world: MinecraftWorldDisplayDetails, index: number): JSX.SpecificElement<"div"> => {
                const [worldContextMenu_isOpen, worldContextMenu_setOpen] = useState(false);
                const [worldContextMenu_anchorPoint, worldContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                function onWorldRightClick(event: TargetedMouseEvent<HTMLDivElement>): void {
                    event.preventDefault();
                    event.stopPropagation();
                    // const clickPosition: { x: number; y: number } = {
                    //     x: event.clientX,
                    //     y: event.clientY,
                    // };
                    // console.log(clickPosition);

                    worldContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                    worldContextMenu_setOpen(true);
                }
                const hoverInfo = `${world.name}\nLast Opened With: ${world.lastOpenedWithVerison}${world.minimumCompatibleClientVersion ? `\nMinimum Compatible Client Version: ${world.minimumCompatibleClientVersion}` : ""}\nCreated In: ${world.createdInVersion}\nLast Played: ${
                    world.lastPlayed?.toLocaleString() ?? "null"
                }\nPath: ${world.path}${
                    config.showWorldSizesOnWorldList ?
                        `\nFolder Size: ${
                            typeof world.size === "number" ?
                                (config.fileSizeUnits === "binary" ? formatFileSizeBinary : formatFileSizeMetric)(world.size)
                            :   "Loading..."
                        }`
                    :   ""
                }\nWorld Start Count: ${world.startCount}\nPlay Time: ${
                    world.playTime === null ?
                        "null"
                    :   `${(world.playTime / 20n / 60n / 60n / 24n).toString().padStart(2, "0")}:${((world.playTime / 20n / 60n / 60n) % 24n)
                            .toString()
                            .padStart(2, "0")}:${((world.playTime / 20n / 60n) % 60n).toString().padStart(2, "0")}:${((world.playTime / 20n) % 60n)
                            .toString()
                            .padStart(2, "0")}.${(world.playTime % 20n) * 5n}`
                }\nStorage Version: ${world.storageVersion}\nGame Mode: ${
                    world.gameMode === -1 ? "Unknown" : (gameModes[world.gameMode] ?? world.gameMode)
                }\nGenerator: ${generatorTypes[world.generator] ?? world.generator}${world.hardcore ? "\nHardcore" : ""}\n${
                    world.multiplayer ? "Multiplayer" : "Singleplayer"
                }${world.fromLockedTemplate ? "\nFrom Locked Template" : ""}${world.fromWorldTemplate ? "\nFrom World Template" : ""}${
                    world.singleUseWorld ? "\nSingle Use World" : ""
                }${world.editorOnly ? "\nEditor Only" : ""}${world.createdInEditor ? "\nCreated In Editor" : ""}${world.isolated ? "\nIsolated" : ""}`;
                return (
                    // TODO: When you press and hold on a world, it should show the world details, like when you hover with a mouse. This is so that mobile players can also see it.
                    <div
                        title={`${hoverInfo} `}
                        class="nsel ndrg world-list-world-item"
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            cursor: "pointer",
                            paddingRight: "5px",
                        }}
                        data-hover-bg-color="var(--alternating-bg-hover-color)"
                        data-bg-color={`var(--alternating-bg-color-${(index % 2) + 1})`}
                        onClick={(event: TargetedMouseEvent<HTMLDivElement>): void => {
                            if (
                                event.target instanceof Node &&
                                $(event.currentTarget)
                                    .find<HTMLDivElement>(".szh-menu-container")
                                    .toArray()
                                    .some((element: HTMLDivElement): boolean => element.contains(event.target as Node))
                            ) {
                                return;
                            }
                            // Treat Alt+Click as a middle click.
                            const switchToTab = !event.altKey;
                            if (switchToTab) tabManager.switchTab("loading");
                            setTimeout((): void => {
                                try {
                                    tabManager.openTab(
                                        {
                                            path: world.path,
                                            name: world.name,
                                            type: "world",
                                            icon: world.thumbnailPath,
                                            isNonIsolatedWorld: !world.isolated,
                                            hasFragileLevelDB: world.fragileLevelDB,
                                        },
                                        switchToTab
                                    );
                                } catch (e) {
                                    if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                        void dialog.showMessageBox({
                                            type: "error",
                                            title: "Out of Space",
                                            message: "You have run out of storage space on this device. Please free up some space and try again.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        tabManager.switchTab(null);
                                        return;
                                    }
                                    throw e;
                                }
                            }, 10);
                        }}
                        onMouseDown={(event: TargetedMouseEvent<HTMLDivElement>): void => {
                            if (event.button === 1) event.preventDefault();
                        }}
                        onAuxClick={(event: TargetedMouseEvent<HTMLDivElement>): void => {
                            if (event.button !== 1) return;
                            setTimeout((): void => {
                                try {
                                    tabManager.openTab(
                                        {
                                            path: world.path,
                                            name: world.name,
                                            type: "world",
                                            icon: world.thumbnailPath,
                                            isNonIsolatedWorld: !world.isolated,
                                            hasFragileLevelDB: world.fragileLevelDB,
                                        },
                                        false
                                    );
                                } catch (e) {
                                    if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                        void dialog.showMessageBox({
                                            type: "error",
                                            title: "Out of Space",
                                            message: "You have run out of storage space on this device. Please free up some space and try again.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        tabManager.switchTab(null);
                                        return;
                                    }
                                    throw e;
                                }
                            }, 10);
                        }}
                        onContextMenu={(event: TargetedMouseEvent<HTMLDivElement>): void => void onWorldRightClick(event)}
                        key={JSON.stringify({ path: world.path })}
                    >
                        <img
                            title={hoverInfo + " ".repeat(2)}
                            alt="Icon"
                            aria-hidden="true"
                            src={world.thumbnailObjectURL ?? defaultWorldIconDataURI ?? "resource://images/ui/misc/CreateNewWorld.png"}
                            style={`margin: 4px; width: ${
                                viewMode === "compact" ? 32
                                : viewMode === "detailed" ? 64
                                : 128
                            }px; aspect-ratio: 16 / 9;`}
                        />
                        <div
                            title={hoverInfo + " ".repeat(3)}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div title={hoverInfo + " ".repeat(4)} style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {world.name}
                            </div>
                            {viewMode === "detailed" && (
                                <div
                                    title={hoverInfo + " ".repeat(5)}
                                    style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: gray"
                                >
                                    {world.path.replaceAll("\\", "/").startsWith(path.join(APP_DATA_FOLDER_PATH, "mounted_volumes").replaceAll("\\", "/")) ?
                                        `mnt${world.path.slice(path.join(APP_DATA_FOLDER_PATH, "mounted_volumes").replaceAll("\\", "/").length)}`
                                    :   world.path}
                                </div>
                            )}
                        </div>
                        {viewMode === "detailed" && (
                            <div
                                style={{
                                    flex: 0,
                                    textAlign: "right",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "right",
                                    cursor: "pointer",
                                }}
                            >
                                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    {world.lastPlayed?.toLocaleString() ?? <span style="color: red;">null</span>}
                                </div>
                                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    {config.showWorldSizesOnWorldList && (
                                        <span class="worldSelectorListItemWorldSize">
                                            {typeof world.size === "number" ?
                                                (config.fileSizeUnits === "binary" ? formatFileSizeBinary : formatFileSizeMetric)(world.size)
                                            :   "Loading..."}{" "}
                                        </span>
                                    )}
                                    {world.isolated && (
                                        <img
                                            src="resource://images/ui/glyphs/isolated_world_square.png"
                                            alt="Isolated World"
                                            title="This world folder is isolated from any Minecraft data folders or servers, as such features that rely on accessing game data outside of the world data will not work on this world."
                                            style={{
                                                display: "inline-block",
                                                flexShrink: 1,
                                                height: "1em",
                                                width: "1em",
                                                verticalAlign: "bottom",
                                                margin: "0 0.25em",
                                            }}
                                        />
                                    )}
                                    {world.editorOnly && (
                                        <img
                                            src="resource://images/ui/glyphs/Bedrock_Editor_pack_logo.png"
                                            alt="Editor Only"
                                            title="This world can only be seen in the Bedrock Editor."
                                            style={{
                                                display: "inline-block",
                                                flexShrink: 1,
                                                height: "1em",
                                                width: "1em",
                                                verticalAlign: "bottom",
                                                margin: "0 0.25em",
                                            }}
                                        />
                                    )}
                                    <span class="worldSelectorListItemWorldVersion">
                                        {world.lastOpenedWithVerison ?? <StorageVersionMCVersionRangeToDisplayVersion storageVersion={world.storageVersion} />}
                                        {world.storageVersion !== null && config.showWorldStorageVersionsOnWorldList ?
                                            <>
                                                {" "}
                                                <span style="color: color-mix(in lab, var(--text-color) 50%, gray);">
                                                    &lt;0x{world.storageVersion.toString(16).toUpperCase().padStart(2, "0")}&gt;
                                                </span>
                                            </>
                                        :   ""}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div title="" style={{ display: "contents", cursor: "auto" }}>
                            <ControlledMenu
                                anchorPoint={worldContextMenu_anchorPoint}
                                state={worldContextMenu_isOpen ? "open" : "closed"}
                                direction="right"
                                onClose={(): void => void worldContextMenu_setOpen(false)}
                            >
                                <MenuItem
                                    onClick={(): void => {
                                        tabManager.switchTab("loading");
                                        setTimeout((): void => {
                                            try {
                                                void tabManager.openTab({
                                                    path: world.path,
                                                    name: world.name,
                                                    type: "world",
                                                    icon: world.thumbnailPath,
                                                    isNonIsolatedWorld: !world.isolated,
                                                    hasFragileLevelDB: world.fragileLevelDB,
                                                });
                                            } catch (e) {
                                                if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                                    void dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Out of Space",
                                                        message: "You have run out of storage space on this device. Please free up some space and try again.",
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                    tabManager.switchTab(null);
                                                    return;
                                                }
                                                throw e;
                                            }
                                        }, 10);
                                    }}
                                >
                                    Open World
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        tabManager.switchTab("loading");
                                        setTimeout((): void => {
                                            try {
                                                void tabManager.openTab({
                                                    path: world.path,
                                                    name: world.name,
                                                    type: "world",
                                                    icon: world.thumbnailPath,
                                                    mode: TabManagerTabMode.Readonly,
                                                    isNonIsolatedWorld: !world.isolated,
                                                    hasFragileLevelDB: world.fragileLevelDB,
                                                });
                                            } catch (e) {
                                                if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                                    void dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Out of Space",
                                                        message: "You have run out of storage space on this device. Please free up some space and try again.",
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                    tabManager.switchTab(null);
                                                    return;
                                                }
                                                throw e;
                                            }
                                        }, 10);
                                    }}
                                >
                                    Open in Read-Only Mode
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        if (
                                            dialog.showMessageBoxSync({
                                                type: "warning",
                                                title: "Bedrock World Editor",
                                                message: `Are you sure you want to open this world in Direct Mode?`,
                                                detail: "Direct mode is unsafe as any changes are immediately saved directly to your world files, leading to the potential corruption of your world. Using direct mode also can behave unpredictably when used while the world is open in Minecraft. Use at your own risk.",
                                                buttons: ["Proceed", "Cancel"],
                                                noLink: true,
                                            })
                                        ) {
                                            return;
                                        }
                                        if (
                                            world.fragileLevelDB === true &&
                                            dialog.showMessageBoxSync({
                                                type: "warning",
                                                title: "Bedrock World Editor",
                                                message: `Are you sure you want to open this world? It has a fragile LevelDB and will appear corrupted to the version it was last used in if you open it in Direct Mode. You should open it in Read-Only Mode instead.`,
                                                detail: "This world was last opened in a version that is affected by a bug where if you access the LevelDB on it, the world will be very broken (it will work fine on versions not affected by the bug, but the versions that are affected will behave very strangely). Some effects of the bug include: World data wipes, extremely slow chunk loading and lag spikes, instant crashes (on low-end devices), extremely long world loading using 100% CPU, rubberbanding, etc.",
                                                buttons: ["Proceed", "Cancel"],
                                                noLink: true,
                                            })
                                        ) {
                                            return;
                                        }
                                        if (
                                            world.fragileLevelDB === "possible" &&
                                            dialog.showMessageBoxSync({
                                                type: "warning",
                                                title: "Bedrock World Editor",
                                                message: `Are you sure you want to open this world? It might have a fragile LevelDB and may appear corrupted to the version it was last used in if you open it in Direct Mode. You should open it in Read-Only Mode instead.`,
                                                detail: "This world was last opened in a version that might have been affected by a bug where if you access the LevelDB on it, the world will be very broken (it will work fine on versions not affected by the bug, but the versions that are affected will behave very strangely). Some effects of the bug include: World data wipes, extremely slow chunk loading and lag spikes, instant crashes (on low-end devices), extremely long world loading using 100% CPU, rubberbanding, etc.",
                                                buttons: ["Proceed", "Cancel"],
                                                noLink: true,
                                            })
                                        ) {
                                            return;
                                        }
                                        tabManager.switchTab("loading");
                                        setTimeout((): void => {
                                            try {
                                                void tabManager.openTab({
                                                    path: world.path,
                                                    name: world.name,
                                                    type: "world",
                                                    icon: world.thumbnailPath,
                                                    mode: TabManagerTabMode.Direct,
                                                    isNonIsolatedWorld: !world.isolated,
                                                    hasFragileLevelDB: world.fragileLevelDB,
                                                });
                                            } catch (e) {
                                                if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                                    void dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Out of Space",
                                                        message: "You have run out of storage space on this device. Please free up some space and try again.",
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                    tabManager.switchTab(null);
                                                    return;
                                                }
                                                throw e;
                                            }
                                        }, 10);
                                    }}
                                >
                                    Open in Direct Mode (Unsafe)
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        setTimeout((): void => {
                                            try {
                                                void tabManager.openTab(
                                                    {
                                                        path: world.path,
                                                        name: world.name,
                                                        type: "world",
                                                        icon: world.thumbnailPath,
                                                        isNonIsolatedWorld: !world.isolated,
                                                        hasFragileLevelDB: world.fragileLevelDB,
                                                    },
                                                    false
                                                );
                                            } catch (e) {
                                                if (e instanceof Error && e.message.startsWith("ENOSPC, No space left on device")) {
                                                    void dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Out of Space",
                                                        message: "You have run out of storage space on this device. Please free up some space and try again.",
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                    tabManager.switchTab(null);
                                                    return;
                                                }
                                                throw e;
                                            }
                                        }, 10);
                                    }}
                                >
                                    Open in Background
                                </MenuItem>
                                <MenuDivider />
                                <MenuItem
                                    onClick={(): void => {
                                        void shell.openPath(world.path);
                                    }}
                                >
                                    Open World Folder in{" "}
                                    {process.platform === "win32" ?
                                        "File Explorer"
                                    : process.platform === "darwin" ?
                                        "Finder"
                                    :   "File Manager"}
                                </MenuItem>
                                {mcAppName && (
                                    <MenuItem
                                        onClick={(): void => {
                                            void shell.openExternal(`minecraft://?load=${encodeURIComponent(path.basename(world.path))}`);
                                        }}
                                    >
                                        Open World in Minecraft
                                    </MenuItem>
                                )}
                                {mcPreviewAppName && (
                                    <MenuItem
                                        onClick={(): void => {
                                            void shell.openExternal(`minecraft-preview://?load=${encodeURIComponent(path.basename(world.path))}`);
                                        }}
                                    >
                                        Open World in Minecraft Preview
                                    </MenuItem>
                                )}
                                <MenuDivider />
                                {world.favorited ?
                                    <MenuItem
                                        onClick={(): void => {
                                            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) return;
                                            try {
                                                const favoritedWorldsData = JSON.parse(
                                                    readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")
                                                ) as string[];
                                                if (favoritedWorldsData.includes(world.path)) {
                                                    favoritedWorldsData.splice(favoritedWorldsData.indexOf(world.path), 1);
                                                    writeFileSync(
                                                        path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"),
                                                        JSON.stringify(favoritedWorldsData)
                                                    );
                                                    world.favorited = false;
                                                }
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                    >
                                        Unfavorite
                                    </MenuItem>
                                :   <MenuItem
                                        onClick={(): void => {
                                            try {
                                                let favoritedWorldsData: string[] = [];
                                                if (existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) {
                                                    favoritedWorldsData = JSON.parse(
                                                        readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")
                                                    ) as string[];
                                                }
                                                if (!favoritedWorldsData.includes(world.path)) {
                                                    favoritedWorldsData.push(world.path);
                                                    writeFileSync(
                                                        path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"),
                                                        JSON.stringify(favoritedWorldsData)
                                                    );
                                                    world.favorited = true;
                                                }
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                    >
                                        Favorite
                                    </MenuItem>
                                }
                            </ControlledMenu>
                        </div>
                        {/* TO-DO: Add a star icon for favorited tabs. */}
                    </div>
                );
            });
    }
    return (
        <div style="display: flex; flex-direction: column; overflow: auto;">
            <div style={{ display: "contents" }} ref={renderWorldsContainerRef}>
                <RenderWorlds />
            </div>
            {/* IDEA: Maybe make this button have a hover tint. */}
            {/* IDEA: Maybe make this button have a disabled tint, and change the cursor when it is disabled. */}
            <div
                class="nsel ndrg"
                style={{
                    cursor: "pointer",
                    height: "26px",
                    backgroundColor: "var(--alternating-bg-hover-color)",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                }}
                onClick={(event): void => {
                    if (event.currentTarget.dataset.disabled) return;
                    const newShowingMoreValue: boolean = !showingMore;
                    updateShowingMore(newShowingMoreValue);
                    const currentTarget: HTMLDivElement = event.currentTarget;
                    currentTarget.textContent = "Loading...";
                    currentTarget.dataset.disabled = "true";
                    void getMinecraftWorlds(newShowingMoreValue, config.showWorldSizesOnWorldList).then((worlds: MinecraftWorldDisplayDetails[]): void => {
                        currentTarget.textContent = newShowingMoreValue ? "Show less" : "Show more";
                        delete currentTarget.dataset.disabled;
                        refreshData(worlds);
                    });
                }}
                key="showMoreOrLess"
            >
                Show more
            </div>
        </div>
    );
}

/**
 * The start screen of the app.
 *
 * @returns The JSX element for the start screen.
 */
export function StartScreen(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
            <StartScreenContents />
        </div>
    );
}

/**
 * The contents of the start screen.
 *
 * @returns The JSX element for the start screen contents.
 */
export function StartScreenContents(): JSX.Element {
    const forceTriggerUpdateRef: RefObject<() => Promise<void>> = useRef<() => Promise<void>>(null);
    const [openMenu_isOpen, openMenu_setOpen] = useState(false);
    const [openMenu_anchorPoint, openMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
    const [openMenu_direction, openMenu_setDirection] = useState<MenuDirection>("top");
    /**
     * Represents an option that shows in the list when you click the "+" button on the right of the tab bar.
     */
    interface PopupTab {
        icon: string;
        name: string;
        resolution: number;
        onClick(this: void, event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> | void;
    }
    const popupTabs: PopupTab[] = (
        [
            {
                icon: "resource://images/ui/glyphs/Folder-Closed.png",
                name: "World Folder",
                resolution: 12,
                async onClick(_event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> {
                    $("#add-tab-popup-menu").hide();
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the world folders in.
                    const openFolderResult: OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                        // IDEA: Implement functionality to remember the folder that the last opened world folder was located in to default to that folder.
                        buttonLabel: "Open",
                        message: "Select world folders to open.",
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open World Folders",
                    });
                    if (openFolderResult.canceled) return;
                    const validFilePaths: string[] = [];
                    const invalidFilePaths: string[] = [];
                    openFolderResult.filePaths.forEach((filePath: string): void => {
                        if (existsSync(path.join(filePath, "level.dat"))) validFilePaths.push(filePath);
                        else invalidFilePaths.push(filePath);
                    });
                    validFilePaths.forEach(async (folderPath: string): Promise<void> => {
                        tabManager.openTab({
                            icon:
                                existsSync(path.join(folderPath, "world_icon.jpeg")) ?
                                    path.join(folderPath, "world_icon.jpeg")
                                :   globSync(path.join(folderPath, "world_icon.*"))[0],
                            name:
                                (await (async (): Promise<string | undefined> => {
                                    try {
                                        return (await entryContentTypeToFormatMap.LevelDat.parse(readFileSync(path.join(folderPath, "level.dat")))).value
                                            .LevelName?.value;
                                    } catch (e) {
                                        console.error("Error while reading level.dat:", e, "folderPath:", folderPath);
                                        try {
                                            if (existsSync(path.join(folderPath, "level.dat_old"))) {
                                                return (await entryContentTypeToFormatMap.LevelDat.parse(readFileSync(path.join(folderPath, "level.dat_old"))))
                                                    .value.LevelName?.value;
                                            }
                                            console.warn("Unable to load details for world; level.dat_old not found. folderPath:", folderPath);
                                        } catch (e) {
                                            console.error("Error while reading level.dat_old:", e, "folderPath:", folderPath);
                                        }
                                    }
                                    return undefined;
                                })()) ??
                                (existsSync(path.join(folderPath, "levelname.txt")) ?
                                    readFileSync(path.join(folderPath, "levelname.txt"), { encoding: "utf-8" })
                                :   "Unknown Name"),
                            path: folderPath,
                            type: "world",
                            // TODO: Add support for detecting if this world folder is actually isolated or not.
                        });
                    });
                    if (invalidFilePaths.length) {
                        void dialog.showMessageBox(getCurrentWindow(), {
                            type: "error",
                            title: `Invalid World Folder${invalidFilePaths.length === 1 ? "" : "s"}`,
                            message: `The following ${invalidFilePaths.length} world folder${invalidFilePaths.length === 1 ? "" : "s"} could not be opened as ${invalidFilePaths.length === 1 ? "it is" : "they are"} missing a level.dat file:`,
                            detail: `${invalidFilePaths.join("\n")}`,
                            buttons: ["OK"],
                            noLink: true,
                        });
                    }
                },
            },
            {
                icon: "resource://images/ui/glyphs/icon_bookshelf.png",
                name: "LevelDB Folder",
                resolution: 16,
                async onClick(_event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> {
                    $("#add-tab-popup-menu").hide();
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the LevelDB folders in.
                    const openFolderResult: OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                        // IDEA: Implement functionality to remember the folder that the last opened LevelDB folder was located in to default to that folder.
                        buttonLabel: "Open",
                        message: "Select LevelDB folders to open.",
                        properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open LevelDB Folders",
                    });
                    if (openFolderResult.canceled) return;
                    const validFilePaths: string[] = [];
                    // const invalidFilePaths: string[] = [];
                    // TODO: Implement a way to check if a folder is a valid LevelDB.
                    openFolderResult.filePaths.forEach((filePath: string): void => {
                        /* if (existsSync(path.join(filePath, "level.dat"))) */ validFilePaths.push(filePath);
                        // else invalidFilePaths.push(filePath);
                    });
                    validFilePaths.forEach((folderPath: string): void => {
                        tabManager.openTab({
                            icon: "resource://images/ui/glyphs/icon_bookshelf.png", // TODO: Add supports for using the custom icon set for the folder if it exists.
                            name: path.basename(folderPath), // TODO: Implement something to get a better name for the tab (as it will often times just be `db`).
                            path: folderPath,
                            type: "leveldb",
                        });
                    });
                    // if (invalidFilePaths.length) {
                    //     void dialog.showMessageBox(getCurrentWindow(), {
                    //         type: "error",
                    //         title: `Invalid World Folder${invalidFilePaths.length === 1 ? "" : "s"}`,
                    //         message: `The following ${invalidFilePaths.length} world folder${invalidFilePaths.length === 1 ? "" : "s"} could not be opened as ${invalidFilePaths.length === 1 ? "it is" : "they are"} missing a level.dat file:`,
                    //         detail: `${invalidFilePaths.join("\n")}`,
                    //         buttons: ["OK"],
                    //         noLink: true,
                    //     });
                    // }
                },
            },
            // IDEA: Add support for editing `.mcworld` and `.mctemplate` files, and maybe even selecting a `.mcaddon` file that contains worlds to open all of those worlds at once.
            {
                icon: "resource://images/ui/glyphs/icon_NBT.png",
                name: "NBT File",
                resolution: 16,
                async onClick(_event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> {
                    $("#add-tab-popup-menu").hide();
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the NBT files in.
                    const openFileResult: OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                        // IDEA: Implement functionality to remember the folder that the last opened NBT file was located in to default to that folder.
                        buttonLabel: "Open",
                        message: "Select NBT files to open.",
                        filters: [
                            { name: "NBT", extensions: ["nbt", "mcstructure", "schem", "schematic", "bin", "snbt", "hex", "dat"] },
                            { name: "All", extensions: ["*"] },
                        ],
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open NBT Files",
                    });
                    if (openFileResult.canceled) return;
                    openFileResult.filePaths.forEach((filePath: string): void => {
                        tabManager.openTab({
                            icon: undefined, // TODO: Add an icon for NBT tabs, and add support for using the custom icon set for the file if it exists.
                            name: path.basename(filePath),
                            path: filePath,
                            type: "nbt",
                        });
                    });
                },
            },
            {
                icon: "resource://images/ui/glyphs/Data-Empty.png",
                name: "JSON File",
                resolution: 12,
                async onClick(_event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> {
                    $("#add-tab-popup-menu").hide();
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the JSON files in.
                    const openFileResult: OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                        // IDEA: Implement functionality to remember the folder that the last opened JSON file was located in to default to that folder.
                        buttonLabel: "Open",
                        message: "Select NBT files to open.",
                        filters: [
                            { name: "JSON", extensions: ["json", "jsonc"] }, // TODO: Add JSONL support.
                            { name: "All", extensions: ["*"] },
                        ],
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open NBT Files",
                    });
                    if (openFileResult.canceled) return;
                    openFileResult.filePaths.forEach((filePath: string): void => {
                        tabManager.openTab({
                            icon: undefined, // TODO: Add an icon for JSON tabs, and add support for using the custom icon set for the file if it exists.
                            name: path.basename(filePath),
                            path: filePath,
                            type: "json",
                        });
                    });
                },
            },
            {
                icon: "resource://images/ui/glyphs/Data-Empty.png",
                name: "Raw File",
                resolution: 12,
                async onClick(_event: TargetedMouseEvent<HTMLDivElement> | ClickEvent): Promise<void> {
                    $("#add-tab-popup-menu").hide();
                    // IDEA: If the user holds ALT while clicking the button, have it prompt them to select what mode to open the binary files in.
                    const openFileResult: OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                        // IDEA: Implement functionality to remember the folder that the last opened binary file was located in to default to that folder.
                        buttonLabel: "Open",
                        message: "Select NBT files to open.",
                        filters: [{ name: "All", extensions: ["*"] }],
                        properties: ["openFile", "showHiddenFiles", "treatPackageAsDirectory", "multiSelections"],
                        title: "Open NBT Files",
                    });
                    if (openFileResult.canceled) return;
                    openFileResult.filePaths.forEach((filePath: string): void => {
                        tabManager.openTab({
                            icon: undefined, // TODO: Add an icon for binary tabs, and add support for using the custom icon set for the file if it exists.
                            name: path.basename(filePath),
                            path: filePath,
                            type: "binary",
                        });
                    });
                },
            },
        ] as const satisfies (PopupTab | false | undefined)[]
    ).filter((tab: PopupTab | false | undefined): tab is PopupTab => !!tab);
    return (
        <>
            <div
                id="main-menu-app-info-navbar"
                class="nsel ndrg"
                style="position: fixed; height: 50px; width: 100vw; display: flex; flex-direction: row; background-color: #87CEEB22; overflow: hidden; overflow-x: scroll; overflow: auto; align-items: center; gap: 1em; text-align: center; flex-shrink: 0;"
            >
                <img
                    aria-hidden="true"
                    src="resource://icon.png"
                    class="nsel ndrg reloadWorldListButton"
                    style="margin-left: 9px; width: 32px; cursor: pointer;"
                    title="Reload world list"
                    onClick={(event: TargetedMouseEvent<HTMLImageElement>): void => {
                        const currentTarget: HTMLImageElement = event.currentTarget;
                        if (currentTarget.dataset.disabled) return;
                        currentTarget.dataset.disabled = "true";
                        currentTarget.classList.remove("error");
                        forceTriggerUpdateRef.current?.().then(
                            (): void => {
                                delete currentTarget.dataset.disabled;
                            },
                            (e: unknown): void => {
                                delete currentTarget.dataset.disabled;
                                reportError(e);
                                // The setTimout is just in case there was not a long enough delay before the error occurred.
                                setTimeout((): void => void currentTarget.classList.add("error"), 1);
                            }
                        );
                    }}
                />
                <div style="flex: 1; overflow: auto; line-height: 1.25em; text-wrap: nowrap;">
                    Bedrock World Editor <wbr />v{VERSION_DISP_SHORT}
                    {process.env.NODE_ENV === "development" ? "*" : ""}
                </div>
                <div style="flex: none; overflow: auto; line-height: 1.25em; display: flex; flex-direction: row; height: fit-content; margin: 5px; gap: 5px; height: -webkit-fill-available; float: right;">
                    <div class="mainMenuAppInfoNavbarRightButton" style="float: right; height: -webkit-fill-available; align-content: center;">
                        <a
                            style="padding: 8px; display: flex;"
                            onClick={(event: TargetedMouseEvent<HTMLAnchorElement>): void => {
                                openMenu_setDirection("bottom");
                                const boundingClientRect: DOMRect = event.currentTarget.getBoundingClientRect();
                                openMenu_setAnchorPoint({ x: boundingClientRect.left, y: boundingClientRect.bottom });
                                openMenu_setOpen(true);
                            }}
                        >
                            <img aria-hidden="true" class="piximg" src="resource://images/ui/glyphs/icon-plus.png" />
                        </a>
                    </div>
                    <div class="mainMenuAppInfoNavbarRightButton" style="float: right; height: -webkit-fill-available; align-content: center;">
                        <a
                            style="padding: 12px; display: flex;"
                            onClick={(_event: TargetedMouseEvent<HTMLAnchorElement>): void => {
                                tabManager.switchTab("settings");
                            }}
                        >
                            <img aria-hidden="true" class="piximg" src="resource://images/ui/glyphs/config.png" />
                        </a>
                    </div>
                </div>
            </div>
            <div
                id="main-menu-app-info-sidebar"
                class="nsel ndrg"
                style="width: 200px; height: -webkit-fill-available; display: flex; flex-direction: column; background-color: #87CEEB22; overflow: hidden; overflow-y: scroll; overflow: auto; align-items: center; gap: 1em; text-align: center; flex-shrink: 0;"
            >
                <img
                    aria-hidden="true"
                    src="resource://icon.png"
                    class="nsel ndrg reloadWorldListButton"
                    style="margin-top: 35px; width: 128px; cursor: pointer;"
                    title="Reload world list"
                    onClick={(event: TargetedMouseEvent<HTMLImageElement>): void => {
                        const currentTarget: HTMLImageElement = event.currentTarget;
                        if (currentTarget.dataset.disabled) return;
                        currentTarget.dataset.disabled = "true";
                        currentTarget.classList.remove("error");
                        forceTriggerUpdateRef.current?.().then(
                            (): void => {
                                delete currentTarget.dataset.disabled;
                            },
                            (e: unknown): void => {
                                delete currentTarget.dataset.disabled;
                                reportError(e);
                                // The setTimout is just in case there was not a long enough delay before the error occurred.
                                setTimeout((): void => void currentTarget.classList.add("error"), 1);
                            }
                        );
                    }}
                />
                <div style="flex: 1; overflow: auto; line-height: 1.25em;">
                    Bedrock World Editor
                    <br />v{VERSION_DISP_SHORT}
                    {process.env.NODE_ENV === "development" ? "*" : ""}
                </div>
                <div style="flex: none; overflow: auto; line-height: 1.25em; display: flex; flex-direction: column; height: fit-content; margin: 5px; gap: 5px; width: -webkit-fill-available;">
                    <button
                        type="button"
                        class="mainMenuAppInfoSidebarBottomButton"
                        style="flex: 1; overflow: auto; line-height: 1.25em; float: end;"
                        onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            const boundingClientRect: DOMRect = event.currentTarget.getBoundingClientRect();
                            openMenu_setAnchorPoint({ x: boundingClientRect.x, y: boundingClientRect.y });
                            openMenu_setOpen(true);
                        }}
                    >
                        Open...
                    </button>
                    <button
                        type="button"
                        class="mainMenuAppInfoSidebarBottomButton"
                        style="flex: 1; overflow: auto; line-height: 1.25em; float: end;"
                        onClick={(_event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            tabManager.switchTab("settings");
                        }}
                    >
                        Settings
                    </button>
                </div>
            </div>
            <div id="world-selector-container" style="flex: 1; overflow: auto; min-width: 300px; min-height: 300px;">
                <WorldSelector forceTriggerUpdateRef={forceTriggerUpdateRef} />
            </div>
            <div title="" style={{ display: "contents", cursor: "auto" }}>
                <ControlledMenu
                    anchorPoint={openMenu_anchorPoint}
                    state={openMenu_isOpen ? "open" : "closed"}
                    direction={openMenu_direction}
                    onClose={(): void => void openMenu_setOpen(false)}
                >
                    {popupTabs.map(
                        (tab: PopupTab): JSX.Element => (
                            <MenuItem onClick={tab.onClick}>
                                <div style="display: inline-block; vertical-align: middle; width: 16px; height: 16px; position: absolute; left: 5px; top: 5px;">
                                    <img
                                        aria-hidden="true"
                                        src={tab.icon}
                                        class="nsel ndrg piximg"
                                        style={`display: inline-block; width: auto; height: ${16 - (16 % tab.resolution)}px; margin: ${
                                            (16 % tab.resolution) / 2
                                        }px 0;`}
                                    />
                                </div>
                                {tab.name}
                            </MenuItem>
                        )
                    )}
                    <MenuDivider />
                    <SubMenu label="Advanced..." disabled>
                        {/* TODO */}
                    </SubMenu>
                </ControlledMenu>
            </div>
        </>
    );
}

/**
 * Props for the {@link LoadingScreenContents} component.
 */
export interface LoadingScreenContentsProps {
    /**
     * The message to display.
     *
     * @default "Loading..."
     */
    message?: string;
    messageContainerRef?: RefObject<HTMLDivElement>;
    /**
     * Whether to preserve the text offset.
     *
     * @default false
     */
    preserveTextOffset?: boolean;
}

/**
 * The contents of a loading screen.
 *
 * @param props The props for the loading screen contents.
 * @returns The JSX element for the loading screen contents.
 */
export function LoadingScreenContents(props: LoadingScreenContentsProps): JSX.Element {
    return (
        <>
            <div style="flex: 1; overflow: auto; min-width: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img
                    aria-hidden="true"
                    src="resource://images/ui/misc/loading_bar.gif"
                    class="piximg"
                    style="vertical-align: middle; width: round(down, calc(max(100vw, 300px) / 4), 64px); background-color: #0008; padding: calc(round(down, calc(max(100vw, 300px) / 4), 64px) / 16);"
                />
                <div
                    style={`${props.preserveTextOffset ? "" : "margin-bottom: -1.5em; "}line-height: 1.5em; font-family: Consolas; font-size: round(down, calc(max(100vw, 300px) / 50), 5.12px);`}
                    class="loading-screen-message nsel"
                    ref={props.messageContainerRef!} // XXX: Passing undefined here may actually be bad, look into this at some point.
                >
                    {props.message ?? "Loading..."}
                </div>
            </div>
        </>
    );
}

/**
 * The main editor container.
 *
 * @returns The JSX element for the main editor view.
 */
export function MainEditor(): JSX.SpecificElement<"div"> {
    const tabContentsContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): (() => void) => {
        return (): void => {
            if (tabContentsContainerRef.current) render(null, tabContentsContainerRef.current);
        };
    });
    return (
        <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: column;">
            <TabBar />
            <div id="tab-contents-container" style="display: contents;" ref={tabContentsContainerRef} />
        </div>
    );
}

/**
 * Props for the {@link WorldEditor} component.
 */
export interface WorldEditorProps {
    tab: TabManagerTab;
}

/**
 * The world editor.
 *
 * @param props The props for the world editor.
 * @returns The JSX element for the world editor.
 */
export function WorldEditor(props: WorldEditorProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useLayoutEffect((): void => {
        if (containerRef.current) {
            render(<WorldEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
    });
    useEffect((): (() => void) => {
        function update(): void {
            if (containerRef.current === null) return;
            render(null, containerRef.current);
            render(<WorldEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
        props.tab.on("reloadCurrentSubTab", update);
        props.tab.on("switchTab", update);
        return (): void => {
            props.tab.off("reloadCurrentSubTab", update);
            props.tab.off("switchTab", update);
            if (containerRef.current) render(null, containerRef.current);
        };
    }, []);
    return (
        <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: column;">
            {props.tab.hasTabBar && <SubTabBar tab={props.tab} />}
            <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: row;">
                <LeftSidebar tab={props.tab} />
                <main style="width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1;" id="main" ref={containerRef}>
                    {/* Nothing is needed here as useLayoutEffect will insert the WorldEditorTabRenderer component before the next frame renders. */}
                    {/* The WorldEditorTabRenderer component is being inserted via render() instead of just being here so that cleanup effects are properly triggered when the tab is switched. */}
                </main>
            </div>
        </div>
    );
}

/**
 * Props for the {@link LevelDBEditor} component.
 */
export interface LevelDBEditorProps {
    tab: TabManagerTab;
}

/**
 * The LevelDB editor.
 *
 * @param props The props for the LevelDB editor.
 * @returns The JSX element for the LevelDB editor.
 */
export function LevelDBEditor(props: LevelDBEditorProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useLayoutEffect((): void => {
        if (containerRef.current) {
            render(<LevelDBEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
    });
    useEffect((): (() => void) => {
        function update(): void {
            if (containerRef.current === null) return;
            render(null, containerRef.current);
            render(<LevelDBEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
        props.tab.on("reloadCurrentSubTab", update);
        props.tab.on("switchTab", update);
        return (): void => {
            props.tab.off("reloadCurrentSubTab", update);
            props.tab.off("switchTab", update);
            if (containerRef.current) render(null, containerRef.current);
        };
    }, []);
    return (
        <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: column;">
            {props.tab.hasTabBar && <SubTabBar tab={props.tab} />}
            <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: row;">
                <LeftSidebar tab={props.tab} />
                <main style="width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1;" id="main" ref={containerRef}>
                    {/* Nothing is needed here as useLayoutEffect will insert the LevelDBEditorTabRenderer component before the next frame renders. */}
                    {/* The LevelDBEditorTabRenderer component is being inserted via render() instead of just being here so that cleanup effects are properly triggered when the tab is switched. */}
                </main>
            </div>
        </div>
    );
}

/**
 * Props for the {@link NBTFileEditor} component.
 */
export interface NBTFileEditorProps {
    tab: TabManagerTab;
}

/**
 * The NBT file editor.
 *
 * @param props The props for the NBT file editor.
 * @returns The JSX element for the NBT file editor.
 */
export function NBTFileEditor(props: NBTFileEditorProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useLayoutEffect((): void => {
        if (containerRef.current) {
            render(<NBTFileEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
    });
    useEffect((): (() => void) => {
        function update(): void {
            if (containerRef.current === null) return;
            render(null, containerRef.current);
            render(<NBTFileEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current);
        }
        props.tab.on("reloadCurrentSubTab", update);
        props.tab.on("switchTab", update);
        return (): void => {
            props.tab.off("reloadCurrentSubTab", update);
            props.tab.off("switchTab", update);
            if (containerRef.current) render(null, containerRef.current);
        };
    }, []);
    return (
        <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: column;">
            <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: row;">
                <main style="width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1;" id="main" ref={containerRef}>
                    {/* Nothing is needed here as useLayoutEffect will insert the NBTFileEditorTabRenderer component before the next frame renders. */}
                    {/* The NBTFileEditorTabRenderer component is being inserted via render() instead of just being here so that cleanup effects are properly triggered when the tab is switched. */}
                </main>
            </div>
        </div>
    );
}

/**
 * The start tab of the world editor.
 *
 * @returns The JSX element for the start tab of the world editor.
 */
export function WorldEditorStartTab(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <NoneTab />
            </div>
        </div>
    );
}

/**
 * The start tab of the LevelDB editor.
 *
 * @returns The JSX element for the start tab of the LevelDB editor.
 */
export function LevelDBEditorStartTab(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <NoneTab />
            </div>
        </div>
    );
}

/**
 * The renderer for the world editor tabs.
 *
 * @param props The props for the world editor tab renderer.
 * @returns The JSX element for the world editor tab renderer.
 */
export function WorldEditorTabRenderer(props: {
    tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
    parentTab: TabManagerTab;
}): JSX.SpecificElement<"div"> {
    if (props.tab === null) return <WorldEditorStartTab />;
    if (typeof props.tab === "string") {
        switch (props.tab) {
            case "world-settings":
            case "dynamic-properties":
            case "scoreboards":
            case "portals":
            case "schedulerwt":
                return (
                    <Notice
                        title="Unsupported Tab Type Usage"
                        subtitle={`The tab type ${props.tab} is not supported to be used as a special string type sub-tab.`}
                        detail={null}
                        image="nothing_to_see"
                    />
                );
            case "entities":
                return <EntitiesTab tab={props.parentTab} />;
            case "fun":
                return <FunTab tab={props.parentTab} />;
            case "integrations":
                return <IntegrationsTab tab={props.parentTab} />;
            case "maps":
                return <MapsTab tab={props.parentTab} />;
            case "packs":
                return <PacksTab tab={props.parentTab} />;
            case "players":
                return <PlayersTab tab={props.parentTab} />;
            case "repair-forced-world-corruption":
                return <RepairForcedWorldCorruptionTab tab={props.parentTab} />;
            case "structures":
                return <StructuresTab tab={props.parentTab} />;
            case "ticks":
                return <TicksTab tab={props.parentTab} />;
            case "ticking-areas":
                return <TickingAreasTab tab={props.parentTab} />;
            case "view-files":
                return <ViewFilesTab tab={props.parentTab} />;
            case "world":
                return <WorldEditorTab tab={props.parentTab} />;
            case "block-entities":
            case "villages":
            default:
                return <UnderConstruction detail={`The ${props.tab} tab has not been implemented yet.`} />;
        }
    } else {
        if (props.tab.rawMode) return <HexEditorTab tab={props.tab} />;
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (props.tab.contentType) {
            case "LevelDat":
                return <WorldSettingsTab tab={props.tab} />;
            case "Map":
                return <MapEditorTab tab={props.tab} />;
            default: {
                const format: EntryContentTypeFormatData =
                    props.tab.formatData ?? (entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData);
                switch (format.type) {
                    case "NBT":
                        return <GenericNBTEditorTab tab={props.tab} />;
                    case "custom":
                        switch (format.resultType) {
                            case "JSONNBT":
                                return <GenericNBTEditorTab tab={props.tab} />;
                            case "SNBT": // TODO: Add SNBT editor tab.
                            case "unknown":
                            case "buffer":
                            default:
                                return <HexEditorTab tab={props.tab} />;
                        }
                    case "ASCII":
                    case "UTF-8":
                    case "SNBT": // TODO: Add SNBT editor tab.
                    case "JSON": // TODO: Add JSON editor tab.
                    case "JSONC": // TODO: Add JSONC editor tab.
                        return <TextEditorTab tab={props.tab} />;
                    case "int": // TODO: Add int editor tab.
                    case "binary":
                    case "binaryPlainText":
                    case "hex":
                    case "unknown":
                    default:
                        return <HexEditorTab tab={props.tab} />;
                }
            }
        }
    }
}

/**
 * The renderer for the LevelDB editor tabs.
 *
 * @param props The props for the LevelDB editor tab renderer.
 * @returns The JSX element for the LevelDB editor tab renderer.
 */
export function LevelDBEditorTabRenderer(props: {
    tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
    parentTab: TabManagerTab;
}): JSX.SpecificElement<"div"> {
    if (props.tab === null) return <LevelDBEditorStartTab />;
    if (typeof props.tab === "string") {
        switch (props.tab) {
            case "world-settings":
            case "dynamic-properties":
            case "scoreboards":
            case "portals":
            case "schedulerwt":
                return (
                    <Notice
                        title="Unsupported Tab Type Usage"
                        subtitle={`The tab type ${props.tab} is not supported to be used as a special string type sub-tab.`}
                        detail={null}
                        image="nothing_to_see"
                    />
                );
            case "entities":
                return <EntitiesTab tab={props.parentTab} />;
            case "fun":
                return <FunTab tab={props.parentTab} />;
            case "integrations":
                return <IntegrationsTab tab={props.parentTab} />;
            case "maps":
                return <MapsTab tab={props.parentTab} />;
            case "packs":
                return (
                    <Notice
                        title="Unsupported Tab Type"
                        subtitle={`The tab type ${props.tab} is not supported in the LevelDB editor.`}
                        detail={null}
                        image="nothing_to_see"
                    />
                );
            case "players":
                return <PlayersTab tab={props.parentTab} />;
            case "repair-forced-world-corruption":
                return <RepairForcedWorldCorruptionTab tab={props.parentTab} />;
            case "structures":
                return <StructuresTab tab={props.parentTab} />;
            case "ticks":
                return <TicksTab tab={props.parentTab} />;
            case "ticking-areas":
                return <TickingAreasTab tab={props.parentTab} />;
            case "view-files":
                return <ViewFilesTab tab={props.parentTab} />;
            case "world":
                return <WorldEditorTab tab={props.parentTab} />;
            case "block-entities":
            case "villages":
            default:
                return <UnderConstruction detail={`The ${props.tab} tab has not been implemented yet.`} />;
        }
    } else {
        if (props.tab.rawMode) return <HexEditorTab tab={props.tab} />;
        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (props.tab.contentType) {
            case "LevelDat":
                return <WorldSettingsTab tab={props.tab} />;
            case "Map":
                return <MapEditorTab tab={props.tab} />;
            default: {
                const format: EntryContentTypeFormatData =
                    props.tab.formatData ?? (entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData);
                switch (format.type) {
                    case "NBT":
                        return <GenericNBTEditorTab tab={props.tab} />;
                    case "custom":
                        switch (format.resultType) {
                            case "JSONNBT":
                                return <GenericNBTEditorTab tab={props.tab} />;
                            case "SNBT": // TODO: Add SNBT editor tab.
                            case "unknown":
                            case "buffer":
                            default:
                                return <HexEditorTab tab={props.tab} />;
                        }
                    case "ASCII":
                    case "UTF-8":
                    case "SNBT": // TODO: Add SNBT editor tab.
                    case "JSON": // TODO: Add JSON editor tab.
                    case "JSONC": // TODO: Add JSONC editor tab.
                        return <TextEditorTab tab={props.tab} />;
                    case "int": // TODO: Add int editor tab.
                    case "binary":
                    case "binaryPlainText":
                    case "hex":
                    case "unknown":
                    default:
                        return <HexEditorTab tab={props.tab} />;
                }
            }
        }
    }
}

/**
 * The renderer for the NBT file editor tabs.
 *
 * @param props The props for the NBT file editor tab renderer.
 * @returns The JSX element for the NBT file editor tab renderer.
 *
 * @throws {Error} If the sub-tab is a special string type sub-tab.
 */
export function NBTFileEditorTabRenderer(props: {
    tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
    parentTab: TabManagerTab;
}): JSX.SpecificElement<"div"> {
    if (props.tab === null) return <LoadingScreenContents />;
    if (typeof props.tab === "string") {
        throw new Error(`The NBT file editor does not have any supported special string type sub-tabs: ${props.tab}`);
    }
    if (props.tab.rawMode) return <HexEditorTab tab={props.tab} />;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (props.tab.contentType) {
        case "LevelDat":
            return <GenericNBTEditorTab tab={props.tab} />;
        case "Map":
            return <MapEditorTab tab={props.tab} />;
        default: {
            const format: EntryContentTypeFormatData =
                props.tab.formatData ?? (entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData);
            switch (format.type) {
                case "NBT":
                case "unknown":
                    return <GenericNBTEditorTab tab={props.tab} />;
                case "custom":
                    switch (format.resultType) {
                        case "JSONNBT":
                            return <GenericNBTEditorTab tab={props.tab} />;
                        case "SNBT": // TODO: Add SNBT editor tab.
                            return <TextEditorTab tab={props.tab} />;
                        case "unknown":
                        case "buffer":
                        default:
                            return (
                                <center
                                    style={{
                                        display: "inline-block",
                                        width: "-webkit-fill-available",
                                        height: "-webkit-fill-available",
                                    }}
                                >
                                    <h1>Error</h1>
                                    <p>Something went wrong...</p>
                                    <img
                                        class="piximg ndrg nsel"
                                        style={{ width: "min(calc(100% - mod(100%, 260px)), 260px * 4)" }}
                                        aria-hidden="true"
                                        src="resource://images/ui/art/generic_error.png"
                                    />
                                    <p>Upsupported NBT tab custom data format: {format.resultType}</p>
                                </center>
                            );
                    }
                case "SNBT": // TODO: Add SNBT editor tab.
                    return <TextEditorTab tab={props.tab} />;
                case "ASCII":
                case "UTF-8":
                case "JSON":
                case "JSONC":
                case "int":
                case "binary":
                case "binaryPlainText":
                case "hex":
                default:
                    return (
                        <center
                            style={{
                                display: "inline-block",
                                width: "-webkit-fill-available",
                                height: "-webkit-fill-available",
                            }}
                        >
                            <h1>Error</h1>
                            <p>Something went wrong...</p>
                            <img
                                class="piximg ndrg nsel"
                                style={{ width: "min(calc(100% - mod(100%, 260px)), 260px * 4)" }}
                                aria-hidden="true"
                                src="resource://images/ui/art/generic_error.png"
                            />
                            <p>Upsupported NBT tab data format: {format.type}</p>
                        </center>
                    );
            }
        }
    }
}

function renderTabContents({
    tabContentsElement,
    newTab,
}: {
    tabContentsElement: HTMLDivElement;
    newTab: TabManagerTab | TabManagerGenericTabID | null;
}): void {
    render(null, tabContentsElement);
    if (newTab === null) {
        render(
            <div style="width: 100vw; height: 0; flex: 1; display: flex; flex-direction: row;">
                <StartScreenContents />
            </div>,
            tabContentsElement
        );
    } else if (typeof newTab !== "string") {
        if (!newTab.isInitialized) {
            // TODO: Maybe add a better loading screen message here.
            render(<LoadingScreenContents />, tabContentsElement);
            return;
        }
        switch (newTab.type) {
            case "world":
                render(<WorldEditor tab={newTab} />, tabContentsElement);
                break;
            case "leveldb":
                render(<LevelDBEditor tab={newTab} />, tabContentsElement);
                break;
            case "nbt":
                render(<NBTFileEditor tab={newTab} />, tabContentsElement);
                break;
            case "json":
                render(
                    <UnderConstruction subtitle="This tab type is under construction." detail="The JSON editor has not been implemented yet." />,
                    tabContentsElement
                );
                break;
            case "xml":
                render(
                    <UnderConstruction subtitle="This tab type is under construction." detail="The XML editor has not been implemented yet." />,
                    tabContentsElement
                );
                break;
            case "binary":
                render(
                    <UnderConstruction subtitle="This tab type is under construction." detail="The binary editor has not been implemented yet." />,
                    tabContentsElement
                );
                break;
            case "text":
                render(
                    <UnderConstruction subtitle="This tab type is under construction." detail="The text editor has not been implemented yet." />,
                    tabContentsElement
                );
                break;
            case "other":
                render(
                    <center
                        style={{
                            display: "inline-block",
                            width: "-webkit-fill-available",
                            height: "-webkit-fill-available",
                        }}
                    >
                        <h1>Hmmmmm... There's nothing here.</h1>
                        <p>How did this happen?</p>
                        <img
                            class="piximg ndrg nsel"
                            style={{ width: "min(calc(100% - mod(100%, 256px)), 256px * 4)" }}
                            aria-hidden="true"
                            src="resource://images/ui/art/generic_empty.png"
                        />
                        <p>We don't know what do to with a tab type of "other"...</p>
                    </center>,
                    tabContentsElement
                );
                break;
            default:
                render(
                    <center
                        style={{
                            display: "inline-block",
                            width: "-webkit-fill-available",
                            height: "-webkit-fill-available",
                        }}
                    >
                        <h1>Error</h1>
                        <p>Something went wrong...</p>
                        <img
                            class="piximg ndrg nsel"
                            style={{ width: "min(calc(100% - mod(100%, 260px)), 260px * 4)" }}
                            aria-hidden="true"
                            src="resource://images/ui/art/generic_error.png"
                        />
                        <p>Invalid tab type: {newTab.type}</p>
                    </center>,
                    tabContentsElement
                );
        }
    } else {
        switch (newTab) {
            case "loading":
                render(
                    <div style="width: 100vw; height: 0; flex: 1; display: flex; flex-direction: row;">
                        <LoadingScreenContents />
                    </div>,
                    tabContentsElement
                );
                break;
            case "settings":
                render(<SettingsPage />, tabContentsElement);
                break;
            default:
                render(
                    <center
                        style={{
                            display: "inline-block",
                            width: "-webkit-fill-available",
                            height: "-webkit-fill-available",
                        }}
                    >
                        <h1>Hmmmmm... There's nothing here.</h1>
                        <p>How did this happen?</p>
                        <img
                            class="piximg ndrg nsel"
                            style={{ width: "min(calc(100% - mod(100%, 256px)), 256px * 4)" }}
                            aria-hidden="true"
                            src="resource://images/ui/art/generic_empty.png"
                        />
                        <p>There is no page with an ID of {JSON.stringify(String(newTab))}...</p>
                    </center>,
                    tabContentsElement
                );
                break;
        }
    }
}

// let lastTabContainerType: "app" | "tab" = "app";

tabManager.on("switchTab", ({ /* previousTab, */ newTab }: TabManagerSwitchTabEvent): void => {
    // const appContentsElement: HTMLDivElement | null = document.getElementById("app-contents") as HTMLDivElement | null;
    // if (!appContentsElement) return;
    // if (newTab === null && tabManager.openTabs.length === 0) {
    //     lastTabContainerType = "app";
    //     render(null, appContentsElement);
    //     render(<StartScreen />, appContentsElement);
    //     return;
    // }
    // if (newTab === "loading" && tabManager.openTabs.length === 0) {
    //     lastTabContainerType = "app";
    //     render(null, appContentsElement);
    //     render(
    //         <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
    //             <LoadingScreenContents />
    //         </div>,
    //         appContentsElement
    //     );
    //     return;
    // }
    // if (previousTab === null || lastTabContainerType !== "tab") {
    //     lastTabContainerType = "tab";
    //     render(null, appContentsElement);
    //     render(<MainEditor />, appContentsElement);
    // }
    const tabContentsElement: HTMLDivElement | null = document.getElementById("tab-contents-container") as HTMLDivElement | null;
    if (!tabContentsElement) return;
    renderTabContents({ newTab, tabContentsElement });
});

tabManager.on("tabInitialized", ({ tab }: TabManagerInitializedTabEvent): void => {
    if (tabManager.selectedTab !== tab) return;
    const tabContentsElement: HTMLDivElement | null = document.getElementById("tab-contents-container") as HTMLDivElement | null;
    if (!tabContentsElement) return;
    renderTabContents({ newTab: tab, tabContentsElement });
});

// tabManager.on("openTab", ({ switchToTab }: TabManagerOpenTabEvent): void => {
//     if (switchToTab || $("#tab-bar")[0]?.checkVisibility()) return;
//     const appContentsElement: HTMLDivElement | null = document.getElementById("app-contents") as HTMLDivElement | null;
//     if (!appContentsElement) return;
//     if (tabManager.selectedTab === null || lastTabContainerType !== "tab") {
//         lastTabContainerType = "tab";
//         render(null, appContentsElement);
//         render(<MainEditor />, appContentsElement);
//     }
//     const tabContentsElement: HTMLDivElement | null = document.getElementById("tab-contents-container") as HTMLDivElement | null;
//     if (!tabContentsElement) return;
//     renderTabContents({ newTab: tabManager.selectedTab, tabContentsElement });
// });

window.addEventListener("keydown", (event: KeyboardEvent): void => {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (true) {
        case document.activeElement === document.body &&
            event.code === "KeyS" &&
            !event.shiftKey &&
            (process.platform === "darwin" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey): {
            event.preventDefault();
            const currentTab = tabManager.selectedTab;
            if (currentTab instanceof TabManagerTab) {
                if (!currentTab.isSaving) {
                    void currentTab.save(false, event.altKey);
                }
            }
            break;
        }
        // no default
    }
});
