import { Editor, type Monaco } from "@monaco-editor/react";
import { prettyPrintSNBT, prismarineToSNBT, type DBEntryContentType } from "mcbe-leveldb";
import * as monaco from "monaco-editor";
import type { IMarkdownString } from "monaco-editor";
import type { JSX } from "preact";
import { LoadingScreenContents } from "../app";
import { useRef } from "preact/compat";
import type * as NBT from "prismarine-nbt";
// import { IProductService } from "monaco-editor/esm/vs/platform/product/common/productService.js";
export interface PrismarineNBTEditorProps {
    dataStorageObject: GenericDataStorageObject;
    contentType?: DBEntryContentType;
    /**
     * A callback function that is called when a value is changed in the editor.
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

export default function PrismarineNBTEditor(props: PrismarineNBTEditorProps): JSX.Element {
    if (props.dataStorageObject.dataType === "JSON") return <p style="color: red;">JSON is not supported.</p>;
    const editorRef = useRef<typeof Editor>(null);
    function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco): void {
        // editor.getid
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ ...monaco.languages.json.jsonDefaults.diagnosticsOptions, schemas: [] });
    }
    let editorValue: string | undefined;
    let lastChangeTime: number = Date.now() - 1000;
    let lastChangeStartTime: number = Date.now() - 1000;
    function handleEditorValueChanged(value: string | undefined, ev: monaco.editor.IModelContentChangedEvent): void {
        const currentChangeTime: number = Date.now();
        if (value === undefined) return;
        editorValue = value;
        if (currentChangeTime - lastChangeStartTime < 500 && lastChangeTime >= lastChangeStartTime) {
            lastChangeStartTime = currentChangeTime;
            setTimeout((): void => {
                if (currentChangeTime !== lastChangeStartTime) return;
                if (editorValue !== value) return;
                lastChangeTime = Date.now();
                try {
                    if (props.dataStorageObject.data.type === "compound") {
                        props.dataStorageObject.data.value = JSON.parse(editorValue);
                    } else if ("parsed" in props.dataStorageObject.data) {
                        (props.dataStorageObject.data.parsed as NBT.NBT)!.value = JSON.parse(editorValue);
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
                    props.dataStorageObject.data.value = JSON.parse(editorValue);
                } else if ("parsed" in props.dataStorageObject.data) {
                    (props.dataStorageObject.data.parsed as NBT.NBT)!.value = JSON.parse(editorValue);
                }
                props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
            } catch (e) {
                console.error(e);
            }
        }
    }
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
            language="json"
            value={JSON.stringify(
                props.dataStorageObject.data.type === "compound" ? props.dataStorageObject.data.value : props.dataStorageObject.data.parsed.value,
                null,
                4
            )}
            // overrideServices={{
            //     productService: IProductService,
            // }}
            onMount={handleEditorDidMount}
            options={{
                readOnly: props.readonly,
                readOnlyMessage: props.readonly ? props.readonlyMessage : undefined,
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

monaco
