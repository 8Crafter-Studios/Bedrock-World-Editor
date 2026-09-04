import { Editor, type Monaco } from "@monaco-editor/react";
import { parseSNBTCompoundString, prettyPrintSNBT, prismarineToSNBT, type DBEntryContentType } from "mcbe-leveldb";
import * as monaco from "monaco-editor";
import type { JSX } from "preact";
import { LoadingScreenContents } from "../app";
import { useRef } from "preact/compat";
import * as NBT from "prismarine-nbt";

/**
 * Props for the {@link SNBTEditor} component.
 */
export interface SNBTEditorProps {
    /**
     * The tab associated with this editor.
     */
    tab?: TabManagerSubTab | undefined;
    dataStorageObject: GenericDataStorageObject;
    contentType?: DBEntryContentType;
    /**
     * A callback function that is called when a value is changed in the SNBT editor.
     *
     * @param dataStorageObject The current value of the data storage object (it is a reference to the original data storage object).
     * @param cause The cause of the change, or `undefined`.
     */
    onValueChange?(
        dataStorageObject: GenericDataStorageObject,
        cause?: {
            newValue: string;
            type: "changeContents";
        }
    ): void;
    /**
     * Whether the SNBT should be read-only.
     *
     * @default false
     */
    readonly?: boolean;
    /**
     * A message to display when the SNBT is read-only.
     *
     * Only used when {@link readonly} is `true`.
     *
     * @default undefined
     */
    readonlyMessage?: monaco.IMarkdownString;
    /**
     * Model path.
     *
     * For a tab, should be `tab://${tab.parentTab.id}/${tab.id}`.
     */
    path?: string;
    /**
     * A callback function that can be used to trigger a save.
     *
     * @default undefined
     */
    triggerSave?(): void;
}

