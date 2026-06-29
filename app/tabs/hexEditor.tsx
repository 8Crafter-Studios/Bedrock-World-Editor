import type { JSX, RefObject } from "preact";
import _React, { render, useRef } from "preact/compat";
import { LoadingScreenContents } from "../app";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import BinaryHexEditor, { initHexEditorDataStorageObjectProps, type HexEditorDataStorageObject } from "../components/BinaryHexEditor";
import Notice from "../components/Notice";

export interface HexEditorTabProps {
    tab: TabManagerSubTab;
}

export default function HexEditorTab(props: HexEditorTabProps): JSX.SpecificElement<"div"> {
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
    props.tab.currentState.options.viewMode ??= "raw";
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
    if (!props.tab.currentState.options.dataStorageObject) {
        async function loadData(): Promise<void> {
            if (props.tab.target.type === "LevelDBEntry" && !props.tab.parentTab.db?.isOpen() && !((await props.tab.parentTab.awaitDBOpen) ?? true)) {
                throw new Error("LevelDB open failure.");
            }
            await props.tab.loadData(true);
            if (props.tab.currentState.options.dataStorageObject) {
                initHexEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
            }
        }
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
                                    return false;
                                })() && (
                                    <button
                                        type="button"
                                        onClick={(): void => {
                                            if (props.tab.target.type === "File") return;
                                            props.tab.parentTab.db!.put(props.tab.target.key, Buffer.alloc(0));
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
    } else {
        if (!props.tab.currentState.options.dataStorageObject.hexEditor) {
            initHexEditorDataStorageObjectProps(props.tab.currentState.options.dataStorageObject);
        }
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
        render(<Contents props={props} options={props.tab.currentState.options} />, containerRef.current /* tempElement */);
        // containerRef.current.replaceChildren(...tempElement.children);
    }
    function Contents(props: {
        props: HexEditorTabProps;
        options: Extract<HexEditorTabProps["tab"]["currentState"]["options"], { viewMode?: any }>;
    }): JSX.Element {
        switch (props.options.viewMode) {
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
