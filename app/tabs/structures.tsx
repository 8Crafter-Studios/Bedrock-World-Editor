import type { JSX, RefObject } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import {
    DBEntryContentTypes,
    dimensions,
    entryContentTypeToFormatMap,
    gameModes,
    getKeyDisplayName,
    getKeysOfType,
    NBTSchemas,
    prettyPrintSNBT,
    prismarineToSNBT,
    toLong,
    type DBEntryContentType,
    type Vector3,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { existsSync, type Dirent } from "node:fs";
import path from "node:path";
import { testForObjectExtension } from "../../src/utils/miscUtils";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import type { SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import SearchSyntaxHelpMenu from "../components/SearchSyntaxHelpMenu";
import { viewFilesTabSearchSyntax } from "./viewFiles";
import EditorWidgetOverlayBar from "../components/EditorWidgetOverlayBar";
import { dialog } from "@electron/remote";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirRecursiveSafe } from "../../src/utils/folderContentsUtils";
import type { ShowSelectOpenTabDialogResult } from "../components/SelectOpenTabDialog";
import showSelectOpenTabDialog from "../components/SelectOpenTabDialog";

export interface StructuresTabProps {
    tab: TabManagerTab;
}

const structuresTabSearchSyntax: SearchSyntaxHelpInfo = {
    bodyText: (
        <>
            <p>
                Plain text without a filter will be used to search the human-readable LevelDB key (the one displayed in the DB Key column) and non-NBT file
                contents (to search all file contents, use the <code>contents</code>, and to search just the human-readable LevelDB keys, use the{" "}
                <code>dbkey</code> filter).
            </p>
            <p>
                Prefixing text with one of the prefix operators (listed below) will cause it to have that operator applied to it. If you need to have a prefix
                operator outisde of a filter at the beginning of a word or as the first character inside of quotes, you can prefix that with the <code>|</code>{" "}
                operator, as that is the "Any Of" operator, which is the default behavior, and that <code>|</code> will be removed when performing the search.
            </p>
            <p>
                To search for text that includes a colon (":"), space (" "), double quote, or single quote, you can put it inside of quotes (double or single).
                If you are putting quotes inside quotes, make sure to either use a different kind of quote from the one inside the quotes, or escape the quote
                with a backslash ("\").
            </p>
        </>
    ),
    prefixOperators: {
        "|": {
            description:
                "Any Of - Anything without a prefix operator will be added to the Any Of filter. Which means one or more of the filters of that type must match.",
        },
        "-": {
            description: "None Of - None of the filters of that type must match.",
        },
        "^": {
            description: "One Of - Exactly one of the filters of that type must match.",
        },
        "&": {
            description: "All Of - All of the filters of that type must match.",
        },
    },
    filters: {
        dbkey: {
            description: "Searches the human-readable LevelDB key (the one displayed in the DB Key column) for the text.",
        },
        // TO-DO
        contents: {
            description: "Searches the LevelDB entry value as SNBT.",
        },
        nbt: viewFilesTabSearchSyntax.filters.nbt!,
    },
};

export default function StructuresTab(props: StructuresTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The structures sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    getStructuresTabContents(props.tab).then(
        (element: JSX.Element): void => {
            if (!containerRef.current) return;
            render(null, containerRef.current);
            render(element, containerRef.current);
        },
        (reason: any): void => {
            if (containerRef.current) {
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent =
                    reason instanceof Error ? (reason.stack?.startsWith(reason.toString()) ? reason.stack : reason.toString() + reason.stack) : reason;
                render(null, containerRef.current);
                containerRef.current.replaceChildren("Failed to load data:", errorElement);
            }
            console.error(reason);
        }
    );
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;" ref={containerRef}>
            <LoadingScreenContents />
        </div>
    );
}

interface KeyData {
    rawKey: Buffer;
    displayKey: string;
    data: { parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.StructureTemplate; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

async function getStructuresTabContents(tab: TabManagerTab): Promise<JSX.Element> {
    if (!tab.db) return <div>The structures sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    tab.db.isOpen() || (await tab.awaitDBOpen!);
    tab.cachedDBKeys || (await tab.awaitCachedDBKeys);
    const rawKeys: Buffer[] = tab.cachedDBKeys!.StructureTemplate;
    let keys: KeyData[] = await Promise.all(
        rawKeys.map(
            async (key: Buffer): Promise<KeyData> => ({
                rawKey: key,
                displayKey: getKeyDisplayName(key),
                data: (await NBT.parse((await tab.db!.get(key))!)) as any,
            })
        )
    );
    // globalThis.a = keys;
    let dynamicProperties: NBT.NBT | undefined = await tab
        .db!.get("DynamicProperties")
        .then((data: Buffer | null): Promise<NBT.NBT> | undefined =>
            data ? NBT.parse(data!).then((data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata }): NBT.NBT => data.parsed) : undefined
        )
        .catch((e: any): undefined => (console.error(e), undefined));
    // console.log(dynamicProperties);
    let mode: ConfigConstants.views.Structures.StructuresTabMode = config.views.structures.mode;
    let tablesContents: JSX.Element[][] = await Promise.all(
        ConfigConstants.views.Structures.structuresTabModeToSectionIDs[mode].map(
            (sectionID: (typeof ConfigConstants.views.Structures.structuresTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                getStructuresTabContentsRows({
                    tab,
                    keys,
                    dynamicProperties,
                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Structures.StructuresTabSectionMode,
                })
        )
    );
    function Contents(): JSX.Element {
        const tablesContainerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
        const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
        const searchRefs = {
            searchAreaContainer: useRef<HTMLDivElement>(null),
            searchTextBox: useRef<HTMLInputElement>(null),
            searchTextBoxErrorPopup: useRef<HTMLDivElement>(null),
            searchButton: useRef<HTMLButtonElement>(null),
            helpButton: useRef<HTMLButtonElement>(null),
        };
        const viewOptionsRefs = {
            viewOptionsContainer: useRef<HTMLDivElement>(null),
            viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
        };
        function TablesContents(): JSX.Element {
            return (
                <>
                    {...ConfigConstants.views.Structures.structuresTabModeToSectionIDs[mode].map(
                        (
                            sectionID: (typeof ConfigConstants.views.Structures.structuresTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                                // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                const headerName = ConfigConstants.views.Structures.structuresTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Structures.StructuresTabSectionMode = (
                                    sectionID === null ? mode : `${mode}_${sectionID}`
                                ) as ConfigConstants.views.Structures.StructuresTabSectionMode;
                                return (
                                    <>
                                        {/* TO-DO: Add in this context menu once the bug with it is fixed. https://github.com/szhsin/react-menu/issues/1591 */}
                                        {/* <ControlledMenu
                                            anchorPoint={columnHeadersContextMenu_anchorPoint}
                                            state={columnHeadersContextMenu_isOpen ? "open" : "closed"}
                                            direction="right"
                                            onClose={(): void => void columnHeadersContextMenu_setOpen(false)}
                                        >
                                            <MenuItem>Cut</MenuItem>
                                            <MenuItem>Copy</MenuItem>
                                            <MenuItem>Paste</MenuItem>
                                        </ControlledMenu> */}
                                        <table class="nsel" style="flex: 1; overflow: auto; margin: 5px;">
                                            <thead>
                                                {headerName && (
                                                    <tr>
                                                        <th colSpan={ConfigConstants.views.Structures.structuresTabModeToColumnIDs[sectionMode].length}>
                                                            {headerName}
                                                        </th>
                                                    </tr>
                                                )}
                                                <tr
                                                /* onContextMenu={(event: JSX.TargetedMouseEvent<HTMLTableRowElement>): void => {
                                                        if (typeof document.hasFocus === "function" && !document.hasFocus()) return;

                                                        event.preventDefault();
                                                        columnHeadersContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                        columnHeadersContextMenu_setOpen(true);
                                                    }} */
                                                >
                                                    {...config.views.structures.modeSettings[mode].columns.map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Structures.structuresTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Structures.columnIDToDisplayName[columnID];
                                                            return <th>{typeof displayName === "string" ? displayName : (displayName as any).headerLabel}</th>;
                                                        }
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody ref={bodyRef}>{...tablesContents[index]!.slice(0, 20)}</tbody>
                                            <tfoot>
                                                <tr class="table-footer-row-page-navigation">
                                                    <td colSpan={ConfigConstants.views.Structures.structuresTabModeToColumnIDs[sectionMode].length}>
                                                        <PageNavigation
                                                            totalPages={Math.ceil(tablesContents[index]!.length / 20)}
                                                            onPageChange={(page: number): void => {
                                                                if (!bodyRef.current) return;
                                                                // let tempElement: HTMLDivElement = document.createElement("div");
                                                                render(null, bodyRef.current);
                                                                render(
                                                                    <>{...tablesContents[index]!.slice((page - 1) * 20, page * 20)}</>,
                                                                    bodyRef.current /* tempElement */
                                                                );
                                                                // bodyRef.current.replaceChildren(...tempElement.children);
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                );
                            }
                            return <Test1 />;
                        }
                    )}
                </>
            );
        }
        let query: Omit<TabManagerTab_LevelDBSearchQuery, "searchTargets"> & {
            searchTargets: {
                key: Buffer<ArrayBufferLike>;
                displayKey: string;
                value: {
                    parsed: NBT.NBT;
                    type: NBT.NBTFormat;
                    metadata: NBT.Metadata;
                };
                valueType: {
                    readonly type: "NBT";
                };
                contentType: "StructureTemplate";
                data: KeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: keys.map(
                (key: KeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value: key.data,
                        valueType: entryContentTypeToFormatMap.StructureTemplate,
                        contentType: "StructureTemplate",
                        data: key,
                        searchableContents: [
                            key.displayKey,
                            ((): string => {
                                try {
                                    // return prettyPrintSNBT(prismarineToSNBT(key.data.parsed), { indent: 0 });
                                    // Disable directly searching SNBT.
                                    return "";
                                } catch {
                                    return "";
                                }
                            })(),
                        ],
                        customDataFields: {
                            contents: ((): string => {
                                try {
                                    return prettyPrintSNBT(prismarineToSNBT(key.data.parsed), { indent: 0 });
                                } catch {
                                    return "";
                                }
                            })(),
                        },
                    } as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number])
            ),
        };
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                mode = config.views.structures.mode;
                console.log(query);
                tablesContents = await Promise.all(
                    ConfigConstants.views.Structures.structuresTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Structures.structuresTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                            getStructuresTabContentsRows({
                                tab,
                                keys:
                                    Object.keys(query).length > 1
                                        ? tab
                                              .dbSearch!.serach(query)
                                              .toArray()
                                              .map((key): KeyData => key.originalObject.data)
                                        : keys,
                                dynamicProperties,
                                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Structures.StructuresTabSectionMode,
                            })
                    )
                );
            }
            const tempElement: HTMLDivElement = document.createElement("div");
            render(<TablesContents />, tempElement);
            tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                updateTablesContents(true);
            }
            function onSimpleModeColumnsChanged(): void {
                if (mode !== "simple") return;
                updateTablesContents(false);
            }
            config.on("settingChanged:views.structures.mode", onModeChanged);
            config.on("settingChanged:views.structures.modeSettings.simple.columns", onSimpleModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.structures.mode", onModeChanged);
                config.off("settingChanged:views.structures.modeSettings.simple.columns", onSimpleModeColumnsChanged);
            };
        });
        let lastHideErrorPopupFunction: (() => void) | undefined = undefined;
        return (
            <>
                {/* <div
                    class="widget-overlay-bar widget-overlay-bar-transparent"
                    style="display: flex; flex-direction: row;"
                    ref={viewOptionsRefs.viewOptionsContainer}
                >
                    <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                        <button
                            type="button"
                            class={mode === "simple" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.structures.mode = "simple";
                            }}
                        >
                            Simple
                        </button>
                    </div>
                </div> */}
                <EditorWidgetOverlayBar>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Import Structures"
                            onClick={async (): Promise<void> => {
                                const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                                    title: "Import Structures",
                                    buttonLabel: "Import",
                                    filters: [
                                        { name: "mcstructure", extensions: ["mcstructure"] },
                                        // { name: "Java Structure", extensions: ["nbt", "schem", "schematic"] }, // TO-DO
                                        { name: "All", extensions: ["*"] },
                                    ],
                                    message: "Select the structure files to import.",
                                    properties: ["openFile", "multiSelections", "showHiddenFiles", "treatPackageAsDirectory"],
                                });
                                if (result.canceled) return;
                                let failedImports: [filePath: string, error?: any][] = [];
                                let importPromises: Promise<void>[] = [];
                                for (const filePath of result.filePaths) {
                                    try {
                                        const fileData: Buffer = await readFile(filePath);
                                        const structureData = await NBT.parse(fileData);
                                        if (structureData.type === "little") {
                                            function checkIsBedrock_mcstructure(): boolean {
                                                let structure: NBTSchemas.NBTSchemaTypes.StructureTemplate = structureData.parsed as any;
                                                if (!structure) return false;
                                                if (structure.type !== "compound") return false;
                                                if (typeof structure.value !== "object") return false;
                                                if (structure.value.format_version?.value !== 1) return false;
                                                if (structure.value.size?.type !== "list") return false;
                                                if (structure.value.size.value.value?.length !== 3) return false;
                                                if (!structure.value.structure?.value) return false;
                                                return true;
                                            }
                                            if (checkIsBedrock_mcstructure()) {
                                                const key: Buffer<ArrayBuffer> = Buffer.from(
                                                    `structuretemplate_mystructure:${path.parse(filePath).name}`,
                                                    "binary"
                                                );
                                                importPromises.push(
                                                    tab
                                                        .db!.put(key, fileData)
                                                        .then((success: boolean): void => {
                                                            if (success) {
                                                                tab.cachedDBKeys?.StructureTemplate?.push(key);
                                                                tab.setLevelDBIsModified();
                                                            }
                                                        })
                                                        .catch((e: any): void => void failedImports.push([filePath, e]))
                                                );
                                            } else {
                                                failedImports.push([filePath, new Error("Unsupported Structure Format")]);
                                            }
                                        } else {
                                            dialog.showErrorBox(
                                                "Unsupported Structure Format",
                                                `The structure format of the file at ${filePath} is not supported yet.`
                                            );
                                        }
                                    } catch (e) {
                                        failedImports.push([filePath, e]);
                                    }
                                }
                                await Promise.all(importPromises);
                                if (failedImports.length > 0) {
                                    console.error("Failed to import some structures:", failedImports);
                                    dialog
                                        .showMessageBox(getCurrentWindow(), {
                                            type: "error",
                                            title: "Failed to Import Some Structures",
                                            message: `Failed to import ${failedImports.length} structure(s).`,
                                            buttons: ["OK", "Details"],
                                            noLink: true,
                                            cancelId: 0,
                                            defaultId: 0,
                                        })
                                        .then((result: Electron.MessageBoxReturnValue): void => {
                                            if (result.response === 1) {
                                                dialog.showErrorBox("Failed to Import Structures", failedImports.map((f) => `${f[0]}\n\n${f[1]}`).join("\n\n"));
                                            }
                                        });
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/upload_glyph.png"
                                style={{ width: "16px", imageRendering: "pixelated", margin: "-3.5px 5px -3.5px 0" }}
                                aria-hidden="true"
                            />
                            Import Structures
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Import Structure Folders"
                            onClick={async (): Promise<void> => {
                                const fileExtensionFilterEnabled: boolean = true;
                                const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                                    title: "Import Structure Folders",
                                    buttonLabel: "Import",
                                    message: "Select the structure files to import.",
                                    properties: ["openDirectory", "multiSelections", "showHiddenFiles", "treatPackageAsDirectory"],
                                });
                                if (result.canceled) return;
                                let failedImports: [filePath: string, error?: any][] = [];
                                let importPromises: Promise<void>[] = [];
                                for (const folderPath of result.filePaths) {
                                    if (!existsSync(folderPath)) continue;
                                    importPromises.push(
                                        (async function importStructuresFromFolder(): Promise<void> {
                                            let innerImportPromises: Promise<void>[] = [];
                                            const filePaths: Dirent[] = await readdirRecursiveSafe(folderPath);
                                            for (const filePathDirent of filePaths) {
                                                if (!filePathDirent.isFile()) continue;
                                                if (
                                                    fileExtensionFilterEnabled &&
                                                    !["mcstructure" /* , "nbt", "schem", "schematic" */].includes(
                                                        path.extname(filePathDirent.name).toLowerCase().slice(1)
                                                    )
                                                )
                                                    continue;
                                                const filePath: string = path.join(filePathDirent.parentPath, filePathDirent.name);
                                                const relativePath: string = path.relative(folderPath, filePath).replaceAll("\\", "/");
                                                const structureID: string = `structuretemplate_${
                                                    relativePath.includes("/") ? relativePath.split("/")[0] : "mystructure"
                                                }:${relativePath.includes("/") ? relativePath.split("/").slice(1).join("/") : relativePath}`.replace(
                                                    /\.[^.\\/]+$/,
                                                    ""
                                                );
                                                try {
                                                    const fileData: Buffer = await readFile(filePath);
                                                    const structureData = await NBT.parse(fileData);
                                                    if (structureData.type === "little") {
                                                        function checkIsBedrock_mcstructure(): boolean {
                                                            let structure: NBTSchemas.NBTSchemaTypes.StructureTemplate = structureData.parsed as any;
                                                            if (!structure) return false;
                                                            if (structure.type !== "compound") return false;
                                                            if (typeof structure.value !== "object") return false;
                                                            if (structure.value.format_version?.value !== 1) return false;
                                                            if (structure.value.size?.type !== "list") return false;
                                                            if (structure.value.size.value.value?.length !== 3) return false;
                                                            if (!structure.value.structure?.value) return false;
                                                            return true;
                                                        }
                                                        if (checkIsBedrock_mcstructure()) {
                                                            const key: Buffer<ArrayBuffer> = Buffer.from(structureID, "binary");
                                                            innerImportPromises.push(
                                                                tab
                                                                    .db!.put(key, fileData)
                                                                    .then((success: boolean): void => {
                                                                        if (success) {
                                                                            tab.cachedDBKeys?.StructureTemplate?.push(key);
                                                                            tab.setLevelDBIsModified();
                                                                        }
                                                                    })
                                                                    .catch((e: any): void => void failedImports.push([filePath, e]))
                                                            );
                                                        } else {
                                                            failedImports.push([filePath, new Error("Unsupported Structure Format")]);
                                                        }
                                                    } else {
                                                        failedImports.push([filePath, new Error("Unsupported Structure Format")]);
                                                    }
                                                } catch (e) {
                                                    failedImports.push([filePath, e]);
                                                }
                                            }
                                            await Promise.all(innerImportPromises);
                                        })()
                                    );
                                }
                                await Promise.all(importPromises);
                                if (failedImports.length > 0) {
                                    console.error("Failed to import some structures:", failedImports);
                                    dialog
                                        .showMessageBox(getCurrentWindow(), {
                                            type: "error",
                                            title: "Failed to Import Some Structures",
                                            message: `Failed to import ${failedImports.length} structure(s).`,
                                            buttons: ["OK", "Details"],
                                            noLink: true,
                                            cancelId: 0,
                                            defaultId: 0,
                                        })
                                        .then((result: Electron.MessageBoxReturnValue): void => {
                                            if (result.response === 1) {
                                                dialog.showErrorBox(
                                                    "Failed to Import Some Structures",
                                                    failedImports.map((f) => `${f[0]}\n\n${f[1]}`).join("\n\n")
                                                );
                                            }
                                        });
                                } else {
                                    console.log("Successfully imported all structures.");
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/upload_glyph.png"
                                style={{ width: "16px", imageRendering: "pixelated", margin: "-3.5px 5px -3.5px 0" }}
                                aria-hidden="true"
                            />
                            Import Structure Folders
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Export Structures"
                            onClick={async (): Promise<void> => {
                                const result: Electron.OpenDialogReturnValue = await dialog.showOpenDialog(getCurrentWindow(), {
                                    title: "Export Structures",
                                    buttonLabel: "Export",
                                    message: "Select a folder to export the structures to.",
                                    properties: ["openDirectory", "showHiddenFiles", "treatPackageAsDirectory"],
                                });
                                if (result.canceled) return;
                                if (!existsSync(result.filePaths[0]!)) await mkdir(result.filePaths[0]!, { recursive: true });
                                // TO-DO: Add an option to toggle this.
                                const filterExportsBySearchQuery: boolean = true;
                                // TO-DO: Add an option to toggle this.
                                const refreshBeforeExporting: boolean = false;
                                if (refreshBeforeExporting) {
                                    await tab.refreshCachedDBKeys();
                                    keys = await Promise.all(
                                        rawKeys.map(
                                            async (key: Buffer): Promise<KeyData> => ({
                                                rawKey: key,
                                                displayKey: getKeyDisplayName(key),
                                                data: (await NBT.parse((await tab.db!.get(key))!)) as any,
                                            })
                                        )
                                    );
                                }
                                const structureKeys: KeyData[] =
                                    filterExportsBySearchQuery && Object.keys(query).length > 1
                                        ? tab
                                              .dbSearch!.serach(query)
                                              .toArray()
                                              .map((key): KeyData => key.originalObject.data)
                                        : keys;
                                let failedExports: [filePath: string, error?: any][] = [];
                                await Promise.all(
                                    structureKeys.map(async function exportStructureToFile(key: KeyData): Promise<void> {
                                        try {
                                            const stringKey: string = key.rawKey.toString("utf-8");
                                            const destinationPath: string = `${
                                                stringKey.startsWith("structuretemplate_mystructure:")
                                                    ? ""
                                                    : stringKey.replace(/^structuretemplate_/, "").split(":")[0] + "/"
                                            }${stringKey.replace(/^structuretemplate_[^:]*:/, "")}.mcstructure`.replace(
                                                /[:*?"<>|\x00-\x1F]/g,
                                                (char: string): string => {
                                                    return "%" + char.charCodeAt(0).toString(16).padStart(2, "0");
                                                }
                                            );
                                            if (!existsSync(path.dirname(path.join(result.filePaths[0]!, destinationPath))))
                                                await mkdir(path.join(result.filePaths[0]!, path.dirname(destinationPath)), { recursive: true });
                                            const data: Buffer | null = await tab.db!.get(key.rawKey)!;
                                            if (!data) throw new ReferenceError(`Entry not found: ${stringKey}`);
                                            await writeFile(path.join(result.filePaths[0]!, destinationPath), data);
                                        } catch (e) {
                                            failedExports.push([key.rawKey.toString("binary"), e]);
                                        }
                                    })
                                );
                                if (failedExports.length > 0) {
                                    console.error("Failed to export some structures:", failedExports);
                                    dialog
                                        .showMessageBox(getCurrentWindow(), {
                                            type: "error",
                                            title: "Failed to Export Some Structures",
                                            message: `Failed to export ${failedExports.length} structure(s).`,
                                            buttons: ["OK", "Details"],
                                            noLink: true,
                                            cancelId: 0,
                                            defaultId: 0,
                                        })
                                        .then((result: Electron.MessageBoxReturnValue): void => {
                                            if (result.response === 1) {
                                                dialog.showErrorBox(
                                                    "Failed to Export Some Structures",
                                                    failedExports.map((f) => `${f[0]}\n\n${f[1]}`).join("\n\n")
                                                );
                                            }
                                        });
                                } else {
                                    console.log("Successfully exported all structures.");
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/download_glyph.png"
                                style={{ width: "16px", imageRendering: "pixelated", margin: "-3.5px 5px -3.5px 0" }}
                                aria-hidden="true"
                            />
                            Export Structures
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Transfer Structures to Open Tab"
                            onClick={async (): Promise<void> => {
                                const result: ShowSelectOpenTabDialogResult = await showSelectOpenTabDialog({
                                    excludedTabs: [{ windowID: getCurrentWindow().id, tabID: tab.id }],
                                    message: "Select a tab to transfer structures to.",
                                    tabTargetTypeFilter: ["world", "leveldb"],
                                });
                                if (result.canceled) return;
                                // TO-DO: Add an option to toggle this.
                                const filterExportsBySearchQuery: boolean = true;
                                // TO-DO: Add an option to toggle this.
                                const refreshBeforeExporting: boolean = false;
                                if (refreshBeforeExporting) {
                                    await tab.refreshCachedDBKeys();
                                    keys = await Promise.all(
                                        rawKeys.map(
                                            async (key: Buffer): Promise<KeyData> => ({
                                                rawKey: key,
                                                displayKey: getKeyDisplayName(key),
                                                data: (await NBT.parse((await tab.db!.get(key))!)) as any,
                                            })
                                        )
                                    );
                                }
                                const structureKeys: KeyData[] =
                                    filterExportsBySearchQuery && Object.keys(query).length > 1
                                        ? tab
                                              .dbSearch!.serach(query)
                                              .toArray()
                                              .map((key): KeyData => key.originalObject.data)
                                        : keys;
                                console.log(`Transferring ${structureKeys.length} structure(s) to tab ${result.tabID} in window ${result.window.id}.`);
                                const errors: Error[] = (
                                    await Promise.all(
                                        structureKeys.map(async (key: KeyData): Promise<Error | void> => {
                                            const data: readonly [key: Buffer, data: Buffer | null] = [key.rawKey, await tab.db!.get(key.rawKey)!] as const;
                                            if (data[1] === null) return new ReferenceError(`Entry not found: ${key.displayKey}`);
                                            await result.window.webContents.executeJavaScript(
                                                `{/* This is to make sure the contents are different so that it works each time. */"${Date.now()}_${Math.floor(
                                                    Math.random() * 1000000
                                                )}"; const tab = tabManager.openTabs.find((tab) => tab.id === ${
                                                    result.tabID
                                                }n); if (tab) {const db = tab.db; if (db) {const [{data: key}, {data}] = ${JSON.stringify(
                                                    data
                                                )}; const keyBuffer = Buffer.from(key); db.put(keyBuffer, Buffer.from(data)).then((success)=>{if(!success) console.error("Failed to transfer structure:", keyBuffer); else if (!tab.cachedDBKeys.StructureTemplate.some(targetKey=> targetKey.equals(keyBuffer))) {tab.cachedDBKeys.StructureTemplate.push(keyBuffer); tab.setLevelDBIsModified();}});}} else console.log("Unable to find tab with ID:", ${
                                                    result.tabID
                                                }n);}`
                                            );
                                        })
                                    )
                                ).filter((error: void | Error): error is Error => error instanceof Error);
                                if (errors.length > 0) {
                                    dialog.showErrorBox(
                                        "Failed to Transfer Some Structures",
                                        errors.map((error: Error): string => `${error.message}\n\n${error.stack}`).join("\n\n")
                                    );
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/export.png"
                                style={{ width: "16px", imageRendering: "pixelated", margin: "-3.5px 5px -3.5px 0" }}
                                aria-hidden="true"
                            />
                            Transfer Structures to Open Tab
                        </button>
                    </div>
                </EditorWidgetOverlayBar>
                <div class="search-controls-container" ref={searchRefs.searchAreaContainer}>
                    <input
                        type="search"
                        class="search-text-input"
                        placeholder="Search..."
                        autocomplete="off"
                        autocorrect="off"
                        autocapitalize="off"
                        spellcheck={false}
                        onKeyDown={(event: JSX.TargetedKeyboardEvent<HTMLInputElement>): void => {
                            if (!searchRefs.searchButton.current) return;
                            if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                                event.preventDefault();
                                searchRefs.searchButton.current.click();
                            }
                        }}
                        ref={searchRefs.searchTextBox}
                    />
                    <button
                        type="button"
                        class="search-button"
                        title="Search"
                        onClick={(): void => {
                            try {
                                if (!searchRefs.searchTextBox.current) return;
                                delete query.contentTypes;
                                delete query.displayKeyContents;
                                delete query.excludeContentTypes;
                                delete query.nbtTags;
                                delete query.rawKeyContents;
                                delete query.rawValueContents;
                                delete query.contentsStringContents;
                                delete query.customDataFields;
                                const keywordPrefixOperators = [
                                    // anyOf
                                    "|",
                                    // oneOf
                                    "^",
                                    // allOf
                                    "&",
                                    // noneOf
                                    "-",
                                ] as const;
                                const keywords = ["typeid", "nbt", "uuid", "name", "contents"] as const;
                                function getKeywordedOperators<T extends string, O extends string = "" | (typeof keywordPrefixOperators)[number]>(
                                    keywords: readonly T[],
                                    operators: readonly O[] = ["", ...keywordPrefixOperators] as O[]
                                ): `${O}${T}`[] {
                                    return keywords.flatMap((key: T): `${O}${T}`[] => operators.map((op: O): `${O}${T}` => `${op}${key}` as const));
                                }
                                const keywordedOperators = getKeywordedOperators(keywords);
                                const searchString = SearchString.parse(searchRefs.searchTextBox.current.value);
                                const conditionArray = searchString.getConditionArray();
                                const queryData: Partial<Record<LooseAutocomplete<(typeof keywordedOperators)[number]>, string[]>> = {};
                                for (const condition of conditionArray) {
                                    const key = `${condition.negated ? "-" : ""}${condition.keyword}`;
                                    queryData[key] ??= [];
                                    queryData[key].push(condition.value);
                                }
                                const textQueryData = searchString.getTextSegments();
                                console.log(searchString, queryData, textQueryData);
                                if (lastHideErrorPopupFunction) lastHideErrorPopupFunction();
                                function showError(options: { message: string }): void {
                                    if (!searchRefs.searchTextBox.current || !searchRefs.searchTextBoxErrorPopup.current) return;
                                    setTimeout((): void => {
                                        if (!searchRefs.searchTextBox.current || !searchRefs.searchTextBoxErrorPopup.current) return;
                                        searchRefs.searchTextBoxErrorPopup.current.textContent = options.message;
                                        searchRefs.searchTextBoxErrorPopup.current.style.left = `${searchRefs.searchTextBox.current.offsetLeft}px`;
                                        searchRefs.searchTextBoxErrorPopup.current.style.top = `${
                                            searchRefs.searchTextBox.current.offsetTop + searchRefs.searchTextBox.current.offsetHeight
                                        }px`;
                                        searchRefs.searchTextBoxErrorPopup.current.style.display = "block";
                                        function hideErrorPopup(): void {
                                            searchRefs.searchTextBoxErrorPopup.current!.style.display = "none";
                                            window.removeEventListener("keydown", hideErrorPopup);
                                            window.removeEventListener("mousedown", hideErrorPopup);
                                            if (lastHideErrorPopupFunction === hideErrorPopup) lastHideErrorPopupFunction = undefined;
                                        }
                                        window.addEventListener("keydown", hideErrorPopup);
                                        window.addEventListener("mousedown", hideErrorPopup);
                                    });
                                }
                                for (const key in queryData) {
                                    if ([...getKeywordedOperators(["typeid", "nbt", "uuid", "name", "contents"])].includes(key as any)) continue;
                                    if (
                                        !keywordPrefixOperators.includes(key.slice(0, 1) as any) &&
                                        keywords.includes(key.slice(1) as any) &&
                                        /^[^a-z0-9]$/i.test(key.slice(0, 1))
                                    ) {
                                        showError({ message: `Unknown operator: ${key.slice(0, 1)}` });
                                    } else if (!keywordedOperators.includes(key as any)) {
                                        showError({
                                            message: `Unknown filter: ${keywordPrefixOperators.includes(key.slice(0, 1) as any) ? key.slice(1) : key}`,
                                        });
                                    } else {
                                        showError({ message: `Operator ${key.slice(0, 1)} is not supported for filter: ${key.slice(1)}` });
                                    }
                                    return;
                                }
                                if (getKeywordedOperators(["typeid", "nbt", "uuid", "name"]).some((key: string): boolean => key in queryData)) {
                                    function parseTypeIDQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["identifier"],
                                                value: v,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseNameQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["CustomName"],
                                                value: v,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseUUIDQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["UniqueID"],
                                                value: v,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseNBTQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries
                                            .map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery | undefined => {
                                                let data: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery | undefined = undefined;
                                                try {
                                                    const val: any = JSON.parse(v);
                                                    if (typeof val !== "object") {
                                                        switch (typeof val) {
                                                            // case "string":
                                                            //     if ()
                                                            default:
                                                                throw new Error();
                                                        }
                                                    } else {
                                                        if (
                                                            [
                                                                "path",
                                                                "caseSensitivePath",
                                                                "key",
                                                                "caseSensitiveKey",
                                                                "tagType",
                                                                "value",
                                                                "caseSensitiveValue",
                                                            ].some((key: string): boolean => key in val)
                                                        ) {
                                                            data = val;
                                                        } else {
                                                            throw new Error();
                                                        }
                                                    }
                                                } catch {
                                                    if (v.split("=").length === 2) {
                                                        let [key, value] = v.split("=");
                                                        let tagType: NBT.TagType | undefined = undefined;
                                                        if (key?.includes(":")) {
                                                            let preKey: string;
                                                            [preKey, key] = key.split(":") as [preKey: string, key: string, ...string[]];
                                                            if (preKey !== "*") {
                                                                if (preKey in NBT.TagType) {
                                                                    tagType = preKey.toLowerCase() as NBT.TagType;
                                                                }
                                                            }
                                                        }
                                                        let path: string[] | undefined = key?.split("/");
                                                        data = {};
                                                        data.key = key;
                                                        data.value = value;
                                                        data.path = path;
                                                        data.tagType = tagType;
                                                    } else {
                                                        showError({ message: `Invalid NBT query: ${v}` });
                                                        throw new Error("Error to return but already handled.");
                                                    }
                                                }
                                                return data;
                                            })
                                            .filter(
                                                (
                                                    v: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery | undefined
                                                ): v is TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => v !== undefined
                                            );
                                    }
                                    query.nbtTags = {};
                                    if (["-typeid", "-nbt", "-uuid", "-name"].some((key: string): boolean => key in queryData)) {
                                        query.nbtTags.noneOf = [];
                                        if (queryData["-typeid"]) query.nbtTags.noneOf.push(...parseTypeIDQueries(queryData["-typeid"]));
                                        if (queryData["-name"]) query.nbtTags.noneOf.push(...parseNameQueries(queryData["-name"]));
                                        if (queryData["-uuid"]) query.nbtTags.noneOf.push(...parseUUIDQueries(queryData["-uuid"]));
                                        if (queryData["-nbt"]) query.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                    }
                                    if (keywords.some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.anyOf = [];
                                        if (queryData.typeid) query.nbtTags.anyOf.push(...parseTypeIDQueries(queryData.typeid));
                                        if (queryData.name) query.nbtTags.anyOf.push(...parseNameQueries(queryData.name));
                                        if (queryData.uuid) query.nbtTags.anyOf.push(...parseUUIDQueries(queryData.uuid));
                                        if (queryData.nbt) query.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                    }
                                    if (getKeywordedOperators(keywords, ["^"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.oneOf = [];
                                        if (queryData["^typeid"]) query.nbtTags.oneOf.push(...parseTypeIDQueries(queryData["^typeid"]));
                                        if (queryData["^name"]) query.nbtTags.oneOf.push(...parseNameQueries(queryData["^name"]));
                                        if (queryData["^uuid"]) query.nbtTags.oneOf.push(...parseUUIDQueries(queryData["^uuid"]));
                                        if (queryData["^nbt"]) query.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                    }
                                    if (getKeywordedOperators(keywords, ["&"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.allOf = [];
                                        if (queryData["&typeid"]) query.nbtTags.allOf.push(...parseTypeIDQueries(queryData["&typeid"]));
                                        if (queryData["&name"]) query.nbtTags.allOf.push(...parseNameQueries(queryData["&name"]));
                                        if (queryData["&uuid"]) query.nbtTags.allOf.push(...parseUUIDQueries(queryData["&uuid"]));
                                        if (queryData["&nbt"]) query.nbtTags.allOf.push(...parseNBTQueries(queryData["&nbt"]));
                                    }
                                }
                                if (queryData["-contents"] !== undefined) {
                                    query.customDataFields ??= {};
                                    query.customDataFields.contents ??= {};
                                    query.customDataFields.contents.noneOf ??= [];
                                    query.customDataFields.contents.noneOf.push(...queryData["-contents"]);
                                }
                                if (queryData["|contents"] !== undefined) {
                                    query.customDataFields ??= {};
                                    query.customDataFields.contents ??= {};
                                    query.customDataFields.contents.anyOf ??= [];
                                    query.customDataFields.contents.anyOf.push(...queryData["|contents"]);
                                }
                                if (queryData.contents !== undefined) {
                                    query.customDataFields ??= {};
                                    query.customDataFields.contents ??= {};
                                    query.customDataFields.contents.anyOf ??= [];
                                    query.customDataFields.contents.anyOf.push(...queryData.contents);
                                }
                                if (queryData["&contents"] !== undefined) {
                                    query.customDataFields ??= {};
                                    query.customDataFields.contents ??= {};
                                    query.customDataFields.contents.allOf ??= [];
                                    query.customDataFields.contents.allOf.push(...queryData["&contents"]);
                                }
                                if (queryData["^contents"] !== undefined) {
                                    query.customDataFields ??= {};
                                    query.customDataFields.contents ??= {};
                                    query.customDataFields.contents.oneOf ??= [];
                                    query.customDataFields.contents.oneOf.push(...queryData["^contents"]);
                                }
                                if (textQueryData.length > 0) {
                                    query.contentsStringContents ??= {};
                                    for (const textQuery of textQueryData) {
                                        if (textQuery.negated) {
                                            query.contentsStringContents.noneOf = [];
                                            query.contentsStringContents.noneOf.push(textQuery.text);
                                        } else if (textQuery.text.startsWith("^")) {
                                            query.contentsStringContents.oneOf ??= [];
                                            query.contentsStringContents.oneOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("&")) {
                                            query.contentsStringContents.allOf ??= [];
                                            query.contentsStringContents.allOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("|")) {
                                            query.contentsStringContents.anyOf ??= [];
                                            query.contentsStringContents.anyOf.push(textQuery.text.slice(1));
                                        } else {
                                            query.contentsStringContents.anyOf ??= [];
                                            query.contentsStringContents.anyOf.push(textQuery.text);
                                        }
                                    }
                                }
                                if (searchRefs.searchTextBox.current) searchRefs.searchTextBox.current.blur();
                                if (tablesContainerRef.current) {
                                    const tempElement: HTMLDivElement = document.createElement("div");
                                    render(
                                        <div style="width: 100%; height: 100%; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
                                            <LoadingScreenContents messageContainerRef={loadingScreenMessageContainerRef} />
                                        </div>,
                                        tempElement
                                    );
                                    tablesContainerRef.current.replaceChildren(...tempElement.children);
                                }
                                updateTablesContents(true);
                            } catch (e) {
                                if (e instanceof Error && e.message === "Error to return but already handled.") return;
                                throw e;
                            }
                        }}
                        ref={searchRefs.searchButton}
                    >
                        <img aria-hidden="true" src="resource://images/ui/glyphs/magnifyingGlass.png" />
                    </button>
                    <button
                        type="button"
                        class="search-help-button"
                        title="Help"
                        onClick={(): void => {
                            let containerElement: HTMLDivElement = document.createElement("div");
                            containerElement.style.display = "contents";
                            function OverlaySearchSyntaxHelpMenu(): JSX.SpecificElement<"div"> {
                                const overlayElementRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
                                return (
                                    <div class="search-syntax-help-page-overlay-container" ref={overlayElementRef}>
                                        <SearchSyntaxHelpMenu
                                            helpInfo={structuresTabSearchSyntax}
                                            onClose={(): void => {
                                                if (overlayElementRef.current) {
                                                    overlayElementRef.current.remove();
                                                }
                                            }}
                                        />
                                    </div>
                                );
                            }
                            render(<OverlaySearchSyntaxHelpMenu />, containerElement);
                            $("#page-overlay-container").append(containerElement);
                        }}
                        ref={searchRefs.helpButton}
                    >
                        <img aria-hidden="true" src="resource://images/ui/glyphs/question-mark.png" />
                    </button>
                    <div class="search-text-box-error-popup" ref={searchRefs.searchTextBoxErrorPopup}></div>
                </div>
                <div style="display: flex; flex-direction: column;" ref={tablesContainerRef}>
                    <TablesContents />
                </div>
            </>
        );
    }
    return <Contents />;
}

async function getStructuresTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The full list of key data to display.
     */
    keys: KeyData[];
    dynamicProperties?: NBT.NBT | undefined;
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.Structures.StructuresTabSectionMode;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "simple": {
            const columns = config.views.structures.modeSettings.simple.columns;
            return data.keys.map((key: KeyData): JSX.Element => {
                try {
                    return (
                        <tr
                            data-key={key.rawKey}
                            onDblClick={(): void => {
                                data.tab.openTab({
                                    // TO-DO: In the future, add support for getting their skin head or profile picture.
                                    contentType: "StructureTemplate",
                                    icon: "resource://images/ui/glyphs/structure_block.png",
                                    name: key.displayKey,
                                    parentTab: data.tab,
                                    target: {
                                        type: "LevelDBEntry",
                                        key: key.rawKey,
                                    },
                                });
                            }}
                        >
                            {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                switch (column) {
                                    case "DBKey":
                                        return <td>{key.displayKey}</td>;
                                    case "ID":
                                        return <td>{key.rawKey.subarray(18).toString("utf8")}</td>;
                                    case "Size":
                                        return (
                                            <td>
                                                {key.data.parsed.value.size?.type === "list" && key.data.parsed.value.size.value.type === "int" ? (
                                                    (key.data.parsed.value.size.value.value as number[]).join(", ")
                                                ) : (
                                                    <span style="color: red;">null</span>
                                                )}
                                            </td>
                                        );
                                    case "WorldOrigin":
                                        return (
                                            <td>
                                                {key.data.parsed.value.size?.type === "list" && key.data.parsed.value.size.value.type === "int" ? (
                                                    (key.data.parsed.value.size.value.value as number[]).join(", ")
                                                ) : (
                                                    <span style="color: red;">null</span>
                                                )}
                                            </td>
                                        );
                                    case "Entities":
                                        return (
                                            <td>
                                                {key.data.parsed.value.structure?.value?.entities?.type === "list" &&
                                                key.data.parsed.value.structure?.value?.entities?.value?.value ? (
                                                    key.data.parsed.value.structure.value.entities.value.value.length
                                                ) : (
                                                    <span style="color: red;">null</span>
                                                )}
                                            </td>
                                        );
                                    case "BlockEntities":
                                        return (
                                            <td>
                                                {key.data.parsed.value.structure?.value?.palette?.value?.default?.value?.block_position_data?.type ===
                                                "compound" ? (
                                                    Object.keys(key.data.parsed.value.structure.value.palette.value.default.value.block_position_data.value)
                                                        .length
                                                ) : (
                                                    <span style="color: red;">null</span>
                                                )}
                                            </td>
                                        );
                                }
                            })}
                        </tr>
                    );
                } catch (e) {
                    console.error(e);
                    return (
                        <tr
                            data-key={key.rawKey}
                            onDblClick={(): void => {
                                data.tab.openTab({
                                    // TO-DO: In the future, add support for getting their skin head or profile picture.
                                    contentType: "StructureTemplate",
                                    icon: "resource://images/ui/glyphs/structure_block.png",
                                    name: key.displayKey,
                                    parentTab: data.tab,
                                    target: {
                                        type: "LevelDBEntry",
                                        key: key.rawKey,
                                    },
                                });
                            }}
                        >
                            <td style={{ color: "red" }}>{e as any}</td>
                        </tr>
                    );
                }
            });
        }
    }
}
