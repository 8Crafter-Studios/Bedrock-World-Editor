import { Editor, type Monaco } from "@monaco-editor/react";
import { type DBEntryContentType } from "mcbe-leveldb";
import * as monaco from "monaco-editor";
import type { JSX } from "preact";
import { LoadingScreenContents } from "../app";
import { useRef } from "preact/compat";
export interface TextEditorProps {
    dataStorageObject: GenericDataStorageObject;
    contentType?: DBEntryContentType;
    /**
     * A callback function that is called when a value is changed in the tree editor.
     *
     * @param dataStorageObject The current value of the data storage object (it is a reference to the original data storage object).
     * @param cause The cause of the change, or `undefined`.
     * @returns `true` to prevent the tree editor from refreshing, `false` or `undefined` to allow the tree editor to refresh.
     */
    onValueChange?(
        dataStorageObject: GenericDataStorageObject,
        cause?: {
            newValue: string;
            type: "changeContents";
        }
    ): boolean | undefined;
    /**
     * Whether the tree editor should be read-only.
     *
     * @default false
     */
    readonly?: boolean;
    /**
     * A message to display when the tree editor is read-only.
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
}

export default function TextEditor(props: TextEditorProps): JSX.Element {
    type PossibleDataType = GenericDataStorageObject["dataType"];
    const supportedDataTypes = ["ASCII", "UTF-8", "binaryPlainText"] as const satisfies readonly PossibleDataType[];
    function checkIfSupported(
        storageObject: GenericDataStorageObject
    ): storageObject is Extract<GenericDataStorageObject, { dataType: (typeof supportedDataTypes)[number] }> {
        return (supportedDataTypes as readonly PossibleDataType[]).includes(storageObject.dataType);
    }
    if (!checkIfSupported(props.dataStorageObject)) return <p style="color: red;">JSON is not supported.</p>;
    const editorRef = useRef<typeof Editor>(null);
    function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco): void {
        // editor.getid
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
                if (!checkIfSupported(props.dataStorageObject)) return;
                lastChangeTime = Date.now();
                try {
                    props.dataStorageObject.data = editorValue;
                    props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
                } catch (e) {
                    console.error(e);
                }
            }, 500);
        } else {
            if (!checkIfSupported(props.dataStorageObject)) return;
            lastChangeStartTime = currentChangeTime;
            lastChangeTime = currentChangeTime;
            try {
                props.dataStorageObject.data = editorValue;
                props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
            } catch (e) {
                console.error(e);
            }
        }
    }
    let dataLoaded: boolean = props.dataStorageObject?.data !== undefined;
    const editorParams = new URLSearchParams({ contentType: props.contentType ?? "Unknown" });
    return (
        <Editor
            theme="tomorrow-night-blue"
            loading={
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <LoadingScreenContents />
                </div>
            }
            onChange={handleEditorValueChanged}
            language="plaintext"
            value={dataLoaded ? String(props.dataStorageObject.data) : "Data is not loaded."}
            onMount={handleEditorDidMount}
            options={{
                readOnly: props.readonly || !dataLoaded,
                readOnlyMessage:
                    props.readonly ? props.readonlyMessage!
                    : !dataLoaded ? { value: "Data is not loaded." }
                    : undefined!,
                tabSize: 4,
                bracketPairColorization: { enabled: false },
                automaticLayout: true,
                fontFamily: "Consolas",
                matchBrackets: "never",
                fixedOverflowWidgets: true,
                allowOverflow: false,
            }}
            path={
                props.path ?
                    props.path + (props.path.includes("?") ? "&" : "?") + editorParams.toString()
                :   `unlinked-editor://${Date.now()}?${editorParams.toString()}`
            }
            ref={editorRef}
        />
    );
}
