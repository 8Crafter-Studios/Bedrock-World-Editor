import { Editor, type Monaco } from "@monaco-editor/react";
import { parseSNBTCompoundString, prettyPrintSNBT, prismarineToSNBT, type DBEntryContentType } from "mcbe-leveldb";
import * as monaco from "monaco-editor";
import type { JSX } from "preact";
import { LoadingScreenContents } from "../app";
import { useRef } from "preact/compat";
import * as NBT from "prismarine-nbt";
export interface SNBTEditorProps {
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

export default function SNBTEditor(props: SNBTEditorProps): JSX.Element {
    if (props.dataStorageObject?.dataType === "JSON") return <p style="color: red;">JSON is not supported.</p>;
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
                lastChangeTime = Date.now();
                try {
                    if (props.dataStorageObject.data.type === "compound") {
                        props.dataStorageObject.data = parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value;
                    } else if ("parsed" in props.dataStorageObject.data) {
                        (props.dataStorageObject.data.parsed as NBT.NBT) = {
                            name: (props.dataStorageObject.data.parsed as NBT.NBT)?.name,
                            ...parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value,
                        };
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
                if (props.dataStorageObject.data.type === "compound") {
                    props.dataStorageObject.data = parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value;
                } else if ("parsed" in props.dataStorageObject.data) {
                    (props.dataStorageObject.data.parsed as NBT.NBT) = {
                        name: (props.dataStorageObject.data.parsed as NBT.NBT)?.name,
                        ...parseSNBTCompoundString(editorValue, { keepGoingAfterError: true }).value,
                    };
                }
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
            language="snbt"
            value={
                dataLoaded
                    ? prettyPrintSNBT(
                          prismarineToSNBT(
                              props.dataStorageObject.data.type === "compound" ? props.dataStorageObject.data : props.dataStorageObject.data.parsed
                          ),
                          {
                              indent: 4,
                              inlineArrays: true,
                              maxInlineLength: 5,
                          }
                      )
                    : "Data is not loaded."
            }
            onMount={handleEditorDidMount}
            options={{
                readOnly: props.readonly || !dataLoaded,
                readOnlyMessage: props.readonly ? props.readonlyMessage : !dataLoaded ? { value: "Data is not loaded." } : undefined,
                tabSize: 4,
                bracketPairColorization: { enabled: true },
                automaticLayout: true,
                fontFamily: "Consolas",
                matchBrackets: "always",
                fixedOverflowWidgets: true,
                allowOverflow: false,
            }}
            path={
                props.path
                    ? props.path + (props.path.includes("?") ? "&" : "?") + editorParams.toString()
                    : `unlinked-editor://${Date.now()}?${editorParams.toString()}`
            }
            ref={editorRef}
        />
    );
}
