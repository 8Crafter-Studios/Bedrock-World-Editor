import { type JSX, type RefObject } from "preact";
import { hydrate, render } from "preact/compat";
import LeftSidebar from "./components/LeftSidebar";
import DebugOverlay from "./components/DebugOverlay";
import TabBar from "./components/TabBar";
import { entryContentTypeToFormatMap, toLong } from "mcbe-leveldb";
import { Dirent, existsSync, globSync, read, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import NBT from "prismarine-nbt";
import { useEffect, useRef, useState } from "preact/hooks";
import WorldSettingsTab from "./tabs/worldSettings";
import SubTabBar from "./components/SubTabBar";
import PlayersTab from "./tabs/players";
import GenericNBTEditorTab from "./tabs/genericNBTEditor";
import HexEditor from "./components/HexEditor";
import * as monaco from "monaco-editor";
import EntitiesTab from "./tabs/entities";
import ViewFilesTab from "./tabs/viewFiles";
import RepairForcedWorldCorruptionTab from "./tabs/repairForcedWorldCorruption";
import MapsTab from "./tabs/maps";
import { app, dialog } from "@electron/remote";
import type { MessageBoxReturnValue } from "electron";
import MapEditorTab from "./tabs/mapNBTEditor";
import NoneTab from "./tabs/none";
import TickingAreasTab from "./tabs/tickingAreas";
import StructuresTab from "./tabs/structures";
import FunTab from "./tabs/fun";
import { ControlledMenu, MenuDivider, MenuItem } from "@szhsin/react-menu";
import { APP_DATA_FOLDER_PATH } from "../src/utils/URLs";
// import { Renderer3D } from "./3DRendererV1/3DRenderer";
const mime = require("mime-types") as typeof import("mime-types");

monaco.languages.register({ id: "snbt", extensions: [".snbt"] });

let isClosing: boolean = false;
let closeCanceled: boolean = false;
getCurrentWindow().on("close", async (event: Electron.Event): Promise<void> => {
    isClosing = true;
    if (tabManager.openTabs.length > 0) {
        closeCanceled = true;
        const unsavedTabs: TabManagerTab[] = tabManager.openTabs.filter((tab: TabManagerTab): boolean => tab.isModified());
        if (unsavedTabs.length > 0) {
            const result: number = dialog.showMessageBoxSync(getCurrentWindow(), {
                type: "warning",
                title: "Unsaved Changes",
                ...(unsavedTabs.length === 1
                    ? {
                          message: `Do you want to save the changes you made to ${unsavedTabs[0]!.name}?`,
                          detail: "Your changes will be lost if you don't save them.",
                      }
                    : {
                          message: `Do you want to save the changes to the following ${unsavedTabs.length} tab${unsavedTabs.length === 1 ? "" : "s"}?`,
                          detail: `${unsavedTabs
                              .map((tab: TabManagerTab): string => tab.name)
                              .join("\n")}\n\nYour changes will be lost if you don't save them.`,
                      }),
                buttons: ["Save", "Don't Save", "Cancel"],
                noLink: true,
                defaultId: 0,
                cancelId: 2,
            });
            switch (result) {
                case 0:
                    try {
                        await Promise.all(unsavedTabs.map((tab: TabManagerTab): Promise<void> => tab.save().then((): Promise<void> => tab.close())));
                    } catch (e) {
                        console.error(e);
                    }
                    isClosing = true;
                    closeCanceled = false;
                    getCurrentWindow().close();
                    return;
                case 1:
                    try {
                        await Promise.all(unsavedTabs.map((tab: TabManagerTab): Promise<void> => tab.close()));
                    } catch (e) {
                        console.error(e);
                    }
                    isClosing = true;
                    closeCanceled = false;
                    getCurrentWindow().close();
                    return;
                case 2:
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
                await Promise.all(unsavedTabs.map((tab: TabManagerTab): Promise<void> => tab.close()));
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
                ...(unsavedTabs.length === 1
                    ? {
                          message: `Do you want to save the changes you made to ${unsavedTabs[0]!.name}?`,
                          detail: "Your changes will be lost if you don't save them.",
                      }
                    : {
                          message: `Do you want to save the changes to the following ${unsavedTabs.length} tab${unsavedTabs.length === 1 ? "" : "s"}?`,
                          detail: `${unsavedTabs
                              .map((tab: TabManagerTab): string => tab.name)
                              .join("\n")}\n\nYour changes will be lost if you don't save them.`,
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
                        await Promise.all(unsavedTabs.map((tab: TabManagerTab): Promise<void> => tab.save().then((): Promise<void> => tab.close())));
                    } catch (e) {
                        console.error(e);
                    }
                    location.reload();
                    break;
                case 1:
                    event.preventDefault();
                    try {
                        await Promise.all(unsavedTabs.map((tab: TabManagerTab): Promise<void> => tab.close()));
                    } catch (e) {
                        console.error(e);
                    }
                    location.reload();
                    break;
                case 2:
                    event.preventDefault();
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
                await Promise.all(tabManager.openTabs.map((tab: TabManagerTab): Promise<void> => tab.close()));
            } catch (e) {
                console.error(e);
            }
            location.reload();
        }
    }
});

export function setActivePage(activePage: string): void {
    $(`.app-tab:not(#app-tab-${activePage})`).hide();
    $(`#app-tab-${activePage}`).show();
    $(`.sidebar_button[data-path-id]:not([data-path-id="${activePage}"])`).removeClass("active");
    $(`.sidebar_button[data-path-id="${activePage}"]`).addClass("active");
}

export default function App(): JSX.Element {
    return (
        <>
            <div id="app-contents">
                <StartScreen />
            </div>
            <div id="page-overlay-container" style="display: contents;" />
            <DebugOverlay />
            {/* This svg is used to completely disable anti-aliasing on fonts, please ignore it. */}
            <svg class="offscreen" width="0" height="0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="crispify">
                        <feComponentTransfer>
                            <feFuncA type="discrete" tableValues="0 1" />
                        </feComponentTransfer>
                    </filter>
                </defs>
            </svg>
        </>
    );
}

export interface MinecraftWorldDisplayDetails {
    name: string;
    path: string;
    thumbnailPath?: string;
    lastOpenedWithVerison: `v${string}` | null;
    lastPlayed: Date | null;
    favorited: boolean;
}

type FavoritedWorldsJSONData = string[];

export async function getMinecraftWorlds(all: boolean = false): Promise<MinecraftWorldDisplayDetails[]> {
    return (
        await Promise.all(
            (all ? [...new Set([...config.parsedMinecraftDataFolders, ...config.parsedExtraMinecraftDataFolders])] : config.parsedMinecraftDataFolders)
                .filter((folderPath: string): boolean => existsSync(path.join(folderPath, "minecraftWorlds")))
                .map((folderPath: string): string[] => {
                    return readdirSync(path.join(folderPath, "minecraftWorlds"), { withFileTypes: true })
                        .filter((dirent: Dirent<string>): boolean => dirent.isDirectory())
                        .map((dirent: Dirent<string>): string => path.join(folderPath, "minecraftWorlds", dirent.name));
                })
                .flat()
                .map(async (folderPath: string): Promise<MinecraftWorldDisplayDetails | undefined> => {
                    if (!existsSync(path.join(folderPath, "level.dat"))) return;
                    try {
                        const levelDat: NBT.NBT = (await NBT.parse(readFileSync(path.join(folderPath, "level.dat"), { encoding: null }))).parsed;
                        const name: string = existsSync(path.join(folderPath, "levelname.txt"))
                            ? readFileSync(path.join(folderPath, "levelname.txt"), { encoding: "utf-8" })
                            : (levelDat.value.LevelName?.value as string) ?? "Unknown Name";
                        // console.log(folderPath, levelDat);
                        return {
                            name,
                            path: folderPath,
                            thumbnailPath: existsSync(path.join(folderPath, "world_icon.jpeg"))
                                ? path.join(folderPath, "world_icon.jpeg")
                                : globSync(path.join(folderPath, "world_icon.*"))[0],
                            lastOpenedWithVerison: levelDat.value.lastOpenedWithVersion
                                ? `v${(levelDat.value.lastOpenedWithVersion as NBT.List<NBT.TagType.Int>).value.value.join(".")}`
                                : null,
                            lastPlayed: levelDat.value.LastPlayed ? new Date(Number(toLong((levelDat.value.LastPlayed as NBT.Long).value) * 1000n)) : null,
                            favorited: existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))
                                ? ((): boolean => {
                                      try {
                                          const favoritedWorldsData: FavoritedWorldsJSONData = JSON.parse(
                                              readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")
                                          );
                                          if (favoritedWorldsData.includes(folderPath)) {
                                              return true;
                                          }
                                      } catch (e) {
                                          console.error(e);
                                      }
                                      return false;
                                  })()
                                : false,
                        };
                    } catch (e) {
                        console.error(e);
                        return;
                    }
                })
        )
    ).filter((world: MinecraftWorldDisplayDetails | undefined): world is MinecraftWorldDisplayDetails => !!world);
}

