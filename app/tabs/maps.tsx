import type { JSX, RefObject, TargetedMouseEvent } from "preact";
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
    type Dimension,
    type Vector3,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createObservable, testForObjectExtension, type Observable } from "../../src/utils/miscUtils";
import { ControlledMenu, MenuItem, SubMenu, type ClickEvent as ContextMenu_ClickEvent } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import type { SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import SearchSyntaxHelpMenu from "../components/SearchSyntaxHelpMenu";
import { viewFilesTabSearchSyntax } from "./viewFiles";
import { MapEditor } from "../components/MapEditor";
import Notice from "../components/Notice";
import { clipboard } from "@electron/remote";

/**
 * Props for the {@link MapsTab} component.
 */
export interface MapsTabProps {
    tab: TabManagerTab;
}

const mapsTabSearchSyntax: SearchSyntaxHelpInfo = {
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
        dimension: {
            description: "Searches for maps by the namespaced ID (the one displayed in the Type ID column).",
            extendedDescription: (
                <>
                    <p>Searches for maps by the dimension the map is of.</p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                            <li>"^" - One Of</li>
                            <li>"&" - All Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>dimension:0</code> - Searches for maps of the Overworld.
                </p>,
                <p>
                    <code>|dimension:1</code> - Searches for maps of the Nether.
                </p>,
                <p>
                    <code>dimension:2 dimension:overworld</code> - Searches for maps of the End or the Overworld.
                </p>,
                <p>
                    <code>-dimension:the_end -dimension:nether</code> - Searches for maps that are not of the End or the Nether.
                </p>,
            ],
        },
        id: {
            description: "Searches for maps by their ID (the one displayed in the ID column).",
            extendedDescription: (
                <>
                    <p>Searches for maps by their ID (the one displayed in the ID column).</p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                            <li>"^" - One Of</li>
                            <li>"&" - All Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>id:-8589934591</code> - Searches for maps with an ID of <code>-8589934591</code>.
                </p>,
                <p>
                    <code>|id:-23457</code> - Searches for maps with an ID of <code>-23457</code>.
                </p>,
                <p>
                    <code>id:56 id:-72</code> - Searches for maps with an ID of <code>56</code> or <code>-72</code>.
                </p>,
                <p>
                    <code>-id:2001 -id:-16437</code> - Searches for maps that do not have an ID of <code>2001</code> or <code>-16437</code>.
                </p>,
            ],
        },
        parentid: {
            description: "Searches for maps by their parent map's ID (the one displayed in the Parent Map ID column).",
            extendedDescription: (
                <>
                    <p>Searches for maps by their parent map's ID (the one displayed in the Parent Map ID column).</p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                            <li>"^" - One Of</li>
                            <li>"&" - All Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>id:-8589934591</code> - Searches for maps whose parent map has an ID of <code>-8589934591</code>.
                </p>,
                <p>
                    <code>|id:-23457</code> - Searches for maps whose parent map has an ID of <code>-23457</code>.
                </p>,
                <p>
                    <code>id:56 id:-72</code> - Searches for maps whose parent map has an ID of <code>56</code> or <code>-72</code>.
                </p>,
                <p>
                    <code>-id:2001 -id:-16437</code> - Searches for maps whose parent map does not have an ID of <code>2001</code> or <code>-16437</code>.
                </p>,
            ],
        },
        locked: {
            description: "Searches for maps by whether or not they are locked.",
            extendedDescription: (
                <>
                    <p>Searches for maps by whether or not they are locked.</p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                            <li>"^" - One Of</li>
                            <li>"&" - All Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>locked:true</code> - Searches for maps that are locked.
                </p>,
                <p>
                    <code>|locked:0</code> - Searches for maps that are not locked.
                </p>,
                <p>
                    <code>locked:0 locked:true</code> - Searches for maps that do not have an invalid value in the <code>locked</code> NBT tag.
                </p>,
                <p>
                    <code>-locked:false -locked:true</code> - Searches for maps that have an invalid value in the <code>locked</code> NBT tag.
                </p>,
            ],
        },
        scale: {
            description: "Searches for maps by their scale (the one displayed in the Scale column).",
            extendedDescription: (
                <>
                    <p>Searches for maps by their scale (the one displayed in the Scale column).</p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                            <li>"^" - One Of</li>
                            <li>"&" - All Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>scale:1</code> - Searches for maps with a scale of <code>1</code>.
                </p>,
                <p>
                    <code>|scale:0</code> - Searches for maps with a scale of <code>0</code>.
                </p>,
                <p>
                    <code>scale:3 scale:4</code> - Searches for maps with a scale of <code>3</code> or <code>4</code>.
                </p>,
                <p>
                    <code>-scale:2 -scale:0</code> - Searches for maps that do not have a scale of <code>2</code> or <code>0</code>.
                </p>,
            ],
        },
        contents: {
            description: "Searches the LevelDB entry value as SNBT.",
        },
        nbt: viewFilesTabSearchSyntax.filters.nbt!,
    },
};

