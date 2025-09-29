import type { JSX, RefObject } from "preact";
import _React, { render, useRef } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import { entryContentTypeToFormatMap, getKeyDisplayName, type EntryContentTypeFormatData } from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LoadingScreenContents } from "../app";
import SNBTEditor from "../components/SNBTEditor";
import PrismarineNBTEditor from "../components/PrismarineNBTEditor";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import StructureEditor from "../components/StructureEditor";

export interface StructureNBTEditorTabProps {
    tab: TabManagerSubTab;
}

export default function StructureEditorTab(props: StructureNBTEditorTabProps): JSX.SpecificElement<"div"> {
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
    props.tab.currentState.options.viewMode ??= "3D";
    if (!props.tab.currentState.options.dataStorageObject) {
        const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData;
        async function loadData(): Promise<void> {
            formatTypeSwitch: switch (format.type) {
                case "NBT": {
                    await props.tab.loadData();
                    if (props.tab.currentState.options.dataStorageObject)
                        props.tab.currentState.options.dataStorageObject.treeEditor = { scrollTop: 0, expansionData: {} };
                    break;
                }
                case "custom": {
                    switch (format.resultType) {
                        case "JSONNBT": {
                            await props.tab.loadData();
                            if (props.tab.currentState.options.dataStorageObject)
                                props.tab.currentState.options.dataStorageObject.treeEditor = { scrollTop: 0, expansionData: {} };
                            break formatTypeSwitch;
                        }
                        default:
                            throw new TypeError(
                                `The content type "${props.tab.contentType}" is not supported in the NBT editor. (format type: ${format.type}, result type: ${format.resultType})`
                            );
                    }
                }
                default:
                    throw new TypeError(`The content type "${props.tab.contentType}" is not supported in the NBT editor. (format type: ${format.type})`);
            }
        }
        loadData().then(
            (): void => {
                reloadContents();
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
    }
    function reloadContents(): void {
        if (!containerRef.current) return;
        fakeAssertIsValidOptionsType(props.tab.currentState.options);
        // const tempElement: HTMLDivElement = document.createElement("div");
        render(<Contents props={props} options={props.tab.currentState.options} />, containerRef.current /* tempElement */);
        // containerRef.current.replaceChildren(...tempElement.children);
    }
    function Contents(props: {
        props: StructureNBTEditorTabProps;
        options: Extract<StructureNBTEditorTabProps["tab"]["currentState"]["options"], { viewMode?: any }>;
    }): JSX.Element {
        switch (props.options.viewMode) {
            case "3D":
                return (
                    <StructureEditor
                        dataStorageObject={props.props.tab.currentState.options.dataStorageObject! as any}
                        tab={props.props.tab}
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
                    />
                );
            case "raw":
                return <span style="color: red;">This view mode is still a work in progress: {String(props.options.viewMode)}</span>;
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
                        class={props.tab.currentState.options.viewMode === "3D" ? "selected" : ""}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.classList.contains("selected")) return;
                            fakeAssertIsValidOptionsType(props.tab.currentState.options);
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.options.viewMode = "3D";
                            reloadContents();
                        }}
                    >
                        3D
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
                        disabled
                    >
                        Raw
                    </button>
                </div>
            </EditorWidgetOverlayBar>
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                {asyncMode || !props.tab.currentState.options.dataStorageObject ? (
                    <LoadingScreenContents />
                ) : (
                    <Contents props={props} options={props.tab.currentState.options} />
                )}
            </div>
        </div>
    );
}