export function WorldSelector(): JSX.SpecificElement<"div"> {
    const renderWorldsContainerRef: RefObject<HTMLDivElement> = useRef(null);
    const viewMode: "compact" | "detailed" | "grid" = "detailed";
    let [data, updateData] = useState<MinecraftWorldDisplayDetails[]>([]);
    useEffect((): void => void getMinecraftWorlds().then(updateData), []);
    function RenderWorlds(): JSX.SpecificElement<"div">[] {
        return data
            .toSorted((a: MinecraftWorldDisplayDetails, b: MinecraftWorldDisplayDetails): number =>
                a.favorited && !b.favorited ? -1 : b.favorited && !a.favorited ? 1 : b.lastPlayed!.getTime() - a.lastPlayed!.getTime()
            )
            .map((world: MinecraftWorldDisplayDetails, index: number): JSX.SpecificElement<"div"> => {
                const [worldContextMenu_isOpen, worldContextMenu_setOpen] = useState(false);
                const [worldContextMenu_anchorPoint, worldContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                function onWorldRightClick(event: JSX.TargetedMouseEvent<HTMLDivElement>): void {
                    event.preventDefault();
                    event.stopPropagation();
                    const clickPosition: { x: number; y: number } = {
                        x: event.clientX,
                        y: event.clientY,
                    };
                    console.log(clickPosition);

                    worldContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                    worldContextMenu_setOpen(true);
                }
                return (
                    <div
                        title={`${world.name}\nLast Opened With: ${world.lastOpenedWithVerison}\nLast Played: ${
                            world.lastPlayed?.toLocaleString() ?? "null"
                        }\nPath: ${world.path}`}
                        class="nsel ndrg"
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            cursor: "pointer",
                            paddingRight: "5px",
                        }}
                        data-hover-bg-color="var(--alternating-bg-hover-color)"
                        data-bg-color={`var(--alternating-bg-color-${(index % 2) + 1})`}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                            if (
                                event.target instanceof Node &&
                                $(event.currentTarget)
                                    .find<HTMLDivElement>(".szh-menu-container")
                                    .toArray()
                                    .some((element: HTMLDivElement): boolean => element.contains(event.target as Node))
                            )
                                return;
                            tabManager.switchTab("loading");
                            setTimeout(
                                (): void => void tabManager.openTab({ path: world.path, name: world.name, type: "world", icon: world.thumbnailPath! }),
                                10
                            );
                        }}
                        onAuxClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => void (event.button === 2 && onWorldRightClick(event))}
                    >
                        <img
                            aria-hidden="true"
                            src={
                                world.thumbnailPath
                                    ? `data:${mime.lookup(path.extname(world.thumbnailPath))};base64,${readFileSync(world.thumbnailPath, {
                                          encoding: "base64",
                                      })}`
                                    : "resource://images/ui/misc/CreateNewWorld.png"
                            }
                            style={`margin: 4px; width: ${viewMode === "compact" ? 32 : viewMode === "detailed" ? 64 : 128}px; aspect-ratio: 16 / 9;`}
                        />
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{world.name}</div>
                            {viewMode === "detailed" && (
                                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: gray">{world.path}</div>
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
                                    {world.lastOpenedWithVerison ?? <span style="color: red;">null</span>}
                                </div>
                            </div>
                        )}
                        <ControlledMenu
                            anchorPoint={worldContextMenu_anchorPoint}
                            state={worldContextMenu_isOpen ? "open" : "closed"}
                            direction="right"
                            onClose={(): void => void worldContextMenu_setOpen(false)}
                        >
                            <MenuItem
                                onClick={async (): Promise<void> => {
                                    tabManager.switchTab("loading");
                                    setTimeout(
                                        (): void => void tabManager.openTab({ path: world.path, name: world.name, type: "world", icon: world.thumbnailPath! }),
                                        10
                                    );
                                }}
                            >
                                Open World
                            </MenuItem>
                            <MenuItem
                                onClick={async (): Promise<void> => {
                                    tabManager.switchTab("loading");
                                    setTimeout(
                                        (): void =>
                                            void tabManager.openTab({
                                                path: world.path,
                                                name: world.name,
                                                type: "world",
                                                icon: world.thumbnailPath!,
                                                mode: TabManagerTabMode.Readonly,
                                            }),
                                        10
                                    );
                                }}
                            >
                                Open in Read-Only Mode
                            </MenuItem>
                            <MenuItem
                                onClick={(): void => {
                                    tabManager.switchTab("loading");
                                    setTimeout(
                                        (): void =>
                                            void tabManager.openTab({
                                                path: world.path,
                                                name: world.name,
                                                type: "world",
                                                icon: world.thumbnailPath!,
                                                mode: TabManagerTabMode.Direct,
                                            }),
                                        10
                                    );
                                }}
                            >
                                Open in Direct Mode (Unsafe)
                            </MenuItem>
                            <MenuDivider />
                            {world.favorited ? (
                                <MenuItem
                                    onClick={(): void => {
                                        if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"))) return;
                                        try {
                                            const favoritedWorldsData: FavoritedWorldsJSONData = JSON.parse(
                                                readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")
                                            );
                                            if (favoritedWorldsData.includes(world.path)) {
                                                favoritedWorldsData.splice(favoritedWorldsData.indexOf(world.path), 1);
                                                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), JSON.stringify(favoritedWorldsData));
                                                world.favorited = false;
                                            }
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }}
                                >
                                    Unfavorite
                                </MenuItem>
                            ) : (
                                <MenuItem
                                    onClick={(): void => {
                                        try {
                                            let favoritedWorldsData: FavoritedWorldsJSONData = [];
                                            if (existsSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json")))
                                                favoritedWorldsData = JSON.parse(
                                                    readFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), "utf-8")
                                                );
                                            if (!favoritedWorldsData.includes(world.path)) {
                                                favoritedWorldsData.push(world.path);
                                                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "favorited_worlds.json"), JSON.stringify(favoritedWorldsData));
                                                world.favorited = true;
                                            }
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }}
                                >
                                    Favorite
                                </MenuItem>
                            )}
                        </ControlledMenu>
                        {/* TO-DO: Add a star icon for favorited tabs. */}
                    </div>
                );
            });
    }
    let showingMore: boolean = false;
    return (
        <div style="display: flex; flex-direction: column; overflow: auto;">
            <div style={{ display: "contents" }} ref={renderWorldsContainerRef}>
                <RenderWorlds />
            </div>
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
                    showingMore = !showingMore;
                    event.currentTarget.textContent = "Loading...";
                    event.currentTarget.dataset.disabled = "true";
                    getMinecraftWorlds(showingMore).then((worlds: MinecraftWorldDisplayDetails[]): void => {
                        event.currentTarget!.textContent = showingMore ? "Show less" : "Show more";
                        delete event.currentTarget.dataset.disabled;
                        data = worlds;
                        const parentElement = event.currentTarget.parentElement!;
                        const currentTarget = event.currentTarget;
                        parentElement.removeChild(event.currentTarget);
                        render(<RenderWorlds />, parentElement);
                        parentElement.appendChild(currentTarget);
                    });
                }}
            >
                Show more
            </div>
        </div>
    );
}

