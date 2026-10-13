import type { JSX, RefObject, TargetedKeyboardEvent, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import {
    entryContentTypeToFormatMap,
    getKeyDisplayName,
    prettyPrintSNBT,
    prismarineToSNBT,
    type MCDBEntryContentType,
    type EntryContentTypeFormatData,
    type MCFileEntryContentType,
    MCEntryContentTypesGrouping,
    type MCEntryContentType,
    MCEntryContentTypes,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { ControlledMenu, MenuItem, SubMenu, type ClickEvent as ContextMenu_ClickEvent } from "@szhsin/react-menu";
import { LoadingScreenContents } from "../app";
import SearchString from "search-string";
import { PageNavigation } from "../components/PageNavigation";
import SearchSyntaxHelpMenu, { type SearchSyntaxHelpInfo } from "../components/SearchSyntaxHelpMenu";
import EditorWidgetOverlayBar from "../components/EditorWidgetOverlayBar";
import { clipboard, dialog } from "@electron/remote";
import type { MessageBoxReturnValue } from "electron";
import Notice from "../components/Notice";
import { stringifyError } from "../../src/utils/miscUtils";
import { readFile, rm } from "node:fs/promises";
import { readdirRecursiveSafe } from "../../src/utils/folderContentsUtils";
import { existsSync, type Dirent } from "node:fs";
import path from "node:path";
import commentJSON from "comment-json";

// TODO: Implement Async Mode for this tab.

/**
 * Props for the {@link ViewFilesTab} component.
 */
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
            description: "Searches the human-readable LevelDB key or relative file path (the one displayed in the DB Key or File Path column) for the text.",
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
                            {MCEntryContentTypes.map(
                                (contentType: MCEntryContentType): JSX.SpecificElement<"li"> => (
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
                    <code>-type:Data3D -type:Block</code> - Searches entries with a content type other than Data3D or Block.
                </p>,
            ],
        },
        typegroup: {
            description:
                'Filters by the content type group of the entry (the groups used in the "Tab" debug overlay). This is like the "type" filter, but it allows searching for a group of related content types instead of entering each content type individually. Click "See more..." below for a list of supported content types.',
            extendedDescription: (
                <>
                    <p>Filters by the content type group of the entry (the one displayed in the "Tab" debug overlay).</p>
                    <p>
                        This is like the "type" filter, but it allows searching for a group of related content types instead of entering each content type
                        individually. This is very useful when searching for NBT, as it can take quite a while on large worlds, but filtering by the content
                        types you want to search in can make it almost instant.
                    </p>
                    <p>
                        Supported content type groups:
                        <ul>
                            {[...new Set(Object.values(MCEntryContentTypesGrouping))].map(
                                (contentType: (typeof MCEntryContentTypesGrouping)[keyof typeof MCEntryContentTypesGrouping]): JSX.SpecificElement<"li"> => (
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
                    <code>typegroup:Dimension</code> - Only searches entries with a content type under the Dimension group.
                </p>,
                <p>
                    <code>|typegroup:Dimension</code> - Only searches entries with a content type under the Dimension group.
                </p>,
                <p>
                    <code>typegroup:Dimension typegroup:Netease</code> - Only searches entries with a content type under either the Dimension or Netease groups.
                </p>,
                <p>
                    <code>-typegroup:Dimension -typegroup:Netease</code> - Searches entries with a content type that is neither under the Dimension group nor
                    the Netease group.
                </p>,
            ],
        },
        contents: {
            description:
                "Searches the LevelDB entry value. This will cause searching to take a lot longer on larger worlds, it is highly recommended to use a <code>type</code> or <code>typegroup</code> filter to limit the search.",
        },
        nbt: {
            description:
                "Searches the NBT data of entries. This will cause searching to take a lot longer on larger worlds, it is highly recommended to use a <code>type</code> or <code>typegroup</code> filter to limit the search.",
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

/**
 * The view files tab.
 *
 * This tab is used to view all LevelDB entries. (it only shows LevelDB entries atm, not files)
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
// IDEA: Maybe make the view files tab also show files.
export default function ViewFilesTab(props: ViewFilesTabProps): JSX.SpecificElement<"div"> {
    // Worlds can use this tab without a LevelDB because pre-0.9.0 worlds did not have a LevelDB but still had data.
    if (!props.tab.db && props.tab.type !== "world") return <div>The viewFiles sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const abortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        return (): void => {
            abortController.abort(new DOMException("Tab switched.", "AbortError"));
            if (containerRef.current) render(null, containerRef.current);
        };
    });
    getViewFilesTabContents(props.tab, abortController.signal).then(
        (element: JSX.Element): void => {
            if (!containerRef.current) return;
            render(null, containerRef.current);
            render(element, containerRef.current);
        },
        (reason: unknown): void => {
            if (reason instanceof DOMException && reason.name === "AbortError" && reason.message === "Tab switched.") return;
            if (containerRef.current) {
                // TODO: Replace this with a better error screen.
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent = stringifyError(reason);
                render(null, containerRef.current);
                containerRef.current.replaceChildren("Failed to load data:", errorElement);
            }
            console.error(reason);
        }
    );
    const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    if (props.tab.db && !props.tab.db.isOpen()) {
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
    if (props.tab.db && !props.tab.cachedDBKeys) {
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

interface LevelDBKeyData {
    rawKey: Buffer;
    displayKey: string;
    contentType: MCDBEntryContentType;
    valueType: EntryContentTypeFormatData;
    value?: any;
    // data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

interface FileKeyData {
    rawKey: Buffer;
    file: string;
    displayKey: string;
    contentType: MCFileEntryContentType;
    formatData?: EntryContentTypeFormatData | undefined;
    valueType: EntryContentTypeFormatData;
    value?: any;
    // data: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
}

async function getViewFilesTabContents(tab: TabManagerTab, signal: AbortSignal): Promise<JSX.Element> {
    if (tab.db && !tab.db.isOpen() && !((await tab.awaitDBOpen) ?? true)) {
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
                <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>{stringifyError(tab.errorOnDBOpen)}</div>
            </div>
        );
    }
    if (tab.db && !tab.cachedDBKeys) await tab.awaitCachedDBKeys!;
    signal.throwIfAborted();
    const leveldbKeys: LevelDBKeyData[] =
        tab.db ?
            (Object.keys(tab.cachedDBKeys!) as (keyof typeof tab.cachedDBKeys)[])
                .flatMap((contentType: keyof NonNullable<typeof tab.cachedDBKeys>): { contentType: MCDBEntryContentType; key: Buffer }[] =>
                    tab.cachedDBKeys![contentType].map((key: Buffer): { contentType: MCDBEntryContentType; key: Buffer } => ({
                        contentType,
                        key,
                    }))
                )
                .map(
                    ({ contentType, key }: { contentType: MCDBEntryContentType; key: Buffer }): LevelDBKeyData => ({
                        rawKey: key,
                        displayKey: getKeyDisplayName(key),
                        contentType,
                        valueType: entryContentTypeToFormatMap[contentType],
                        // data: await NBT.parse((await tab.db!.get(key))!),
                    })
                )
        :   [];
    const fileKeys: FileKeyData[] = [];
    {
        const basePath: string = tab.tempPath ?? tab.path;
        for (const file of await readdirRecursiveSafe(basePath, [], (dir: string, entry: Dirent<string>): boolean => {
            if (entry.name.startsWith(".")) return false;
            if (dir === basePath) {
                if (entry.isDirectory()) {
                    if (entry.name === "db") return false;
                    if (entry.name === "resource_packs") return false;
                    if (entry.name === "behavior_packs") return false;
                }
            }
            return true;
        })) {
            if (!file.isFile()) continue;
            const relativePath: string = path.relative(basePath, `${file.parentPath}/${file.name}`);
            if (relativePath.startsWith("..")) continue;
            let contentType: MCFileEntryContentType = "Unknown";
            let formatData: EntryContentTypeFormatData | undefined;
            getFileEntryContentType: {
                if (["level.dat", "level.dat_old", "level.dat_new"].includes(relativePath)) contentType = "LevelDat";
                else if (relativePath === "player.dat") contentType = "PlayerDat";
                // REVIEW
                else if (/^players\/-?[0-9]+\.dat$/.test(relativePath)) contentType = "LANPlayerDat";
                else if (relativePath === "entities.dat") contentType = "EntitiesDat";
                else if (relativePath === "chunks.dat") contentType = "ChunksDat";
                else if (relativePath === "importedchunks.dat") contentType = "ImportedChunksDat";
                // TODO
                // else if (["world_resource_packs.json", "world_behavior_packs.json"].includes(relativePath)) contentType = "WorldPacksJSON";
                // else if (["world_resource_packs_history.json", "world_behavior_packs_history.json"].includes(relativePath)) {
                //     contentType = "WorldPacksHistoryJSON";
                // } else if (/^pack_icon\.(?:png|jpg|jpeg|webp)$/i.test(relativePath) && relativePath.startsWith("pack_icon")) contentType = "PackIcon";
                else {
                    const extension: string = path.extname(relativePath).toLowerCase();
                    switch (extension) {
                        case ".json":
                            formatData = {
                                type: "JSON",
                                allowComments: true,
                            };
                            break;
                        case ".jsonc":
                            formatData = {
                                type: "JSONC",
                            };
                            break;
                        case ".txt":
                            formatData = {
                                type: "UTF-8",
                            };
                            break;
                        default:
                            break;
                    }
                }
                break getFileEntryContentType;
            }
            fileKeys.push({
                rawKey: Buffer.from(relativePath, "utf-8"),
                file: relativePath,
                displayKey: relativePath,
                contentType,
                formatData,
                valueType: entryContentTypeToFormatMap[contentType],
            });
        }
    }
    let mode: ConfigConstants.views.ViewFiles.ViewFilesTabMode =
        tab.db ?
            tab.type === "leveldb" ?
                "leveldb"
            :   config.views.viewFiles.mode
        :   "files";
    let keySearchResults: LevelDBKeyData[] | FileKeyData[] = mode === "files" ? fileKeys : leveldbKeys;
    // UNDONE: The view files tab does not need to preload all the data.
    // for (const key of keys) {
    //     valueTypeSwitcher: switch (key.valueType?.type) {
    //         case "UTF-8":
    //         case "ASCII":
    //         case "SNBT": {
    //             try {
    //                 const data = await tab.db.get(key.rawKey);
    //                 key.value = data?.toString("utf-8") ?? undefined;
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //             break;
    //         }
    //         case "binary":
    //         case "binaryPlainText": {
    //             try {
    //                 const data = await tab.db.get(key.rawKey);
    //                 key.value = data?.toString("binary") ?? undefined;
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //             break;
    //         }
    //         case "NBT": {
    //             // Do not load NBT as it takes too long.
    //             break;
    //         }
    //         case "JSON": {
    //             try {
    //                 const data = await tab.db.get(key.rawKey);
    //                 key.value = data ? JSON.stringify(JSON.parse(data.toString("utf-8"))) : undefined;
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //             break;
    //         }
    //         case "int": {
    //             try {
    //                 const data = await tab.db.get(key.rawKey);
    //                 key.value = data ? BigInt(`0x${data.slice(0, key.valueType.bytes).toString("hex")}`).toString(10) : undefined;
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //             break;
    //         }
    //         case "hex": {
    //             try {
    //                 const data = await tab.db.get(key.rawKey);
    //                 key.value = data ? BigInt(`0x${data.toString("hex")}`).toString(10) : undefined;
    //             } catch (e) {
    //                 console.error(e);
    //             }
    //             break;
    //         }
    //         case "custom": {
    //             switch (key.valueType.resultType) {
    //                 case "JSONNBT": {
    //                     // Do not load NBT as it takes too long.
    //                     break valueTypeSwitcher;
    //                 }
    //                 case "SNBT":
    //                 case "buffer":
    //                 case "unknown":
    //                     break valueTypeSwitcher;
    //                 default:
    //                     throw new Error(
    //                         `Unknown custom value type: ${(key.valueType as Extract<EntryContentTypeFormatData, { type: "custom" }>).resultType}`
    //                     );
    //             }
    //         }
    //         case "unknown": {
    //             break;
    //         }
    //         default:
    //             throw new Error(`Unknown value type: ${key.valueType?.type as string}`);
    //     }
    // }
    const keyValuesLoaded: Record<ConfigConstants.views.ViewFiles.ViewFilesTabMode, boolean> = {
        leveldb: false,
        files: false,
    };
    let currentUpdateTablesContentsFunction: ((reloadData: boolean) => Promise<void>) | null = null;
    let tablesContents: JSX.Element[][] = [
        await getViewFilesTabContentsRows({
            tab,
            leveldbKeys,
            fileKeys,
            mode,
            get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                return currentUpdateTablesContentsFunction;
            },
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
            leveldbModeWidgetOverlays: {
                clearEntries: useRef<HTMLDivElement>(null),
                newEntry: useRef<HTMLDivElement>(null),
            } satisfies Record<string, RefObject<HTMLElement>>,
            filesModeWidgetOverlays: {
                // TODO
                // clearFiles: useRef<HTMLDivElement>(null),
                // newFile: useRef<HTMLDivElement>(null),
            } satisfies Record<string, RefObject<HTMLElement>>,
        };
        function TablesContents(): JSX.Element {
            return (
                <>
                    {...ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs[mode].map(
                        (
                            _sectionID: (typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                useEffect((): (() => void) => {
                                    return (): void => {
                                        if (bodyRef.current) render(null, bodyRef.current);
                                    };
                                });
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
                                                /* onContextMenu={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                                        if (typeof document.hasFocus === "function" && !document.hasFocus()) return;

                                                        event.preventDefault();
                                                        columnHeadersContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                        columnHeadersContextMenu_setOpen(true);
                                                    }} */
                                                >
                                                    {...config.views.viewFiles.modeSettings[mode].columns.map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs)[typeof mode][number]
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
                                                    <td colSpan={ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs[mode].length}>
                                                        <PageNavigation
                                                            totalPages={Math.ceil(tablesContents[index]!.length / 20)}
                                                            onPageChange={(page: number): void => {
                                                                if (!bodyRef.current) return;
                                                                render(null, bodyRef.current);
                                                                render(<>{...tablesContents[index]!.slice((page - 1) * 20, page * 20)}</>, bodyRef.current);
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
        const query: Omit<TabManagerTab_LevelDBSearchQuery, "searchTargets"> & {
            searchTargets:
                | (
                      | {
                            key: Buffer<ArrayBufferLike>;
                            displayKey: string;
                            contentType: MCDBEntryContentType;
                            data: LevelDBKeyData;
                            searchableContents: string[];
                        }
                      | {
                            key: Buffer<ArrayBufferLike>;
                            displayKey: string;
                            value: any;
                            valueType: EntryContentTypeFormatData;
                            contentType: MCDBEntryContentType;
                            data: LevelDBKeyData;
                            searchableContents: string[];
                        }
                  )[]
                | (
                      | {
                            key: Buffer<ArrayBufferLike>;
                            displayKey: string;
                            contentType: MCFileEntryContentType;
                            data: FileKeyData;
                            searchableContents: string[];
                        }
                      | {
                            key: Buffer<ArrayBufferLike>;
                            displayKey: string;
                            value: any;
                            valueType: EntryContentTypeFormatData;
                            contentType: MCFileEntryContentType;
                            data: FileKeyData;
                            searchableContents: string[];
                        }
                  )[];
        } = {
            searchTargets:
                mode === "leveldb" ?
                    leveldbKeys.map(
                        (key: LevelDBKeyData) =>
                            ({
                                key: key.rawKey,
                                displayKey: key.displayKey,
                                // value: key.data,
                                // valueType: entryContentTypeToFormatMap.ActorPrefix,
                                contentType: key.contentType,
                                data: key,
                                searchableContents: [key.displayKey],
                            }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                    )
                :   fileKeys.map(
                        (key: FileKeyData) =>
                            ({
                                key: key.rawKey,
                                displayKey: key.displayKey,
                                // value: key.data,
                                // valueType: entryContentTypeToFormatMap.ActorPrefix,
                                contentType: key.contentType,
                                data: key,
                                searchableContents: [key.displayKey],
                            }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                    ),
        };
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            // TODO: Add an error handler to this function.
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                console.debug(query);
                const lastMode: ConfigConstants.views.ViewFiles.ViewFilesTabMode = mode;
                mode = config.views.viewFiles.mode;
                const hasNBTContentsQuery: boolean = !!(
                    (
                        (query.nbtTags?.allOf && query.nbtTags?.allOf.length > 0) ||
                        (query.nbtTags?.anyOf && query.nbtTags?.anyOf.length > 0) ||
                        (query.nbtTags?.oneOf && query.nbtTags?.oneOf.length > 0) ||
                        (query.nbtTags?.noneOf && query.nbtTags?.noneOf.length > 0) ||
                        (query.customDataFields?.contents?.allOf && query.customDataFields?.contents?.allOf.length > 0) ||
                        (query.customDataFields?.contents?.anyOf && query.customDataFields?.contents?.anyOf.length > 0) ||
                        (query.customDataFields?.contents?.oneOf && query.customDataFields?.contents?.oneOf.length > 0) ||
                        (query.customDataFields?.contents?.noneOf && query.customDataFields?.contents?.noneOf.length > 0)
                    ) /* ||
                    (query.rawValueContents?.allOf && query.rawValueContents?.allOf.length > 0) ||
                    (query.rawValueContents?.anyOf && query.rawValueContents?.anyOf.length > 0) ||
                    (query.rawValueContents?.oneOf && query.rawValueContents?.oneOf.length > 0) ||
                    (query.rawValueContents?.noneOf && query.rawValueContents?.noneOf.length > 0) */ /* TODO */
                );
                const hasGenericContentsQuery: boolean = !!(
                    (query.customDataFields?.contents?.allOf && query.customDataFields?.contents?.allOf.length > 0) ||
                    (query.customDataFields?.contents?.anyOf && query.customDataFields?.contents?.anyOf.length > 0) ||
                    (query.customDataFields?.contents?.oneOf && query.customDataFields?.contents?.oneOf.length > 0) ||
                    (query.customDataFields?.contents?.noneOf && query.customDataFields?.contents?.noneOf.length > 0) ||
                    (query.contentsStringContents?.allOf && query.contentsStringContents?.allOf.length > 0) ||
                    (query.contentsStringContents?.anyOf && query.contentsStringContents?.anyOf.length > 0) ||
                    (query.contentsStringContents?.oneOf && query.contentsStringContents?.oneOf.length > 0) ||
                    (query.contentsStringContents?.noneOf && query.contentsStringContents?.noneOf.length > 0)
                );
                if (!keyValuesLoaded[mode] && (hasNBTContentsQuery || hasGenericContentsQuery)) {
                    let i: number = 0;
                    let t: number = Date.now();
                    for (const key of mode === "files" ? fileKeys : leveldbKeys) {
                        i++;
                        if (t + 10 < Date.now()) {
                            t = Date.now();
                            if (loadingScreenMessageContainerRef.current) {
                                loadingScreenMessageContainerRef.current.textContent = `Reading ${
                                    hasGenericContentsQuery ?
                                        mode === "files" ?
                                            "files"
                                        :   "LevelDB entry"
                                    :   "NBT"
                                } data: ${i}/${leveldbKeys.length}...`;
                            }
                        }
                        if (key.value !== undefined) continue;
                        if (query.contentTypes && !query.contentTypes.includes(key.contentType)) continue;
                        if (query.excludeContentTypes?.includes(key.contentType)) continue;
                        valueTypeSwitcher: switch (key.valueType?.type) {
                            case "UTF-8": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data?.toString("utf-8") ?? undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "SNBT": {
                                if (!hasNBTContentsQuery) break;
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data?.toString("utf-8") ?? undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "ASCII": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data?.toString("ascii") ?? undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "binary":
                            case "binaryPlainText": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data?.toString("binary") ?? undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "NBT": {
                                if (!hasNBTContentsQuery) break;
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value =
                                        data !== null ?
                                            await NBT.parse(
                                                data,
                                                !key.valueType.format ? "little"
                                                : key.valueType.format === "LE" ? "little"
                                                : key.valueType.format === "BE" ? "big"
                                                : key.valueType.format === "LEV" ? "littleVarint"
                                                : "little"
                                            )
                                        :   null;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "JSON": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data ? (JSON.parse(data.toString("utf-8")) as unknown) : undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "JSONC": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data ? (commentJSON.parse(data.toString("utf-8")) as unknown) : undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "int": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data ? BigInt(`0x${data.slice(0, key.valueType.bytes).toString("hex")}`).toString(10) : undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "hex": {
                                try {
                                    const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                    key.value = data ? data.toString("hex") : undefined;
                                } catch (e) {
                                    console.error(e);
                                }
                                break;
                            }
                            case "custom": {
                                switch (key.valueType.resultType) {
                                    case "JSONNBT":
                                    case "SNBT": {
                                        if (!hasNBTContentsQuery) break valueTypeSwitcher;
                                        try {
                                            const data = await ("file" in key ? readFile(path.join(tab.path, key.file)) : tab.db!.get(key.rawKey));
                                            key.value = data !== null ? await key.valueType.parse(data) : null;
                                        } catch (e) {
                                            console.error(e);
                                        }
                                        break valueTypeSwitcher;
                                    }
                                    case "buffer":
                                    case "unknown":
                                        break valueTypeSwitcher;
                                    default:
                                        console.error(
                                            new Error(
                                                `Unknown custom value type: ${(key.valueType as Extract<EntryContentTypeFormatData, { type: "custom" }>).resultType}`
                                            ),
                                            key
                                        );
                                        break valueTypeSwitcher;
                                }
                            }
                            case "unknown": {
                                break;
                            }
                            default:
                                console.error(new Error(`Unknown value type: ${(key.valueType as EntryContentTypeFormatData)?.type as string}`), key);
                                break;
                        }
                    }
                    if (
                        (!query.contentTypes || query.contentTypes.length === 0) &&
                        (!query.excludeContentTypes || query.excludeContentTypes.length === 0) &&
                        hasNBTContentsQuery
                    ) {
                        keyValuesLoaded[mode] = true;
                    }
                    query.searchTargets =
                        mode === "leveldb" ?
                            leveldbKeys.map(
                                (key: LevelDBKeyData) =>
                                    ({
                                        key: key.rawKey,
                                        displayKey: key.displayKey,
                                        value: key.value!,
                                        valueType: key.valueType,
                                        contentType: key.contentType,
                                        data: key,
                                        searchableContents: [
                                            key.displayKey,
                                            ...(key.value ?
                                                [
                                                    key.valueType.type === "NBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   "",
                                                ]
                                            :   []),
                                        ],
                                        customDataFields: {
                                            contents:
                                                key.value ?
                                                    key.valueType.type === "NBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), {
                                                                    indent: 0,
                                                                });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   undefined
                                                :   undefined,
                                        },
                                    }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                            )
                        :   fileKeys.map(
                                (key: FileKeyData) =>
                                    ({
                                        key: key.rawKey,
                                        displayKey: key.displayKey,
                                        value: key.value!,
                                        valueType: key.valueType,
                                        contentType: key.contentType,
                                        data: key,
                                        searchableContents: [
                                            key.displayKey,
                                            ...(key.value ?
                                                [
                                                    key.valueType.type === "NBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   "",
                                                ]
                                            :   []),
                                        ],
                                        customDataFields: {
                                            contents:
                                                key.value ?
                                                    key.valueType.type === "NBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), {
                                                                    indent: 0,
                                                                });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   undefined
                                                :   undefined,
                                        },
                                    }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                            );
                } else if (mode !== lastMode) {
                    query.searchTargets =
                        mode === "leveldb" ?
                            leveldbKeys.map(
                                (key: LevelDBKeyData) =>
                                    ({
                                        key: key.rawKey,
                                        displayKey: key.displayKey,
                                        value: key.value!,
                                        valueType: key.valueType,
                                        contentType: key.contentType,
                                        data: key,
                                        searchableContents: [
                                            key.displayKey,
                                            ...(key.value ?
                                                [
                                                    key.valueType.type === "NBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   "",
                                                ]
                                            :   []),
                                        ],
                                        customDataFields: {
                                            contents:
                                                key.value ?
                                                    key.valueType.type === "NBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), {
                                                                    indent: 0,
                                                                });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   undefined
                                                :   undefined,
                                        },
                                    }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                            )
                        :   fileKeys.map(
                                (key: FileKeyData) =>
                                    ({
                                        key: key.rawKey,
                                        displayKey: key.displayKey,
                                        value: key.value!,
                                        valueType: key.valueType,
                                        contentType: key.contentType,
                                        data: key,
                                        searchableContents: [
                                            key.displayKey,
                                            ...(key.value ?
                                                [
                                                    key.valueType.type === "NBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string => {
                                                            try {
                                                                // return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                                // Disable directly searching SNBT.
                                                                return "";
                                                            } catch {
                                                                return "";
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   "",
                                                ]
                                            :   []),
                                        ],
                                        customDataFields: {
                                            contents:
                                                key.value ?
                                                    key.valueType.type === "NBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT((key.value as { parsed: NBT.NBT }).parsed), {
                                                                    indent: 0,
                                                                });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "custom" && key.valueType.resultType === "JSONNBT" ?
                                                        ((): string | undefined => {
                                                            try {
                                                                return prettyPrintSNBT(prismarineToSNBT(key.value), { indent: 0 });
                                                            } catch {
                                                                return undefined;
                                                            }
                                                        })()
                                                    : key.valueType.type === "JSON" ? JSON.stringify(key.value)
                                                    : key.valueType.type === "JSONC" ? commentJSON.stringify(key.value)
                                                    : typeof key.value !== "function" && typeof key.value !== "object" && typeof key.value !== "symbol" ?
                                                        String(key.value)
                                                    :   undefined
                                                :   undefined,
                                        },
                                    }) as const satisfies NonNullable<TabManagerTab_LevelDBSearchQuery["searchTargets"]>[number]
                            );
                }
                tablesContents = await Promise.all(
                    ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs[mode].map(
                        async (
                            _sectionID: (typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToSectionIDs)[typeof mode][number]
                        ): Promise<JSX.Element[]> =>
                            await getViewFilesTabContentsRows({
                                tab,
                                leveldbKeys:
                                    mode === "leveldb" && Object.keys(query).length > 1 ?
                                        await (async (): Promise<LevelDBKeyData[]> => {
                                            const iterator = tab.dbSearch!.search(
                                                query as Omit<typeof query, "searchTargets"> & {
                                                    searchTargets: Extract<(typeof query)["searchTargets"], { data: LevelDBKeyData }[]>;
                                                },
                                                true
                                            );
                                            let i: number = 0;
                                            let t: number = Date.now();
                                            const results: LevelDBKeyData[] = [];
                                            const formatter = new Intl.NumberFormat();
                                            for (const value of iterator) {
                                                i++;
                                                if (t + 15 < Date.now()) {
                                                    if (loadingScreenMessageContainerRef.current) {
                                                        loadingScreenMessageContainerRef.current.textContent = `Searching LevelDB: ${formatter.format(i)}/${formatter.format(leveldbKeys.length)} (${formatter.format(results.length)} results)...`;
                                                    }
                                                    signal.throwIfAborted();
                                                    await sleep(5);
                                                    t = Date.now();
                                                }
                                                if (!value) continue;
                                                results.push(value.originalObject.data);
                                            }
                                            keySearchResults = results;
                                            return results;
                                        })()
                                    :   (keySearchResults = leveldbKeys),
                                fileKeys:
                                    mode === "files" && Object.keys(query).length > 1 ?
                                        await (async (): Promise<FileKeyData[]> => {
                                            const iterator = tab.dbSearch!.search(
                                                query as Omit<typeof query, "searchTargets"> & {
                                                    searchTargets: Extract<(typeof query)["searchTargets"], { data: FileKeyData }[]>;
                                                },
                                                true
                                            );
                                            let i: number = 0;
                                            let t: number = Date.now();
                                            const results: FileKeyData[] = [];
                                            const formatter = new Intl.NumberFormat();
                                            for (const value of iterator) {
                                                i++;
                                                if (t + 15 < Date.now()) {
                                                    if (loadingScreenMessageContainerRef.current) {
                                                        loadingScreenMessageContainerRef.current.textContent = `Searching files: ${formatter.format(i)}/${formatter.format(leveldbKeys.length)} (${formatter.format(results.length)} results)...`;
                                                    }
                                                    signal.throwIfAborted();
                                                    await sleep(5);
                                                    t = Date.now();
                                                }
                                                if (!value) continue;
                                                results.push(value.originalObject.data);
                                            }
                                            keySearchResults = results;
                                            return results;
                                        })()
                                    :   (keySearchResults = fileKeys),
                                mode,
                                get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                                    return currentUpdateTablesContentsFunction;
                                },
                            })
                    )
                );
            }
            render(null, tablesContainerRef.current);
            render(<TablesContents />, tablesContainerRef.current);
        }
        currentUpdateTablesContentsFunction = updateTablesContents;
        useEffect((): (() => void) => {
            function onModeChanged(newModeValue: ConfigConstants.views.ViewFiles.ViewFilesTabMode): void {
                for (const element of Object.values(viewOptionsRefs.leveldbModeWidgetOverlays)) {
                    if (!element.current) continue;
                    element.current.hidden = newModeValue !== "leveldb";
                }
                // TODO
                // for (const element of Object.values(viewOptionsRefs.filesModeOptions)) {
                //     if (!element.current) continue;
                //     element.current.hidden = newModeValue !== "files";
                // }
                void updateTablesContents(true);
            }
            function onLevelDBModeColumnsChanged(): void {
                if (mode !== "leveldb") return;
                void updateTablesContents(false);
            }
            function onFilesModeColumnsChanged(): void {
                if (mode !== "files") return;
                void updateTablesContents(false);
            }
            config.on("settingChanged:views.viewFiles.mode", onModeChanged);
            config.on("settingChanged:views.viewFiles.modeSettings.leveldb.columns", onLevelDBModeColumnsChanged);
            config.on("settingChanged:views.viewFiles.modeSettings.files.columns", onFilesModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.viewFiles.mode", onModeChanged);
                config.off("settingChanged:views.viewFiles.modeSettings.leveldb.columns", onLevelDBModeColumnsChanged);
                config.off("settingChanged:views.viewFiles.modeSettings.files.columns", onFilesModeColumnsChanged);
                if (tablesContainerRef.current) render(null, tablesContainerRef.current);
            };
        });
        let lastHideErrorPopupFunction: (() => void) | undefined;
        return (
            <>
                <EditorWidgetOverlayBar barContainerRef={viewOptionsRefs.viewOptionsContainer}>
                    <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                        <button
                            type="button"
                            class={mode === "leveldb" ? "selected" : ""}
                            onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.viewFiles.mode = "leveldb";
                            }}
                            disabled={!tab.db}
                        >
                            LevelDB
                        </button>
                        <button
                            type="button"
                            class={mode === "files" ? "selected" : ""}
                            onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.viewFiles.mode = "files";
                            }}
                            disabled={tab.type === "leveldb"}
                        >
                            Files
                        </button>
                        {/* TODO */}
                        {/* <button
                            type="button"
                            class={mode === "files" ? "selected" : ""}
                            onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.viewFiles.mode = "files";
                            }}
                            disabled={tab.type === "leveldb"}
                        >
                            chunks.dat
                        </button> */}
                    </div>
                    <div class="widget-overlay tabbed-selector" hidden={mode !== "leveldb"} ref={viewOptionsRefs.leveldbModeWidgetOverlays.clearEntries}>
                        <button
                            type="button"
                            title="Clear Entries"
                            onClick={async (): Promise<void> => {
                                if (mode !== "leveldb") return;
                                if (!tab.db) return;
                                if (!tab.db.isOpen()) return;
                                if (!tab.cachedDBKeys) return;
                                if (keySearchResults === leveldbKeys) {
                                    const prompt1Result: MessageBoxReturnValue = await dialog.showMessageBox({
                                        type: "warning",
                                        title: "Deleting ALL LevelDB Entries",
                                        message: `Are you sure you want to delete all ${keySearchResults.length} LevelDB entries?`,
                                        buttons: ["Proceed", "Cancel"],
                                        noLink: true,
                                        // Make the default option to cancel as this is a very dangerous operation.
                                        defaultId: 1,
                                        cancelId: 1,
                                    });
                                    if (prompt1Result.response !== 0) return;
                                    const prompt2Result: MessageBoxReturnValue = await dialog.showMessageBox({
                                        type: "warning",
                                        title: "Deleting ALL LevelDB Entries",
                                        message: `Are you REALLY sure you want to delete all ${keySearchResults.length} LevelDB entries?`,
                                        detail: "This is like deleting your entire world except for the settings.",
                                        buttons: ["Proceed", "Cancel"],
                                        noLink: true,
                                        // Make the default option to cancel as this is a very dangerous operation.
                                        defaultId: 1,
                                        cancelId: 1,
                                    });
                                    if (prompt2Result.response !== 0) return;
                                } else {
                                    const promptResult: MessageBoxReturnValue = await dialog.showMessageBox({
                                        type: "warning",
                                        title: "Deleting Search Results from LevelDB",
                                        message: `Are you sure you want to delete all ${keySearchResults.length} search results from the LevelDB?`,
                                        buttons: ["Proceed", "Cancel"],
                                        noLink: true,
                                        // Make the default option to cancel as this is a very dangerous operation.
                                        defaultId: 1,
                                        cancelId: 1,
                                    });
                                    if (promptResult.response !== 0) return;
                                }
                                if (mode !== "leveldb") return;
                                const searchResults = [...keySearchResults] as LevelDBKeyData[] | FileKeyData[];
                                function assertIsValidKeySearchResultsType(
                                    value: typeof keySearchResults
                                ): asserts value is Exclude<typeof keySearchResults, FileKeyData[]> {
                                    if (value[0] && "file" in value[0]) {
                                        throw new Error("keySearchResults contains file entries instead of LevelDB entries.");
                                    }
                                }
                                assertIsValidKeySearchResultsType(searchResults);
                                await Promise.all(
                                    searchResults.map(
                                        async (key: LevelDBKeyData): Promise<void> =>
                                            void (await tab.db!.delete(key.rawKey).then((success: boolean): void => {
                                                if (!success) return;
                                                tab.setLevelDBIsModified();
                                                deleteKeySearchResultsKey: {
                                                    const keySearchResultsKeyIndex: number = keySearchResults.indexOf(key as never);
                                                    if (keySearchResultsKeyIndex === -1) break deleteKeySearchResultsKey;
                                                    keySearchResults.splice(keySearchResultsKeyIndex, 1);
                                                }
                                                searchResults.splice(searchResults.indexOf(key), 1);
                                                deleteSearchTargetsKey: {
                                                    const searchTargetsKeyIndex: number = query.searchTargets.findIndex((key2): boolean => key2.data === key);
                                                    if (searchTargetsKeyIndex === -1) break deleteSearchTargetsKey;
                                                    query.searchTargets.splice(searchTargetsKeyIndex, 1);
                                                }
                                                if (tab.cachedDBKeys?.[key.contentType]?.includes(key.rawKey)) {
                                                    tab.cachedDBKeys[key.contentType].splice(tab.cachedDBKeys[key.contentType].indexOf(key.rawKey), 1);
                                                }
                                                if (leveldbKeys.includes(key)) {
                                                    leveldbKeys.splice(leveldbKeys.indexOf(key), 1);
                                                }
                                            }))
                                    )
                                );
                                // OPTIMIZE: This reloads more than is necessary.
                                void updateTablesContents(true);
                            }}
                        >
                            <img
                                src="resource://images/ui/glyphs/delete.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            Clear Entries
                        </button>
                    </div>
                    <div class="widget-overlay tabbed-selector" hidden={mode !== "leveldb"} ref={viewOptionsRefs.leveldbModeWidgetOverlays.newEntry}>
                        <button
                            type="button"
                            title="New Entry"
                            // eslint-disable-next-line @typescript-eslint/require-await -- TEMP
                            onClick={async (): Promise<void> => {
                                try {
                                    if (!tab.db) return;
                                    if (!tab.db.isOpen()) return;
                                    if (!tab.cachedDBKeys) return;
                                    // const creationOptions = await showDBKeyCreationDialog({
                                    //     options: ["chunkX", "chunkZ", "dimension"],
                                    //     message: "Please enter the paremters for the new RandomTicks entry.",
                                    // });
                                    // if (creationOptions.canceled) return;
                                    // const key: Buffer = generateChunkKeyFromIndices(
                                    //     { x: creationOptions.data.chunkX, z: creationOptions.data.chunkZ, dimension: creationOptions.data.dimension },
                                    //     "RandomTicks"
                                    // );
                                    // if (await tab.db.get(key)) {
                                    //     void dialog.showMessageBox({
                                    //         type: "error",
                                    //         title: "Duplicate Key",
                                    //         message: `Unable to create a new RandomTicks entry at chunk ${creationOptions.data.chunkX} ${creationOptions.data.chunkZ} in dimension ${creationOptions.data.dimension}.`,
                                    //         detail: "There is already a RandomTicks entry at this location.",
                                    //         buttons: ["OK"],
                                    //         noLink: true,
                                    //     });
                                    //     return;
                                    // }
                                    // await tab.db.put(key, entryContentTypeToFormatMap.RandomTicks.defaultValue);
                                    // tab.setLevelDBIsModified();
                                    // tab.cachedDBKeys.RandomTicks.push(key);
                                    // tab.openTab({
                                    //     contentType: "RandomTicks",
                                    //     icon: "auto",
                                    //     name: getKeyDisplayName(key),
                                    //     parentTab: tab,
                                    //     target: {
                                    //         type: "LevelDBEntry",
                                    //         key,
                                    //     },
                                    // });
                                } catch (e) {
                                    void dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: `An error occurred while creating the RandomTicks entry.`,
                                        detail: stringifyError(e),
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                }
                            }}
                            disabled
                        >
                            <img
                                src="resource://images/ui/glyphs/Data-Empty.png"
                                class="invert_on_light_theme"
                                style={{ width: "12px", imageRendering: "pixelated", margin: "-1.5px 5px -1.5px 0" }}
                                aria-hidden="true"
                            />
                            New Entry
                        </button>
                    </div>
                    {/* TODO: Add a Clear Files and New File button. */}
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
                        onKeyDown={(event: TargetedKeyboardEvent<HTMLInputElement>): void => {
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
                                const keywords = ["dbkey", "nbt", "type", "typegroup", "contents"] as const;
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
                                    if (
                                        [
                                            ...getKeywordedOperators(["dbkey", "nbt", "contents"]),
                                            ...getKeywordedOperators(["type", "typegroup"], ["", "|", "-"]),
                                        ].includes(key as never)
                                    ) {
                                        continue;
                                    }
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
                                // BUG: Add wildcard handling to this.
                                function showInvalidContentTypeErrorWithMostSimilarContentTypes(contentType: string): void {
                                    contentType = contentType.replaceAll("*", ""); // TEMP: This is just until wildcard handling is added.
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
                                    if (contentType.length > 0) {
                                        contentTypesLoop: for (const v2 of MCEntryContentTypes) {
                                            const LOCAL_MAX_NONEXISTENT_CHARACTERS: number = Math.min(
                                                Math.max(0, v2.length - 2, Math.floor(v2.length / 2)),
                                                4,
                                                MAX_NONEXISTENT_CHARACTERS
                                            );
                                            let i: number = 0;
                                            let i2: number = 0;
                                            let totalDistanceBetweenCharacters: number = 0;
                                            let nonExistentCharacters: number = 0;
                                            while (i2 < v2.length && i < contentType.length) {
                                                const index: number = v2.toLowerCase().indexOf(contentType[i]!.toLowerCase(), i2);
                                                i++;
                                                if (index === -1) {
                                                    nonExistentCharacters++;
                                                    if (nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS) continue contentTypesLoop;
                                                    continue;
                                                } else {
                                                    totalDistanceBetweenCharacters += index - i2;
                                                    i2 = index + 1;
                                                }
                                            }
                                            if (i !== contentType.length && contentType.length - i + nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS) {
                                                continue;
                                            }
                                            const substringIndex: number = v2.toLowerCase().indexOf(contentType.toLowerCase());
                                            if (substringIndex !== -1) {
                                                totalDistanceBetweenCharacters -= Math.max(0, 50 - substringIndex * 5);
                                            }
                                            similarVals.push({
                                                quality: totalDistanceBetweenCharacters + nonExistentCharacters * 10,
                                                value: v2,
                                            });
                                        }
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
                                                    suggestionVals.length === 2 ?
                                                        `${suggestionVals[0]!} or ${suggestionVals[1]!}`
                                                    :   `${suggestionVals.slice(0, -1).join(", ")}, or ${suggestionVals.at(-1)!}`
                                                }?`,
                                            });
                                        } else {
                                            showError({ message: `Unknown content type: ${contentType}, did you mean ${similarVals[0]!.value}?` });
                                        }
                                    }
                                }
                                const contentTypeGroups = [...new Set(Object.values(MCEntryContentTypesGrouping))];
                                const contentTypeGroupToContentTypesMap = (Object.keys(MCEntryContentTypesGrouping) as MCEntryContentType[]).reduce(
                                    (
                                        acc: Record<(typeof contentTypeGroups)[number], MCEntryContentType[]>,
                                        contentType: MCEntryContentType
                                    ): Record<(typeof contentTypeGroups)[number], MCEntryContentType[]> => {
                                        if (acc[MCEntryContentTypesGrouping[contentType]]?.includes(contentType)) return acc;
                                        (acc[MCEntryContentTypesGrouping[contentType]] ??= []).push(contentType);
                                        return acc;
                                    },
                                    {} as Record<(typeof contentTypeGroups)[number], MCEntryContentType[]>
                                );
                                // BUG: Add wildcard handling to this.
                                function showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(contentTypeGroup: string): void {
                                    contentTypeGroup = contentTypeGroup.replaceAll("*", ""); // TEMP: This is just until wildcard handling is added.
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
                                        Math.max(0, contentTypeGroup.length - 2, Math.floor(contentTypeGroup.length / 2)),
                                        4
                                    );
                                    if (contentTypeGroup.length > 0) {
                                        contentTypeGroupsLoop: for (const v2 of contentTypeGroups) {
                                            const LOCAL_MAX_NONEXISTENT_CHARACTERS: number = Math.min(
                                                Math.max(0, v2.length - 2, Math.floor(v2.length / 2)),
                                                4,
                                                MAX_NONEXISTENT_CHARACTERS
                                            );
                                            let i: number = 0;
                                            let i2: number = 0;
                                            let totalDistanceBetweenCharacters: number = 0;
                                            let nonExistentCharacters: number = 0;
                                            while (i2 < v2.length && i < contentTypeGroup.length) {
                                                const index: number = v2.toLowerCase().indexOf(contentTypeGroup[i]!.toLowerCase(), i2);
                                                i++;
                                                if (index === -1) {
                                                    nonExistentCharacters++;
                                                    if (nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS) continue contentTypeGroupsLoop;
                                                    continue;
                                                } else {
                                                    totalDistanceBetweenCharacters += index - i2;
                                                    i2 = index + 1;
                                                }
                                            }
                                            if (
                                                i !== contentTypeGroup.length &&
                                                contentTypeGroup.length - i + nonExistentCharacters > LOCAL_MAX_NONEXISTENT_CHARACTERS
                                            ) {
                                                continue;
                                            }
                                            const substringIndex: number = v2.toLowerCase().indexOf(contentTypeGroup.toLowerCase());
                                            if (substringIndex !== -1) {
                                                totalDistanceBetweenCharacters -= Math.max(0, 50 - substringIndex * 5);
                                            }
                                            similarVals.push({
                                                quality: totalDistanceBetweenCharacters + nonExistentCharacters * 10,
                                                value: v2,
                                            });
                                        }
                                    }
                                    if (similarVals.length === 0) {
                                        showError({ message: `Unknown content type group: ${contentTypeGroup}` });
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
                                                message: `Unknown content type group: ${contentTypeGroup}, did you mean ${
                                                    suggestionVals.length === 2 ?
                                                        `${suggestionVals[0]!} or ${suggestionVals[1]!}`
                                                    :   `${suggestionVals.slice(0, -1).join(", ")}, or ${suggestionVals.at(-1)!}`
                                                }?`,
                                            });
                                        } else {
                                            showError({ message: `Unknown content type group: ${contentTypeGroup}, did you mean ${similarVals[0]!.value}?` });
                                        }
                                    }
                                }
                                if (queryData["-type"] !== undefined) {
                                    query.excludeContentTypes ??= [];
                                    query.excludeContentTypes.push(
                                        ...queryData["-type"].flatMap((v: string): MCEntryContentType | MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                const vals = MCEntryContentTypes.filter((v2: string): boolean => regex.test(v2));
                                                if (vals.length) return vals;
                                                showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = MCEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
                                    );
                                }
                                if (queryData["|type"] !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...queryData["|type"].flatMap((v: string): MCEntryContentType | MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                const vals = MCEntryContentTypes.filter((v2: string): boolean => regex.test(v2));
                                                if (vals.length) return vals;
                                                showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = MCEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
                                    );
                                }
                                if (queryData.type !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...queryData.type.flatMap((v: string): MCEntryContentType | MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                console.log(regex);
                                                const vals = MCEntryContentTypes.filter((v2: string): boolean => regex.test(v2));
                                                console.log(MCEntryContentTypes, vals);
                                                if (vals.length) return vals;
                                                showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = MCEntryContentTypes.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return val;
                                            showInvalidContentTypeErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
                                    );
                                }
                                if (queryData["|typegroup"] !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...queryData["|typegroup"].flatMap((v: string): MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                const vals = contentTypeGroups
                                                    .filter((v2): boolean => regex.test(v2))
                                                    .flatMap((v2) => contentTypeGroupToContentTypesMap[v2]);
                                                if (vals.length) return vals;
                                                showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = contentTypeGroups.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return contentTypeGroupToContentTypesMap[val];
                                            showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
                                    );
                                }
                                if (queryData.typegroup !== undefined) {
                                    query.contentTypes ??= [];
                                    query.contentTypes.push(
                                        ...queryData.typegroup.flatMap((v: string): MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                const vals = contentTypeGroups
                                                    .filter((v2): boolean => regex.test(v2))
                                                    .flatMap((v2) => contentTypeGroupToContentTypesMap[v2]);
                                                if (vals.length) return vals;
                                                showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = contentTypeGroups.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return contentTypeGroupToContentTypesMap[val];
                                            showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
                                    );
                                }
                                if (queryData["-typegroup"] !== undefined) {
                                    query.excludeContentTypes ??= [];
                                    query.excludeContentTypes.push(
                                        ...queryData["-typegroup"].flatMap((v: string): MCEntryContentType[] => {
                                            if (v.includes("*")) {
                                                const regex = new RegExp(`^${v.split("*").map(RegExp.escape).join(".*")}$`, "i");
                                                const vals = contentTypeGroups
                                                    .filter((v2): boolean => regex.test(v2))
                                                    .flatMap((v2) => contentTypeGroupToContentTypesMap[v2]);
                                                if (vals.length) return vals;
                                                showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                                throw new Error("Error to return but already handled.");
                                            }
                                            const val = contentTypeGroups.find((v2: string): boolean => v2.toLowerCase() === v.toLowerCase());
                                            if (val) return contentTypeGroupToContentTypesMap[val];
                                            showInvalidContentTypeGroupErrorWithMostSimilarContentTypes(v);
                                            throw new Error("Error to return but already handled.");
                                        })
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
                                    render(null, tablesContainerRef.current);
                                    render(
                                        <div style="width: 100%; height: 100%; position: fixed; bottom: 0; left: 0; display: flex; flex-direction: row; overflow: auto;">
                                            <LoadingScreenContents messageContainerRef={loadingScreenMessageContainerRef} />
                                        </div>,
                                        tablesContainerRef.current
                                    );
                                }
                                void updateTablesContents(true);
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

// eslint-disable-next-line @typescript-eslint/require-await -- TEMP
async function getViewFilesTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    /**
     * The full list of LevelDB key data.
     */
    leveldbKeys: LevelDBKeyData[];
    /**
     * The full list of LevelDB key data.
     */
    fileKeys: FileKeyData[];
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.ViewFiles.ViewFilesTabSectionMode;
    get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null;
}): Promise<JSX.Element[]> {
    // IDEA: Maybe add a chunks.dat mode, which would allow you to search chunks for data in worlds from before Pocket Edition 0.9.0 Alpha.
    switch (data.mode) {
        case "leveldb": {
            const columns = ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs[data.mode];
            return data.leveldbKeys.map((key: LevelDBKeyData): JSX.Element => {
                let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                function Row(): JSX.Element {
                    // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                    const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                    const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                    function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        event.preventDefault();
                        event.stopPropagation();
                        // const clickPosition: { x: number; y: number } = {
                        //     x: event.clientX,
                        //     y: event.clientY,
                        // };
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
                                // TODO: In the future, add support for getting their skin head or profile picture.
                                contentType: key.contentType,
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
                                        const cachedIndex: number = data.tab.cachedDBKeys[key.contentType].findIndex((cachedKey: Buffer): boolean =>
                                            key.rawKey.equals(cachedKey)
                                        );
                                        if (cachedIndex !== -1) data.tab.cachedDBKeys[key.contentType].splice(cachedIndex, 1);
                                        void data.updateTablesContents?.(true);
                                    }}
                                >
                                    Delete LevelDB Entry
                                </MenuItem>
                                {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                    <MenuItem
                                        onClick={(_event: ContextMenu_ClickEvent): void => {
                                            // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                            // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                            // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                            if (copyContextMenuItemValue?.value === undefined) return;
                                            clipboard.writeText(copyContextMenuItemValue.value);
                                            // copyContextMenuItemValue = null;
                                        }}
                                        disabled={copyContextMenuItemValue?.value === undefined}
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
                                onDblClick={(): void => {
                                    data.tab.openTab({
                                        // TODO: In the future, add support for getting their skin head or profile picture.
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
                                        case "ContentType":
                                            // const contentType: MCDBEntryContentType = getContentTypeFromDBKey(key.rawKey);
                                            return (
                                                <td data-copy-data={JSON.stringify({ value: key.contentType } satisfies CopyContextMenuItemValue)}>
                                                    {key.contentType}
                                                </td>
                                            );
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
        case "files": {
            const columns = ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs[data.mode];
            return data.fileKeys.map((key: FileKeyData): JSX.Element => {
                let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                function Row(): JSX.Element {
                    // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                    const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                    const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                    function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                        event.preventDefault();
                        event.stopPropagation();
                        // const clickPosition: { x: number; y: number } = {
                        //     x: event.clientX,
                        //     y: event.clientY,
                        // };
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
                        if (key.file === "chunks.dat") {
                            // TODO (Config): Add a way to disable this popup.
                            if (
                                dialog.showMessageBoxSync({
                                    type: "warning",
                                    title: "Opening Large File",
                                    message: "Are you sure you want to open chunks.dat?",
                                    // REVIEW: See if I need \n\n instead of just \n.
                                    detail: "chunks.dat is very large (usually around 21.0 MiB), and as a result the Prismarine-NBT, SNBT, and Raw editor modes will likely not work.\nIt is recommended that you open the data for the chunk you want to edit via the 2D world map instead.",
                                    buttons: ["Proceed", "Cancel"],
                                    noLink: true,
                                    // Make the default option to cancel as this is a very dangerous operation.
                                    defaultId: 1,
                                    cancelId: 1,
                                })
                            ) {
                                return;
                            }
                        }
                        data.tab.openTab(
                            {
                                contentType: key.contentType,
                                formatData: key.formatData,
                                icon: "auto",
                                name: key.displayKey,
                                parentTab: data.tab,
                                target: {
                                    type: "File",
                                    path: key.file,
                                },
                            },
                            false
                        );
                    }
                    const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
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
                                        const filePath: string = path.join(data.tab.tempPath ?? data.tab.path, key.file);
                                        if (!existsSync(filePath)) return;
                                        // IDEA: Add a confirmation dialog here before deleting the file, and make it able to be disabled in the config.
                                        await rm(filePath, { recursive: true, force: true });
                                        data.tab.setFileAsModified(key.file); // REVIEW: Maybe this should be marked in a different way?
                                        void data.updateTablesContents?.(true);
                                    }}
                                >
                                    Delete File
                                </MenuItem>
                                {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                    <MenuItem
                                        onClick={(_event: ContextMenu_ClickEvent): void => {
                                            // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                            // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                            // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                            if (copyContextMenuItemValue?.value === undefined) return;
                                            clipboard.writeText(copyContextMenuItemValue.value);
                                            // copyContextMenuItemValue = null;
                                        }}
                                        disabled={copyContextMenuItemValue?.value === undefined}
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
                                onDblClick={(): void => {
                                    if (key.file === "chunks.dat") {
                                        // TODO (Config): Add a way to disable this popup.
                                        if (
                                            dialog.showMessageBoxSync({
                                                type: "warning",
                                                title: "Opening Large File",
                                                message: "Are you sure you want to open chunks.dat?",
                                                // REVIEW: See if I need \n\n instead of just \n.
                                                detail: "chunks.dat is very large (usually around 21.0 MiB), and as a result the Prismarine-NBT, SNBT, and Raw editor modes will likely not work.\nIt is recommended that you open the data for the chunk you want to edit via the 2D world map instead.",
                                                buttons: ["Proceed", "Cancel"],
                                                noLink: true,
                                                // Make the default option to cancel as this is a very dangerous operation.
                                                defaultId: 1,
                                                cancelId: 1,
                                            })
                                        ) {
                                            return;
                                        }
                                    }
                                    data.tab.openTab({
                                        contentType: key.contentType,
                                        formatData: key.formatData,
                                        icon: "auto",
                                        name: key.displayKey,
                                        parentTab: data.tab,
                                        target: {
                                            type: "File",
                                            path: key.file,
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
                                        case "FilePath":
                                            return (
                                                <td
                                                    data-copy-data={JSON.stringify({
                                                        formatOptions: [
                                                            ...(data.tab.tempPath !== undefined ?
                                                                [
                                                                    { label: "Original Path", value: path.join(data.tab.path, key.file) },
                                                                    { label: "Temp Path", value: path.join(data.tab.path, key.file) },
                                                                ]
                                                            :   [{ label: "Path", value: path.join(data.tab.path, key.file) }]),
                                                            { label: "Relative path", value: key.file },
                                                        ],
                                                    } satisfies CopyContextMenuItemValue)}
                                                >
                                                    {key.displayKey}
                                                </td>
                                            );
                                        case "ContentType":
                                            // const contentType: MCDBEntryContentType = getContentTypeFromDBKey(key.rawKey);
                                            return (
                                                <td data-copy-data={JSON.stringify({ value: key.contentType } satisfies CopyContextMenuItemValue)}>
                                                    {key.contentType}
                                                </td>
                                            );
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
