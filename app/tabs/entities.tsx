import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import {
    DBEntryContentTypes,
    dimensions,
    entryContentTypeToFormatMap,
    gameModes,
    getChunkKeyIndices,
    getInt32Val,
    getKeyDisplayName,
    getKeysOfType,
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
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import type { SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import SearchSyntaxHelpMenu from "../components/SearchSyntaxHelpMenu";
import { viewFilesTabSearchSyntax } from "./viewFiles";

export interface EntitiesTabProps {
    tab: TabManagerTab;
}

const entitiesTabSearchSyntax: SearchSyntaxHelpInfo = {
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
        typeid: {
            description: "Searches for entities by the namespaced ID (the one displayed in the Type ID column).",
            extendedDescription: (
                <>
                    <p>Searches for entities by the namespaced ID (the one displayed in the Type ID column).</p>
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
                    <code>typeid:minecraft:sheep</code> - Searches for entities with a namespaced ID of <code>minecraft:sheep</code>.
                </p>,
                <p>
                    <code>|typeid:minecraft:sheep</code> - Searches for entities with a namespaced ID of <code>minecraft:sheep</code>.
                </p>,
                <p>
                    <code>typeid:minecraft:sheep typeid:minecraft:item</code> - Searches for entities with a namespaced ID of <code>minecraft:sheep</code> or{" "}
                    <code>minecraft:item</code>.
                </p>,
                <p>
                    <code>-typeid:minecraft:sheep -typeid:minecraft:item</code> - Searches for entities that do not have a namespaced ID of{" "}
                    <code>minecraft:sheep</code> or <code>minecraft:item</code>.
                </p>,
            ],
        },
        uuid: {
            description: "Searches for entities by their UUID (the one displayed in the UUID column).",
            extendedDescription: (
                <>
                    <p>Searches for entities by their UUID (the one displayed in the UUID column).</p>
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
                    <code>typeid:-42949666731</code> - Searches for entities with a UUID <code>-42949666731</code>.
                </p>,
                <p>
                    <code>|typeid:-180388626396</code> - Searches for entities with a UUID <code>-180388626396</code>.
                </p>,
                <p>
                    <code>typeid:-42949666731 typeid:-180388626396</code> - Searches for entities with a UUID <code>-42949666731</code> or{" "}
                    <code>-180388626396</code>.
                </p>,
                <p>
                    <code>-typeid:-42949666731 -typeid:-180388626396</code> - Searches for entities that do not have a UUID <code>-42949666731</code> or{" "}
                    <code>-180388626396</code>.
                </p>,
            ],
        },
        name: {
            description: "Searches for entities by their name tag (the one displayed in the Name column).",
            extendedDescription: (
                <>
                    <p>Searches for entities by their name tag (the one displayed in the Name column).</p>
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
                    <code>name:Jeff</code> - Searches for entities with a name tag of "Jeff".
                </p>,
                <p>
                    <code>|name:Joey</code> - Searches for entities with a name tag of "Joey".
                </p>,
                <p>
                    <code>name:Maria name:Joey</code> - Searches for entities with a name tag of "Maria" or "Joey".
                </p>,
                <p>
                    <code>-name:Doggo -name:Fluffy</code> - Searches for entities that do not have a name tag of "Doggo" or "Fluffy".
                </p>,
            ],
        },
        contents: {
            description: "Searches the LevelDB entry value as SNBT.",
        },
        nbt: viewFilesTabSearchSyntax.filters.nbt!,
    },
};

export default function EntitiesTab(props: EntitiesTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The entities sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const abortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        return (): void => {
            abortController.abort(new DOMException("Tab switched.", "AbortError"));
        };
    });
    getEntitiesTabContents(props.tab, abortController.signal).then(
        async (element: JSX.Element): Promise<void> => {
            if (!containerRef.current) return;
            // const tempElement: HTMLDivElement = document.createElement("div");
            render(null, containerRef.current);
            render(element, containerRef.current /* tempElement */);
            // containerRef.current?.replaceChildren(...tempElement.children);
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
    data?: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata } | null | undefined;
}