export function StartScreen(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
            <StartScreenContents />
        </div>
    );
}

export function StartScreenContents(): JSX.Element {
    return (
        <>
            <div
                class="nsel ndrg"
                style="width: 200px; height: -webkit-fill-available; display: flex; flex-direction: column; background-color: #87CEEB22; overflow: hidden; overflow-y: scroll; overflow: auto; align-items: center; gap: 1em; text-align: center; flex-shrink: 0;"
            >
                <img aria-hidden="true" src="resource://icon.png" style="margin-top: 35px; width: 128px" />
                <div style="flex: 1; overflow: auto; line-height: 1.25em;">
                    Bedrock World Editor
                    <br />v{VERSION}
                </div>
            </div>
            <div style="flex: 1; overflow: auto; min-width: 300px;">
                <WorldSelector />
            </div>
        </>
    );
}

export interface LoadingScreenContentsProps {
    /**
     * The message to display.
     *
     * @default "Loading..."
     */
    message?: string;
    messageContainerRef?: RefObject<HTMLDivElement>;
}

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
                    style="margin-bottom: -1.5em; line-height: 1.5em; font-family: Consolas; font-size: round(down, calc(max(100vw, 300px) / 50), 5.12px);"
                    class="loading-screen-message"
                    ref={props.messageContainerRef}
                >
                    {props.message ?? "Loading..."}
                </div>
            </div>
        </>
    );
}