/**
 * The SNBT editor.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function SNBTEditor(props: SNBTEditorProps): JSX.Element {
    if (props.dataStorageObject?.dataType === "JSON") return <p style="color: red;">JSON is not supported.</p>;
    const editorRef = useRef<typeof Editor>(null);
    let currentEditor: monaco.editor.IStandaloneCodeEditor | undefined = undefined;
    function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco): void {
        currentEditor = editor;
        // editor.getid
        if (props.tab) {
            // OPTIMIZE: This creates a new callback every time the editor is mounted, and the callbacks are not removed until the corresponding tab is closed.
            const callback = (event: TabManagerTabClosedTabEvent): void => {
                if (event.tab !== props.tab) return;
                editor.getModel()?.dispose();
                editor.dispose();
                props.tab.parentTab.off("closeTab", callback);
            };
            props.tab.parentTab.on("closeTab", callback);
        }
        if (props.triggerSave) {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, (): void => {
                props.triggerSave?.();
            });
        }
        updateModelValue: if (startingEditorValue) {
            const model: monaco.editor.ITextModel | null = editor.getModel();
            if (model) {
                // console.log(7.2); // DEBUG
                if (startingEditorValue === model.getValue()) break updateModelValue;
                // console.log(8.2); // DEBUG
                const lastObj: object | undefined = props.dataStorageObject.lastSavedDataObjectForModel?.get(model.id)?.deref();
                if (lastObj && props.dataStorageObject.data === lastObj && props.dataStorageObject.lastEditedInModel === model.id) break updateModelValue;
                const currentSelections: monaco.Selection[] | null = editor.getSelections();
                model.pushEditOperations(
                    currentSelections,
                    [
                        {
                            range: model.getFullModelRange(),
                            text: startingEditorValue,
                            forceMoveMarkers: true,
                        },
                    ],
                    (): monaco.Selection[] | null => null /* currentSelections */
                );
                if (currentSelections) editor.setSelections(currentSelections);
            }
            // TODO: Add a check so this only happens if the data has been changed since the model was last used.
            // editor.setValue(startingEditorValue);
            startingEditorValue = undefined;
        }
    }
    let editorValue: string | undefined;
    let lastChangeTime: number = Date.now() - 1000;
    let lastChangeStartTime: number = Date.now() - 1000;
    function handleEditorValueChanged(value: string | undefined, ev: monaco.editor.IModelContentChangedEvent): void {
        if (value === undefined || !dataLoaded) return;
        const currentChangeTime: number = Date.now();
        editorValue = value;
        if (currentChangeTime - lastChangeStartTime < 500 && lastChangeTime >= lastChangeStartTime) {
            lastChangeStartTime = currentChangeTime;
            setTimeout((): void => {
                if (currentChangeTime !== lastChangeStartTime) return;
                if (editorValue !== value) return;
                lastChangeTime = Date.now();
                try {
                    if (props.dataStorageObject.dataType === "NBTCompound") {
                        const v = parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value;
                        prismarineToSNBT(v);
                        props.dataStorageObject.data = v;
                    } else if (props.dataStorageObject.dataType === "NBT") {
                        const v = {
                            name: (props.dataStorageObject.data.parsed as NBT.NBT)?.name,
                            ...parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value,
                        };
                        prismarineToSNBT(v);
                        (props.dataStorageObject.data.parsed as NBT.NBT) = v;
                    }
                    const model = currentEditor?.getModel();
                    if (model) {
                        props.dataStorageObject.lastEditedInModel = model.id;
                        props.dataStorageObject.lastSavedDataObjectForModel ??= new Map();
                        props.dataStorageObject.lastSavedDataObjectForModel.set(model.id, new WeakRef(props.dataStorageObject.data));
                    }
                    props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
                } catch (e) {
                    console.error(e);
                }
            }, 500);
        } else {
            lastChangeStartTime = currentChangeTime;
            lastChangeTime = currentChangeTime;
            try {
                if (props.dataStorageObject.dataType === "NBTCompound") {
                    const v = parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value;
                    prismarineToSNBT(v);
                    props.dataStorageObject.data = v;
                } else if (props.dataStorageObject.dataType === "NBT") {
                    const v = {
                        name: (props.dataStorageObject.data.parsed as NBT.NBT)?.name,
                        ...parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value,
                    };
                    prismarineToSNBT(v);
                    (props.dataStorageObject.data.parsed as NBT.NBT) = v;
                }

                const model = currentEditor?.getModel();
                if (model) {
                    props.dataStorageObject.lastEditedInModel = model.id;
                    props.dataStorageObject.lastSavedDataObjectForModel ??= new Map();
                    props.dataStorageObject.lastSavedDataObjectForModel.set(model.id, new WeakRef(props.dataStorageObject.data));
                }
                props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
            } catch (e) {
                console.error(e);
            }
        }
    }
    let dataLoaded: boolean = props.dataStorageObject?.data !== undefined;
    const editorParams = new URLSearchParams({ contentType: props.contentType ?? "Unknown" });
    let startingEditorValue: string | undefined =
        dataLoaded ?
            prettyPrintSNBT(
                prismarineToSNBT(props.dataStorageObject.data.type === "compound" ? props.dataStorageObject.data : props.dataStorageObject.data.parsed),
                {
                    indent: 4,
                    inlineArrays: true,
                    maxInlineLength: 5,
                }
            )
        :   "Data is not loaded.";
    return (
        <Editor
            theme="tomorrow-night-blue"
            loading={
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <LoadingScreenContents />
                </div>
            }
            onChange={handleEditorValueChanged}
            language="snbt"
            value={startingEditorValue}
            onMount={handleEditorDidMount}
            options={{
                readOnly: props.readonly || !dataLoaded,
                readOnlyMessage:
                    props.readonly ? props.readonlyMessage!
                    : !dataLoaded ? { value: "Data is not loaded." }
                    : undefined!,
                tabSize: 4,
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
                fontFamily: "Consolas",
                matchBrackets: "always",
                fixedOverflowWidgets: true,
                allowOverflow: true,
            }}
            keepCurrentModel={!!props.tab}
            path={
                props.path ?
                    props.path + (props.path.includes("?") ? "&" : "?") + editorParams.toString()
                :   `unlinked-editor://${Date.now()}?${editorParams.toString()}`
            }
            ref={editorRef}
        />
    );
}