async function getEntitiesTabContents(tab: TabManagerTab, signal: AbortSignal): Promise<JSX.Element> {
    if (!tab.db) return <div>The entities sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    if (!tab.db.isOpen()) await tab.awaitDBOpen!;
    if (!tab.cachedDBKeys) await tab.awaitCachedDBKeys!;
    signal.throwIfAborted();
    const rawKeys: Buffer[] = tab.cachedDBKeys!.ActorPrefix;
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
                data: asyncMode ? undefined : await NBT.parse((await tab.db!.get(key))!),
            })
        )
    );
    const entityDimensionMappings: Record<Dimension, bigint[]> =
        (tab.cachedDBKeys?.Digest.length ?? 0) >= config.noLookupEntityDimensionDigestKeyThreshold ?
            (Object.fromEntries(dimensions.map((dimension: Dimension): [Dimension, bigint[]] => [dimension, []])) as Record<Dimension, bigint[]>)
        :   await getEntityDimensionMappings(tab);
    let targetKeys: KeyData[] = keys;
    // globalThis.a = keys;
    let dynamicProperties: NBT.NBT | undefined = await tab
        .db!.get("DynamicProperties")
        .then((data: Buffer | null): Promise<NBT.NBT> | undefined =>
            data ? NBT.parse(data!).then((data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata }): NBT.NBT => data.parsed) : undefined
        )
        .catch((e: any): undefined => (console.error(e), undefined));
    // console.log(dynamicProperties);
    let mode: ConfigConstants.views.Entities.EntitiesTabMode = config.views.entities.mode;
    let emptyTablesContents: JSX.Element[][] =
        asyncMode ?
            [[]]
        :   await Promise.all(
                ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode].map(
                    async (sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                        await getEntitiesTabContentsRows({
                            tab,
                            keys,
                            dynamicProperties,
                            mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Entities.EntitiesTabSectionMode,
                            entityDimensionMappings,
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
            const sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode][sectionIndex]!;
            return await getEntitiesTabContentsRows({
                tab,
                keys: await Promise.all(
                    targetKeys
                        .slice(start, end)
                        .map(async (key: KeyData): Promise<KeyData> => ({ ...key, data: await NBT.parse((await tab.db!.get(key.rawKey))!) }))
                ),
                dynamicProperties,
                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Entities.EntitiesTabSectionMode,
                entityDimensionMappings,
            });
        }
        async function loadTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<void> {
            if (!asyncMode) return;
            const sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode][sectionIndex]!;
            tablesContents = [...tablesContents];
            tablesContents[sectionIndex] = [...emptyTablesContents[sectionIndex]!];
            tablesContents[sectionIndex].splice(start, end - start, ...(await getTablesContentsInRange(sectionIndex, start, end)));
        }
        function getSectionEntryCounts(): number[] {
            return ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode].map(
                (sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number]): number => {
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
                    ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode].map(
                        async (
                            _sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): Promise<JSX.Element[]> => getTablesContentsInRange(index, 0, 20)
                    )
                ).then((tablesContents: JSX.Element[][]): void => {
                    localTablesContents.set(tablesContents);
                });
            }
            return (
                <>
                    {...ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number], index: number): JSX.Element => {
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
                                const headerName = ConfigConstants.views.Entities.entitiesTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Entities.EntitiesTabSectionMode = (
                                    sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Entities.EntitiesTabSectionMode;
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
                                                        <th colSpan={ConfigConstants.views.Entities.entitiesTabModeToColumnIDs[sectionMode].length}>
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
                                                    {...config.views.entities.modeSettings[mode].columns.map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Entities.columnIDToDisplayName[columnID];
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
                                                    <td colSpan={ConfigConstants.views.Entities.entitiesTabModeToColumnIDs[sectionMode].length}>
                                                        <PageNavigation
                                                            totalPages={Math.ceil(getSectionEntryCounts()[index]! / 20)}
                                                            onPageChange={async (page: number): Promise<void> => {
                                                                if (!bodyRef.current) return;
                                                                // await loadTablesContentsInRange(index, (page - 1) * 20, page * 20);
                                                                if (asyncMode) {
                                                                    localTablesContents.get()[index] = await getTablesContentsInRange(
                                                                        index,
                                                                        (page - 1) * 20,
                                                                        page * 20
                                                                    );
                                                                }
                                                                let tempElement: HTMLDivElement = document.createElement("div");
                                                                render(
                                                                    <>
                                                                        {...asyncMode ?
                                                                            localTablesContents.get()[index]!
                                                                        :   tablesContents[index]!.slice((page - 1) * 20, page * 20)}
                                                                    </>,
                                                                    tempElement
                                                                );
                                                                bodyRef.current.replaceChildren(...tempElement.children);
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
                    | (() => Promise<{ parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata }>);
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
                mode = config.views.entities.mode;
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
                        ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode].map(
                            async (
                                sectionID: (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[typeof mode][number]
                            ): Promise<JSX.Element[]> =>
                                await getEntitiesTabContentsRows({
                                    tab,
                                    keys:
                                        Object.keys(query).length > 1 ?
                                            tab
                                                .dbSearch!.search(query)
                                                .toArray()
                                                .map((key): KeyData => key.originalObject.data)
                                        :   keys,
                                    dynamicProperties,
                                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Entities.EntitiesTabSectionMode,
                                    entityDimensionMappings,
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
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                updateTablesContents(true);
            }
            function onSimpleModeColumnsChanged(): void {
                if (mode !== "simple") return;
                updateTablesContents(false);
            }
            config.on("settingChanged:views.entities.mode", onModeChanged);
            config.on("settingChanged:views.entities.modeSettings.simple.columns", onSimpleModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.entities.mode", onModeChanged);
                config.off("settingChanged:views.entities.modeSettings.simple.columns", onSimpleModeColumnsChanged);
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
                                config.views.entities.mode = "simple";
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
                                            helpInfo={entitiesTabSearchSyntax}
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

async function getEntityDimension(tab: TabManagerTab, key: Buffer): Promise<Dimension | undefined> {
    const id: [number, number] = [getInt32Val(key, key.length - 8), getInt32Val(key, key.length - 4)];
    if (!tab.db) throw new ReferenceError("tab.db is not defined.");
    if (!tab.cachedDBKeys) throw new ReferenceError("tab.cachedDBKeys is not defined.");
    for (const digest of tab.cachedDBKeys.Digest) {
        const entityIds: [number, number][] = (await entryContentTypeToFormatMap.Digest.parse((await tab.db.get(digest))!)).value.entityIds.value.value;
        if (entityIds.some((entityId: [number, number]): boolean => entityId[0] === id[0] && entityId[1] === id[1])) {
            return getChunkKeyIndices(digest).dimension;
        }
    }
    return undefined;
}

async function getEntityDimensionMappings(tab: TabManagerTab): Promise<Record<Dimension, bigint[]>> {
    if (!tab.db) throw new ReferenceError("tab.db is not defined.");
    if (!tab.cachedDBKeys) throw new ReferenceError("tab.cachedDBKeys is not defined.");
    const entityDimensionMappings: Record<Dimension, bigint[]> = {
        overworld: [],
        nether: [],
        the_end: [],
    };
    for (const digest of tab.cachedDBKeys.Digest) {
        const dimension: Dimension = getChunkKeyIndices(digest).dimension;
        entityDimensionMappings[dimension].push(
            ...(await entryContentTypeToFormatMap.Digest.parse((await tab.db.get(digest))!)).value.entityIds.value.value.map((v: [number, number]): bigint =>
                toLong(v)
            )
        );
    }
    return entityDimensionMappings;
}

function getEntityDimensionFromMappings(key: Buffer, entityDimensionMappings: Record<Dimension, bigint[]>): Dimension | undefined {
    const entityId: bigint = toLong([getInt32Val(key, key.length - 8), getInt32Val(key, key.length - 4)]);
    for (const dimension of dimensions) {
        if (entityDimensionMappings[dimension].includes(entityId)) {
            return dimension;
        }
    }
    return undefined;
}

async function getEntitiesTabContentsRows(data: {
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
    mode: ConfigConstants.views.Entities.EntitiesTabSectionMode;
    entityDimensionMappings?: Record<Dimension, bigint[]> | undefined;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "simple": {
            const columns = config.views.entities.modeSettings.simple.columns;
            return data.keys.map((key: KeyData): JSX.Element => {
                function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                    data.tab.openTab(
                        {
                            contentType: "ActorPrefix",
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
                return (
                    <tr
                        data-key={key.rawKey}
                        onDblClick={(): void => {
                            data.tab.openTab({
                                contentType: "ActorPrefix",
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
                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                            switch (column) {
                                case "DBKey":
                                    return <td>{key.displayKey}</td>;
                                case "Name": {
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
                                    const entityName: string | null =
                                        key.data.parsed.value.CustomName?.type === "string" ? key.data.parsed.value.CustomName.value : null;
                                    if (!entityName) {
                                        return (
                                            <td>
                                                <span style="color: red;">N/A</span>
                                            </td>
                                        );
                                    }
                                    return <td>{entityName}</td>;
                                }
                                case "UUID":
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
                                        <td>
                                            {key.data.parsed.value.UniqueID?.type === "long" ?
                                                toLong(key.data.parsed.value.UniqueID.value)
                                            :   <span style="color: red;">null</span>}
                                        </td>
                                    );
                                case "TypeID":
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
                                        <td>
                                            {key.data.parsed.value.identifier?.type === "string" ?
                                                key.data.parsed.value.identifier.value
                                            :   <span style="color: red;">null</span>}
                                        </td>
                                    );
                                case "Location":
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
                                        <td>
                                            {key.data.parsed.value.Pos?.type === "list" && key.data.parsed.value.Pos.value.type === "float" ?
                                                `${(key.data.parsed.value.Pos.value.value as number[]).map((v: number): string => v.toFixed(3)).join(", ")} ${
                                                    key.data.parsed.value.DimensionId?.type === "int" ?
                                                        (dimensions[key.data.parsed.value.DimensionId.value] ?? key.data.parsed.value.DimensionId.value)
                                                    :   ((data.entityDimensionMappings &&
                                                            getEntityDimensionFromMappings(key.rawKey, data.entityDimensionMappings)) ??
                                                        "Unknown Dimension")
                                                }`
                                            :   <span style="color: red;">null</span>}
                                        </td>
                                    );
                                case "LocationCompact":
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
                                        <td>
                                            {key.data.parsed.value.Pos?.type === "list" && key.data.parsed.value.Pos.value.type === "float" ?
                                                `${(key.data.parsed.value.Pos.value.value as number[]).map((v: number): string => v.toFixed(0)).join(",")} ${
                                                    key.data.parsed.value.DimensionId?.type === "int" ? key.data.parsed.value.DimensionId.value
                                                    : (
                                                        !data.entityDimensionMappings ||
                                                        getEntityDimensionFromMappings(key.rawKey, data.entityDimensionMappings) === undefined
                                                    ) ?
                                                        "?"
                                                    :   dimensions.indexOf(getEntityDimensionFromMappings(key.rawKey, data.entityDimensionMappings)!)
                                                }`
                                            :   <span style="color: red;">null</span>}
                                        </td>
                                    );
                                case "Rotation":
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
                                        <td>
                                            {key.data.parsed.value.Rotation?.type === "list" ?
                                                key.data.parsed.value.Rotation.value.value.join(", ")
                                            :   <span style="color: red;">null</span>}
                                        </td>
                                    );
                            }
                        })}
                    </tr>
                );
            });
        }
    }
}