export function MainEditor(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: column;">
            <TabBar />
            <div id="tab-contents-container" style="display: contents;" />
        </div>
    );
}

export interface WorldEditorProps {
    tab: TabManagerTab;
}

export function WorldEditor(props: WorldEditorProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef(null);
    useEffect((): (() => void) => {
        function update(): void {
            if (containerRef.current === null) return;
            // const element: HTMLDivElement = document.createElement("div");
            render(null, containerRef.current);
            render(<WorldEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />, containerRef.current /* element */);
            // containerRef.current.replaceChildren(...element.children);
        }
        props.tab.on("switchTab", update);
        return (): void => {
            props.tab.off("switchTab", update);
        };
    }, []);
    return (
        <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: column;">
            {props.tab.hasTabBar && <SubTabBar tab={props.tab} />}
            <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: row;">
                <LeftSidebar tab={props.tab} />
                <main style="width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1;" id="main" ref={containerRef}>
                    <WorldEditorTabRenderer tab={props.tab.selectedTab} parentTab={props.tab} />
                </main>
            </div>
        </div>
    );
}
export function WorldEditorStartTab(): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <NoneTab />
            </div>
        </div>
    );
}

export function WorldEditorTabRenderer(props: {
    tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null;
    parentTab: TabManagerTab;
}): JSX.SpecificElement<"div"> {
    if (props.tab === null) return <WorldEditorStartTab />;
    if (typeof props.tab === "string") {
        switch (props.tab) {
            case "players":
                return <PlayersTab tab={props.parentTab} />;
            case "entities":
                return <EntitiesTab tab={props.parentTab} />;
            case "fun":
                return <FunTab tab={props.parentTab} />;
            case "maps":
                return <MapsTab tab={props.parentTab} />;
            case "repair-forced-world-corruption":
                return <RepairForcedWorldCorruptionTab tab={props.parentTab} />;
            case "structures":
                return <StructuresTab tab={props.parentTab} />;
            case "ticking-areas":
                return <TickingAreasTab tab={props.parentTab} />;
            case "view-files":
                return <ViewFilesTab tab={props.parentTab} />;
            default:
                return <h2>The {props.tab} tab has not been implemented yet.</h2>;
        }
    } else {
        switch (props.tab.contentType) {
            case "ActorPrefix":
            case "AutonomousEntities":
            case "BiomeData":
            case "BlockEntity":
            case "Dimension":
            case "DynamicProperties":
            case "Entity":
            case "Scoreboard":
            case "SchedulerWT":
                return <GenericNBTEditorTab tab={props.tab} />;
            case "LevelDat":
                return <WorldSettingsTab tab={props.tab} />;
            case "Map":
                return <MapEditorTab tab={props.tab} />;
            default: {
                const format = entryContentTypeToFormatMap[props.tab.contentType];
                switch (format.type) {
                    case "NBT":
                        return <GenericNBTEditorTab tab={props.tab} />;
                    case "custom":
                        switch (format.resultType) {
                            case "JSONNBT":
                                return <GenericNBTEditorTab tab={props.tab} />;
                            default:
                                return <HexEditor tab={props.tab} />;
                        }
                    case "ASCII": // Add text editor tab.
                    case "int": // Add int editor tab.
                    case "unknown":
                    default:
                        return <HexEditor tab={props.tab} />;
                }
            }
        }
    }
}

