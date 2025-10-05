import type { JSX, RefObject } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import {
    DBEntryContentTypes,
    dimensions,
    entryContentTypeToFormatMap,
    gameModes,
    getContentTypeFromDBKey,
    getKeyDisplayName,
    getKeysOfType,
    prettyPrintSNBT,
    prismarineToSNBT,
    toLong,
    type DBEntryContentType,
    type Vector3,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { testForObjectExtension } from "../../src/utils/miscUtils";
import { ControlledMenu, MenuItem } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import SearchSyntaxHelpMenu, { type SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";

export interface ViewFilesTabProps {
    tab: TabManagerTab;
}

export const viewFilesTabSearchSyntax: SearchSyntaxHelpInfo = {
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
        type: {
            description:
                'Filters by the content type of the entry (the one displayed in the Content Type column). This is very useful when searching for NBT, as it can take quite a while on large worlds, but filtering by the content types you want to search in can make it almost instant. Click "See more..." below for a list of supported content types.',
            extendedDescription: (
                <>
                    <p>Filters by the content type of the entry (the one displayed in the Content Type column).</p>
                    <p>
                        This is very useful when searching for NBT, as it can take quite a while on large worlds, but filtering by the content types you want to
                        search in can make it almost instant.
                    </p>
                    <p>
                        Supported content types:
                        <ul>
                            {DBEntryContentTypes.map(
                                (contentType: DBEntryContentType): JSX.SpecificElement<"li"> => (
                                    <li>{contentType}</li>
                                )
                            )}
                        </ul>
                    </p>
                    <p>
                        Supported prefix operators:
                        <ul>
                            <li>"|" - Any Of</li>
                            <li>"-" - None Of</li>
                        </ul>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>type:Data3D</code> - Only searches entries with the Data3D content type.
                </p>,
                <p>
                    <code>|type:Data3D</code> - Only searches entries with the Data3D content type.
                </p>,
                <p>
                    <code>type:Data3D type:Block</code> - Only searches entries with the Data3D or Block content type.
                </p>,
                <p>
                    <code>-type:Data3D -type:Block</code> - Searches entries with and content type other than Data3D or Block.
                </p>,
            ],
        },
        contents: {
            description:
                "Searches the LevelDB entry value. This will cause searching to take a lot longer on larger worlds, it is highly recommended to use a <code>type</code> filter to limit the search.",
        },
        nbt: {
            description:
                "Searches the NBT data of entries. This will cause searching to take a lot longer on larger worlds, it is highly recommended to use a <code>type</code> filter to limit the search.",
            extendedDescription: (
                <>
                    <p>
                        Searches the NBT data of entries. This will cause searching to take a lot longer on larger worlds, it is highly recommended to use a{" "}
                        <code>type</code> filter to limit the search.
                    </p>
                    <p>
                        Syntax:
                        <code>nbt:StringifiedNBTFilterJSON</code>
                        <br />
                        <br />
                        <code>StringifiedNBTFilterJSON</code> Type:
                        <br />
                        <br />
                        <code class="multiline">{`{
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
    tagType?: "byte" | "short" | "int" | "long" | "float" | "double" | "string" | "list" | "compound" | "byteArray" | "shortArray" | "intArray" | "longArray";
    /**
     * The value of the tag.
     *
     * Will be converted to a string before comparison, this can only match byte, short, int, long, float, double, and string tags.
     *
     * @default undefined
     */
    value?: string | number | bigint;
    /**
     * Whether or not the value should be case-sensitive.
     *
     * @default true
     */
    caseSensitiveValue?: boolean;
}`}</code>
                    </p>
                    <h2>Supported Prefix Operators</h2>
                    <ul>
                        <li>"|" - Any Of</li>
                        <li>"-" - None Of</li>
                        <li>"^" - One Of</li>
                        <li>"&" - All Of</li>
                    </ul>
                    <p style={{ marginTop: 0 }}>
                        <h2>Tips</h2>
                        To generate the value for this filter, you can just run{" "}
                        <code>{`console.log(\`nbt:\${JSON.stringify(JSON.stringify(NBTFilterJSON))}\`)`}</code> in the devtools console in this app, just press{" "}
                        <code>F12</code> to open it (if you don't have an <code>F12</code> key, hold down <code>Left Shift</code> and <code>Left Control</code>,
                        then click <code>Right Control</code> while still holding the other two keys, then press <code>i</code>).
                        <br />
                        Example: <code>{`console.log(\`nbt:\${JSON.stringify(JSON.stringify({ value: "minecraft:wheat_seeds" }))}\`)`}</code>
                    </p>
                </>
            ),
            examples: [
                <p>
                    <code>nbt:{JSON.stringify(JSON.stringify({ value: "minecraft:wheat_seeds" }))}</code> - Searches entries for NBT tags with a value of{" "}
                    <code>minecraft:wheat_seeds</code>.
                </p>,
                <p>
                    <code>|nbt:{JSON.stringify(JSON.stringify({ path: ["Item", "Name"], value: "minecraft:wheat_seeds" }))}</code> - Searches entries for an{" "}
                    <code>Item</code> NBT tag at the root of the entry with a <code>Name</code> tag with a value of <code>minecraft:wheat_seeds</code>.
                </p>,
                <p>
                    <code>
                        nbt:{JSON.stringify(JSON.stringify({ path: ["Rotation", "0"], value: 0 }))} nbt:
                        {JSON.stringify(JSON.stringify({ path: ["Rotation", "1"], value: "0" }))}
                    </code>{" "}
                    - Searches entries for a <code>Rotation</code> NBT tag at the root of the entry with NBT tags at indices <code>0</code> and <code>1</code>{" "}
                    of that tag with at least one having a value of <code>0</code>.
                </p>,
                <p>
                    <code>
                        nbt:{JSON.stringify(JSON.stringify({ path: ["Rotation", "0"], value: 0 }))} |nbt:
                        {JSON.stringify(JSON.stringify({ path: ["Rotation", "1"], value: "0" }))}
                    </code>{" "}
                    - Searches entries for a <code>Rotation</code> NBT tag at the root of the entry with NBT tags at indices <code>0</code> and <code>1</code>{" "}
                    of that tag with at least one having a value of <code>0</code>.
                </p>,
                <p>
                    <code>
                        |nbt:{JSON.stringify(JSON.stringify({ path: ["Rotation", "0"], value: 0 }))} |nbt:
                        {JSON.stringify(JSON.stringify({ path: ["Rotation", "1"], value: "0" }))}
                    </code>{" "}
                    - Searches entries for a <code>Rotation</code> NBT tag at the root of the entry with NBT tags at indices <code>0</code> and <code>1</code>{" "}
                    of that tag with at least one having a value of <code>0</code>.
                </p>,
                <p>
                    <code>
                        ^nbt:{JSON.stringify(JSON.stringify({ path: ["Rotation", "0"], value: 0 }))} ^nbt:
                        {JSON.stringify(JSON.stringify({ path: ["Rotation", "1"], value: "0" }))}
                    </code>{" "}
                    - Searches entries for a <code>Rotation</code> NBT tag at the root of the entry with NBT tags at indices <code>0</code> and <code>1</code>{" "}
                    of that tag exactly one having a value of <code>0</code>.
                </p>,
                <p>
                    <code>
                        &nbt:{JSON.stringify(JSON.stringify({ path: ["Rotation", "0"], value: 0 }))} &nbt:
                        {JSON.stringify(JSON.stringify({ path: ["Rotation", "1"], value: "0" }))}
                    </code>{" "}
                    - Searches entries for a <code>Rotation</code> NBT tag at the root of the entry with NBT tags at indices <code>0</code> and <code>1</code>{" "}
                    of that tag with values of <code>0</code>.
                </p>,
                <p>
                    <code>nbt:{JSON.stringify(JSON.stringify({ key: ["0"], value: 0 }))}</code> - Searches entries for NBT tags with keys of <code>0</code> (ex.
                    a property in a compound with a key of <code>0</code>, or the first item in a list) with values of <code>0</code>.
                </p>,
                <p>
                    <code>^nbt:{JSON.stringify(JSON.stringify({ key: ["0"], value: 0 }))}</code> - Searches for entries that don't have NBT tags with keys of{" "}
                    <code>0</code> with values of <code>0</code>.
                </p>,
                <p>
                    <code>
                        ^nbt:{JSON.stringify(JSON.stringify({ value: "minecraft:wheat_seeds" }))} nbt:{JSON.stringify(JSON.stringify({ key: ["0"], value: 0 }))}
                    </code>{" "}
                    - Searches for entries that don't have NBT tags with values of <code>minecraft:wheat_seeds</code> but do have NBT tags with keys of{" "}
                    <code>0</code> and values of <code>0</code>.
                </p>,
            ],
        },
    },
};

export default function ViewFilesTab(props: ViewFilesTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The viewFiles sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    getViewFilesTabContents(props.tab).then(
        async (element: JSX.Element): Promise<void> => {
            if (!containerRef.current) return;
            const tempElement: HTMLDivElement = document.createElement("div");
            render(element, tempElement);
            containerRef.current?.replaceChildren(...tempElement.children);
        },
        (reason: any): void => {
            if (containerRef.current) {
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent =
                    reason instanceof Error ? (reason.stack?.startsWith(reason.toString()) ? reason.stack : reason.toString() + reason.stack) : reason;
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
    contentType: DBEntryContentType;
    valueType: (typeof entryContentTypeToFormatMap)[DBEntryContentType];
    value?: any;
    // data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

async function getViewFilesTabContents(tab: TabManagerTab): Promise<JSX.Element> {
    if (!tab.db) return <div>The view files sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    tab.db.isOpen() || (await tab.awaitDBOpen!);
    tab.cachedDBKeys || (await tab.awaitCachedDBKeys);
    const keys: KeyData[] = (Object.keys(tab.cachedDBKeys!) as (keyof typeof tab.cachedDBKeys)[])
        .flatMap((contentType: keyof NonNullable<typeof tab.cachedDBKeys>): { contentType: DBEntryContentType; key: Buffer }[] =>
            tab.cachedDBKeys![contentType].map((key: Buffer): { contentType: DBEntryContentType; key: Buffer } => ({
                contentType,
                key,
            }))
        )
        .map(
            ({ contentType, key }: { contentType: DBEntryContentType; key: Buffer }): KeyData => ({
                rawKey: key,
                displayKey: getKeyDisplayName(key),
                contentType,
                valueType: entryContentTypeToFormatMap[contentType],
                // data: await NBT.parse((await tab.db!.get(key))!),
            })
        );
    for (const key of keys) {
        valueTypeSwitcher: switch (key.valueType?.type) {
            case "ASCII": {
                try {
                    const data = await tab.db!.get(key.rawKey);
                    key.value = data?.toString("utf-8");
                } catch (e) {
                    console.error(e);
                }
                break;
            }
            case "NBT": {
                // Do not load NBT as it takes too long.
                break;
            }
            case "int": {
                try {
                    const data = await tab.db!.get(key.rawKey);
                    key.value = data !== null ? BigInt("0x" + data.slice(0, key.valueType.bytes).toString("hex")).toString(10) : null;
                } catch (e) {
                    console.error(e);
                }
                break;
            }
            case "custom": {
                switch (key.valueType.resultType) {
                    case "JSONNBT": {
                        // Do not load NBT as it takes too long.
                        break valueTypeSwitcher;
                    }
                }
            }
            case "unknown": {
                break;
            }
        }
    }
    let keyValuesLoaded: boolean = false;
    let dynamicProperties: NBT.NBT | undefined = await tab
        .db!.get("DynamicProperties")
        .then((data: Buffer | null): Promise<NBT.NBT> | undefined =>
            data ? NBT.parse(data!).then((data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata }): NBT.NBT => data.parsed) : undefined
        )
        .catch((e: any): undefined => (console.error(e), undefined));
    // console.log(dynamicProperties);
    let tablesContents: JSX.Element[][] = [
        await getViewFilesTabContentsRows({
            tab,
            keys,
            dynamicProperties,
        }),
    ];
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
                    {...(["simple"] as const).map((sectionID: "simple", index: number): JSX.Element => {
                        const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                        function Test1(): JSX.Element {
                            // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                            // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
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
                                            <tr
                                            /* onContextMenu={(event: JSX.TargetedMouseEvent<HTMLTableRowElement>): void => {
                                                        if (typeof document.hasFocus === "function" && !document.hasFocus()) return;

                                                        event.preventDefault();
                                                        columnHeadersContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                        columnHeadersContextMenu_setOpen(true);
                                                    }} */
                                            >
                                                {...(["DBKey", "ContentType"] as const).map(
                                                    (
                                                        columnID: (typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs)["simple"][number]
                                                    ): JSX.SpecificElement<"th"> => {
                                                        const displayName = ConfigConstants.views.ViewFiles.columnIDToDisplayName[columnID];
                                                        return <th>{displayName}</th>;
                                                    }
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody ref={bodyRef}>{...tablesContents[index]!.slice(0, 20)}</tbody>
                                        <tfoot>
                                            <tr class="table-footer-row-page-navigation">
                                                <td colSpan={ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs["simple"].length}>
                                                    <PageNavigation
                                                        totalPages={Math.ceil(tablesContents[index]!.length / 20)}
                                                        onPageChange={(page: number): void => {
                                                            if (!bodyRef.current) return;
                                                            let tempElement: HTMLDivElement = document.createElement("div");
                                                            render(<>{...tablesContents[index]!.slice((page - 1) * 20, page * 20)}</>, tempElement);
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
                    })}
                </>
            );
        }
        let query: Omit<TabManagerTab_LevelDBSearchQuery, "searchTargets"> & {
            searchTargets: (
                | {
                      key: Buffer<ArrayBufferLike>;
                      displayKey: string;
                      contentType: DBEntryContentType;
                      data: KeyData;
                      searchableContents: string[];
                  }
                | {
                      key: Buffer<ArrayBufferLike>;
                      displayKey: string;
                      value: any;
                      valueType: (typeof entryContentTypeToFormatMap)[DBEntryContentType];
                      contentType: DBEntryContentType;
                      data: KeyData;
                      searchableContents: string[];
                  }
            )[];
        } = {
            searchTargets: keys.map(
                (key: KeyData) =>
                    ({
                        key: key.rawKey,
                        displayKey: key.displayKey,
                        // value: key.data,
                        // valueType: entryContentTypeToFormatMap.ActorPrefix,
                        contentType: key.contentType,
                        data: key,
                        searchableContents: [key.displayKey],
                    } as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number])
            ),
        };
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                console.debug(query);
                if (
                    !keyValuesLoaded &&
                    ((query.nbtTags?.allOf && query.nbtTags?.allOf.length > 0) ||
                        (query.nbtTags?.anyOf && query.nbtTags?.anyOf.length > 0) ||
                        (query.nbtTags?.oneOf && query.nbtTags?.oneOf.length > 0) ||
                        (query.nbtTags?.noneOf && query.nbtTags?.noneOf.length > 0) ||
                        (query.customDataFields?.contents?.allOf && query.customDataFields?.contents?.allOf.length > 0) ||
                        (query.customDataFields?.contents?.anyOf && query.customDataFields?.contents?.anyOf.length > 0) ||
                        (query.customDataFields?.contents?.oneOf && query.customDataFields?.contents?.oneOf.length > 0) ||
                        (query.customDataFields?.contents?.noneOf && query.customDataFields?.contents?.noneOf.length > 0))
                ) {
                    let i: number = 0;
                    let t: number = Date.now();
                    for (const key of keys) {
                        i++;
                        if (t + 10 < Date.now()) {
                            t = Date.now();
                            if (loadingScreenMessageContainerRef.current)
                                loadingScreenMessageContainerRef.current.textContent = `Reading NBT data: ${i}/${keys.length}...`;
                        }
                        if (query.contentTypes && !query.contentTypes.includes(key.contentType)) continue;
                        if (query.excludeContentTypes && query.excludeContentTypes.includes(key.contentType)) continue;
                        if (key.value !== undefined) continue;
                        valueTypeSwitcher: switch (key.valueType?.type) {
                            case "ASCII": {
                                // ASCII would have already been loaded.
                                break;
                            }
                            case "NBT": {
                                try {
                                    const data = await tab.db!.get(key.rawKey);
                                    key.value = data !== null ? await NBT.parse(data) : null;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "int": {
                                // Int would have already been loaded.
                                break;
                            }
                            case "custom": {
                                switch (key.valueType.resultType) {
                                    case "JSONNBT": {
                                        try {
                                            const data = await tab.db!.get(key.rawKey);
                                            key.value = data !== null ? await key.valueType.parse(data) : null;
                                        } catch (e) {
                                            console.error(e);
                                        }
                                        break valueTypeSwitcher;
                                    }
                                }
                            }
                            case "unknown": {
                                break;
                            }
                        }
                    }
                    if ((!query.contentTypes || query.contentTypes.length === 0) && (!query.excludeContentTypes || query.excludeContentTypes.length === 0))
                        keyValuesLoaded = true;
                    query.searchTargets = keys.map(
                        (key: KeyData) =>
                            ({
                                key: key.rawKey,
                                displayKey: key.displayKey,
                                value: key.value!,
                                valueType: key.valueType,
                                contentType: key.contentType,
                                data: key,
                                searchableContents: [
                                    key.displayKey,
                                    ...(key.value
                                        ? [
                                              key.valueType.type === "NBT"
                                                  ? ((): string => {
                                                        try {
                                                            // return prettyPrintSNBT(prismarineToSNBT(key.value!), { indent: 0 });
                                                            // Disable directly searching SNBT.
                                                            return "";
                                                        } catch {
                                                            return "";
                                                        }
                                                    })()
                                                  : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol"
                                                  ? String(key.value)
                                                  : "",
                                          ]
                                        : []),
                                ],
                                customDataFields: {
                                    contents: key.value
                                        ? key.valueType.type === "NBT"
                                            ? ((): string | undefined => {
                                                  try {
                                                      return prettyPrintSNBT(prismarineToSNBT(key.value!), { indent: 0 });
                                                  } catch {
                                                      return undefined;
                                                  }
                                              })()
                                            : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol"
                                            ? String(key.value)
                                            : undefined
                                        : undefined,
                                },
                            } as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number])
                    );
                }
                tablesContents = await Promise.all(
                    ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs["simple"].map(
                        async (sectionID: (typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs)["simple"][number]): Promise<JSX.Element[]> =>
                            getViewFilesTabContentsRows({
                                tab,
                                keys:
                                    Object.keys(query).length > 1
                                        ? await (async (): Promise<KeyData[]> => {
                                              const iterator = tab.dbSearch!.serach(query, true);
                                              let i: number = 0;
                                              let t: number = Date.now();
                                              const results: KeyData[] = [];
                                              for (const value of iterator) {
                                                  i++;
                                                  if (t + 10 < Date.now()) {
                                                      if (loadingScreenMessageContainerRef.current)
                                                          loadingScreenMessageContainerRef.current.textContent = `Searching LevelDB: ${i}/${keys.length}...`;
                                                      await sleep(10);
                                                      t = Date.now();
                                                  }
                                                  if (!value) continue;
                                                  results.push(value.originalObject.data);
                                              }
                                              return results;
                                          })()
                                        : keys,
                                dynamicProperties,
                            })
                    )
                );
            }
            const tempElement: HTMLDivElement = document.createElement("div");
            render(<TablesContents />, tempElement);
            tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
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
                                config.views.viewFiles.mode = "simple";
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
                                const keywords = ["dbkey", "nbt", "type", "contents"] as const;
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
                                    if (
                                        [...getKeywordedOperators(["dbkey", "nbt", "contents"]), ...getKeywordedOperators(["type"], ["", "|", "-"])].includes(
                                            key as any
                                        )
                                    )
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
                                if (getKeywordedOperators(["nbt"]).some((key: string): boolean => key in queryData)) {
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
                                    if (queryData && ["-nbt"].some((key: string): boolean => key in queryData)) {
                                        query.nbtTags.noneOf = [];
                                        if (queryData["-nbt"]) query.nbtTags.noneOf.push(...parseNBTQueries(queryData["-nbt"]));
                                    }
                                    if (["nbt"].some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.anyOf = [];
                                        if (queryData.nbt) query.nbtTags.anyOf.push(...parseNBTQueries(queryData.nbt));
                                    }
                                    if (getKeywordedOperators(["nbt"], ["^"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.oneOf = [];
                                        if (queryData["^nbt"]) query.nbtTags.oneOf.push(...parseNBTQueries(queryData["^nbt"]));
                                    }
                                    if (getKeywordedOperators(["nbt"], ["&"]).some((v: string): boolean => v in queryData)) {
                                        query.nbtTags.allOf = [];
                                        if (queryData["&nbt"]) query.nbtTags.allOf.push(...parseNBTQueries(queryData["&nbt"]));
                                    }
                                }
                                if (queryData["-dbkey"] !== undefined) {
                                    query.displayKeyContents ??= {};
                                    query.displayKeyContents.noneOf ??= [];
                                    query.displayKeyContents.noneOf.push(...queryData["-dbkey"]);
                                }
                                if (queryData["|dbkey"] !== undefined) {
                                    query.displayKeyContents ??= {};
                                    query.displayKeyContents.anyOf ??= [];
                                    query.displayKeyContents.anyOf.push(...queryData["|dbkey"]);
                                }
                                if (queryData.dbkey !== undefined) {
                                    query.displayKeyContents ??= {};
                                    query.displayKeyContents.anyOf ??= [];
                                    query.displayKeyContents.anyOf.push(...queryData.dbkey);
                                }
                                if (queryData["&dbkey"] !== undefined) {
                                    query.displayKeyContents ??= {};
                                    query.displayKeyContents.allOf ??= [];
                                    query.displayKeyContents.allOf.push(...queryData["&dbkey"]);
                                }
                                if (queryData["^dbkey"] !== undefined) {
                                    query.displayKeyContents ??= {};
                                    query.displayKeyContents.oneOf ??= [];
                                    query.displayKeyContents.oneOf.push(...queryData["^dbkey"]);
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
                                function showInvalidContentTypeErrorWithMostSimilarContentTypes(contentType: string): void {
                                    const similarVals: {
                                        /**
                                         * The quality of the similarity.
                                         *
                                         * Lower is more similar.
                                         */
                                        quality: number;
                                        /**
                                         * The value.
                                         */
                                        value: string;
                                    }[] = [];
                                    const MAX_NONEXISTENT_CHARACTERS: number = Math.min(
                                        Math.max(0, contentType.length - 2, Math.floor(contentType.length / 2)),
                                        4
                                    );
                                    if (contentType.length > 0)
                                        contentTypesLoop: for (const v2 of DBEntryContentTypes) {
                                            const LOCAL_MAX_NONEXISTENT_CHARACTERS: number = Math.min(
                                                Math.max(0, v2.length - 2, Math.floor(v2.length / 2)),
                                                4,
                                                MAX_NONEXISTENT_CHARACTERS
                                            );
                                            let i: number = 0;
                                            let i2: number = 0;
                                            let totalDistanceBetweenCharacters: number = 0;
                                            let nonExistentCharacters: number = 0;
                                            let firstCharacterOffset: number = 0;
                                            while (i2 < v2.length && i < contentType.length) {
                                                const index: number = v2.toLowerCase().indexOf(contentType[i]!.toLowerCase(), i2);
                                                i++;
                                                if (index === -1) {
                                                    nonExistentCharacters++;
                                                    if (nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS) continue contentTypesLoop;
                                                    continue;
                                                } else {
                                                    if (i === 1) firstCharacterOffset = index;
                                                    totalDistanceBetweenCharacters += index;
                                                    i2 += index + 1;
                                                }
                                            }
                                            if (i !== contentType.length && contentType.length - i + nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS)
                                                continue contentTypesLoop;
                                            similarVals.push({ quality: totalDistanceBetweenCharacters + nonExistentCharacters * 10, value: v2 });
                                        }
                                    if (similarVals.length === 0) {
                                        showError({ message: `Unknown content type: ${contentType}` });
                                    } else {
                                        similarVals.sort((a: (typeof similarVals)[number], b: (typeof similarVals)[number]): number => a.quality - b.quality);
                                        if (1 in similarVals && similarVals[0]!.quality === similarVals[1].quality) {
                                            const suggestionVals: string[] = similarVals
                                                .slice(
                                                    0,
                                                    similarVals.findIndex(
                                                        (v2: { quality: number; value: string }): boolean => v2.quality !== similarVals[0]!.quality
                                                    )
                                                )
                                                .map((v2): string => v2.value);
                                            showError({
                                                message: `Unknown content type: ${contentType}, did you mean ${
                                                    suggestionVals.length === 2
                                                        ? `${suggestionVals[0]!} or ${suggestionVals[1]!}`
                                                        : `${suggestionVals.slice(0, -1).join(", ")}, or ${suggestionVals.at(-1)!}`
                                                }?`,
                                            });
                                        } else {
                                            showError({ message: `Unknown content type: ${contentType}, did you mean ${similarVals[0]!.value}?` });
                                        }
                                    }
                                }
                                if (queryData["-type"] !== undefined) {
                                    query.excludeContentTypes ??= [];
                                    query.excludeContentTypes.push(
                                        ...(queryData["-type"].map((v: string): string => {
                                            const val = DBEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        }) as any)
                                    );
                                }
                                if (queryData["|type"] !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...(queryData["|type"].map((v: string): string => {
                                            const val = DBEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        }) as any)
                                    );
                                }
                                if (queryData.type !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...(queryData.type.map((v: string): string => {
                                            const val = DBEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        }) as any)
                                    );
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
                                            helpInfo={viewFilesTabSearchSyntax}
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

async function getViewFilesTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The full list of client key data (including what isn't going to be displayed).
     */
    keys: KeyData[];
    dynamicProperties?: NBT.NBT | undefined;
}): Promise<JSX.Element[]> {
    const columns = ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs["simple"];
    return data.keys.map((key: KeyData): JSX.Element => {
        return (
            <tr
                onDblClick={(): void => {
                    data.tab.openTab({
                        // TO-DO: In the future, add support for getting their skin head or profile picture.
                        contentType: key.contentType,
                        icon: "auto",
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
                        case "ContentType":
                            return <td>{getContentTypeFromDBKey(key.rawKey)}</td>;
                    }
                })}
            </tr>
        );
    });
}
