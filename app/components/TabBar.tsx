import { type JSX, type RefObject, type TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import { checkIsURIOrPath } from "../../src/utils/pathUtils";
const mime = require("mime-types") as typeof import("mime-types");
import { existsSync, globSync, readFileSync } from "node:fs";
import type { NBTSchemas, Vector2 } from "mcbe-leveldb";
import { dialog, shell } from "@electron/remote";
import { get } from "jquery";
import type { MessageBoxReturnValue, OpenDialogReturnValue } from "electron";
import { ControlledMenu, MenuDivider, MenuItem, type ClickEvent } from "@szhsin/react-menu";
import path from "node:path";
import * as NBT from "prismarine-nbt";

export default function TabBar(): JSX.Element {
    const tabContainerRef: RefObject<HTMLUListElement> = useRef(null);
    const popupRef: RefObject<HTMLDivElement> = useRef(null);
    useEffect((): (() => void) => {
        function update(): void {
            if (tabContainerRef.current === null) return;
            const element: HTMLUListElement = document.createElement("ul");
            render(<RenderTabs />, element);
            render(null, tabContainerRef.current);
            tabContainerRef.current.replaceChildren(...element.children);
        }
        function hideAddTabPopup(event: MouseEvent): void {
            if (popupRef.current === null || popupRef.current.contains(event.target as Node)) return;
            $("#add-tab-popup-menu").hide();
        }
        tabManager.on("openTab", update);
        tabManager.on("closeTab", update);
        tabManager.on("switchTab", update);
        tabManager.on("reorderTabs", update);
        window.addEventListener("mousedown", hideAddTabPopup);
        return (): void => {
            tabManager.off("openTab", update);
            tabManager.off("closeTab", update);
            tabManager.off("switchTab", update);
            tabManager.off("reorderTabs", update);
            window.removeEventListener("mousedown", hideAddTabPopup);
        };
    }, []);
    interface PopupTab {
        icon: string;
        name: string;
        resolution: number;
        onClick?(event: JSX.TargetedMouseEvent<HTMLDivElement>): Promise<void> | void;
    }
    const popupTabs: PopupTab[] = (
        [
            {
                icon: "resource://images/ui/glyphs/world_glyph_color.png",
                name: "World",
                resolution: 17,
                onClick(_event) {
                    $("#add-tab-popup-menu").hide();
                    tabManager.switchTab(null);
                },
            },
            {
                icon: "resource://images/ui/glyphs/Folder-Closed.png",
                name: "World Folder",
                resolution: 12,
                async onClick(event) {
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
                                        return (
                                            (await NBT.parse(readFileSync(path.join(folderPath, "level.dat")))).parsed as NBTSchemas.NBTSchemaTypes.LevelDat
                                        ).value.LevelName?.value;
                                    } catch (e) {
                                        console.error("Error while reading level.dat:", e, "folderPath:", folderPath);
                                        try {
                                            return (
                                                (await NBT.parse(readFileSync(path.join(folderPath, "level.dat_old"))))
                                                    .parsed as NBTSchemas.NBTSchemaTypes.LevelDat
                                            ).value.LevelName?.value;
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
                        });
                    });
                    if (invalidFilePaths.length) {
                        dialog.showMessageBox(getCurrentWindow(), {
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
                resolution: 18,
                async onClick(event) {
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
                    validFilePaths.forEach(async (folderPath: string): Promise<void> => {
                        tabManager.openTab({
                            icon: "resource://images/ui/glyphs/icon_bookshelf.png", // TODO: Add supports for using the custom icon set for the folder if it exists.
                            name: path.basename(folderPath), // TODO: Implement something to get a better name for the tab (as it will often times just be `db`).
                            path: folderPath,
                            type: "leveldb",
                        });
                    });
                    // if (invalidFilePaths.length) {
                    //     dialog.showMessageBox(getCurrentWindow(), {
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
                icon: "resource://images/ui/glyphs/Data-Empty.png",
                name: "NBT File",
                resolution: 12,
                async onClick(event) {
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
                    openFileResult.filePaths.forEach(async (filePath: string): Promise<void> => {
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
                async onClick(event) {
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
                    openFileResult.filePaths.forEach(async (filePath: string): Promise<void> => {
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
                async onClick(event) {
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
                    openFileResult.filePaths.forEach(async (filePath: string): Promise<void> => {
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
    ).filter((tab: PopupTab | false | undefined): tab is PopupTab => !!tab) as PopupTab[];
    interface TabProps {
        tab: TabManagerTab;
    }
    function Tab(props: TabProps): JSX.SpecificElement<"li"> {
        const containerRef: RefObject<HTMLLIElement> = useRef(null);
        const unsavedBulletPointRef: RefObject<HTMLDivElement> = useRef(null);
        let dragging: boolean = false;
        let draggingInitiated: boolean = false;
        let cursorOffset: Vector2 = { x: 0, y: 0 };
        let absoluteCursorOffset: Vector2 = { x: 0, y: 0 };
        let clonedElement: HTMLLIElement | null = null;
        function getNewTabIndex(): number {
            if (containerRef.current === null || clonedElement === null) return tabManager.openTabs.indexOf(props.tab);
            let index: number = 0;
            const elementRect: DOMRect = clonedElement?.getBoundingClientRect();
            const lastTabY: number =
                Array.from(containerRef.current!.parentElement!.children)
                    .findLast((tab: Element): boolean => !tab.hasAttribute("data-immovable"))
                    ?.getBoundingClientRect().top ?? 0;
            for (const tab of containerRef.current!.parentElement!.children) {
                if (tab.hasAttribute("data-immovable")) continue;
                const rect: DOMRect = tab.getBoundingClientRect();
                if (rect.left + rect.width / 2 < elementRect.left) index++;
                else if (rect.top < lastTabY && rect.top + rect.height <= elementRect.top) index++;
                else break;
            }
            return index;
        }
        function onMouseUp(event: MouseEvent): void {
            dragging = false;
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("mousemove", onMouseMove);
            if (containerRef.current === null) return;
            if (draggingInitiated) {
                event.preventDefault();
                event.stopPropagation();
                draggingInitiated = false;
                document.documentElement.style.pointerEvents = "";
                document.documentElement.style.cursor = "";
            }
            if (clonedElement) {
                let newTabIndex: number = getNewTabIndex();
                if (newTabIndex > tabManager.openTabs.indexOf(props.tab)) newTabIndex--;
                if (newTabIndex !== tabManager.openTabs.indexOf(props.tab)) {
                    tabManager.moveTab(props.tab, newTabIndex);
                }
                // UNDONE: Removed the transition of the dragged tab.
                clonedElement.remove();
                clonedElement = null;
                // clonedElement.style.transition = "top 0.2s ease-out, left 0.2s ease-out";
                // const x: number = containerRef.current.offsetLeft;
                // const y: number = containerRef.current.offsetTop;
                // clonedElement.style.left = `${x}px`;
                // clonedElement.style.top = `${y}px`;
                // setTimeout((): void => {
                //     if (!containerRef.current || !clonedElement) return;
                //     clonedElement.remove();
                //     clonedElement = null;
                //     // containerRef.current.style.opacity = "";
                // }, 200);
            }
            $(containerRef.current.parentElement!)
                .find<HTMLLIElement>(".left-highlight, .right-highlight")
                .removeClass("left-highlight")
                .removeClass("right-highlight");
            return;
        }
        function onMouseMove(event: MouseEvent): void {
            if (!containerRef.current || !dragging) {
                dragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                return;
            }
            if (!draggingInitiated && Math.abs(event.clientX - absoluteCursorOffset.x) ** 2 + Math.abs(event.clientY - absoluteCursorOffset.y) ** 2 > 100) {
                draggingInitiated = true;
                clonedElement = containerRef.current.cloneNode(true) as HTMLLIElement;
                clonedElement.style.transition = "none";
                clonedElement.style.position = "absolute";
                clonedElement.style.zIndex = "100";
                clonedElement.style.opacity = "0.5";
                clonedElement.setAttribute("inert", "true");
                containerRef.current.parentElement?.appendChild(clonedElement);
                // containerRef.current.style.opacity = "0";
                document.documentElement.style.pointerEvents = "none";
                document.documentElement.style.cursor = "grabbing";
            } else if (!draggingInitiated) {
                return;
            } else if (!clonedElement) return;
            event.preventDefault();
            event.stopPropagation();
            const x: number = event.clientX - cursorOffset.x;
            const y: number = event.clientY - cursorOffset.y;
            clonedElement.style.left = `${x}px`;
            clonedElement.style.top = `${y}px`;
            const newTabIndex: number = getNewTabIndex();
            if (
                !containerRef.current.parentElement!.children[newTabIndex] ||
                containerRef.current.parentElement!.children[newTabIndex]?.hasAttribute("data-immovable") ||
                (containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement).style?.opacity === "0" ||
                (containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement).inert
            ) {
                const elem: HTMLLIElement = containerRef.current.parentElement!.children[newTabIndex - 1] as HTMLLIElement;
                if (!elem) return;
                elem.classList.add("right-highlight");
                $(containerRef.current.parentElement!).find<HTMLLIElement>(".left-highlight").removeClass("left-highlight");
                $(containerRef.current.parentElement!)
                    .find<HTMLLIElement>(".right-highlight")
                    .filter((_index: number, element: HTMLLIElement): boolean => element !== elem)
                    .removeClass("right-highlight");
            } else {
                const elem: HTMLLIElement = containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement;
                elem.classList.add("left-highlight");
                $(containerRef.current.parentElement!).find<HTMLLIElement>(".right-highlight").removeClass("right-highlight");
                $(containerRef.current.parentElement!)
                    .find<HTMLLIElement>(".left-highlight")
                    .filter((_index: number, element: HTMLLIElement): boolean => element !== elem)
                    .removeClass("left-highlight");
            }
            // console.log(newTabIndex);
        }
        function onModificationStatusChanged(event: TabManagerTabModificationStatusChangedEvent): void {
            if (event.tab === props.tab) {
                if (!unsavedBulletPointRef.current) return;
                unsavedBulletPointRef.current.style.display = event.isModified ? "" : "none";
            }
        }
        useEffect((): (() => void) => {
            props.tab.on("modificationStatusChanged", onModificationStatusChanged);
            return (): void => {
                props.tab.off("modificationStatusChanged", onModificationStatusChanged);
            };
        });
        const [tabContextMenu_isOpen, tabContextMenu_setOpen] = useState(false);
        const [tabContextMenu_anchorPoint, tabContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        function onTabRightClick(event: JSX.TargetedMouseEvent<HTMLLIElement>): void {
            event.preventDefault();
            event.stopPropagation();
            const clickPosition: { x: number; y: number } = {
                x: event.clientX,
                y: event.clientY,
            };
            // console.log(clickPosition);

            tabContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
            tabContextMenu_setOpen(true);
        }
        async function onTabMiddleClick(event: TargetedMouseEvent<HTMLLIElement>): Promise<void> {
            if (props.tab.isModified()) {
                if (event.shiftKey) {
                    if (event.ctrlKey) await props.tab.save();
                    await props.tab.close();
                    return;
                }
                const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                    type: "warning",
                    title: "Unsaved Changes",
                    message: `Do you want to save the changes you made to ${props.tab.name}?`,
                    detail: "Your changes will be lost if you don't save them.",
                    buttons: ["Save", "Don't Save", "Cancel"],
                    noLink: true,
                    defaultId: 0,
                    cancelId: 2,
                });
                switch (result.response) {
                    case 0:
                        await props.tab.save();
                        await props.tab.close();
                        break;
                    case 1:
                        await props.tab.close();
                        break;
                    case 2:
                        break;
                }
            } else {
                props.tab.close();
            }
        }
        return (
            <li
                class={props.tab === tabManager.selectedTab ? "active" : ""}
                onClick={(event: TargetedMouseEvent<HTMLLIElement>): void => {
                    // Treat Alt+Click as a middle click.
                    if (!event.altKey) return;
                    onTabMiddleClick(event);
                }}
                onAuxClick={(event: TargetedMouseEvent<HTMLLIElement>): void => {
                    if (event.button !== 1) return;
                    onTabMiddleClick(event);
                }}
                onContextMenu={(event: TargetedMouseEvent<HTMLLIElement>): void => void onTabRightClick(event)}
                ref={containerRef}
            >
                <ControlledMenu
                    anchorPoint={tabContextMenu_anchorPoint}
                    state={tabContextMenu_isOpen ? "open" : "closed"}
                    direction="right"
                    onClose={(): void => void tabContextMenu_setOpen(false)}
                >
                    <MenuItem
                        onClick={async (): Promise<void> => {
                            if (props.tab.isModified()) {
                                const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                    type: "warning",
                                    title: "Unsaved Changes",
                                    message: `${props.tab.name} has unsaved changes.`,
                                    detail: "Your changes will be lost if you don't save them first.",
                                    buttons: ["Proceed", "Cancel"],
                                    noLink: true,
                                    defaultId: 0,
                                    cancelId: 1,
                                });
                                if (result.response === 1) return;
                            }
                            // TODO: Add a proper reload feature where it keeps the tab open but just reloads the data.
                            const data: Parameters<typeof tabManager.openTab>[0] = {
                                icon: props.tab.icon,
                                name: props.tab.name,
                                path: props.tab.path,
                                type: props.tab.type,
                                mode: props.tab.mode,
                            };
                            const tabIndex: number = props.tab.index;
                            await props.tab.close();
                            const newTab: TabManagerTab = tabManager.openTab(data);
                            if (tabIndex !== -1) tabManager.moveTab(newTab, tabIndex);
                        }}
                    >
                        Reload Tab
                    </MenuItem>
                    <MenuDivider />
                    {props.tab.isModified() ?
                        <>
                            <MenuItem
                                title="Save Tab (Alt to save in unsafe mode)"
                                onClick={async (event: ClickEvent): Promise<void> => {
                                    await props.tab.save(false, event.syntheticEvent.altKey);
                                }}
                            >
                                Save Tab
                            </MenuItem>
                            <MenuItem
                                title="Save & Close Tab (Alt to save in unsafe mode)"
                                onClick={async (event: ClickEvent): Promise<void> => {
                                    await props.tab.save(false, event.syntheticEvent.altKey);
                                    props.tab.close();
                                }}
                            >
                                Save & Close Tab
                            </MenuItem>
                            <MenuItem
                                onClick={(): void => {
                                    props.tab.close();
                                }}
                            >
                                Close Tab Without Saving
                            </MenuItem>
                        </>
                    :   <MenuItem
                            onClick={(): void => {
                                props.tab.close();
                            }}
                        >
                            Close Tab
                        </MenuItem>
                    }
                    <MenuItem
                        title="Save & Close Others (Alt to save in unsafe mode)"
                        onClick={(event: ClickEvent): void => {
                            tabManager.openTabs.forEach(async (tab: TabManagerTab): Promise<void> => {
                                if (tab !== props.tab) {
                                    await tab.save(false, event.syntheticEvent.altKey);
                                    tab.close();
                                }
                            });
                        }}
                        disabled={tabManager.openTabs.length < 2}
                    >
                        Save & Close Others
                    </MenuItem>
                    <MenuItem
                        onClick={(): void => {
                            tabManager.openTabs.forEach((tab: TabManagerTab): void => {
                                if (tab !== props.tab) tab.close();
                            });
                        }}
                        disabled={tabManager.openTabs.length < 2}
                    >
                        Close Others
                    </MenuItem>
                    <MenuDivider />
                    {props.tab.type === "world" || props.tab.type === "leveldb" ?
                        <MenuItem
                            onClick={(): void => {
                                shell.openPath(props.tab.path);
                            }}
                        >
                            Open Folder in{" "}
                            {process.platform === "win32" ?
                                "File Explorer"
                            : process.platform === "darwin" ?
                                "Finder"
                            :   "File Manager"}
                        </MenuItem>
                    :   <MenuItem
                            onClick={(): void => {
                                shell.showItemInFolder(props.tab.path);
                            }}
                        >
                            Reveal in{" "}
                            {process.platform === "win32" ?
                                "File Explorer"
                            : process.platform === "darwin" ?
                                "Finder"
                            :   "File Manager"}
                        </MenuItem>
                    }
                    {props.tab.type === "world" &&
                        (config.parsedMinecraftDataFolders.some((folder: string): boolean =>
                            props.tab.path.replaceAll("\\", "/").startsWith(folder.replaceAll("\\", "/").replace(/(?<!\/)$/, "/"))
                        ) ||
                            props.tab.isFavorited) && (
                            <>
                                <MenuDivider />
                                {props.tab.isFavorited ?
                                    <MenuItem
                                        onClick={(): void => {
                                            props.tab.isFavorited = false;
                                        }}
                                    >
                                        Unfavorite
                                    </MenuItem>
                                :   <MenuItem
                                        onClick={(): void => {
                                            props.tab.isFavorited = true;
                                        }}
                                    >
                                        Favorite
                                    </MenuItem>
                                }
                            </>
                        )}
                </ControlledMenu>
                <a
                    title={props.tab.name}
                    onMouseDown={(event): void => {
                        if (!containerRef.current || event.currentTarget.querySelector(".closebtn")?.contains(event.target as Node)) return;
                        dragging = true;
                        cursorOffset = { x: event.offsetX, y: event.offsetY };
                        absoluteCursorOffset = { x: event.clientX, y: event.clientY };
                        document.addEventListener("mousemove", onMouseMove);
                        document.addEventListener("mouseup", onMouseUp);
                    }}
                    onClick={(): void => void (!draggingInitiated && tabManager.switchTab(props.tab))}
                >
                    <div>
                        <img
                            aria-hidden="true"
                            src={
                                props.tab.icon ?
                                    checkIsURIOrPath(props.tab.icon) === "URI" ?
                                        props.tab.icon
                                    :   `data:${mime.lookup(props.tab.icon)};base64,${readFileSync(props.tab.icon, "base64")}`
                                : props.tab.type === "world" ?
                                    "resource://images/ui/misc/CreateNewWorld.png"
                                :   undefined
                            }
                            style="max-width: 16px; max-height: 16px; margin-right: 0.5em;"
                        />
                    </div>
                    {props.tab.name.length > 40 ?
                        props.tab.name.slice(0, 30 - Math.min(10, Math.max(0, props.tab.name.length - 45))) +
                        "..." +
                        props.tab.name.slice(30 + Math.max(0, props.tab.name.length - 40))
                    :   props.tab.name}
                    {props.tab.readonly && (
                        <img
                            title="Read-only"
                            src="resource://images/ui/glyphs/Lock-Locked.png"
                            style="margin-left: 0.5em; width: 18px; height: 18px; vertical-align: middle;"
                        />
                    )}
                    <div
                        title="Modified"
                        style={{
                            display: props.tab.isModified() ? undefined : "none",
                            marginLeft: "0.25em",
                            marginRight: "-0.125em",
                            fontSize: "2em",
                            lineHeight: "0.5em",
                        }}
                        ref={unsavedBulletPointRef}
                    >
                        •
                    </div>
                    <img
                        title="Close (Shift to Close Without Saving, Ctrl+Shift to Save & Close)"
                        src="resource://images/ui/glyphs/Close.png"
                        style="margin-left: 0.5em; width: 10px; height: 10px; vertical-align: middle;"
                        class="closebtn piximg"
                        onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                            event.stopPropagation();
                            if (props.tab.isModified()) {
                                if (event.shiftKey) {
                                    if (event.ctrlKey) await props.tab.save();
                                    await props.tab.close();
                                    return;
                                }
                                const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                    type: "warning",
                                    title: "Unsaved Changes",
                                    message: `Do you want to save the changes you made to ${props.tab.name}?`,
                                    detail: "Your changes will be lost if you don't save them.",
                                    buttons: ["Save", "Don't Save", "Cancel"],
                                    noLink: true,
                                    defaultId: 0,
                                    cancelId: 2,
                                });
                                switch (result.response) {
                                    case 0:
                                        await props.tab.save();
                                        await props.tab.close();
                                        break;
                                    case 1:
                                        await props.tab.close();
                                        break;
                                    case 2:
                                        break;
                                }
                            } else {
                                props.tab.close();
                            }
                        }}
                    />
                </a>
            </li>
        );
    }
    function RenderTabs(): JSX.Element {
        return (
            <>
                {...tabManager.openTabs.map((tab: TabManagerTab): JSX.SpecificElement<"li"> => <Tab tab={tab} />)}
                <li style="float: right;" data-immovable>
                    <a
                        style="padding: 10px;"
                        onClick={(): void => {
                            $("#add-tab-popup-menu").css("left", window.innerWidth - 200);
                            $("#add-tab-popup-menu").css("top", 44);
                            $("#add-tab-popup-menu").toggle();
                        }}
                    >
                        <img aria-hidden="true" class="piximg" src="resource://images/ui/glyphs/icon-plus.png" />
                    </a>
                </li>
            </>
        );
    }
    return (
        <>
            <ul class="horizontal-nav full-sized-nav tab-bar" id="tab-bar" style="overflow-x: auto; overflow-y: visible; flex-shrink: 0;" ref={tabContainerRef}>
                <RenderTabs />
            </ul>
            <div
                id="add-tab-popup-menu"
                style="display: none; background-color: #13383f; color: white; width: 200px; position: fixed; z-index: 1000;"
                ref={popupRef}
            >
                <div style="display: flex; flex-direction: column; height: 100%; width: 200px;">
                    {popupTabs.map(
                        (tab: PopupTab): JSX.SpecificElement<"div"> => (
                            <div
                                class="sidebar_button nsel"
                                // onMouseDown={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                //     if (event.currentTarget.hasAttribute("disabled")) return;
                                //     SoundEffects.popB();
                                // }}
                                onClick={tab.onClick}
                            >
                                <div style="display: inline-block; vertical-align: middle; width: 36px; height: 36px;">
                                    <img
                                        aria-hidden="true"
                                        src={tab.icon}
                                        class="nsel ndrg"
                                        style={`display: inline-block; vertical-align: middle; width: auto; height: ${36 - (36 % tab.resolution)}px; margin: ${
                                            (36 % tab.resolution) / 2
                                        }px 0;`}
                                    />
                                </div>
                                {tab.name}
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
}