let lastTabContainerType: "app" | "tab" = "app";

tabManager.on("switchTab", ({ previousTab, newTab }: TabManagerSwitchTabEvent): void => {
    const appContentsElement: HTMLDivElement | null = document.getElementById("app-contents") as HTMLDivElement | null;
    if (!appContentsElement) return;
    if (newTab === null && tabManager.openTabs.length === 0) {
        lastTabContainerType = "app";
        render(null, appContentsElement);
        render(<StartScreen />, appContentsElement);
        return;
    }
    if (newTab === "loading" && tabManager.openTabs.length === 0) {
        lastTabContainerType = "app";
        render(null, appContentsElement);
        render(
            <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
                <LoadingScreenContents />
            </div>,
            appContentsElement
        );
        // const tempElement: HTMLDivElement = document.createElement("div");
        // render(
        //     <div style="width: 100vw; height: 100vh; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
        //         <LoadingScreenContents />
        //     </div>,
        //     tempElement
        // );
        // appContentsElement.replaceChildren(...tempElement.children);
        return;
    }
    if (previousTab === null || lastTabContainerType !== "tab") {
        lastTabContainerType = "tab";
        render(null, appContentsElement);
        render(<MainEditor />, appContentsElement);
        // const tempElement: HTMLDivElement = document.createElement("div");
        // render(<MainEditor />, tempElement);
        // appContentsElement.replaceChildren(...tempElement.children);
    }
    const tabContentsElement: HTMLDivElement | null = document.getElementById("tab-contents-container") as HTMLDivElement | null;
    if (!tabContentsElement) return;
    // const tempElement: HTMLDivElement = document.createElement("div");
    render(null, tabContentsElement);
    if (newTab === null)
        render(
            <div style="width: 100vw; height: 0; flex: 1; display: flex; flex-direction: row;">
                <StartScreenContents />
            </div>,
            tabContentsElement // tempElement
        );
    else if (typeof newTab !== "string" && newTab.type === "world") render(<WorldEditor tab={newTab} />, tabContentsElement /* tempElement */);
    else if (typeof newTab === "string") {
        if (newTab === "loading") {
            render(
                <div style="width: 100vw; height: 0; flex: 1; display: flex; flex-direction: row;">
                    <LoadingScreenContents />
                </div>,
                tabContentsElement // tempElement
            );
        }
    }
    // tabContentsElement.replaceChildren(...tempElement.children);
});

window.addEventListener("keydown", (event: KeyboardEvent): void => {
    switch (true) {
        case document.activeElement === document.body && event.code === "KeyS" && !event.shiftKey && event.ctrlKey && !event.altKey: {
            event.preventDefault();
            const currentTab = tabManager.selectedTab;
            if (currentTab instanceof TabManagerTab) {
                if (!currentTab.isSaving) {
                    currentTab.save();
                }
            }
        }
    }
});
