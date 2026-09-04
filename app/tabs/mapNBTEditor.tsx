import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useRef } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import { entryContentTypeToFormatMap, getContentTypeFromDBKey, type EntryContentTypeFormatData } from "mcbe-leveldb";
import { LoadingScreenContents } from "../app";
import SNBTEditor from "../components/SNBTEditor";
import PrismarineNBTEditor from "../components/PrismarineNBTEditor";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import { initMapEditorDataStorageObjectProps, MapEditor } from "../components/MapEditor";
import BinaryHexEditor, { initHexEditorDataStorageObjectProps, type HexEditorDataStorageObject } from "../components/BinaryHexEditor";
import Notice from "../components/Notice";

export interface MapEditorTabProps {
    tab: TabManagerSubTab;
}

export default function MapEditorTab(props: MapEditorTabProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const viewOptionsRefs = {
        viewOptionsContainer: useRef<HTMLDivElement>(null),
        viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
    };
    const widgetRegistryRef: RefObject<EditorWidgetOverlayBarWidgetRegistry> = useRef<EditorWidgetOverlayBarWidgetRegistry>(null);
    function fakeAssertIsValidOptionsType(
        options: typeof props.tab.currentState.options
    ): asserts options is Extract<typeof props.tab.currentState.options, { viewMode?: any }> {}
    const asyncMode: boolean = !props.tab.currentState.options.dataStorageObject;
    fakeAssertIsValidOptionsType(props.tab.currentState.options);
    props.tab.currentState.options.viewMode ??= "map";
    let dataLoadFailureNoticeReasonExists: boolean = false;
    let dataLoadFailureNoticeReason: any = null;
    let levelDBOpenFailure: boolean = false;
    function LevelDBOpenFailureNotice(): JSX.Element {
        if (props.tab.parentTab.errorDueToEncryptedLevelDB)
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
                    {props.tab.parentTab.errorOnDBOpen instanceof Error ?
                        `${props.tab.parentTab.errorOnDBOpen.stack !== undefined ? props.tab.parentTab.errorOnDBOpen.stack : props.tab.parentTab.errorOnDBOpen.toString()}${
                            props.tab.parentTab.errorOnDBOpen.cause !== undefined ?
                                `\nCaused by: ${((): unknown => {
                                    try {
                                        return typeof props.tab.parentTab.errorOnDBOpen.cause === "object" ?
                                                JSON.stringify(props.tab.parentTab.errorOnDBOpen.cause)
                                            :   props.tab.parentTab.errorOnDBOpen.cause;
                                    } catch {
                                        return props.tab.parentTab.errorOnDBOpen.cause;
                                    }
                                })()}`
                            :   ""
                        }`
                    :   String(
                            (function (): unknown {
                                try {
                                    return typeof props.tab.parentTab.errorOnDBOpen === "object" ?
                                            JSON.stringify(props.tab.parentTab.errorOnDBOpen)
                                        :   props.tab.parentTab.errorOnDBOpen;
                                } catch {
                                    return props.tab.parentTab.errorOnDBOpen;
                                }
                            })()
                        )
                    }
                </div>
            </div>
        );
    }
    function DataLoadFailureNotice({ reason }: { reason: any }): JSX.SpecificElement<"div"> {
        return (
            <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
                <Notice
                    title="Failed to Load Data"
                    subtitle={null}
                    detail="An error occured while loading the data, it may be corrupted or invalid. Try loading the data in raw mode instead by using the button below."
                    image="generic_error"
                    style={{ height: "auto" }}
                />
                <button
                    type="button"
                    title="Reopens the editor in raw mode, allowing you to edit unparseable data as binary data in the hex editor."
                    class="genericRoundButton"
                    onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                        if (!props.tab) throw new ReferenceError("props.tab is undefined.");
                        event.preventDefault();
                        if (event.currentTarget.disabled) return;
                        event.currentTarget.blur();
                        event.currentTarget.disabled = true;
                        try {
                            await props.tab.loadData(true);
                            props.tab.rawMode = true;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            props.tab.currentState.options.viewMode = "raw";
                            if (props.tab.parentTab.selectedTab !== props.tab) return;
                            props.tab.parentTab.emit("reloadCurrentSubTab");
                        } finally {
                            event.currentTarget.disabled = false;
                        }
                    }}
                >
                    Load Data in Raw Mode
                </button>
                <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>
                    {reason instanceof Error ?
                        reason.stack?.startsWith(reason.toString()) ?
                            reason.stack
                        :   reason.toString() + reason.stack
                    :   reason}
                </div>
            </div>
        );
    }
    if (!props.tab.currentState.options.dataStorageObject) {
        const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData;
        async function loadData(): Promise<void> {
            if (props.tab.target.type === "LevelDBEntry" && !props.tab.parentTab.db?.isOpen() && !((await props.tab.parentTab.awaitDBOpen) ?? true)) {
                throw new Error("LevelDB open failure.");
            }
            formatTypeSwitch: switch (format.type) {
                case "NBT": {
                    await props.tab.loadData();
                    if (props.tab.currentState.options.dataStorageObject) {
                        initHexEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
                        initMapEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
                        props.tab.currentState.options.dataStorageObject.treeEditor = { scrollTop: 0, expansionData: {} };
                    }
                    break;
                }
                case "custom": {
                    switch (format.resultType) {
                        case "JSONNBT": {
                            await props.tab.loadData();
                            if (props.tab.currentState.options.dataStorageObject) {
                                initHexEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
                                initMapEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
                                props.tab.currentState.options.dataStorageObject.treeEditor = { scrollTop: 0, expansionData: {} };
                            }
                            break formatTypeSwitch;
                        }
                        default:
                            throw new TypeError(
                                `The content type "${props.tab.contentType}" is not supported in the map editor. (format type: ${format.type}, result type: ${format.resultType})`
                            );
                    }
                }
                default:
                    throw new TypeError(`The content type "${props.tab.contentType}" is not supported in the map editor. (format type: ${format.type})`);
            }
        }
        function triggerLoadData(): void {
            loadData().then(
                (): void => {
                    reloadContents();
                },
                (reason: any): void => {
                    if (containerRef.current) {
                        if (reason instanceof Error && reason.message === "LevelDB open failure.") {
                            render(null, containerRef.current);
                            render(<LevelDBOpenFailureNotice />, containerRef.current);
                            levelDBOpenFailure = true;
                            return;
                        }
                        if (reason instanceof Error && reason.message === "The LevelDB key associated with this sub-tab does not exist.") {
                            render(null, containerRef.current);
                            render(
                                <div>
                                    <h2>The LevelDB key associated with this sub-tab does not exist.</h2>
                                    {((): boolean => {
                                        if (props.tab.target.type === "File") return false;
                                        const contentType =
                                            props.tab.contentType === "Unknown" ? getContentTypeFromDBKey(props.tab.target.key) : props.tab.contentType;
                                        const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[contentType];
                                        if (!((format.type === "NBT") /*  || (format.type === "custom" && format.resultType === "JSONNBT") */)) return false;
                                        return true;
                                    })() && (
                                        <button
                                            type="button"
                                            onClick={async (): Promise<void> => {
                                                if (props.tab.target.type === "File") return;
                                                const contentType =
                                                    props.tab.contentType === "Unknown" ? getContentTypeFromDBKey(props.tab.target.key) : props.tab.contentType;
                                                const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[contentType];
                                                if (!((format.type === "NBT") /*  || (format.type === "custom" && format.resultType === "JSONNBT") */)) return;
                                                if (!format.defaultValue) return; // TEMP: Remove this when a manual default value is added.
                                                // TODO: Make this determine the default values dynamically (it needs to get the map ID from the LevelDB key and use that for the map ID in the default value) so as not to insert invalid data.
                                                await props.tab.parentTab.db!.put(props.tab.target.key, format.defaultValue);
                                                triggerLoadData();
                                            }}
                                        >
                                            Create LevelDB Entry
                                        </button>
                                    )}
                                </div>,
                                containerRef.current
                            );
                            return;
                        }
                        render(null, containerRef.current);
                        render(<DataLoadFailureNotice reason={reason} />, containerRef.current);
                        dataLoadFailureNoticeReasonExists = true;
                        dataLoadFailureNoticeReason = reason;
                        // const errorElement: HTMLDivElement = document.createElement("div");
                        // errorElement.style.color = "red";
                        // errorElement.style.fontFamily = "monospace";
                        // errorElement.style.whiteSpace = "pre";
                        // errorElement.textContent =
                        //     reason instanceof Error ?
                        //         reason.stack?.startsWith(reason.toString()) ?
                        //             reason.stack
                        //         :   reason.toString() + reason.stack
                        //     :   reason;
                        // containerRef.current.replaceChildren("Failed to load data:", errorElement);
                    }
                    console.error(reason);
                }
            );
        }
        triggerLoadData();
    }
    function reloadContents(): void {
        if (!containerRef.current) return;
        fakeAssertIsValidOptionsType(props.tab.currentState.options);
        // const tempElement: HTMLDivElement = document.createElement("div");
        if (levelDBOpenFailure && !props.tab.currentState.options.dataStorageObject) {
            render(null, containerRef.current);
            render(<LevelDBOpenFailureNotice />, containerRef.current);
            return;
        }
        if (dataLoadFailureNoticeReasonExists && !props.tab.currentState.options.dataStorageObject) {
            render(null, containerRef.current);
            render(<DataLoadFailureNotice reason={dataLoadFailureNoticeReason} />, containerRef.current);
            return;
        }
        render(<Contents props={props} options={props.tab.currentState.options} />, containerRef.current /* tempElement */);
        // containerRef.current.replaceChildren(...tempElement.children);
    }
    function Contents(props: {
        props: MapEditorTabProps;
        options: Extract<MapEditorTabProps["tab"]["currentState"]["options"], { viewMode?: any }>;
    }): JSX.Element {
        switch (props.options.viewMode) {
            case "map":
                return (
                    <MapEditor
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject! as any}
                        tab={props.props.tab}
                        overlayBarRegistry={widgetRegistryRef.current ?? undefined}
                    />
                );
            case "node":
                return (
                    <TreeEditor
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject! as any}
                        onValueChange={(): undefined => {
                            props.props.tab.hasUnsavedChanges = true;
                            if (props.props.tab.target.type === "LevelDBEntry") {
                                props.props.tab.parentTab.setLevelDBIsModified();
                            } else {
                                props.props.tab.parentTab.setFileAsModified(props.props.tab.target.path);
                            }
                        }}
                        readonly={props.props.tab.readonly}
                        overlayBarRegistry={widgetRegistryRef.current ?? undefined}
                    />
                );
            case "jsonnbt":
                return (
                    <PrismarineNBTEditor
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject!}
                        onValueChange={(): undefined => {
                            props.props.tab.hasUnsavedChanges = true;
                            if (props.props.tab.target.type === "LevelDBEntry") {
                                props.props.tab.parentTab.setLevelDBIsModified();
                            } else {
                                props.props.tab.parentTab.setFileAsModified(props.props.tab.target.path);
                            }
                        }}
                        readonly={props.props.tab.readonly}
                        path={`tab://${props.props.tab.parentTab.id}/${props.props.tab.id}/jsonnbt`}
                        contentType={props.options.type}
                        triggerSave={(): void => {
                            props.props.tab.parentTab.save();
                        }}
                        tab={props.props.tab}
                    />
                );
            case "snbt":
                return (
                    <SNBTEditor
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject!}
                        onValueChange={(): undefined => {
                            props.props.tab.hasUnsavedChanges = true;
                            if (props.props.tab.target.type === "LevelDBEntry") {
                                props.props.tab.parentTab.setLevelDBIsModified();
                            } else {
                                props.props.tab.parentTab.setFileAsModified(props.props.tab.target.path);
                            }
                        }}
                        readonly={props.props.tab.readonly}
                        path={`tab://${props.props.tab.parentTab.id}/${props.props.tab.id}/snbt`}
                        contentType={props.options.type}
                        triggerSave={(): void => {
                            props.props.tab.parentTab.save();
                        }}
                        tab={props.props.tab}
                    />
                );
            case "raw":
                return (
                    <BinaryHexEditor
                        tab={props.props.tab}
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject! as HexEditorDataStorageObject}
                        onValueChange={(): undefined => {
                            props.props.tab.hasUnsavedChanges = true;
                            if (props.props.tab.target.type === "LevelDBEntry") {
                                props.props.tab.parentTab.setLevelDBIsModified();
                            } else {
                                props.props.tab.parentTab.setFileAsModified(props.props.tab.target.path);
                            }
                        }}
                        readonly={props.props.tab.readonly}
                        contentType={props.options.type}
                        overlayBarRegistry={widgetRegistryRef.current ?? undefined}
                    />
                );
            // return (
            //     <UnderConstruction
            //         subtitle="This view mode is under construction."
            //         detail={`This view mode is still a work in progress: ${String(props.options.viewMode)}`}
            //     />
            // );
            default:
                return <span style="color: red;">Unsupported view mode: {String(props.options.viewMode)}</span>;
        }
    }
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <EditorWidgetOverlayBar widgetRegistryRef={widgetRegistryRef} barContainerRef={viewOptionsRefs.viewOptionsContainer}>
                <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                    <button
                        type="button"
                        class={props.tab.currentState.options.viewMode === "map" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "map";
                            reloadContents();
                        }}
                    >
                        Map
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.options.viewMode === "node" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "node";
                            reloadContents();
                        }}
                    >
                        Node
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.options.viewMode === "jsonnbt" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "jsonnbt";
                            reloadContents();
                        }}
                    >
                        Prismarine-NBT
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.options.viewMode === "snbt" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "snbt";
                            reloadContents();
                        }}
                    >
                        SNBT
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.options.viewMode === "raw" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "raw";
                            reloadContents();
                        }}
                    >
                        Raw
                    </button>
                </div>
            </EditorWidgetOverlayBar>
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                {asyncMode || !props.tab.currentState.options.dataStorageObject ?
                    <LoadingScreenContents />
                :   <Contents props={props} options={props.tab.currentState.options} />}
            </div>
        </div>
    );
}
