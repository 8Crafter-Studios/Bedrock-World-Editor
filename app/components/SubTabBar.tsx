import { type JSX, type RefObject, type TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import { checkIsURIOrPath } from "../../src/utils/pathUtils";
const mime = require("mime-types") as typeof import("mime-types");
import { readFileSync, writeFileSync } from "node:fs";
import { entryContentTypeToFormatMap, prettyPrintSNBT, prismarineToSNBT, type EntryContentTypeFormatData, type Vector2 } from "mcbe-leveldb";
import { ControlledMenu, MenuDivider, MenuItem, SubMenu, type SubMenuProps } from "@szhsin/react-menu";
import { app, dialog } from "@electron/remote";
import type { MessageBoxReturnValue, SaveDialogReturnValue } from "electron";
import path from "node:path";

export interface SubTabBarProps {
    tab: TabManagerTab;
}

export default function SubTabBar(props: SubTabBarProps): JSX.Element {
    const tab = props.tab;
    const tabContainerRef: RefObject<HTMLUListElement> = useRef(null);
    const popupRef: RefObject<HTMLDivElement> = useRef(null);
    let triggerUpdate: (() => void) | null = null;
    useEffect((): (() => void) => {
        function update(): void {
            if (!tab.isValid) return;
            if (tabContainerRef.current === null) return;
            const element: HTMLUListElement = document.createElement("ul");
            render(<RenderTabs />, element);
            render(null, tabContainerRef.current);
            tabContainerRef.current.replaceChildren(...element.children);
        }
        triggerUpdate = update;
        function hideAddTabPopup(event: MouseEvent): void {
            if (popupRef.current === null || popupRef.current.contains(event.target as Node)) return;
            $("#add-tab-popup-menu").hide();
        }
        tab.on("openTab", update);
        tab.on("closeTab", update);
        tab.on("switchTab", update);
        tab.on("reorderTabs", update);
        window.addEventListener("mousedown", hideAddTabPopup);
        return (): void => {
            tab.off("openTab", update);
            tab.off("closeTab", update);
            tab.off("switchTab", update);
            tab.off("reorderTabs", update);
            window.removeEventListener("mousedown", hideAddTabPopup);
        };
    }, []);
    interface PopupTab {
        icon: string;
        name: string;
        resolution: number;
        onClick?(event: JSX.TargetedMouseEvent<HTMLDivElement>): void;
    }
    const popupTabs: PopupTab[] = (
        [
            {
                icon: "resource://images/ui/glyphs/world_glyph_color.png",
                name: "World",
                resolution: 17,
                onClick(event) {
                    tab.switchTab(null);
                },
            },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "NBT File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "JSON File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "Raw File", resolution: 12 },
        ] as const satisfies (PopupTab | false | undefined)[]
    ).filter((tab: PopupTab | false | undefined): tab is PopupTab => !!tab) as PopupTab[];
    interface TabProps {
        tab: TabManagerSubTab;
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
            if (containerRef.current === null || clonedElement === null) return tab.openTabs.indexOf(props.tab);
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
                if (newTabIndex > tab.openTabs.indexOf(props.tab)) newTabIndex--;
                if (newTabIndex !== tab.openTabs.indexOf(props.tab)) {
                    tab.moveTab(props.tab, newTabIndex);
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
        function onModificationStatusChanged(event: TabManagerSubTabModificationStatusChangedEvent): void {
            if (event.tab === props.tab) {
                if (!unsavedBulletPointRef.current) return;
                unsavedBulletPointRef.current.style.display = event.isModified ? "" : "none";
            }
        }
        useEffect((): (() => void) => {
            props.tab.parentTab.on("subTabModificationStatusChanged", onModificationStatusChanged);
            return (): void => {
                props.tab.parentTab.off("subTabModificationStatusChanged", onModificationStatusChanged);
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
                    detail: "Your changes will be lost if you don't save them first.",
                    buttons: ["Save", "Don't Save", "Cancel"],
                    noLink: true,
                    defaultId: 0,
                    cancelId: 2,
                });
                switch (result.response) {
                    case 0:
                        await props.tab.save();
                        break;
                    case 2:
                        return;
                }
            }
            props.tab.close();
        }
        const tabContentsFormat: EntryContentTypeFormatData = entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData;
        let tabDataStorageObject: DataStorageObject | undefined = props.tab.currentState.options.dataStorageObject;
        return (
            <>
                <li
                    class={props.tab === tab.selectedTab ? "active" : ""}
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
                        {/* IDEA: Add a Delete Tab/File option. */}
                        {/* IEDA: Add a Copy File Path option to file entries. Maybe with an additional submenu to change the format of the copied path, like whether it is quoted and what type of quotes. */}
                        {/* IEDA: Add a Reveal in File Exporer/Finder/File Manager option to file entries. */}
                        {/* IDEA: Add a Copy LevelDB Key As... option. The submenu options should have different formats to copy it as, such as: human readable, hex, base64, binary, etc. */}
                        {props.tab.isModified() ?
                            <>
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        await props.tab.save();
                                    }}
                                >
                                    Save Tab
                                </MenuItem>
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        await props.tab.save();
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
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        props.tab.currentState.scrollTop = 0;
                                        delete props.tab.currentState.options.dataStorageObject;
                                        props.tab.activeChanges = [];
                                        props.tab.hasUnsavedChanges = false;
                                        await props.tab.loadData();
                                        if (props.tab.parentTab.selectedTab !== props.tab) return;
                                        props.tab.parentTab.emit("reloadCurrentSubTab");
                                    }}
                                >
                                    Reset Tab
                                </MenuItem>
                            </>
                        :   <>
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        props.tab.currentState.scrollTop = 0;
                                        delete props.tab.currentState.options.dataStorageObject;
                                        props.tab.activeChanges = [];
                                        props.tab.hasUnsavedChanges = false;
                                        await props.tab.loadData();
                                        if (props.tab.parentTab.selectedTab !== props.tab) return;
                                        props.tab.parentTab.emit("reloadCurrentSubTab");
                                    }}
                                >
                                    Reload Tab
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        props.tab.close();
                                    }}
                                >
                                    Close Tab
                                </MenuItem>
                            </>
                        }
                        <MenuDivider />
                        <SubMenu label="Export As...">
                            <MenuItem
                                onClick={async (): Promise<void> => {
                                    tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                    const supportsNBTBinary: boolean =
                                        !!tabDataStorageObject && (tabDataStorageObject.dataType === "NBT" || tabDataStorageObject.dataType === "NBTCompound");
                                    const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                        buttonLabel: "Export",
                                        defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.${supportsNBTBinary ? "dat" : "bin"}`),
                                        properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                        title: "Export Binary",
                                        message: "Select a location to export the data to.",
                                        filters: [
                                            ...(supportsNBTBinary ? [{ name: "NBT Binary", extensions: ["dat"] }] : []),
                                            { name: "Binary", extensions: ["bin"] },
                                        ],
                                    });
                                    if (saveResult.canceled) return;
                                    writeFileSync(saveResult.filePath, await props.tab.exportRawData(true));
                                }}
                            >
                                Binary
                            </MenuItem>
                            {tabDataStorageObject && (tabDataStorageObject.dataType === "NBT" || tabDataStorageObject.dataType === "NBTCompound") && (
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                        if (!tabDataStorageObject) {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "No Data",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as Prismarine-NBT JSON.`,
                                                detail: "There is no loaded data to export.",
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        if (tabDataStorageObject.dataType !== "NBT" && tabDataStorageObject.dataType !== "NBTCompound") {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "Invalid Data Type",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as Prismarine-NBT JSON.`,
                                                detail: `The data type of the loaded data is not supported for this export type: "${tabDataStorageObject.dataType}".`,
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                            buttonLabel: "Export",
                                            defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.json`),
                                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                            title: "Export Prismarine-NBT JSON",
                                            message: "Select a location to export the data to.",
                                            filters: [{ name: "JSON", extensions: ["json", "jsonc"] }],
                                        });
                                        if (saveResult.canceled) return;
                                        switch (tabDataStorageObject.dataType) {
                                            case "NBT":
                                                writeFileSync(saveResult.filePath, JSON.stringify(tabDataStorageObject.data.parsed, null, 0));
                                                break;
                                            case "NBTCompound":
                                                writeFileSync(saveResult.filePath, JSON.stringify(tabDataStorageObject.data, null, 0));
                                                break;
                                        }
                                    }}
                                >
                                    Prismarine-NBT JSON
                                </MenuItem>
                            )}
                            {tabDataStorageObject && tabDataStorageObject.dataType === "NBT" && (
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                        if (!tabDataStorageObject) {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "No Data",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as Prismarine-NBT JSON (+Metadata).`,
                                                detail: "There is no loaded data to export.",
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        if (tabDataStorageObject.dataType !== "NBT") {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "Invalid Data Type",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as Prismarine-NBT JSON (+Metadata).`,
                                                detail: `The data type of the loaded data is not supported for this export type: "${tabDataStorageObject.dataType}".`,
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                            buttonLabel: "Export",
                                            defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.json`),
                                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                            title: "Export Prismarine-NBT JSON (+Metadata)",
                                            message: "Select a location to export the data to.",
                                            filters: [{ name: "JSON", extensions: ["json", "jsonc"] }],
                                        });
                                        if (saveResult.canceled) return;
                                        switch (tabDataStorageObject.dataType) {
                                            case "NBT":
                                                writeFileSync(saveResult.filePath, JSON.stringify(tabDataStorageObject.data, null, 0));
                                                break;
                                        }
                                    }}
                                >
                                    Prismarine-NBT JSON (+Metadata)
                                </MenuItem>
                            )}
                            {tabDataStorageObject && (tabDataStorageObject.dataType === "NBT" || tabDataStorageObject.dataType === "NBTCompound") && (
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                        if (!tabDataStorageObject) {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "No Data",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as SNBT.`,
                                                detail: "There is no loaded data to export.",
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        if (tabDataStorageObject.dataType !== "NBT" && tabDataStorageObject.dataType !== "NBTCompound") {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "Invalid Data Type",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as SNBT.`,
                                                detail: `The data type of the loaded data is not supported for this export type: "${tabDataStorageObject.dataType}".`,
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                            buttonLabel: "Export",
                                            defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.snbt`),
                                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                            title: "Export SNBT",
                                            message: "Select a location to export the data to.",
                                            filters: [{ name: "SNBT", extensions: ["snbt"] }],
                                        });
                                        if (saveResult.canceled) return;
                                        switch (tabDataStorageObject.dataType) {
                                            case "NBT":
                                                writeFileSync(
                                                    saveResult.filePath,
                                                    prettyPrintSNBT(prismarineToSNBT(tabDataStorageObject.data.parsed), { indent: 4 })
                                                );
                                                break;
                                            case "NBTCompound":
                                                writeFileSync(saveResult.filePath, prettyPrintSNBT(prismarineToSNBT(tabDataStorageObject.data), { indent: 4 }));
                                                break;
                                        }
                                    }}
                                >
                                    SNBT
                                </MenuItem>
                            )}
                            {tabDataStorageObject && tabDataStorageObject.dataType === "JSON" && (
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                        if (!tabDataStorageObject) {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "No Data",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as JSON.`,
                                                detail: "There is no loaded data to export.",
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        if (tabDataStorageObject.dataType !== "JSON") {
                                            dialog.showMessageBoxSync({
                                                type: "error",
                                                title: "Invalid Data Type",
                                                message: `Unable to export the data of the sub-tab "${props.tab.name}" as JSON.`,
                                                detail: `The data type of the loaded data is not supported for this export type: "${tabDataStorageObject.dataType}".`,
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                        const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                            buttonLabel: "Export",
                                            defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.json`),
                                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                            title: "Export JSON",
                                            message: "Select a location to export the data to.",
                                            filters: [{ name: "JSON", extensions: ["json", "jsonc"] }],
                                        });
                                        if (saveResult.canceled) return;
                                        switch (tabDataStorageObject.dataType) {
                                            case "JSON":
                                                writeFileSync(saveResult.filePath, JSON.stringify(tabDataStorageObject.data.parsed, null, 0));
                                                break;
                                        }
                                    }}
                                >
                                    JSON
                                </MenuItem>
                            )}
                            {tabDataStorageObject &&
                                (tabDataStorageObject.dataType === "ASCII" ||
                                    tabDataStorageObject.dataType === "UTF-8" ||
                                    tabDataStorageObject.dataType === "binaryPlainText" ||
                                    tabDataStorageObject.dataType === "hex") && (
                                    <MenuItem
                                        onClick={async (): Promise<void> => {
                                            tabDataStorageObject = props.tab.currentState.options.dataStorageObject;
                                            if (!tabDataStorageObject) {
                                                dialog.showMessageBoxSync({
                                                    type: "error",
                                                    title: "No Data",
                                                    message: `Unable to export the data of the sub-tab "${props.tab.name}" as plain text.`,
                                                    detail: "There is no loaded data to export.",
                                                    buttons: ["OK"],
                                                    noLink: true,
                                                });
                                                return;
                                            }
                                            if (
                                                tabDataStorageObject.dataType !== "ASCII" &&
                                                tabDataStorageObject.dataType !== "UTF-8" &&
                                                tabDataStorageObject.dataType !== "binaryPlainText" &&
                                                tabDataStorageObject.dataType !== "hex"
                                            ) {
                                                dialog.showMessageBoxSync({
                                                    type: "error",
                                                    title: "Invalid Data Type",
                                                    message: `Unable to export the data of the sub-tab "${props.tab.name}" as plain text.`,
                                                    detail: `The data type of the loaded data is not supported for this export type: "${tabDataStorageObject.dataType}".`,
                                                    buttons: ["OK"],
                                                    noLink: true,
                                                });
                                                return;
                                            }
                                            const saveResult: SaveDialogReturnValue = await dialog.showSaveDialog({
                                                buttonLabel: "Export",
                                                defaultPath: path.join(app.getPath("downloads"), `${props.tab.name}.txt`),
                                                properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                                                title: "Export Plain Text",
                                                message: "Select a location to export the data to.",
                                                filters: [{ name: "Plain Text", extensions: ["txt"] }],
                                            });
                                            if (saveResult.canceled) return;
                                            switch (tabDataStorageObject.dataType) {
                                                case "ASCII":
                                                case "UTF-8":
                                                case "binaryPlainText":
                                                case "hex":
                                                    writeFileSync(saveResult.filePath, tabDataStorageObject.data);
                                                    break;
                                            }
                                        }}
                                    >
                                        Plain Text
                                    </MenuItem>
                                )}
                        </SubMenu>
                        <MenuDivider />
                        {props.tab.isPinned ?
                            <MenuItem
                                onClick={(): void => {
                                    props.tab.isPinned = false;
                                    triggerUpdate?.();
                                }}
                            >
                                Unpin Tab
                            </MenuItem>
                        :   <MenuItem
                                onClick={(): void => {
                                    props.tab.isPinned = true;
                                    triggerUpdate?.();
                                }}
                            >
                                Pin Tab
                            </MenuItem>
                        }
                    </ControlledMenu>
                    <a
                        title={props.tab.name}
                        onMouseDown={(event: JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
                            if (
                                !containerRef.current ||
                                event.currentTarget.querySelector(".closebtn")?.contains(event.target as Node) ||
                                event.currentTarget.querySelector(".unpinbtn")?.contains(event.target as Node)
                            )
                                return;
                            dragging = true;
                            cursorOffset = { x: event.offsetX, y: event.offsetY };
                            absoluteCursorOffset = { x: event.clientX, y: event.clientY };
                            document.addEventListener("mousemove", onMouseMove);
                            document.addEventListener("mouseup", onMouseUp);
                        }}
                        onClick={(): void => void (!draggingInitiated && tab.switchTab(props.tab))}
                    >
                        {props.tab.icon && (
                            <div>
                                <img
                                    aria-hidden="true"
                                    // Aside from pixelated, -webkit-optimize-contrast is also another interesting image-rendering option.
                                    class="piximg"
                                    src={
                                        checkIsURIOrPath(props.tab.icon) === "URI" ?
                                            props.tab.icon
                                        :   `data:${mime.lookup(props.tab.icon)};base64,${readFileSync(props.tab.icon, "base64")}`
                                    }
                                    style="max-width: 16px; max-height: 16px; margin-right: 0.5em;"
                                />
                            </div>
                        )}
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
                        {props.tab.isPinned ?
                            <img
                                title="Unpin"
                                src="resource://images/ui/glyphs/Pin.png"
                                style="margin-left: 0.5em; width: 18px; height: 18px; vertical-align: middle;"
                                class="unpinbtn"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                                    event.stopPropagation();
                                    props.tab.isPinned = false;
                                    triggerUpdate?.();
                                }}
                            />
                        :   <img
                                title="Save & Close (Shift to Close Without Saving)"
                                src="resource://images/ui/glyphs/Close.png"
                                style="margin-left: 0.5em; width: 10px; height: 10px; vertical-align: middle;"
                                class="closebtn piximg"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                                    event.stopPropagation();
                                    if (!event.shiftKey && props.tab.isModified()) await props.tab.save();
                                    props.tab.close();
                                }}
                            />
                        }
                    </a>
                </li>
            </>
        );
    }
    function RenderTabs(): JSX.Element {
        // TODO: On smaller screen sizes there should instead be a "Show Sub-Tabs" button that will open a full screen list of tabs.
        return <>{...tab.openTabs.map((tab: TabManagerSubTab): JSX.SpecificElement<"li"> => <Tab tab={tab} />)}</>;
    }
    return (
        <>
            <ul
                class="horizontal-nav full-sized-nav tab-bar sub-tab-bar"
                id="sub-tab-bar"
                style="overflow-x: auto; overflow-y: visible; flex-shrink: 0;"
                ref={tabContainerRef}
            >
                <RenderTabs />
            </ul>
        </>
    );
}
