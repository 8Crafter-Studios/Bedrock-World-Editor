import type { JSX, RefObject } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import {
    dimensions,
    entryContentTypeToFormatMap,
    gameModes,
    getKeyDisplayName,
    getKeysOfType,
    getPlayerNameFromUUIDSync,
    prettyPrintSNBT,
    prismarineToSNBT,
    toLong,
    type Vector3,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { testForObjectExtension } from "../../src/utils/miscUtils";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import type { SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import { viewFilesTabSearchSyntax } from "./viewFiles";
import SearchSyntaxHelpMenu from "../components/SearchSyntaxHelpMenu";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";

export interface PlayersTabProps {
    tab: TabManagerTab;
}

// TO-DO: Finish filling this in.
const playersTabSearchSyntax: SearchSyntaxHelpInfo = {
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
            description: "Searches for players by their UUID (the one displayed in the UUID column).",
            extendedDescription: (
                <>
                    <p>Searches for players by their UUID (the one displayed in the UUID column).</p>
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
                    <code>typeid:-42949666731</code> - Searches for players with a UUID <code>-42949666731</code>.
                </p>,
                <p>
                    <code>|typeid:-180388626396</code> - Searches for players with a UUID <code>-180388626396</code>.
                </p>,
                <p>
                    <code>typeid:-42949666731 typeid:-180388626396</code> - Searches for players with a UUID <code>-42949666731</code> or{" "}
                    <code>-180388626396</code>.
                </p>,
                <p>
                    <code>-typeid:-42949666731 -typeid:-180388626396</code> - Searches for players that do not have a UUID <code>-42949666731</code> or{" "}
                    <code>-180388626396</code>.
                </p>,
            ],
        },
        name: {
            description:
                'Searches for players by their username (the one displayed in the Name column). Note: This only works if their username has been saved by one of the supported add-ons/behavior packs. Click "Show more..." below for more info.',
            extendedDescription: (
                <>
                    <p>Searches for players by their username (the one displayed in the Name column).</p>
                    <p>
                        Note: This only works if their username has been saved by one of the supported add-ons/behavior packs.
                        <br />A list of add-ons that save players' names which this can read from can be found on the Github repository. You can also request to
                        have your own add-on be supported if it saves players' names to the world's dynamic properties.
                    </p>
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
                    <code>name:PufferFish53426</code> - Searches for players with a username of "PufferFish53426".
                </p>,
                <p>
                    <code>|name:ApolloSputnik</code> - Searches for players with a username of "ApolloSputnik".
                </p>,
                <p>
                    <code>name:MassaHex name:bestfurth name:StormStqr</code> - Searches for players with a username of "MassaHex", "bestfurth", or "StormStqr".
                </p>,
                <p>
                    <code>name:EnderPearl59 |name:LegoTheArlo name:K4N3K18234</code> - Searches for players with a username of "EnderPearl59", "LegoTheArlo", or
                    "K4N3K18234".
                </p>,
                <p>
                    <code>-name:Andexter8 -name:Mehmet303j</code> - Searches for players that do not have a username of "Andexter8" or "Mehmet303j".
                </p>,
            ],
        },
        contents: {
            description: "Searches the LevelDB entry value as SNBT.",
        },
        nbt: viewFilesTabSearchSyntax.filters.nbt!,
    },
};

