import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import {
    entryContentTypeToFormatMap,
    generateChunkKeyFromIndices,
    getDimensionTypes,
    getKeyDisplayName,
    prettyPrintSNBT,
    prismarineToSNBT,
    type Dimension,
    type EntryContentTypeFormatData,
    type NBTSchemas,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import type { SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import { viewFilesTabSearchSyntax } from "./viewFiles";
import SearchSyntaxHelpMenu from "../components/SearchSyntaxHelpMenu";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import EditorWidgetOverlayBar from "../components/EditorWidgetOverlayBar";
import { dialog } from "@electron/remote";
import showDBKeyCreationDialog from "../components/DBKeyCreationDialog";
import Notice from "../components/Notice";
import { createObservable, type Observable } from "../../src/utils/miscUtils";

/**
 * Props for the {@link TicksTab} component.
 */
export interface TicksTabProps {
    tab: TabManagerTab;
}

// TODO: Finish filling this in.
const ticksTabSearchSyntax: SearchSyntaxHelpInfo = {
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
        contents: {
            description: "Searches the LevelDB entry value as SNBT.",
        },
        nbt: viewFilesTabSearchSyntax.filters.nbt!,
    },
};

/**
 * The ticks tab.
 *
 * This tab is used to manage random ticks and pending ticks.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function TicksTab(props: TicksTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The ticks sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const abortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        return (): void => {
            abortController.abort(new DOMException("Tab switched.", "AbortError"));
        };
    });
    getTicksTabContents(props.tab, abortController.signal).then(
        (element: JSX.Element): void => {
            if (!containerRef.current) return;
            // const tempElement: HTMLDivElement = document.createElement("div");
            render(null, containerRef.current);
            render(element, containerRef.current /* tempElement */);
            // containerRef.current?.replaceChildren(...tempElement.children);
        },
        (reason: unknown): void => {
            if (reason instanceof DOMException && reason.name === "AbortError" && reason.message === "Tab switched.") return;
            if (containerRef.current) {
                // TODO: Replace this with a better error screen.
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent =
                    reason instanceof Error ?
                        reason.stack?.startsWith(reason.toString()) ?
                            reason.stack
                        :   reason.toString() + reason.stack
                    :   String(reason);
                render(null, containerRef.current);
                containerRef.current.replaceChildren("Failed to load data:", errorElement);
            }
            console.error(reason);
        }
    );
    const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    if (!props.tab.db.isOpen()) {
        void props.tab.awaitDBOpen!.then(async (): Promise<void> => {
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
        void props.tab.awaitCachedDBKeys!.then((): void => {
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

interface RandomTickKeyData {
    rawKey: Buffer;
    displayKey: string;
    data?:
        | {
              parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.RandomTicks;
              type: NBT.NBTFormat;
              metadata: NBT.Metadata;
          }
        | null
        | undefined;
}

interface PendingTickKeyData {
    rawKey: Buffer;
    displayKey: string;
    data?:
        | {
              parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.PendingTicks;
              type: NBT.NBTFormat;
              metadata: NBT.Metadata;
          }
        | null
        | undefined;
}

enum UpdateTablesContentsMode {
    None = 0,
    ReloadTablesContents = 1,
    ReloadKeysAndTablesContents = 2,
    ReloadAll = 3,
}

async function getTicksTabContents(tab: TabManagerTab, signal: AbortSignal): Promise<JSX.Element> {
    if (!tab.db) return <div>The ticks sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    if (!tab.db.isOpen() && !((await tab.awaitDBOpen) ?? true)) {
        if (tab.errorDueToEncryptedLevelDB) {
            return (
                <Notice
                    title="Encrypted LevelDB"
                    subtitle="The LevelDB is encrypted. The app cannot open encrypted LevelDBs."
                    detail="If this world is from a marketplace template, that would cause the LevelDB to be encrypted."
                    image="access_denied"
                />
            );
        }
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
                        `${tab.errorOnDBOpen.stack ?? tab.errorOnDBOpen.toString()}${
                            tab.errorOnDBOpen.cause !== undefined ?
                                `\nCaused by: ${String(
                                    ((): unknown => {
                                        try {
                                            return typeof tab.errorOnDBOpen.cause === "object" ?
                                                    JSON.stringify(tab.errorOnDBOpen.cause)
                                                :   tab.errorOnDBOpen.cause;
                                        } catch {
                                            return tab.errorOnDBOpen.cause;
                                        }
                                    })()
                                )}`
                            :   ""
                        }`
                    :   String(
                            (function formatUnknownErrorValue(): unknown {
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
    const asyncMode: boolean =
        "__FORCE_ASYNC_KEY_MODE__" in window ? !!window.__FORCE_ASYNC_KEY_MODE__
        : config.useAsyncModeInEntryViews === "auto" ?
            tab.cachedDBKeys!.RandomTicks.length + tab.cachedDBKeys!.PendingTicks.length >= config.asyncModeEntryThreshold ||
            Object.values(tab.cachedDBKeys!).reduce((a: number, b: Buffer[]): number => a + b.length, 0) >= config.asyncModeTotalKeyCountThreshold
        :   config.useAsyncModeInEntryViews;
    const keys = {
        randomTicks: [] as Buffer[],
        pendingTicks: [] as Buffer[],
    };
    let randomTickKeys: RandomTickKeyData[] = [];
    let pendingTickKeys: PendingTickKeyData[] = [];
    async function reloadKeys(): Promise<void> {
        keys.randomTicks = tab.cachedDBKeys!.RandomTicks;
        keys.pendingTicks = tab.cachedDBKeys!.PendingTicks;
        await Promise.all([
            Promise.all(
                keys.randomTicks.map(
                    async (key: Buffer): Promise<RandomTickKeyData> => ({
                        rawKey: key,
                        displayKey: getKeyDisplayName(key),
                        data: asyncMode ? undefined : ((await NBT.parse((await tab.db!.get(key))!).catch((): null => null)) as RandomTickKeyData["data"]),
                    })
                )
            ).then((data: RandomTickKeyData[]): void => void (randomTickKeys = data)),
            Promise.all(
                keys.pendingTicks.map(
                    async (key: Buffer): Promise<PendingTickKeyData> => ({
                        rawKey: key,
                        displayKey: getKeyDisplayName(key),
                        data: asyncMode ? undefined : ((await NBT.parse((await tab.db!.get(key))!).catch((): null => null)) as PendingTickKeyData["data"]),
                    })
                )
            ).then((data: PendingTickKeyData[]): void => void (pendingTickKeys = data)),
        ]);
    }
    await reloadKeys();
    const targetKeys = {
        randomTicks: randomTickKeys,
        pendingTicks: pendingTickKeys,
    };
    let currentUpdateTablesContentsFunction: ((mode: UpdateTablesContentsMode) => Promise<void>) | null = null;
    let mode: ConfigConstants.views.Ticks.TicksTabMode = config.views.ticks.mode;
    let emptyTablesContents: JSX.Element[][] =
        asyncMode ?
            [[]]
        :   await Promise.all(
                ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode].map(
                    async (sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                        await getTicksTabContentsRows({
                            tab,
                            randomTickKeys,
                            pendingTickKeys,
                            mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Ticks.TicksTabSectionMode,
                            get updateTablesContents(): ((mode: UpdateTablesContentsMode) => Promise<void>) | null {
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
        // const viewOptionsRefs = {
        //     viewOptionsContainer: useRef<HTMLDivElement>(null),
        //     viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
        // };
        // const [data, setData] = useState<{
        //     randomTickKeys: RandomTickKeyData[];
        //     pendingTickKeys: PendingTickKeyData[];
        //     mode: ConfigConstants.views.Ticks.TicksTabMode;
        // }>({
        //     randomTickKeys,
        //     pendingTickKeys,
        //     mode,
        // });
        async function getTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<JSX.Element[]> {
            const sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode][sectionIndex]!;
            return await getTicksTabContentsRows({
                tab,
                // REVIEW // TEST: Make sure this won't crash the tab if an entry with invalid data is present.
                randomTickKeys: await Promise.all(
                    targetKeys.randomTicks.slice(start, end).map(
                        async (key: RandomTickKeyData): Promise<RandomTickKeyData> => ({
                            ...key,
                            data: (await NBT.parse((await tab.db!.get(key.rawKey))!)) as RandomTickKeyData["data"],
                        })
                    )
                ),
                // REVIEW // TEST: Make sure this won't crash the tab if an entry with invalid data is present.
                pendingTickKeys: await Promise.all(
                    targetKeys.pendingTicks.slice(start, end).map(
                        async (key: PendingTickKeyData): Promise<PendingTickKeyData> => ({
                            ...key,
                            data: (await NBT.parse((await tab.db!.get(key.rawKey))!)) as PendingTickKeyData["data"],
                        })
                    )
                ),
                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Ticks.TicksTabSectionMode,
                get updateTablesContents(): ((mode: UpdateTablesContentsMode) => Promise<void>) | null {
                    return currentUpdateTablesContentsFunction;
                },
            });
        }
        async function _loadTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<void> {
            if (!asyncMode) return;
            // const sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number] =
            //     ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode][sectionIndex]!;
            tablesContents = [...tablesContents];
            tablesContents[sectionIndex] = [...emptyTablesContents[sectionIndex]!];
            tablesContents[sectionIndex].splice(start, end - start, ...(await getTablesContentsInRange(sectionIndex, start, end)));
        }
        function getSectionEntryCounts(): number[] {
            return ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode].map(
                (sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number]): number => {
                    switch (sectionID) {
                        case "randomTicks":
                        case "pendingTicks":
                            return targetKeys[sectionID].length;
                        default:
                            return NaN;
                    }
                }
            );
        }
        function TablesContents(): JSX.Element {
            const localTablesContents: Observable<JSX.Element[][]> = createObservable([[]]);
            if (asyncMode) {
                // TODO: Add an error handler to this.
                void Promise.all(
                    ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode].map(
                        async (
                            _sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): Promise<JSX.Element[]> => await getTablesContentsInRange(index, 0, 20)
                    )
                ).then((tablesContents: JSX.Element[][]): void => {
                    localTablesContents.set(tablesContents);
                });
            }
            return (
                <>
                    {...ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number], index: number): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                localTablesContents.observe((tablesContents: JSX.Element[][]): void => {
                                    if (!asyncMode || !bodyRef.current) return;
                                    // const tempElement: HTMLDivElement = document.createElement("div");
                                    render(null, bodyRef.current);
                                    render(<>{...tablesContents[index]!}</>, bodyRef.current /* tempElement */);
                                    // bodyRef.current.replaceChildren(...tempElement.children);
                                });
                                // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                                // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                const headerName = ConfigConstants.views.Ticks.ticksTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Ticks.TicksTabSectionMode =
                                    sectionID === null ? (mode as null extends typeof sectionID ? typeof mode : never) : `${mode}_${sectionID}`;
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
                                                        <th colSpan={ConfigConstants.views.Ticks.ticksTabModeToColumnIDs[sectionMode].length}>{headerName}</th>
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
                                                    {...(sectionID === null ?
                                                        config.views.ticks.modeSettings[mode].columns
                                                    :   config.views.ticks.modeSettings[mode].sections[sectionID].columns
                                                    ).map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Ticks.ticksTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Ticks.columnIDToDisplayName[columnID];
                                                            return (
                                                                <th>
                                                                    {typeof displayName === "string" ?
                                                                        displayName
                                                                    :   (displayName as { optionLabel: string; headerLabel: string }).headerLabel}
                                                                </th>
                                                            );
                                                        }
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody ref={bodyRef}>
                                                {...asyncMode ? localTablesContents.get()[index]! : tablesContents[index]!.slice(0, 20)}
                                            </tbody>
                                            <tfoot>
                                                <tr class="table-footer-row-page-navigation">
                                                    <td colSpan={ConfigConstants.views.Ticks.ticksTabModeToColumnIDs[sectionMode].length}>
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
        async function updateTablesContents(updateMode: UpdateTablesContentsMode): Promise<void> {
            // TODO: Add an error handler to this function.
            if (!tablesContainerRef.current) return;
            if (updateMode >= 3) {
                await tab.refreshCachedDBKeys();
            }
            if (updateMode >= 2) {
                await reloadKeys();
            }
            if (updateMode >= 1) {
                mode = config.views.ticks.mode;
                if (asyncMode) {
                    const sectionIDToQueryMap = {
                        randomTicks: randomTickQuery,
                        pendingTicks: pendingTickQuery,
                    } as const satisfies Record<(typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number], unknown>;
                    const sectionIDToKeysMap = {
                        randomTicks: randomTickKeys,
                        pendingTicks: pendingTickKeys,
                    } as const satisfies Record<(typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number], unknown>;
                    for (const sectionID of ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode]) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- This is necessary.
                        (targetKeys[sectionID] as (typeof sectionIDToKeysMap)[typeof sectionID]) =
                            Object.keys(sectionIDToQueryMap[sectionID]).length > 1 ?
                                await (async (): Promise<(typeof sectionIDToKeysMap)[typeof sectionID]> => {
                                    const iterator = tab.dbSearch!.searchAsync(sectionIDToQueryMap[sectionID], true);
                                    let i: number = 0;
                                    let t: number = Date.now();
                                    const results: (typeof sectionIDToKeysMap)[typeof sectionID][number][] = [];
                                    const formatter = new Intl.NumberFormat();
                                    for await (const value of iterator) {
                                        i++;
                                        if (t + 15 < Date.now()) {
                                            if (loadingScreenMessageContainerRef.current) {
                                                loadingScreenMessageContainerRef.current.textContent = `Searching LevelDB: ${formatter.format(i)}/${formatter.format(sectionIDToKeysMap[sectionID].length)} (${formatter.format(results.length)} results)...`;
                                            }
                                            signal.throwIfAborted();
                                            await sleep(5);
                                            t = Date.now();
                                        }
                                        if (!value) continue;
                                        results.push(value.originalObject.data);
                                    }
                                    return results;
                                })()
                            :   sectionIDToKeysMap[sectionID];
                    }
                } else {
                    emptyTablesContents = await Promise.all(
                        ConfigConstants.views.Ticks.ticksTabModeToSectionIDs[mode].map(
                            async (sectionID: (typeof ConfigConstants.views.Ticks.ticksTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                                await getTicksTabContentsRows({
                                    tab,
                                    randomTickKeys:
                                        Object.keys(randomTickQuery).length > 1 ?
                                            tab
                                                .dbSearch!.search(randomTickQuery)
                                                .toArray()
                                                .map((key): RandomTickKeyData => key.originalObject.data)
                                        :   randomTickKeys,
                                    pendingTickKeys:
                                        Object.keys(pendingTickQuery).length > 1 ?
                                            tab
                                                .dbSearch!.search(pendingTickQuery)
                                                .toArray()
                                                .map((key): PendingTickKeyData => key.originalObject.data)
                                        :   pendingTickKeys,
                                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Ticks.TicksTabSectionMode,
                                    get updateTablesContents(): ((mode: UpdateTablesContentsMode) => Promise<void>) | null {
                                        return currentUpdateTablesContentsFunction;
                                    },
                                })
                        )
                    );
                    tablesContents = emptyTablesContents;
                }
            }
            // const tempElement: HTMLDivElement = document.createElement("div");
            render(null, tablesContainerRef.current);
            render(<TablesContents />, tablesContainerRef.current /* tempElement */);
            // tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
        currentUpdateTablesContentsFunction = updateTablesContents;
        let randomTickQuery: Omit<TabManagerTab_LevelDBSearchQuery<true>, "searchTargets"> & {
            searchTargets: {
                key: Buffer<ArrayBufferLike>;
                displayKey: string;
                value:
                    | {
                          parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.RandomTicks;
                          type: NBT.NBTFormat;
                          metadata: NBT.Metadata;
                      }
                    | (() => Promise<
                          | { parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.RandomTicks; type: NBT.NBTFormat; metadata: NBT.Metadata }
                          | null
                          | undefined
                      >)
                    | null
                    | undefined;
                valueType:
                    | {
                          readonly type: "NBT";
                      }
                    | Extract<EntryContentTypeFormatData, { type: "custom"; resultType: "JSONNBT" }>;
                contentType: "RandomTicks";
                data: RandomTickKeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: randomTickKeys.map(
                (key: RandomTickKeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value:
                            asyncMode ?
                                async (): Promise<NonNullable<RandomTickKeyData["data"]>> =>
                                    (await NBT.parse((await tab.db!.get(key.rawKey))!)) as NonNullable<RandomTickKeyData["data"]>
                            :   key.data!,
                        valueType: entryContentTypeToFormatMap.RandomTicks,
                        contentType: "RandomTicks",
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
                                        if (key.data === null) return "";
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
        let pendingTickQuery: Omit<TabManagerTab_LevelDBSearchQuery<true>, "searchTargets"> & {
            searchTargets: {
                key: Buffer<ArrayBufferLike>;
                displayKey: string;
                value:
                    | {
                          parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.PendingTicks;
                          type: NBT.NBTFormat;
                          metadata: NBT.Metadata;
                      }
                    | (() => Promise<
                          | { parsed: Pick<NBT.NBT, "name"> & NBTSchemas.NBTSchemaTypes.PendingTicks; type: NBT.NBTFormat; metadata: NBT.Metadata }
                          | null
                          | undefined
                      >)
                    | null
                    | undefined;
                valueType:
                    | {
                          readonly type: "NBT";
                      }
                    | Extract<EntryContentTypeFormatData, { type: "custom"; resultType: "JSONNBT" }>;
                contentType: "PendingTicks";
                data: PendingTickKeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: pendingTickKeys.map(
                (key: PendingTickKeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value:
                            asyncMode ?
                                async (): Promise<NonNullable<PendingTickKeyData["data"]>> =>
                                    (await NBT.parse((await tab.db!.get(key.rawKey))!)) as NonNullable<PendingTickKeyData["data"]>
                            :   key.data,
                        valueType: entryContentTypeToFormatMap.PendingTicks,
                        contentType: "PendingTicks",
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
                                        if (key.data === null) return "";
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
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                void updateTablesContents(UpdateTablesContentsMode.ReloadTablesContents);
            }
            function onSimpleModeColumnsChanged(): void {
                if (mode !== "simple") return;
                void updateTablesContents(UpdateTablesContentsMode.None);
            }
            config.on("settingChanged:views.ticks.mode", onModeChanged);
            config.on("settingChanged:views.ticks.modeSettings.simple.sections.randomTicks.columns", onSimpleModeColumnsChanged);
            config.on("settingChanged:views.ticks.modeSettings.simple.sections.pendingTicks.columns", onSimpleModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.ticks.mode", onModeChanged);
                config.off("settingChanged:views.ticks.modeSettings.simple.sections.randomTicks.columns", onSimpleModeColumnsChanged);
                config.off("settingChanged:views.ticks.modeSettings.simple.sections.pendingTicks.columns", onSimpleModeColumnsChanged);
            };
        });
        let lastHideErrorPopupFunction: (() => void) | undefined;
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
                                config.views.ticks.mode = "simple";
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
                            title="Clear Random Ticks"
                            onClick={async (): Promise<void> => {
                                if (!tab.cachedDBKeys) return;
                                await Promise.all(
                                    tab.cachedDBKeys.RandomTicks.map(
                                        async (key: Buffer): Promise<void> =>
                                            void (await tab.db!.delete(key).then((success: boolean): void => {
                                                if (!success) return;
                                                tab.setLevelDBIsModified();
                                                if (tab.cachedDBKeys?.RandomTicks?.includes(key)) {
                                                    tab.cachedDBKeys.RandomTicks.splice(tab.cachedDBKeys.RandomTicks.indexOf(key), 1);
                                                }
                                                if (randomTickKeys.some((k: RandomTickKeyData): boolean => k.rawKey.equals(key))) {
                                                    randomTickKeys.splice(
                                                        randomTickKeys.findIndex((k: RandomTickKeyData): boolean => k.rawKey.equals(key)),
                                                        1
                                                    );
                                                }
                                            }))
                                    )
                                );
                                void updateTablesContents(UpdateTablesContentsMode.ReloadTablesContents);
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/delete.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            Clear Random Ticks
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Clear Pending Ticks"
                            onClick={async (): Promise<void> => {
                                if (!tab.cachedDBKeys) return;
                                await Promise.all(
                                    tab.cachedDBKeys.PendingTicks.map(
                                        async (key: Buffer): Promise<void> =>
                                            void (await tab.db!.delete(key).then((success: boolean): void => {
                                                if (!success) return;
                                                tab.setLevelDBIsModified();
                                                if (tab.cachedDBKeys?.PendingTicks?.includes(key)) {
                                                    tab.cachedDBKeys.PendingTicks.splice(tab.cachedDBKeys.PendingTicks.indexOf(key), 1);
                                                }
                                                if (pendingTickKeys.some((k: PendingTickKeyData): boolean => k.rawKey.equals(key))) {
                                                    pendingTickKeys.splice(
                                                        pendingTickKeys.findIndex((k: PendingTickKeyData): boolean => k.rawKey.equals(key)),
                                                        1
                                                    );
                                                }
                                            }))
                                    )
                                );
                                void updateTablesContents(UpdateTablesContentsMode.ReloadTablesContents);
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/delete.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            Clear Pending Ticks
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Clear All Ticks"
                            onClick={async (): Promise<void> => {
                                if (!tab.cachedDBKeys) return;
                                await Promise.all([
                                    ...tab.cachedDBKeys.RandomTicks.map(
                                        async (key: Buffer): Promise<void> =>
                                            void (await tab.db!.delete(key).then((success: boolean): void => {
                                                if (!success) return;
                                                tab.setLevelDBIsModified();
                                                if (tab.cachedDBKeys?.RandomTicks?.includes(key)) {
                                                    tab.cachedDBKeys.RandomTicks.splice(tab.cachedDBKeys.RandomTicks.indexOf(key), 1);
                                                }
                                                if (randomTickKeys.some((k: RandomTickKeyData): boolean => k.rawKey.equals(key))) {
                                                    randomTickKeys.splice(
                                                        randomTickKeys.findIndex((k: RandomTickKeyData): boolean => k.rawKey.equals(key)),
                                                        1
                                                    );
                                                }
                                            }))
                                    ),
                                    ...tab.cachedDBKeys.PendingTicks.map(
                                        async (key: Buffer): Promise<void> =>
                                            void (await tab.db!.delete(key).then((success: boolean): void => {
                                                if (!success) return;
                                                tab.setLevelDBIsModified();
                                                if (tab.cachedDBKeys?.PendingTicks?.includes(key)) {
                                                    tab.cachedDBKeys.PendingTicks.splice(tab.cachedDBKeys.PendingTicks.indexOf(key), 1);
                                                }
                                                if (pendingTickKeys.some((k: PendingTickKeyData): boolean => k.rawKey.equals(key))) {
                                                    pendingTickKeys.splice(
                                                        pendingTickKeys.findIndex((k: PendingTickKeyData): boolean => k.rawKey.equals(key)),
                                                        1
                                                    );
                                                }
                                            }))
                                    ),
                                ]);
                                void updateTablesContents(UpdateTablesContentsMode.ReloadTablesContents);
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/delete.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            Clear All Ticks
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="New RandomTicks Entry"
                            onClick={async (): Promise<void> => {
                                try {
                                    if (!tab.db) return;
                                    if (!tab.db.isOpen()) return;
                                    if (!tab.cachedDBKeys) return;
                                    let dimensionTypes: Record<Dimension | `${string}:${string}`, number> | undefined;
                                    try {
                                        dimensionTypes = await getDimensionTypes(tab.db);
                                    } catch (e) {
                                        console.error("Error while getting dimension types for prompt for creating a new RandomTicks entry:", e);
                                    }
                                    const creationOptions = await showDBKeyCreationDialog({
                                        options: ["chunkX", "chunkZ", "dimension"],
                                        dimensionTypes,
                                        message: "Please enter the paremters for the new RandomTicks entry.",
                                    });
                                    if (creationOptions.canceled) return;
                                    const key: Buffer = generateChunkKeyFromIndices(
                                        { x: creationOptions.data.chunkX, z: creationOptions.data.chunkZ, dimension: creationOptions.data.dimension },
                                        "RandomTicks"
                                    );
                                    if (await tab.db.get(key)) {
                                        void dialog.showMessageBox({
                                            type: "error",
                                            title: "Duplicate Key",
                                            message: `Unable to create a new RandomTicks entry at chunk ${creationOptions.data.chunkX} ${creationOptions.data.chunkZ} in dimension ${creationOptions.data.dimension}.`,
                                            detail: "There is already a RandomTicks entry at this location.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    await tab.db.put(key, entryContentTypeToFormatMap.RandomTicks.defaultValue);
                                    tab.setLevelDBIsModified();
                                    tab.cachedDBKeys.RandomTicks.push(key);
                                    tab.openTab({
                                        contentType: "RandomTicks",
                                        icon: "auto",
                                        name: getKeyDisplayName(key),
                                        parentTab: tab,
                                        target: {
                                            type: "LevelDBEntry",
                                            key,
                                        },
                                    });
                                } catch (e) {
                                    void dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: `An error occurred while creating the RandomTicks entry.`,
                                        detail: e instanceof Error ? (e.stack ?? String(e)) : String(e),
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/Data-Empty.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            New RandomTicks Entry
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="New PendingTicks Entry"
                            onClick={async (): Promise<void> => {
                                try {
                                    if (!tab.db) return;
                                    if (!tab.db.isOpen()) return;
                                    if (!tab.cachedDBKeys) return;
                                    let dimensionTypes: Record<Dimension | `${string}:${string}`, number> | undefined;
                                    try {
                                        dimensionTypes = await getDimensionTypes(tab.db);
                                    } catch (e) {
                                        console.error("Error while getting dimension types for prompt for creating a new RandomTicks entry:", e);
                                    }
                                    const creationOptions = await showDBKeyCreationDialog({
                                        options: ["chunkX", "chunkZ", "dimension"],
                                        dimensionTypes,
                                        message: "Please enter the paremters for the new PendingTicks entry.",
                                    });
                                    if (creationOptions.canceled) return;
                                    const key: Buffer = generateChunkKeyFromIndices(
                                        { x: creationOptions.data.chunkX, z: creationOptions.data.chunkZ, dimension: creationOptions.data.dimension },
                                        "PendingTicks"
                                    );
                                    if (await tab.db.get(key)) {
                                        void dialog.showMessageBox({
                                            type: "error",
                                            title: "Duplicate Key",
                                            message: `Unable to create a new PendingTicks entry at chunk ${creationOptions.data.chunkX} ${creationOptions.data.chunkZ} in dimension ${creationOptions.data.dimension}.`,
                                            detail: "There is already a PendingTicks entry at this location.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    await tab.db.put(key, entryContentTypeToFormatMap.PendingTicks.defaultValue);
                                    tab.setLevelDBIsModified();
                                    tab.cachedDBKeys.PendingTicks.push(key);
                                    tab.openTab({
                                        contentType: "PendingTicks",
                                        icon: "auto",
                                        name: getKeyDisplayName(key),
                                        parentTab: tab,
                                        target: {
                                            type: "LevelDBEntry",
                                            key,
                                        },
                                    });
                                } catch (e) {
                                    void dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: `An error occurred while creating the PendingTicks entry.`,
                                        detail: e instanceof Error ? (e.stack ?? String(e)) : String(e),
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                }
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/Data-Empty.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            New PendingTicks Entry
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
                        class="search-button piximg invert_on_light_theme"
                        title="Search"
                        onClick={(): void => {
                            try {
                                if (!searchRefs.searchTextBox.current) return;
                                delete pendingTickQuery.contentTypes;
                                delete pendingTickQuery.displayKeyContents;
                                delete pendingTickQuery.excludeContentTypes;
                                delete pendingTickQuery.nbtTags;
                                delete pendingTickQuery.rawKeyContents;
                                delete pendingTickQuery.rawValueContents;
                                delete pendingTickQuery.contentsStringContents;
                                delete pendingTickQuery.customDataFields;
                                delete randomTickQuery.contentTypes;
                                delete randomTickQuery.displayKeyContents;
                                delete randomTickQuery.excludeContentTypes;
                                delete randomTickQuery.nbtTags;
                                delete randomTickQuery.rawKeyContents;
                                delete randomTickQuery.rawValueContents;
                                delete randomTickQuery.contentsStringContents;
                                delete randomTickQuery.customDataFields;
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
                                const keywords = ["nbt", "contents"] as const;
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
                                    if (!Object.hasOwn(queryData, key)) continue;
                                    if ([...getKeywordedOperators(["nbt", "contents"])].includes(key as never)) continue;
                                    if (
                                        !keywordPrefixOperators.includes(key.slice(0, 1) as never) &&
                                        keywords.includes(key.slice(1) as never) &&
                                        /^[^a-z0-9]$/i.test(key.slice(0, 1))
                                    ) {
                                        showError({ message: `Unknown operator: ${key.slice(0, 1)}` });
                                    } else if (!keywordedOperators.includes(key as never)) {
                                        showError({
                                            message: `Unknown filter: ${keywordPrefixOperators.includes(key.slice(0, 1) as never) ? key.slice(1) : key}`,
                                        });
                                    } else {
                                        showError({ message: `Operator ${key.slice(0, 1)} is not supported for filter: ${key.slice(1)}` });
                                    }
                                    return;
                                }
                                if (getKeywordedOperators(["nbt"]).some((key: string): boolean => key in queryData)) {
                                    function parseNBTQueries(queries: string[]): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery[] {
                                        return queries
                                            .map((v: string): TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery | undefined => {
                                                let data: TabManagerTab_LevelDBSearchQuery_NBTTags_TagQuery | undefined;
                                                try {
                                                    const val: unknown = JSON.parse(v);
                                                    if (typeof val !== "object") {
                                                        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
                                                        switch (typeof val) {
                                                            // case "string":
                                                            //     if ()
                                                            default:
                                                                throw new SyntaxError(`Expected a JSON object for NBT query, but got ${typeof val} instead.`);
                                                        }
                                                    } else {
                                                        if (val === null) throw new SyntaxError("Expected a JSON object for NBT query, but got null instead.");
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
                                                            throw new SyntaxError("Missing known fields for NBT query.");
                                                        }
                                                    }
                                                } catch (e) {
                                                    if (v.split("=").length === 2) {
                                                        let [key, value] = v.split("=");
                                                        let tagType: NBT.TagType | undefined;
                                                        if (key?.includes(":")) {
                                                            let preKey: string;
                                                            [preKey, key] = key.split(":") as [preKey: string, key: string, ...string[]];
                                                            if (preKey !== "*") {
                                                                if (preKey in NBT.TagType) {
                                                                    tagType = preKey.toLowerCase() as NBT.TagType;
                                                                }
                                                            }
                                                        }
                                                        const path: string[] | undefined = key?.split("/");
                                                        data = {};
                                                        data.key = key;
                                                        data.value = value;
                                                        data.path = path;
                                                        data.tagType = tagType;
                                                    } else {
                                                        // TODO: The actual error should be displayed in the error message. #54
                                                        reportError(e); // TEMP: Remove this once the actual error is included in the error message.
                                                        showError({ message: `Invalid NBT query: ${v}` });
                                                        throw new Error("Error to return but already handled.", { cause: e });
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
                                    pendingTickQuery.nbtTags = {};
                                    randomTickQuery.nbtTags = {};
                                    if (["-nbt"].some((key: string): boolean => key in queryData)) {
                                        pendingTickQuery.nbtTags.noneOf = [];
                                        randomTickQuery.nbtTags.noneOf = [];
                                        if (queryData["-nbt"]) {
                                            pendingTickQuery.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                            randomTickQuery.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                        }
                                    }
                                    if (keywords.some((v: string): boolean => v in queryData)) {
                                        pendingTickQuery.nbtTags.anyOf = [];
                                        randomTickQuery.nbtTags.anyOf = [];
                                        if (queryData.nbt) {
                                            pendingTickQuery.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                            randomTickQuery.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                        }
                                    }
                                    if (getKeywordedOperators(keywords, ["^"]).some((v: string): boolean => v in queryData)) {
                                        pendingTickQuery.nbtTags.oneOf = [];
                                        randomTickQuery.nbtTags.oneOf = [];
                                        if (queryData["^nbt"]) {
                                            pendingTickQuery.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                            randomTickQuery.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                        }
                                    }
                                    if (getKeywordedOperators(keywords, ["&"]).some((v: string): boolean => v in queryData)) {
                                        pendingTickQuery.nbtTags.allOf = [];
                                        randomTickQuery.nbtTags.allOf = [];
                                        if (queryData["&nbt"]) {
                                            pendingTickQuery.nbtTags.allOf.push(...parseNBTQueries(queryData["&nbt"]));
                                            randomTickQuery.nbtTags.allOf.push(...parseNBTQueries(queryData["&nbt"]));
                                        }
                                    }
                                }
                                if (queryData["-contents"] !== undefined) {
                                    pendingTickQuery.customDataFields ??= {};
                                    pendingTickQuery.customDataFields.contents ??= {};
                                    pendingTickQuery.customDataFields.contents.noneOf ??= [];
                                    pendingTickQuery.customDataFields.contents.noneOf.push(...queryData["-contents"]);
                                    randomTickQuery.customDataFields ??= {};
                                    randomTickQuery.customDataFields.contents ??= {};
                                    randomTickQuery.customDataFields.contents.noneOf ??= [];
                                    randomTickQuery.customDataFields.contents.noneOf.push(...queryData["-contents"]);
                                }
                                if (queryData["|contents"] !== undefined) {
                                    pendingTickQuery.customDataFields ??= {};
                                    pendingTickQuery.customDataFields.contents ??= {};
                                    pendingTickQuery.customDataFields.contents.anyOf ??= [];
                                    pendingTickQuery.customDataFields.contents.anyOf.push(...queryData["|contents"]);
                                    randomTickQuery.customDataFields ??= {};
                                    randomTickQuery.customDataFields.contents ??= {};
                                    randomTickQuery.customDataFields.contents.anyOf ??= [];
                                    randomTickQuery.customDataFields.contents.anyOf.push(...queryData["|contents"]);
                                }
                                if (queryData.contents !== undefined) {
                                    pendingTickQuery.customDataFields ??= {};
                                    pendingTickQuery.customDataFields.contents ??= {};
                                    pendingTickQuery.customDataFields.contents.anyOf ??= [];
                                    pendingTickQuery.customDataFields.contents.anyOf.push(...queryData.contents);
                                    randomTickQuery.customDataFields ??= {};
                                    randomTickQuery.customDataFields.contents ??= {};
                                    randomTickQuery.customDataFields.contents.anyOf ??= [];
                                    randomTickQuery.customDataFields.contents.anyOf.push(...queryData.contents);
                                }
                                if (queryData["&contents"] !== undefined) {
                                    pendingTickQuery.customDataFields ??= {};
                                    pendingTickQuery.customDataFields.contents ??= {};
                                    pendingTickQuery.customDataFields.contents.allOf ??= [];
                                    pendingTickQuery.customDataFields.contents.allOf.push(...queryData["&contents"]);
                                    randomTickQuery.customDataFields ??= {};
                                    randomTickQuery.customDataFields.contents ??= {};
                                    randomTickQuery.customDataFields.contents.allOf ??= [];
                                    randomTickQuery.customDataFields.contents.allOf.push(...queryData["&contents"]);
                                }
                                if (queryData["^contents"] !== undefined) {
                                    pendingTickQuery.customDataFields ??= {};
                                    pendingTickQuery.customDataFields.contents ??= {};
                                    pendingTickQuery.customDataFields.contents.oneOf ??= [];
                                    pendingTickQuery.customDataFields.contents.oneOf.push(...queryData["^contents"]);
                                    randomTickQuery.customDataFields ??= {};
                                    randomTickQuery.customDataFields.contents ??= {};
                                    randomTickQuery.customDataFields.contents.oneOf ??= [];
                                    randomTickQuery.customDataFields.contents.oneOf.push(...queryData["^contents"]);
                                }
                                if (textQueryData.length > 0) {
                                    pendingTickQuery.contentsStringContents ??= {};
                                    randomTickQuery.contentsStringContents ??= {};
                                    for (const textQuery of textQueryData) {
                                        if (textQuery.negated) {
                                            pendingTickQuery.contentsStringContents.noneOf = [];
                                            pendingTickQuery.contentsStringContents.noneOf.push(textQuery.text);
                                            randomTickQuery.contentsStringContents.noneOf = [];
                                            randomTickQuery.contentsStringContents.noneOf.push(textQuery.text);
                                        } else if (textQuery.text.startsWith("^")) {
                                            pendingTickQuery.contentsStringContents.oneOf ??= [];
                                            pendingTickQuery.contentsStringContents.oneOf.push(textQuery.text.slice(1));
                                            randomTickQuery.contentsStringContents.oneOf ??= [];
                                            randomTickQuery.contentsStringContents.oneOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("&")) {
                                            pendingTickQuery.contentsStringContents.allOf ??= [];
                                            pendingTickQuery.contentsStringContents.allOf.push(textQuery.text.slice(1));
                                            randomTickQuery.contentsStringContents.allOf ??= [];
                                            randomTickQuery.contentsStringContents.allOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("|")) {
                                            pendingTickQuery.contentsStringContents.anyOf ??= [];
                                            pendingTickQuery.contentsStringContents.anyOf.push(textQuery.text.slice(1));
                                            randomTickQuery.contentsStringContents.anyOf ??= [];
                                            randomTickQuery.contentsStringContents.anyOf.push(textQuery.text.slice(1));
                                        } else {
                                            pendingTickQuery.contentsStringContents.anyOf ??= [];
                                            pendingTickQuery.contentsStringContents.anyOf.push(textQuery.text);
                                            randomTickQuery.contentsStringContents.anyOf ??= [];
                                            randomTickQuery.contentsStringContents.anyOf.push(textQuery.text);
                                        }
                                    }
                                }
                                if (searchRefs.searchTextBox.current) searchRefs.searchTextBox.current.blur();
                                if (tablesContainerRef.current) {
                                    // const tempElement: HTMLDivElement = document.createElement("div");
                                    render(null, tablesContainerRef.current);
                                    render(
                                        <div style="width: 100%; height: 100%; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
                                            <LoadingScreenContents messageContainerRef={loadingScreenMessageContainerRef} />
                                        </div>,
                                        tablesContainerRef.current // tempElement
                                    );
                                    // tablesContainerRef.current.replaceChildren(...tempElement.children);
                                }
                                void updateTablesContents(UpdateTablesContentsMode.ReloadTablesContents);
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
                            const containerElement: HTMLDivElement = document.createElement("div");
                            containerElement.style.display = "contents";
                            function OverlaySearchSyntaxHelpMenu(): JSX.SpecificElement<"div"> {
                                const overlayElementRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
                                return (
                                    <div class="search-syntax-help-page-overlay-container" ref={overlayElementRef}>
                                        <SearchSyntaxHelpMenu
                                            helpInfo={ticksTabSearchSyntax}
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

// eslint-disable-next-line @typescript-eslint/require-await -- TEMP
async function getTicksTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The list of random tick key data to display.
     */
    randomTickKeys: RandomTickKeyData[];
    /**
     * The list of pending tick key data to display.
     */
    pendingTickKeys: PendingTickKeyData[];
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.Ticks.TicksTabSectionMode;
    get updateTablesContents(): ((mode: UpdateTablesContentsMode) => void) | null;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "simple_randomTicks": {
            const columns = config.views.ticks.modeSettings.simple.sections.randomTicks.columns;
            return data.randomTickKeys.map((randomTickKey: RandomTickKeyData): JSX.Element => {
                // IDEA: Make it so that when right clicking on different cells of the row, there will be an addition context menu option to copy the value of that cell.
                function Row(): JSX.Element {
                    const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                    const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                    function onEntryRightClick(event: JSX.TargetedMouseEvent<HTMLTableRowElement>): void {
                        event.preventDefault();
                        event.stopPropagation();
                        // const clickPosition: { x: number; y: number } = {
                        //     x: event.clientX,
                        //     y: event.clientY,
                        // };
                        // console.log(clickPosition);

                        entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                        entryContextMenu_setOpen(true);
                    }
                    function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        data.tab.openTab(
                            {
                                contentType: "RandomTicks",
                                icon: "auto",
                                name: randomTickKey.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "LevelDBEntry",
                                    key: randomTickKey.rawKey,
                                },
                            },
                            false
                        );
                    }
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
                                        await data.tab.db.delete(randomTickKey.rawKey);
                                        data.tab.setLevelDBIsModified();
                                        const cachedIndex: number = data.tab.cachedDBKeys.RandomTicks.findIndex((key: Buffer): boolean =>
                                            randomTickKey.rawKey.equals(key)
                                        );
                                        if (cachedIndex !== -1) data.tab.cachedDBKeys.RandomTicks.splice(cachedIndex, 1);
                                        data.updateTablesContents?.(UpdateTablesContentsMode.ReloadKeysAndTablesContents);
                                    }}
                                >
                                    Delete LevelDB Entry
                                </MenuItem>
                            </ControlledMenu>
                            <tr
                                onDblClick={(): void => {
                                    data.tab.openTab({
                                        contentType: "RandomTicks",
                                        icon: "auto",
                                        name: randomTickKey.displayKey,
                                        parentTab: data.tab,
                                        target: {
                                            type: "LevelDBEntry",
                                            key: randomTickKey.rawKey,
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
                            >
                                {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                    switch (column) {
                                        // TODO: Add more columns here. #65
                                        case "DBKey":
                                            return <td>{randomTickKey.displayKey}</td>;
                                        default:
                                            return (
                                                <td>
                                                    <span style="color: red;">ERROR: MISSING COLUMN HANDLER</span>
                                                </td>
                                            );
                                    }
                                })}
                            </tr>
                        </>
                    );
                }
                return <Row />;
            });
        }
        case "simple_pendingTicks": {
            const columns = config.views.ticks.modeSettings.simple.sections.pendingTicks.columns;
            return data.pendingTickKeys.map((pendingTickKey: PendingTickKeyData): JSX.Element => {
                function Row(): JSX.Element {
                    const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                    const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                    function onEntryRightClick(event: JSX.TargetedMouseEvent<HTMLTableRowElement>): void {
                        event.preventDefault();
                        event.stopPropagation();
                        // const clickPosition: { x: number; y: number } = {
                        //     x: event.clientX,
                        //     y: event.clientY,
                        // };
                        // console.log(clickPosition);

                        entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                        entryContextMenu_setOpen(true);
                    }
                    function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        data.tab.openTab(
                            {
                                contentType: "PendingTicks",
                                icon: "auto",
                                name: pendingTickKey.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "LevelDBEntry",
                                    key: pendingTickKey.rawKey,
                                },
                            },
                            false
                        );
                    }
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
                                        await data.tab.db.delete(pendingTickKey.rawKey);
                                        data.tab.setLevelDBIsModified();
                                        const cachedIndex: number = data.tab.cachedDBKeys.PendingTicks.findIndex((key: Buffer): boolean =>
                                            pendingTickKey.rawKey.equals(key)
                                        );
                                        if (cachedIndex !== -1) data.tab.cachedDBKeys.PendingTicks.splice(cachedIndex, 1);
                                        data.updateTablesContents?.(UpdateTablesContentsMode.ReloadKeysAndTablesContents);
                                    }}
                                >
                                    Delete LevelDB Entry
                                </MenuItem>
                            </ControlledMenu>
                            <tr
                                onDblClick={(): void => {
                                    data.tab.openTab({
                                        contentType: "PendingTicks",
                                        icon: "auto",
                                        name: pendingTickKey.displayKey,
                                        parentTab: data.tab,
                                        target: {
                                            type: "LevelDBEntry",
                                            key: pendingTickKey.rawKey,
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
                            >
                                {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                    switch (column) {
                                        // TODO: Add more columns here. #65
                                        case "DBKey":
                                            return <td>{pendingTickKey.displayKey}</td>;
                                        default:
                                            return (
                                                <td>
                                                    <span style="color: red;">ERROR: MISSING COLUMN HANDLER</span>
                                                </td>
                                            );
                                    }
                                })}
                            </tr>
                        </>
                    );
                }
                return <Row />;
            });
        }
        // TODO: Maybe add an error message here?
        // no default
    }
}
