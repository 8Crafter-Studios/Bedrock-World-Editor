import type { JSX, RefObject } from "preact";
import _React, { render, useRef } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import { entryContentTypeToFormatMap, getKeyDisplayName, type EntryContentTypeFormatData } from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LoadingScreenContents } from "../app";
import TextEditor from "../components/TextEditor";
import PrismarineNBTEditor from "../components/PrismarineNBTEditor";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import { MapEditor } from "../components/MapEditor";

export interface TextEditorTabProps {
    tab: TabManagerSubTab;
}

// TODO: Add an option to edit the data in raw mode.

export default function TextEditorTab(props: TextEditorTabProps): JSX.SpecificElement<"div"> {
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
    if (!props.tab.currentState.options.dataStorageObject) {
        const format: EntryContentTypeFormatData = entryContentTypeToFormatMap[props.tab.contentType] as EntryContentTypeFormatData;
        async function loadData(): Promise<void> {
            formatTypeSwitch: switch (format.type) {
                case "ASCII":
                case "UTF-8":
                case "binaryPlainText": {
                    await props.tab.loadData();
                    if (props.tab.currentState.options.dataStorageObject)
                        props.tab.currentState.options.dataStorageObject.treeEditor = { scrollTop: 0, expansionData: {} };
                    break;
                }
                case "custom": {
                    switch (format.resultType) {
                        default:
                            throw new TypeError(
                                `The content type "${props.tab.contentType}" is not supported in the text editor. (format type: ${format.type}, result type: ${format.resultType})`
                            );
                            // TEMP: This is to stop the label from throwing an error about being unused while there is no supported custom format for the text editor.
                            break formatTypeSwitch;
                    }
                }
                default:
                    throw new TypeError(`The content type "${props.tab.contentType}" is not supported in the text editor. (format type: ${format.type})`);
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
    }
    function reloadContents(): void {
        if (!containerRef.current) return;
        fakeAssertIsValidOptionsType(props.tab.currentState.options);
        // const tempElement: HTMLDivElement = document.createElement("div");
        render(<Contents props={props} options={props.tab.currentState.options} />, containerRef.current /* tempElement */);
        // containerRef.current.replaceChildren(...tempElement.children);
    }
    function Contents(props: {
        props: TextEditorTabProps;
        options: Extract<TextEditorTabProps["tab"]["currentState"]["options"], { viewMode?: any }>;
    }): JSX.Element {
        return (
            <TextEditor
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
                path={`tab://${props.props.tab.parentTab.id}/${props.props.tab.id}/text`}
                contentType={props.options.type}
            />
        );
    }
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                {asyncMode || !props.tab.currentState.options.dataStorageObject ?
                    <LoadingScreenContents />
                :   <Contents props={props} options={props.tab.currentState.options} />}
            </div>
        </div>
    );
}