export default function PlayersTab(props: PlayersTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The players sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    getPlayersTabContents(props.tab).then(
        async (element: JSX.Element): Promise<void> => {
            if (!containerRef.current) return;
            // const tempElement: HTMLDivElement = document.createElement("div");
            render(null, containerRef.current);
            render(element, containerRef.current /* tempElement */);
            // containerRef.current?.replaceChildren(...tempElement.children);
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

interface ClientKeyData {
    rawKey: Buffer;
    displayKey: string;
    data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

interface ServerKeyData {
    rawKey: Buffer;
    displayKey: string;
    data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

async function getPlayersTabContents(tab: TabManagerTab): Promise<JSX.Element> {
    if (!tab.db) return <div>The players sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    tab.db.isOpen() || (await tab.awaitDBOpen!);
    tab.cachedDBKeys || (await tab.awaitCachedDBKeys);
    const keys = {
        client: tab.cachedDBKeys!.PlayerClient,
        server: tab.cachedDBKeys!.Player.toSorted((a: Buffer, b: Buffer): number => (a.equals(Buffer.from("~local_player", "utf-8")) ? -1 : 0)),
    };
    const clientKeys: ClientKeyData[] = await Promise.all(
        keys.client.map(
            async (key: Buffer): Promise<ClientKeyData> => ({
                rawKey: key,
                displayKey: getKeyDisplayName(key),
                data: await NBT.parse((await tab.db!.get(key))!),
            })
        )
    );
    const serverKeys: ServerKeyData[] = await Promise.all(
        keys.server.map(
            async (key: Buffer): Promise<ServerKeyData> => ({
                rawKey: key,
                displayKey: getKeyDisplayName(key),
                data: await NBT.parse((await tab.db!.get(key))!),
            })
        )
    );
    const serverToClientKeyMap: Map<string, ClientKeyData | undefined> = new Map();
    serverKeys.forEach(
        (serverKey: ServerKeyData): void =>
            void serverToClientKeyMap.set(
                serverKey.displayKey,
                clientKeys.find((clientKey: ClientKeyData): boolean => clientKey.data.parsed.value.ServerId?.value === serverKey.displayKey)
            )
    );
    const clientToServerKeyMap: Map<string, ServerKeyData> = new Map();
    clientKeys.forEach(
        (clientKey: ClientKeyData): void =>
            void clientToServerKeyMap.set(
                clientKey.displayKey,
                serverKeys.find((serverKey: ServerKeyData): boolean => serverKey.displayKey === clientKey.data.parsed.value.ServerId?.value)!
            )
    );
    let dynamicProperties: NBT.NBT | undefined = await tab
        .db!.get("DynamicProperties")
        .then((data: Buffer | null): Promise<NBT.NBT> | undefined =>
            data ? NBT.parse(data!).then((data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata }): NBT.NBT => data.parsed) : undefined
        )
        .catch((e: any): undefined => (console.error(e), undefined));
    // console.log(dynamicProperties);
    let mode: ConfigConstants.views.Players.PlayersTabMode = config.views.players.mode;
    let tablesContents: JSX.Element[][] = await Promise.all(
        ConfigConstants.views.Players.playersTabModeToSectionIDs[mode].map(
            async (sectionID: (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                await getPlayersTabContentsRows({
                    tab,
                    clientKeys,
                    serverKeys,
                    serverToClientKeyMap,
                    clientToServerKeyMap,
                    dynamicProperties,
                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Players.PlayersTabSectionMode,
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
                    {...ConfigConstants.views.Players.playersTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)[typeof mode][number], index: number): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                                // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                const headerName = ConfigConstants.views.Players.playersTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Players.PlayersTabSectionMode = (
                                    sectionID === null ? mode : `${mode}_${sectionID}`
                                ) as ConfigConstants.views.Players.PlayersTabSectionMode;
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
                                                        <th colSpan={ConfigConstants.views.Players.playersTabModeToColumnIDs[sectionMode].length}>
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
                                                    {...(sectionID === null
                                                        ? config.views.players.modeSettings[mode].columns
                                                        : config.views.players.modeSettings[mode].sections[sectionID].columns
                                                    ).map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Players.columnIDToDisplayName[columnID];
                                                            return <th>{typeof displayName === "string" ? displayName : displayName.headerLabel}</th>;
                                                        }
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody ref={bodyRef}>{...tablesContents[index]!.slice(0, 20)}</tbody>
                                            <tfoot>
                                                <tr class="table-footer-row-page-navigation">
                                                    <td colSpan={ConfigConstants.views.Players.playersTabModeToColumnIDs[sectionMode].length}>
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
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                mode = config.views.players.mode;
                tablesContents = await Promise.all(
                    ConfigConstants.views.Players.playersTabModeToSectionIDs[mode].map(
                        async (sectionID: (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                            await getPlayersTabContentsRows({
                                tab,
                                clientKeys:
                                    Object.keys(clientQuery).length > 1
                                        ? tab
                                              .dbSearch!.serach(clientQuery)
                                              .toArray()
                                              .map((key): ClientKeyData => key.originalObject.data)
                                        : clientKeys,
                                serverKeys:
                                    Object.keys(serverQuery).length > 1
                                        ? tab
                                              .dbSearch!.serach(serverQuery)
                                              .toArray()
                                              .map((key): ServerKeyData => key.originalObject.data)
                                        : serverKeys,
                                serverToClientKeyMap,
                                clientToServerKeyMap,
                                dynamicProperties,
                                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Players.PlayersTabSectionMode,
                            })
                    )
                );
            }
            // const tempElement: HTMLDivElement = document.createElement("div");
            render(null, tablesContainerRef.current);
            render(<TablesContents />, tablesContainerRef.current /* tempElement */);
            // tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
        let clientQuery: Omit<TabManagerTab_LevelDBSearchQuery, "searchTargets"> & {
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
                contentType: "PlayerClient";
                data: ClientKeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: clientKeys.map(
                (key: ClientKeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value: key.data,
                        valueType: entryContentTypeToFormatMap.PlayerClient,
                        contentType: "PlayerClient",
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
        let serverQuery: Omit<TabManagerTab_LevelDBSearchQuery, "searchTargets"> & {
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
                contentType: "Player";
                data: ServerKeyData;
                searchableContents: string[];
            }[];
        } = {
            searchTargets: serverKeys.map(
                (key: ServerKeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        value: key.data,
                        valueType: entryContentTypeToFormatMap.Player,
                        contentType: "Player",
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
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                updateTablesContents(true);
            }
            function onSimpleModeColumnsChanged(): void {
                if (mode !== "simple") return;
                updateTablesContents(false);
            }
            function onRawModeColumnsChanged(): void {
                if (mode !== "raw") return;
                updateTablesContents(false);
            }
            config.on("settingChanged:views.players.mode", onModeChanged);
            config.on("settingChanged:views.players.modeSettings.simple.columns", onSimpleModeColumnsChanged);
            config.on("settingChanged:views.players.modeSettings.raw.sections.client.columns", onRawModeColumnsChanged);
            config.on("settingChanged:views.players.modeSettings.raw.sections.server.columns", onRawModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.players.mode", onModeChanged);
                config.off("settingChanged:views.players.modeSettings.simple.columns", onSimpleModeColumnsChanged);
                config.off("settingChanged:views.players.modeSettings.raw.sections.client.columns", onRawModeColumnsChanged);
                config.off("settingChanged:views.players.modeSettings.raw.sections.server.columns", onRawModeColumnsChanged);
            };
        });
        let lastHideErrorPopupFunction: (() => void) | undefined = undefined;
        return (
            <>
                <div
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
                                config.views.players.mode = "simple";
                            }}
                        >
                            Simple
                        </button>
                        <button
                            type="button"
                            class={mode === "raw" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.players.mode = "raw";
                            }}
                        >
                            Raw
                        </button>
                    </div>
                </div>
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
                                delete serverQuery.contentTypes;
                                delete serverQuery.displayKeyContents;
                                delete serverQuery.excludeContentTypes;
                                delete serverQuery.nbtTags;
                                delete serverQuery.rawKeyContents;
                                delete serverQuery.rawValueContents;
                                delete serverQuery.contentsStringContents;
                                delete serverQuery.customDataFields;
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
                                    serverQuery.nbtTags = {};
                                    if (["-typeid", "-nbt", "-uuid", "-name"].some((key: string): boolean => key in queryData)) {
                                        serverQuery.nbtTags.noneOf = [];
                                        if (queryData["-typeid"]) serverQuery.nbtTags.noneOf.push(...parseTypeIDQueries(queryData["-typeid"]));
                                        if (queryData["-name"]) serverQuery.nbtTags.noneOf.push(...parseNameQueries(queryData["-name"]));
                                        if (queryData["-uuid"]) serverQuery.nbtTags.noneOf.push(...parseUUIDQueries(queryData["-uuid"]));
                                        if (queryData["-nbt"]) serverQuery.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                    }
                                    if (keywords.some((v: string): boolean => v in queryData)) {
                                        serverQuery.nbtTags.anyOf = [];
                                        if (queryData.typeid) serverQuery.nbtTags.anyOf.push(...parseTypeIDQueries(queryData.typeid));
                                        if (queryData.name) serverQuery.nbtTags.anyOf.push(...parseNameQueries(queryData.name));
                                        if (queryData.uuid) serverQuery.nbtTags.anyOf.push(...parseUUIDQueries(queryData.uuid));
                                        if (queryData.nbt) serverQuery.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                    }
                                    if (getKeywordedOperators(keywords, ["^"]).some((v: string): boolean => v in queryData)) {
                                        serverQuery.nbtTags.oneOf = [];
                                        if (queryData["^typeid"]) serverQuery.nbtTags.oneOf.push(...parseTypeIDQueries(queryData["^typeid"]));
                                        if (queryData["^name"]) serverQuery.nbtTags.oneOf.push(...parseNameQueries(queryData["^name"]));
                                        if (queryData["^uuid"]) serverQuery.nbtTags.oneOf.push(...parseUUIDQueries(queryData["^uuid"]));
                                        if (queryData["^nbt"]) serverQuery.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                    }
                                    if (getKeywordedOperators(keywords, ["&"]).some((v: string): boolean => v in queryData)) {
                                        serverQuery.nbtTags.allOf = [];
                                        if (queryData["&typeid"]) serverQuery.nbtTags.allOf.push(...parseTypeIDQueries(queryData["&typeid"]));
                                        if (queryData["&name"]) serverQuery.nbtTags.allOf.push(...parseNameQueries(queryData["&name"]));
                                        if (queryData["&uuid"]) serverQuery.nbtTags.allOf.push(...parseUUIDQueries(queryData["&uuid"]));
                                        if (queryData["&nbt"]) serverQuery.nbtTags.allOf.push(...parseNBTQueries(queryData["&nbt"]));
                                    }
                                }
                                if (queryData["-contents"] !== undefined) {
                                    serverQuery.customDataFields ??= {};
                                    serverQuery.customDataFields.contents ??= {};
                                    serverQuery.customDataFields.contents.noneOf ??= [];
                                    serverQuery.customDataFields.contents.noneOf.push(...queryData["-contents"]);
                                }
                                if (queryData["|contents"] !== undefined) {
                                    serverQuery.customDataFields ??= {};
                                    serverQuery.customDataFields.contents ??= {};
                                    serverQuery.customDataFields.contents.anyOf ??= [];
                                    serverQuery.customDataFields.contents.anyOf.push(...queryData["|contents"]);
                                }
                                if (queryData.contents !== undefined) {
                                    serverQuery.customDataFields ??= {};
                                    serverQuery.customDataFields.contents ??= {};
                                    serverQuery.customDataFields.contents.anyOf ??= [];
                                    serverQuery.customDataFields.contents.anyOf.push(...queryData.contents);
                                }
                                if (queryData["&contents"] !== undefined) {
                                    serverQuery.customDataFields ??= {};
                                    serverQuery.customDataFields.contents ??= {};
                                    serverQuery.customDataFields.contents.allOf ??= [];
                                    serverQuery.customDataFields.contents.allOf.push(...queryData["&contents"]);
                                }
                                if (queryData["^contents"] !== undefined) {
                                    serverQuery.customDataFields ??= {};
                                    serverQuery.customDataFields.contents ??= {};
                                    serverQuery.customDataFields.contents.oneOf ??= [];
                                    serverQuery.customDataFields.contents.oneOf.push(...queryData["^contents"]);
                                }
                                if (textQueryData.length > 0) {
                                    serverQuery.contentsStringContents ??= {};
                                    for (const textQuery of textQueryData) {
                                        if (textQuery.negated) {
                                            serverQuery.contentsStringContents.noneOf = [];
                                            serverQuery.contentsStringContents.noneOf.push(textQuery.text);
                                        } else if (textQuery.text.startsWith("^")) {
                                            serverQuery.contentsStringContents.oneOf ??= [];
                                            serverQuery.contentsStringContents.oneOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("&")) {
                                            serverQuery.contentsStringContents.allOf ??= [];
                                            serverQuery.contentsStringContents.allOf.push(textQuery.text.slice(1));
                                        } else if (textQuery.text.startsWith("|")) {
                                            serverQuery.contentsStringContents.anyOf ??= [];
                                            serverQuery.contentsStringContents.anyOf.push(textQuery.text.slice(1));
                                        } else {
                                            serverQuery.contentsStringContents.anyOf ??= [];
                                            serverQuery.contentsStringContents.anyOf.push(textQuery.text);
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
                                            helpInfo={playersTabSearchSyntax}
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

async function getPlayersTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The full list of client key data (including what isn't going to be displayed).
     */
    clientKeys: ClientKeyData[];
    /**
     * The list of server key data to display.
     */
    serverKeys: ServerKeyData[];
    /**
     * The full map of server key data to client key data (including what isn't going to be displayed).
     */
    serverToClientKeyMap: Map<string, ClientKeyData | undefined>;
    /**
     * The full map of client key data to server key data (including what isn't going to be displayed).
     */
    clientToServerKeyMap: Map<string, ServerKeyData>;
    dynamicProperties?: NBT.NBT | undefined;
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.Players.PlayersTabSectionMode;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "simple": {
            const columns = config.views.players.modeSettings.simple.columns;
            return data.serverKeys.map((serverKey: ServerKeyData): JSX.Element => {
                const clientKey: ClientKeyData | undefined = data.serverToClientKeyMap.get(serverKey.displayKey);
                console.log(serverKey, clientKey);
                // Add the ability to get the player's name from dynamic properties, it should be able to get it from both
                // 8Crafter's Server Utilities & Debug Sticks, and a custom behavior pack advertised here that saved the
                // player's name to a player dynamic property specifically for being accessed here.
                // Add a context menu to the individual rows to set player name.
                return (
                    <tr
                        onDblClick={(): void => {
                            data.tab.openTab({
                                // TO-DO: In the future, add support for getting their skin head or profile picture.
                                contentType: "Player",
                                icon: "resource://images/ui/glyphs/icon_steve_server.png",
                                name: serverKey.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "LevelDBEntry",
                                    key: serverKey.rawKey,
                                },
                            });
                        }}
                    >
                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                            switch (column) {
                                case "DBKey":
                                    return <td>{serverKey.displayKey}</td>;
                                case "Name": {
                                    const UUID: bigint | undefined =
                                        data.dynamicProperties && serverKey.data.parsed.value.UniqueID?.type === "long"
                                            ? toLong(serverKey.data.parsed.value.UniqueID.value)
                                            : undefined;
                                    if (!UUID) {
                                        if (data.dynamicProperties) {
                                            if (serverKey.data.parsed.value.UniqueID) {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is not of type long." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            } else {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is missing." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            }
                                        } else {
                                            return (
                                                <td
                                                    title={
                                                        "This player's name was not found in the world's dynamic properties. " +
                                                        "This is because the world has no saved dynamic properties."
                                                    }
                                                    style={{ cursor: "help" }}
                                                >
                                                    <span style="color: red;">N/A</span>
                                                </td>
                                            );
                                        }
                                    }
                                    const playerName: string | null = getPlayerNameFromUUIDSync(data.dynamicProperties!, UUID);
                                    if (!playerName) {
                                        return (
                                            <td
                                                title={
                                                    "This player's name was not found in the world's dynamic properties. " +
                                                    "This could be because supported add-on was not on the world when the player was last online, or the add-on did not save their data. " +
                                                    "A list of add-ons that save players' names which this can read from can be found on the Github repository. " +
                                                    "You can also request to have your own add-on be supported if it saves players' names to the world's dynamic properties."
                                                }
                                                style={{ cursor: "help" }}
                                            >
                                                <span style="color: red;">N/A</span>
                                            </td>
                                        );
                                    }
                                    return <td>{playerName}</td>;
                                }
                                case "UUID":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.UniqueID?.type === "long" ? (
                                                toLong(serverKey.data.parsed.value.UniqueID.value)
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Permissions":
                                    return (
                                        <td
                                            title={
                                                serverKey.data.parsed.value.abilities?.type === "compound"
                                                    ? JSON.stringify(serverKey.data.parsed.value.abilities.value)
                                                    : undefined
                                            }
                                        >
                                            {serverKey.data.parsed.value.abilities?.type === "compound" ? (
                                                testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                    attackmobs: { value: 1 },
                                                    attackplayers: { value: 1 },
                                                    build: { value: 1 },
                                                    doorsandswitches: { value: 1 },
                                                    mine: { value: 1 },
                                                    op: { value: 1 },
                                                    opencontainers: { value: 1 },
                                                    teleport: { value: 1 },
                                                } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #5f5;">Operator</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 1 },
                                                      attackplayers: { value: 1 },
                                                      build: { value: 1 },
                                                      doorsandswitches: { value: 1 },
                                                      mine: { value: 1 },
                                                      op: { value: 1 },
                                                      opencontainers: { value: 1 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #8f5;">Operator (No TP)</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 1 },
                                                      attackplayers: { value: 1 },
                                                      build: { value: 1 },
                                                      doorsandswitches: { value: 1 },
                                                      mine: { value: 1 },
                                                      op: { value: 0 },
                                                      opencontainers: { value: 1 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #55f;">Member</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 0 },
                                                      attackplayers: { value: 0 },
                                                      build: { value: 0 },
                                                      doorsandswitches: { value: 0 },
                                                      mine: { value: 0 },
                                                      op: { value: 0 },
                                                      opencontainers: { value: 0 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #f55;">Visitor</span>
                                                ) : (
                                                    <span style="color: #ff5;">Custom</span>
                                                )
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                            }
                        })}
                    </tr>
                );
            });
        }
        case "raw_client": {
            const columns = config.views.players.modeSettings.raw.sections.client.columns;
            return data.clientKeys.map((clientKey: ClientKeyData): JSX.Element => {
                const serverKey = data.clientToServerKeyMap.get(clientKey.displayKey);
                return (
                    <tr
                        onDblClick={(): void => {
                            data.tab.openTab({
                                // TO-DO: In the future, add support for getting their skin head or profile picture.
                                contentType: "PlayerClient",
                                icon: "resource://images/ui/glyphs/icon_steve_client.png",
                                name: clientKey.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "LevelDBEntry",
                                    key: clientKey.rawKey,
                                },
                            });
                        }}
                    >
                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                            switch (column) {
                                case "DBKey":
                                    return <td>{clientKey.displayKey}</td>;
                                case "Name": {
                                    if (!serverKey) {
                                        return (
                                            <td
                                                title="This player client has no associated server key, and as a result, the player's UniqueID NBT tag could not be found."
                                                style={{ cursor: "help" }}
                                            >
                                                <span style="color: red;">null</span>
                                            </td>
                                        );
                                    }
                                    const UUID: bigint | undefined =
                                        data.dynamicProperties && serverKey.data.parsed.value.UniqueID?.type === "long"
                                            ? toLong(serverKey.data.parsed.value.UniqueID.value)
                                            : undefined;
                                    if (!UUID) {
                                        if (data.dynamicProperties) {
                                            if (serverKey.data.parsed.value.UniqueID) {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is not of type long." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            } else {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is missing." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            }
                                        } else {
                                            return (
                                                <td
                                                    title={
                                                        "This player's name was not found in the world's dynamic properties. " +
                                                        "This is because the world has no saved dynamic properties."
                                                    }
                                                    style={{ cursor: "help" }}
                                                >
                                                    <span style="color: red;">N/A</span>
                                                </td>
                                            );
                                        }
                                    }
                                    const playerName: string | null = getPlayerNameFromUUIDSync(data.dynamicProperties!, UUID);
                                    if (!playerName) {
                                        return (
                                            <td
                                                title={
                                                    "This player's name was not found in the world's dynamic properties. " +
                                                    "This could be because supported add-on was not on the world when the player was last online, or the add-on did not save their data. " +
                                                    "A list of add-ons that save players' names which this can read from can be found on the Github repository. " +
                                                    "You can also request to have your own add-on be supported if it saves players' names to the world's dynamic properties."
                                                }
                                                style={{ cursor: "help" }}
                                            >
                                                <span style="color: red;">N/A</span>
                                            </td>
                                        );
                                    }
                                    return <td>{playerName}</td>;
                                }
                                case "MsaId":
                                    return <td>{clientKey.data.parsed.value.MsaId?.value ?? <span style="color: red;">null</span>}</td>;
                                case "SelfSignedId":
                                    return <td>{clientKey.data.parsed.value.SelfSignedId?.value ?? <span style="color: red;">null</span>}</td>;
                                case "ServerId":
                                    return <td>{clientKey.data.parsed.value.ServerId?.value ?? <span style="color: red;">null</span>}</td>;
                            }
                        })}
                    </tr>
                );
            });
        }
        case "raw_server": {
            const columns = config.views.players.modeSettings.raw.sections.server.columns;
            return data.serverKeys.map((serverKey: ServerKeyData): JSX.Element => {
                return (
                    <tr
                        onDblClick={(): void => {
                            data.tab.openTab({
                                // TO-DO: In the future, add support for getting their skin head or profile picture.
                                contentType: "Player",
                                icon: "resource://images/ui/glyphs/icon_steve_server.png",
                                name: serverKey.displayKey,
                                target: {
                                    type: "LevelDBEntry",
                                    key: serverKey.rawKey,
                                },
                            });
                        }}
                    >
                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                            switch (column) {
                                case "DBKey":
                                    return <td>{serverKey.displayKey}</td>;
                                case "ClientId":
                                    return <td>{data.serverToClientKeyMap.get(serverKey.displayKey)?.displayKey ?? <span style="color: red;">null</span>}</td>;
                                case "Name": {
                                    const UUID: bigint | undefined =
                                        data.dynamicProperties && serverKey.data.parsed.value.UniqueID?.type === "long"
                                            ? toLong(serverKey.data.parsed.value.UniqueID.value)
                                            : undefined;
                                    if (!UUID) {
                                        if (data.dynamicProperties) {
                                            if (serverKey.data.parsed.value.UniqueID) {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is not of type long." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            } else {
                                                return (
                                                    <td title="This player's UniqueID NBT tag is missing." style={{ cursor: "help" }}>
                                                        <span style="color: red;">null</span>
                                                    </td>
                                                );
                                            }
                                        } else {
                                            return (
                                                <td
                                                    title={
                                                        "This player's name was not found in the world's dynamic properties. " +
                                                        "This is because the world has no saved dynamic properties."
                                                    }
                                                    style={{ cursor: "help" }}
                                                >
                                                    <span style="color: red;">N/A</span>
                                                </td>
                                            );
                                        }
                                    }
                                    const playerName: string | null = getPlayerNameFromUUIDSync(data.dynamicProperties!, UUID);
                                    if (!playerName) {
                                        return (
                                            <td
                                                title={
                                                    "This player's name was not found in the world's dynamic properties. " +
                                                    "This could be because supported add-on was not on the world when the player was last online, or the add-on did not save their data. " +
                                                    "A list of add-ons that save players' names which this can read from can be found on the Github repository. " +
                                                    "You can also request to have your own add-on be supported if it saves players' names to the world's dynamic properties."
                                                }
                                                style={{ cursor: "help" }}
                                            >
                                                <span style="color: red;">N/A</span>
                                            </td>
                                        );
                                    }
                                    return <td>{playerName}</td>;
                                }
                                case "UUID":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.UniqueID?.type === "long" ? (
                                                toLong(serverKey.data.parsed.value.UniqueID.value)
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Permissions":
                                    return (
                                        <td
                                            title={
                                                serverKey.data.parsed.value.abilities?.type === "compound"
                                                    ? JSON.stringify(serverKey.data.parsed.value.abilities.value)
                                                    : undefined
                                            }
                                        >
                                            {serverKey.data.parsed.value.abilities?.type === "compound" ? (
                                                testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                    attackmobs: { value: 1 },
                                                    attackplayers: { value: 1 },
                                                    build: { value: 1 },
                                                    doorsandswitches: { value: 1 },
                                                    mine: { value: 1 },
                                                    op: { value: 1 },
                                                    opencontainers: { value: 1 },
                                                    teleport: { value: 1 },
                                                } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #5f5;">Operator</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 1 },
                                                      attackplayers: { value: 1 },
                                                      build: { value: 1 },
                                                      doorsandswitches: { value: 1 },
                                                      mine: { value: 1 },
                                                      op: { value: 1 },
                                                      opencontainers: { value: 1 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #8f5;">Operator (No TP)</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 1 },
                                                      attackplayers: { value: 1 },
                                                      build: { value: 1 },
                                                      doorsandswitches: { value: 1 },
                                                      mine: { value: 1 },
                                                      op: { value: 0 },
                                                      opencontainers: { value: 1 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #55f;">Member</span>
                                                ) : testForObjectExtension(serverKey.data.parsed.value.abilities.value, {
                                                      attackmobs: { value: 0 },
                                                      attackplayers: { value: 0 },
                                                      build: { value: 0 },
                                                      doorsandswitches: { value: 0 },
                                                      mine: { value: 0 },
                                                      op: { value: 0 },
                                                      opencontainers: { value: 0 },
                                                      teleport: { value: 0 },
                                                  } as DeepPartial<NBT.Compound["value"]>) ? (
                                                    <span style="color: #f55;">Visitor</span>
                                                ) : (
                                                    <span style="color: #ff5;">Custom</span>
                                                )
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Location":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.Pos?.type === "list" && serverKey.data.parsed.value.Pos.value.type === "float" ? (
                                                `${(serverKey.data.parsed.value.Pos.value.value as number[])
                                                    .map((v: number): string => v.toFixed(3))
                                                    .join(", ")} ${
                                                    serverKey.data.parsed.value.DimensionId?.type === "int"
                                                        ? dimensions[serverKey.data.parsed.value.DimensionId.value] ??
                                                          serverKey.data.parsed.value.DimensionId.value
                                                        : "Unknown Dimension"
                                                }`
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "LocationCompact":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.Pos?.type === "list" && serverKey.data.parsed.value.Pos.value.type === "float" ? (
                                                `${(serverKey.data.parsed.value.Pos.value.value as number[])
                                                    .map((v: number): string => v.toFixed(0))
                                                    .join(",")} ${
                                                    serverKey.data.parsed.value.DimensionId?.type === "int"
                                                        ? serverKey.data.parsed.value.DimensionId.value
                                                        : "?"
                                                }`
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Rotation":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.Rotation?.type === "list" ? (
                                                serverKey.data.parsed.value.Rotation.value.value.join(", ")
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Spawn":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.SpawnX?.type === "int" ? (
                                                serverKey.data.parsed.value.SpawnX?.value === -2147483648 ? (
                                                    "Not Set"
                                                ) : (
                                                    `${serverKey.data.parsed.value.SpawnX.value}, ${serverKey.data.parsed.value.SpawnY?.value}, ${
                                                        serverKey.data.parsed.value.SpawnZ?.value
                                                    } ${
                                                        serverKey.data.parsed.value.SpawnDimension?.type === "int"
                                                            ? dimensions[serverKey.data.parsed.value.SpawnDimension.value] ??
                                                              serverKey.data.parsed.value.SpawnDimension.value
                                                            : "Unknown Dimension"
                                                    }`
                                                )
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "SpawnCompact":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.SpawnX?.type === "int" ? (
                                                serverKey.data.parsed.value.SpawnX?.value === -2147483648 ? (
                                                    "Not Set"
                                                ) : (
                                                    `${serverKey.data.parsed.value.SpawnX.value.toFixed(0)},${(
                                                        serverKey.data.parsed.value.SpawnY?.value as number
                                                    ).toFixed(0)},${(serverKey.data.parsed.value.SpawnZ?.value as number).toFixed(0)} ${
                                                        serverKey.data.parsed.value.SpawnDimension?.type === "int"
                                                            ? serverKey.data.parsed.value.SpawnDimension.value
                                                            : "?"
                                                    }`
                                                )
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "GameMode":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.PlayerGameMode?.type === "int" ? (
                                                gameModes[serverKey.data.parsed.value.PlayerGameMode.value] ?? serverKey.data.parsed.value.PlayerGameMode.value
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "Level":
                                    return (
                                        <td>
                                            {serverKey.data.parsed.value.PlayerLevel?.type === "int" ? (
                                                serverKey.data.parsed.value.PlayerLevel.value +
                                                (serverKey.data.parsed.value.PlayerLevelProgress?.value.toString().slice(1, 5) ?? "")
                                            ) : (
                                                <span style="color: red;">null</span>
                                            )}
                                        </td>
                                    );
                                case "raw_playerPermissionsLevel":
                                    return <td>{serverKey.data.parsed.value.playerPermissionsLevel?.value ?? <span style="color: red;">null</span>}</td>;
                                case "raw_permissionsLevel":
                                    return <td>{serverKey.data.parsed.value.permissionsLevel?.value ?? <span style="color: red;">null</span>}</td>;
                            }
                        })}
                    </tr>
                );
            });
        }
    }
}