/**
 * The maps tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function MapsTab(props: MapsTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The maps sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const abortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        return (): void => {
            abortController.abort(new DOMException("Tab switched.", "AbortError"));
        };
    });
    getMapsTabContents(props.tab, abortController.signal).then(
        async (element: JSX.Element): Promise<void> => {
            if (!containerRef.current) return;
            render(null, containerRef.current);
            render(element, containerRef.current);
        },
        (reason: any): void => {
            if (reason instanceof DOMException && reason.name === "AbortError" && reason.message === "Tab switched.") return;
            if (containerRef.current) {
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent =
                    reason instanceof Error ?
                        reason.stack?.startsWith(reason.toString()) ?
                            reason.stack
                        :   reason.toString() + reason.stack
                    :   reason;
                render(null, containerRef.current);
                containerRef.current.replaceChildren("Failed to load data:", errorElement);
            }
            console.error(reason);
        }
    );
    const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    if (!props.tab.db.isOpen()) {
        props.tab.awaitDBOpen!.then(async (): Promise<void> => {
            if (loadingScreenMessageContainerRef.current && !props.tab.cachedDBKeys) {
                const formatter = new Intl.NumberFormat();
                loadingScreenMessageContainerRef.current.textContent = `Reading LevelDB keys${props.tab.loadedCachedDBKeysProgress !== undefined ? `: ${formatter.format(props.tab.loadedCachedDBKeysProgress)}` : ""}...`;
                queueMicrotask(async (): Promise<void> => {
                    await sleep(10);
                    while (!props.tab.cachedDBKeys) {
                        if (!loadingScreenMessageContainerRef.current) return;
                        loadingScreenMessageContainerRef.current.textContent = `Reading LevelDB keys${props.tab.loadedCachedDBKeysProgress !== undefined ? `: ${formatter.format(props.tab.loadedCachedDBKeysProgress)}` : ""}...`;
                        await sleep(10);
                    }
                });
                await props.tab.awaitCachedDBKeys;
                if (loadingScreenMessageContainerRef.current) loadingScreenMessageContainerRef.current.textContent = "";
            }
        });
        return (
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;" ref={containerRef}>
                <LoadingScreenContents message="Opening the LevelDB..." messageContainerRef={loadingScreenMessageContainerRef} />
            </div>
        );
    }
    if (!props.tab.cachedDBKeys) {
        const formatter = new Intl.NumberFormat();
        queueMicrotask(async (): Promise<void> => {
            await sleep(20);
            while (!props.tab.cachedDBKeys) {
                if (!loadingScreenMessageContainerRef.current) return;
                loadingScreenMessageContainerRef.current.textContent = `Reading LevelDB keys${props.tab.loadedCachedDBKeysProgress !== undefined ? `: ${formatter.format(props.tab.loadedCachedDBKeysProgress)}` : ""}...`;
                await sleep(20);
            }
        });
        props.tab.awaitCachedDBKeys!.then((): void => {
            if (loadingScreenMessageContainerRef.current) loadingScreenMessageContainerRef.current.textContent = "";
        });
        return (
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;" ref={containerRef}>
                <LoadingScreenContents
                    message={`Reading LevelDB keys${props.tab.loadedCachedDBKeysProgress !== undefined ? `: ${formatter.format(props.tab.loadedCachedDBKeysProgress)}` : ""}...`}
                    messageContainerRef={loadingScreenMessageContainerRef}
                />
            </div>
        );
    }
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;" ref={containerRef}>
            <LoadingScreenContents messageContainerRef={loadingScreenMessageContainerRef} />
        </div>
    );
}

interface KeyData {
    rawKey: Buffer;
    displayKey: string;
    data?: { parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.Map; type: NBT.NBTFormat; metadata: NBT.Metadata } | null | undefined;
}

async function getMapsTabContents(tab: TabManagerTab, signal: AbortSignal): Promise<JSX.Element> {
    if (!tab.db) return <div>The maps sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    if (!tab.db.isOpen() && !((await tab.awaitDBOpen) ?? true)) {
        if (tab.errorDueToEncryptedLevelDB)
            return (
                <Notice
                    title="Encrypted LevelDB"
                    subtitle="The LevelDB is encrypted. The app cannot open encrypted LevelDBs."
                    detail="If this world is from a marketplace template, that would cause the LevelDB to be encrypted."
                    image="access_denied"
                />
            );
        return (
            <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: start;">
                <Notice
                    title="LevelDB Error"
                    subtitle="An error has occurred while opening the LevelDB."
                    detail={null}
                    image="generic_error"
                    style={{ height: "auto" }}
                />
                <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>
                    {tab.errorOnDBOpen instanceof Error ?
                        `${tab.errorOnDBOpen.stack !== undefined ? tab.errorOnDBOpen.stack : tab.errorOnDBOpen.toString()}${
                            tab.errorOnDBOpen.cause !== undefined ?
                                `\nCaused by: ${((): unknown => {
                                    try {
                                        return typeof tab.errorOnDBOpen.cause === "object" ? JSON.stringify(tab.errorOnDBOpen.cause) : tab.errorOnDBOpen.cause;
                                    } catch {
                                        return tab.errorOnDBOpen.cause;
                                    }
                                })()}`
                            :   ""
                        }`
                    :   String(
                            (function (): unknown {
                                try {
                                    return typeof tab.errorOnDBOpen === "object" ? JSON.stringify(tab.errorOnDBOpen) : tab.errorOnDBOpen;
                                } catch {
                                    return tab.errorOnDBOpen;
                                }
                            })()
                        )
                    }
                </div>
            </div>
        );
    }
    if (!tab.cachedDBKeys) await tab.awaitCachedDBKeys!;
    signal.throwIfAborted();
    const rawKeys: Buffer[] = tab.cachedDBKeys!.Map;
    let asyncMode: boolean =
        "__FORCE_ASYNC_KEY_MODE__" in window ? !!window["__FORCE_ASYNC_KEY_MODE__"]
        : config.useAsyncModeInEntryViews === "auto" ?
            rawKeys.length >= config.asyncModeEntryThreshold ||
            Object.values(tab.cachedDBKeys!).reduce((a: number, b: Buffer[]): number => a + b.length, 0) >= config.asyncModeTotalKeyCountThreshold
        :   config.useAsyncModeInEntryViews;
    const keys: KeyData[] = await Promise.all(
        rawKeys.map(
            async (key: Buffer): Promise<KeyData> => ({
                rawKey: key,
                displayKey: getKeyDisplayName(key),
                data: asyncMode ? undefined : ((await NBT.parse((await tab.db!.get(key))!).catch((): null => null)) as any),
            })
        )
    );
    let targetKeys: KeyData[] = keys;
    let mode: ConfigConstants.views.Maps.MapsTabMode = config.views.maps.mode;
    let currentUpdateTablesContentsFunction: ((reloadData: boolean) => Promise<void>) | null = null;
    let emptyTablesContents: JSX.Element[][] =
        asyncMode ?
            [[]]
        :   await Promise.all(
                ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode].map(
                    async (sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                        await getMapsTabContentsRows({
                            tab,
                            keys,
                            mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Maps.MapsTabSectionMode,
                            get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                                return currentUpdateTablesContentsFunction;
                            },
                        })
                )
            );
    let tablesContents: JSX.Element[][] = emptyTablesContents;
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
        async function getTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<JSX.Element[]> {
            const sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode][sectionIndex]!;
            return await getMapsTabContentsRows({
                tab,
                keys: await Promise.all(
                    targetKeys
                        .slice(start, end)
                        .map(async (key: KeyData): Promise<KeyData> => ({ ...key, data: (await NBT.parse((await tab.db!.get(key.rawKey))!)) as any }))
                ),
                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Maps.MapsTabSectionMode,
                get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                    return currentUpdateTablesContentsFunction;
                },
            });
        }
        async function loadTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<void> {
            if (!asyncMode) return;
            const sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode][sectionIndex]!;
            tablesContents = [...tablesContents];
            tablesContents[sectionIndex] = [...emptyTablesContents[sectionIndex]!];
            tablesContents[sectionIndex].splice(start, end - start, ...(await getTablesContentsInRange(sectionIndex, start, end)));
        }
        function getSectionEntryCounts(): number[] {
            return ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode].map(
                (sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number]): number => {
                    switch (sectionID) {
                        case null:
                            return targetKeys.length;
                    }
                }
            );
        }
        function TablesContents(): JSX.Element {
            let localTablesContents: Observable<JSX.Element[][]> = createObservable([[]]);
            if (asyncMode) {
                Promise.all(
                    ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode].map(
                        async (
                            _sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): Promise<JSX.Element[]> => getTablesContentsInRange(index, 0, 20)
                    )
                ).then((tablesContents: JSX.Element[][]): void => {
                    localTablesContents.set(tablesContents);
                });
            }
            return (
                <>
                    {...ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number], index: number): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                localTablesContents.observe((tablesContents: JSX.Element[][]): void => {
                                    if (!asyncMode || !bodyRef.current) return;
                                    let tempElement: HTMLDivElement = document.createElement("div");
                                    render(<>{...tablesContents[index]!}</>, tempElement);
                                    bodyRef.current.replaceChildren(...tempElement.children);
                                });
                                // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                                // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                const headerName = ConfigConstants.views.Maps.mapsTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Maps.MapsTabSectionMode = (
                                    sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Maps.MapsTabSectionMode;
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
                                                        <th colSpan={ConfigConstants.views.Maps.mapsTabModeToColumnIDs[sectionMode].length}>{headerName}</th>
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
                                                    {...config.views.maps.modeSettings[mode].columns.map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Maps.columnIDToDisplayName[columnID];
                                                            return <th>{typeof displayName === "string" ? displayName : displayName.headerLabel}</th>;
                                                        }
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody ref={bodyRef}>
                                                {...asyncMode ? localTablesContents.get()[index]! : tablesContents[index]!.slice(0, 20)}
                                            </tbody>
                                            <tfoot>
                                                <tr class="table-footer-row-page-navigation">
                                                    <td colSpan={ConfigConstants.views.Maps.mapsTabModeToColumnIDs[sectionMode].length}>
                                                        <PageNavigation
                                                            totalPages={Math.ceil(getSectionEntryCounts()[index]! / 20)}
                                                            onPageChange={async (page: number): Promise<void> => {
                                                                if (!bodyRef.current) return;
                                                                if (asyncMode) {
                                                                    localTablesContents.get()[index] = await getTablesContentsInRange(
                                                                        index,
                                                                        (page - 1) * 20,
                                                                        page * 20
                                                                    );
                                                                }
                                                                // let tempElement: HTMLDivElement = document.createElement("div");
                                                                render(null, bodyRef.current);
                                                                render(
                                                                    <>
                                                                        {...asyncMode ?
                                                                            localTablesContents.get()[index]!
                                                                        :   tablesContents[index]!.slice((page - 1) * 20, page * 20)}
                                                                    </>,
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
        let query: Omit<TabManagerTab_LevelDBSearchQuery<true>, "searchTargets"> & {
            searchTargets: {
                key: Buffer<ArrayBufferLike>;
                displayKey: string;
                value:
                    | {
                          parsed: NBT.NBT;
                          type: NBT.NBTFormat;
                          metadata: NBT.Metadata;
                      }
                    | (() => Promise<{ parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata } | null | undefined>)
                    | null
                    | undefined;
                valueType: {
                    readonly type: "NBT";
                };
                contentType: "ActorPrefix";
                data: KeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: keys.map(
                (key: KeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value: asyncMode ? async () => await NBT.parse((await tab.db!.get(key.rawKey))!) : key.data!,
                        valueType: entryContentTypeToFormatMap.ActorPrefix,
                        contentType: "ActorPrefix",
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
                            // TODO: Uncomment the below line and implement a search query for checking for entries with invalid data.
                            // hasInvalidData: key.data === null,
                            contents:
                                asyncMode ?
                                    async (): Promise<string> => {
                                        try {
                                            return prettyPrintSNBT(prismarineToSNBT((await NBT.parse((await tab.db!.get(key.rawKey))!)).parsed), { indent: 0 });
                                        } catch {
                                            return "";
                                        }
                                    }
                                :   ((): string => {
                                        try {
                                            return prettyPrintSNBT(prismarineToSNBT(key.data!.parsed), { indent: 0 });
                                        } catch {
                                            return "";
                                        }
                                    })(),
                        },
                    }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery<true>["searchTargets"]>[number]
            ),
        };
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                mode = config.views.maps.mode;
                console.debug(query);
                if (asyncMode) {
                    targetKeys =
                        Object.keys(query).length > 1 ?
                            await (async (): Promise<KeyData[]> => {
                                const iterator = tab.dbSearch!.searchAsync(query, true);
                                let i: number = 0;
                                let t: number = Date.now();
                                const results: KeyData[] = [];
                                const formatter = new Intl.NumberFormat();
                                for await (const value of iterator) {
                                    i++;
                                    if (t + 15 < Date.now()) {
                                        if (loadingScreenMessageContainerRef.current)
                                            loadingScreenMessageContainerRef.current.textContent = `Searching LevelDB: ${formatter.format(i)}/${formatter.format(keys.length)} (${formatter.format(results.length)} results)...`;
                                        signal.throwIfAborted();
                                        await sleep(5);
                                        t = Date.now();
                                    }
                                    if (!value) continue;
                                    results.push(value.originalObject.data);
                                }
                                return results;
                            })()
                        :   keys;
                } else {
                    emptyTablesContents = await Promise.all(
                        ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode].map(
                            async (sectionID: (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                                await getMapsTabContentsRows({
                                    tab,
                                    keys:
                                        Object.keys(query).length > 1 ?
                                            tab
                                                .dbSearch!.search(query)
                                                .toArray()
                                                .map((key): KeyData => key.originalObject.data)
                                        :   keys,
                                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Maps.MapsTabSectionMode,
                                    get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                                        return currentUpdateTablesContentsFunction;
                                    },
                                })
                        )
                    );
                    tablesContents = emptyTablesContents;
                }
            }
            const tempElement: HTMLDivElement = document.createElement("div");
            render(<TablesContents />, tempElement);
            tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
        currentUpdateTablesContentsFunction = updateTablesContents;
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                updateTablesContents(true);
            }
            function onSimpleModeColumnsChanged(): void {
                if (mode !== "simple") return;
                updateTablesContents(false);
            }
            config.on("settingChanged:views.maps.mode", onModeChanged);
            config.on("settingChanged:views.maps.modeSettings.simple.columns", onSimpleModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.maps.mode", onModeChanged);
                config.off("settingChanged:views.maps.modeSettings.simple.columns", onSimpleModeColumnsChanged);
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
                                config.views.maps.mode = "simple";
                            }}
                        >
                            Simple
                        </button>
                    </div>
                </div> */}
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
                        class="search-button piximg invert_on_light_theme"
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
                                const keywords = ["dimension", "nbt", "id", "parentid", "locked", "scale", "contents"] as const;
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
                                console.debug("Search query:", searchString, queryData, textQueryData);
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
                                    if ([...getKeywordedOperators(["dimension", "nbt", "id", "parentid", "locked", "scale", "contents"])].includes(key as any))
                                        continue;
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
                                // TODO: Replace these filters with ones for maps.
                                if (
                                    getKeywordedOperators(["dimension", "nbt", "id", "parentid", "locked", "scale"]).some(
                                        (key: string): boolean => key in queryData
                                    )
                                ) {
                                    function parseDimensionQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["dimension"],
                                                value: /^\d+$/.test(v) ? Number(v) : dimensions.indexOf(v as Dimension),
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseIdQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["mapId"],
                                                value: v,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseParentIdQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["parentMapId"],
                                                value: v,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseLockedQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["locked"],
                                                value:
                                                    /^\d+$/i.test(v) ? Number(v)
                                                    : v === "true" ? 1
                                                    : 0,
                                                caseSensitivePath: true,
                                            };
                                        });
                                    }
                                    function parseScaleQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries.map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery => {
                                            return {
                                                path: ["scale"],
                                                value: Number(v),
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
                                    if (["-dimension", "-nbt", "-id", "-parentid", "-locked", "-scale"].some((key: string): boolean => key in queryData)) {
                                        query.nbtTags.noneOf = [];
                                        if (queryData["-dimension"]) query.nbtTags.noneOf.push(...parseDimensionQueries(queryData["-dimension"]));
                                        if (queryData["-id"]) query.nbtTags.noneOf.push(...parseIdQueries(queryData["-id"]));
                                        if (queryData["-parentid"]) query.nbtTags.noneOf.push(...parseParentIdQueries(queryData["-parentid"]));
                                        if (queryData["-locked"]) query.nbtTags.noneOf.push(...parseLockedQueries(queryData["-locked"]));
                                        if (queryData["-scale"]) query.nbtTags.noneOf.push(...parseScaleQueries(queryData["-scale"]));
                                        if (queryData["-nbt"]) query.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                    }
                                    if (keywords.some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.anyOf = [];
                                        if (queryData.dimension) query.nbtTags.anyOf.push(...parseDimensionQueries(queryData.dimension));
                                        if (queryData.id) query.nbtTags.anyOf.push(...parseIdQueries(queryData.id));
                                        if (queryData.parentid) query.nbtTags.anyOf.push(...parseParentIdQueries(queryData.parentid));
                                        if (queryData.locked) query.nbtTags.anyOf.push(...parseLockedQueries(queryData.locked));
                                        if (queryData.scale) query.nbtTags.anyOf.push(...parseScaleQueries(queryData.scale));
                                        if (queryData.nbt) query.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                    }
                                    if (getKeywordedOperators(keywords, ["^"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.oneOf = [];
                                        if (queryData["^dimension"]) query.nbtTags.oneOf.push(...parseDimensionQueries(queryData["^dimension"]));
                                        if (queryData["^id"]) query.nbtTags.oneOf.push(...parseIdQueries(queryData["^id"]));
                                        if (queryData["^parentid"]) query.nbtTags.oneOf.push(...parseParentIdQueries(queryData["^parentid"]));
                                        if (queryData["^locked"]) query.nbtTags.oneOf.push(...parseLockedQueries(queryData["^locked"]));
                                        if (queryData["^scale"]) query.nbtTags.oneOf.push(...parseScaleQueries(queryData["^scale"]));
                                        if (queryData["^nbt"]) query.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                    }
                                    if (getKeywordedOperators(keywords, ["&"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.allOf = [];
                                        if (queryData["&dimension"]) query.nbtTags.allOf.push(...parseDimensionQueries(queryData["&dimension"]));
                                        if (queryData["&id"]) query.nbtTags.allOf.push(...parseIdQueries(queryData["&id"]));
                                        if (queryData["&parentid"]) query.nbtTags.allOf.push(...parseParentIdQueries(queryData["&parentid"]));
                                        if (queryData["&locked"]) query.nbtTags.allOf.push(...parseLockedQueries(queryData["&locked"]));
                                        if (queryData["&scale"]) query.nbtTags.allOf.push(...parseScaleQueries(queryData["&scale"]));
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
                        class="search-help-button piximg invert_on_light_theme"
                        title="Help"
                        onClick={(): void => {
                            let containerElement: HTMLDivElement = document.createElement("div");
                            containerElement.style.display = "contents";
                            function OverlaySearchSyntaxHelpMenu(): JSX.SpecificElement<"div"> {
                                const overlayElementRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
                                return (
                                    <div class="search-syntax-help-page-overlay-container" ref={overlayElementRef}>
                                        <SearchSyntaxHelpMenu
                                            helpInfo={mapsTabSearchSyntax}
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

type CopyContextMenuItemValue =
    | {
          /**
           * The value to copy when the context menu item is selected.
           *
           * If not provided, the context menu item cannot be clicked and only the items in the submenu can be clicked.
           */
          value: string;
          /**
           * Additional value format options to show in a submenu for the user to copy.
           */
          formatOptions?: undefined;
      }
    | {
          /**
           * The value to copy when the context menu item is selected.
           *
           * If not provided, the context menu item cannot be clicked and only the items in the submenu can be clicked.
           */
          value?: string | undefined;
          /**
           * Additional value format options to show in a submenu for the user to copy.
           */
          formatOptions: {
              /**
               * The option label.
               */
              label: string;
              /**
               * The value to copy when the option is selected.
               */
              value: string;
          }[];
      };

async function getMapsTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The full list of key data to display.
     */
    keys: KeyData[];
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.Maps.MapsTabSectionMode;
    get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "simple": {
            const columns = config.views.maps.modeSettings.simple.columns;
            return data.keys.map((key: KeyData): JSX.Element => {
                let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                function Row(): JSX.Element {
                    // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                    const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                    const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                    function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        event.preventDefault();
                        event.stopPropagation();
                        const clickPosition: { x: number; y: number } = {
                            x: event.clientX,
                            y: event.clientY,
                        };
                        // console.log(clickPosition);

                        copyContextMenuItemValue = null;
                        valueCopyContextItemConfiguration: if (rowRef.current && event.target !== null && event.target instanceof Element) {
                            const containerCell: HTMLTableCellElement | null = event.target.closest("td");
                            if (containerCell?.parentElement !== rowRef.current) break valueCopyContextItemConfiguration;
                            if (containerCell.dataset.copyData === undefined) break valueCopyContextItemConfiguration;
                            copyContextMenuItemValue = JSON.parse(containerCell.dataset.copyData) as CopyContextMenuItemValue;
                        }

                        entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                        entryContextMenu_setOpen(true);
                    }
                    function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        data.tab.openTab(
                            {
                                contentType: "Map",
                                icon: "auto",
                                name: key.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "LevelDBEntry",
                                    key: key.rawKey,
                                },
                            },
                            false
                        );
                    }
                    const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
                    try {
                        return (
                            <>
                                <ControlledMenu
                                    anchorPoint={entryContextMenu_anchorPoint}
                                    state={entryContextMenu_isOpen ? "open" : "closed"}
                                    direction="right"
                                    onClose={(): void => void entryContextMenu_setOpen(false)}
                                >
                                    <MenuItem
                                        onClick={async (): Promise<void> => {
                                            if (!data.tab.db) return;
                                            if (!data.tab.db.isOpen()) return;
                                            if (!data.tab.cachedDBKeys) return;
                                            // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config.
                                            await data.tab.db.delete(key.rawKey);
                                            data.tab.setLevelDBIsModified();
                                            const cachedIndex: number = data.tab.cachedDBKeys.Map.findIndex((cachedKey: Buffer): boolean =>
                                                key.rawKey.equals(cachedKey)
                                            );
                                            if (cachedIndex !== -1) data.tab.cachedDBKeys.Map.splice(cachedIndex, 1);
                                            data.updateTablesContents?.(true);
                                        }}
                                    >
                                        Delete LevelDB Entry
                                    </MenuItem>
                                    {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                        <MenuItem
                                            onClick={async (_event: ContextMenu_ClickEvent): Promise<void> => {
                                                // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                                // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                                // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                                if (!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined) return;
                                                clipboard.writeText(copyContextMenuItemValue.value);
                                                // copyContextMenuItemValue = null;
                                            }}
                                            disabled={!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined}
                                        >
                                            Copy Cell Value
                                        </MenuItem>
                                    :   null}
                                    {!!copyContextMenuItemValue?.formatOptions && (
                                        <SubMenu label="Copy Cell Value as...">
                                            {...copyContextMenuItemValue.formatOptions.map(
                                                (formatOption: NonNullable<CopyContextMenuItemValue["formatOptions"]>[number]): JSX.Element => (
                                                    <MenuItem
                                                        onClick={(_event: ContextMenu_ClickEvent): void => {
                                                            clipboard.writeText(formatOption.value);
                                                            copyContextMenuItemValue = null;
                                                        }}
                                                    >
                                                        {formatOption.label}
                                                    </MenuItem>
                                                )
                                            )}
                                        </SubMenu>
                                    )}
                                </ControlledMenu>
                                <tr
                                    data-key={key.rawKey}
                                    onDblClick={(): void => {
                                        data.tab.openTab({
                                            contentType: "Map",
                                            icon: "auto",
                                            name: key.displayKey,
                                            parentTab: data.tab,
                                            target: {
                                                type: "LevelDBEntry",
                                                key: key.rawKey,
                                            },
                                        });
                                    }}
                                    onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                        // Treat Alt+Click as a middle click.
                                        if (!event.altKey) return;
                                        onEntryMiddleClick(event);
                                    }}
                                    onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                        if (event.button !== 1) return;
                                        onEntryMiddleClick(event);
                                    }}
                                    onContextMenu={onEntryRightClick}
                                    ref={rowRef}
                                >
                                    {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                        switch (column) {
                                            case "DBKey":
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            formatOptions: [
                                                                { label: "Raw key hex", value: key.rawKey.toString("hex") },
                                                                { label: "Display key", value: key.displayKey },
                                                            ],
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {key.displayKey}
                                                    </td>
                                                );
                                            case "ID": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.mapId?.type !== "long") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = String(toLong(key.data.parsed.value.mapId.value));
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "DecorationCount":
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (
                                                    key.data.parsed.value.decorations?.type !== "list" ||
                                                    key.data.parsed.value.decorations.value?.type !== "compound"
                                                ) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: String(key.data.parsed.value.decorations.value.value.length),
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {key.data.parsed.value.decorations.value.value.length}
                                                    </td>
                                                );
                                            case "Location": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.xCenter?.type !== "int" || key.data.parsed.value.zCenter?.type !== "int") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = `${[key.data.parsed.value.xCenter.value, key.data.parsed.value.zCenter.value]
                                                    .map((v: number): string => v.toFixed(3))
                                                    .join(", ")} ${
                                                    key.data.parsed.value.dimension?.type === "byte" ?
                                                        (dimensions[key.data.parsed.value.dimension.value] ?? key.data.parsed.value.dimension.value)
                                                    :   "Unknown Dimension"
                                                }`;
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "LocationCompact": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.xCenter?.type !== "int" || key.data.parsed.value.zCenter?.type !== "int") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = `${[key.data.parsed.value.xCenter.value, key.data.parsed.value.zCenter.value]
                                                    .map((v: number): string => v.toFixed(0))
                                                    .join(",")} ${
                                                    key.data.parsed.value.dimension?.type === "byte" ? key.data.parsed.value.dimension.value : "?"
                                                }`;
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "FullyExplored":
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.fullyExplored?.type !== "byte") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: String(
                                                                key.data.parsed.value.fullyExplored.value === 1 ? true
                                                                : key.data.parsed.value.fullyExplored.value === 0 ? false
                                                                : key.data.parsed.value.fullyExplored.value
                                                            ),
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {key.data.parsed.value.fullyExplored.value === 1 ?
                                                            <span style="color: #5F5;">True</span>
                                                        : key.data.parsed.value.fullyExplored.value === 0 ?
                                                            <span style="color: #F55;">False</span>
                                                        :   <span style="color: #FA5;">{key.data.parsed.value.fullyExplored.value}</span>}
                                                    </td>
                                                );
                                            case "Height": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.height?.type !== "short") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = String(key.data.parsed.value.height.value);
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "ParentMapID": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.parentMapId?.type !== "long") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = String(toLong(key.data.parsed.value.parentMapId.value));
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "Scale": {
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data.parsed.value.scale?.type !== "byte") {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">null</span>
                                                        </td>
                                                    );
                                                }
                                                const cellValue: string = key.data.parsed.value.scale.value.toFixed(3);
                                                return (
                                                    <td
                                                        data-copy-data={JSON.stringify({
                                                            value: cellValue,
                                                        } satisfies CopyContextMenuItemValue)}
                                                    >
                                                        {cellValue}
                                                    </td>
                                                );
                                            }
                                            case "Preview":
                                                if (key.data === undefined) {
                                                    return (
                                                        <td>
                                                            <span style="color: yellow;">Loading...</span>
                                                        </td>
                                                    );
                                                }
                                                if (key.data === null) {
                                                    return (
                                                        <td>
                                                            <span style="color: red;">N/A</span>
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td style={{ width: "128px" }}>
                                                        {
                                                            <MapEditor
                                                                dataStorageObject={{
                                                                    data: key.data,
                                                                    dataType: "NBT",
                                                                    mapEditor: {},
                                                                    sourceType: entryContentTypeToFormatMap.Map,
                                                                }}
                                                                readonly
                                                            />
                                                        }
                                                    </td>
                                                );
                                        }
                                    })}
                                </tr>
                            </>
                        );
                    } catch (e) {
                        console.error(e);
                        return (
                            <>
                                <ControlledMenu
                                    anchorPoint={entryContextMenu_anchorPoint}
                                    state={entryContextMenu_isOpen ? "open" : "closed"}
                                    direction="right"
                                    onClose={(): void => void entryContextMenu_setOpen(false)}
                                >
                                    <MenuItem
                                        onClick={async (): Promise<void> => {
                                            if (!data.tab.db) return;
                                            if (!data.tab.db.isOpen()) return;
                                            if (!data.tab.cachedDBKeys) return;
                                            // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config.
                                            await data.tab.db.delete(key.rawKey);
                                            data.tab.setLevelDBIsModified();
                                            const cachedIndex: number = data.tab.cachedDBKeys.Map.findIndex((cachedKey: Buffer): boolean =>
                                                key.rawKey.equals(cachedKey)
                                            );
                                            if (cachedIndex !== -1) data.tab.cachedDBKeys.Map.splice(cachedIndex, 1);
                                            data.updateTablesContents?.(true);
                                        }}
                                    >
                                        Delete LevelDB Entry
                                    </MenuItem>
                                    <MenuItem disabled>Copy Cell Value</MenuItem>
                                </ControlledMenu>
                                <tr
                                    data-key={key.rawKey}
                                    onDblClick={(): void => {
                                        data.tab.openTab({
                                            contentType: "Map",
                                            icon: "auto",
                                            name: key.displayKey,
                                            parentTab: data.tab,
                                            target: {
                                                type: "LevelDBEntry",
                                                key: key.rawKey,
                                            },
                                        });
                                    }}
                                    onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                        // Treat Alt+Click as a middle click.
                                        if (!event.altKey) return;
                                        onEntryMiddleClick(event);
                                    }}
                                    onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                        if (event.button !== 1) return;
                                        onEntryMiddleClick(event);
                                    }}
                                >
                                    <td style={{ color: "red" }}>{String(e)}</td>
                                </tr>
                            </>
                        );
                    }
                }
                return <Row />;
            });
        }
    }
}
