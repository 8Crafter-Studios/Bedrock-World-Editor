import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import type { DBEntryContentType } from "mcbe-leveldb";
import HexEditor from "@jixun/react-hex-editor-react-16";
import oneDarkPro from "@jixun/react-hex-editor-react-16/themes/oneDarkPro";
import "./binaryHexEditor.css";
import type { HexEditorHandle } from "@jixun/react-hex-editor-react-16/dist/types";
import Notice from "./Notice";
import type { EditorWidgetOverlayBarWidgetRegistry } from "./EditorWidgetOverlayBar";
import { dialog } from "@electron/remote";
import type { MessageBoxReturnValue } from "electron";
import { LoadingScreenContents } from "../app";

/**
 * The data storage object for the {@link BinaryHexEditor}.
 */
export type HexEditorDataStorageObject = {
    /**
     * The options for the {@link BinaryHexEditor}.
     */
    hexEditor: {
        /**
         * The scroll position of the hex editor.
         *
         * @todo Not implemented yet.
         */
        scrollTop?: number;
    };
} & GenericDataStorageObject;

/**
 * Initializes the properties of the {@link HexEditorDataStorageObject} onto the target {@link DataStorageObject}.
 *
 * This function mutates the original object.
 *
 * @param dataStorageObject The data storage object to initialize.
 * @returns The initialized data storage object.
 */
export function initHexEditorDataStorageObjectProps(dataStorageObject: DataStorageObject): HexEditorDataStorageObject & DataStorageObject {
    return Object.assign(dataStorageObject, { hexEditor: { scrollTop: 0 } } satisfies Omit<HexEditorDataStorageObject, keyof GenericDataStorageObject>);
}

/**
 * Props for the {@link BinaryHexEditor} component.
 */
export interface HexEditorProps {
    /**
     * The tab associated with this editor.
     */
    tab?: TabManagerSubTab | undefined;
    dataStorageObject: HexEditorDataStorageObject;
    contentType?: DBEntryContentType;
    /**
     * A callback function that is called when a value is changed in the hex editor.
     *
     * @param dataStorageObject The current value of the data storage object (it is a reference to the original data storage object).
     * @param cause The cause of the change, or `undefined`.
     */
    onValueChange?(
        dataStorageObject: GenericDataStorageObject,
        cause?: {
            newValue: unknown;
            type: "changeContents";
        }
    ): void;
    /**
     * Whether the hex editor should be read-only.
     *
     * @default false
     */
    readonly?: boolean;
    /**
     * An optional overlay bar widget registry to allow the hex editor to register widgets for the overlay bar.
     *
     * @default undefined
     */
    overlayBarRegistry?: EditorWidgetOverlayBarWidgetRegistry | undefined;
}

/**
 * The hex editor.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function BinaryHexEditor(props: HexEditorProps): JSX.SpecificElement<"div"> {
    if (props.dataStorageObject?.data === undefined) {
        return (
            <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
                <Notice
                    title="Data Not Loaded"
                    subtitle="The data for this sub-tab has not been loaded yet."
                    detail={null}
                    image="no_content"
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
                            if (props.tab.parentTab.selectedTab !== props.tab) return;
                            props.tab.parentTab.emit("reloadCurrentSubTab");
                        } finally {
                            event.currentTarget.disabled = false;
                        }
                    }}
                    disabled={!props.tab}
                >
                    Load Data in Raw Mode
                </button>
            </div>
        );
    }
    useEffect((): (() => void) => {
        const widgetID: string = `HexEditor_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        registerButtons: {
            if (!editorConainterRef.current) break registerButtons;
            if (!props.overlayBarRegistry || props.readonly || !props.tab) break registerButtons;
            if (props.dataStorageObject.dataType === "binary" && !props.tab.rawMode) break registerButtons;
            props.overlayBarRegistry.registerWidget(
                <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                    {!props.tab.rawMode && (
                        <button
                            type="button"
                            title="Use this to reopen the editor as a binary-only editor, allowing you to save changes even if the binary data cannot be parsed to the actual data type of this entry."
                            onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                if (!props.tab) throw new ReferenceError("props.tab is undefined.");
                                event.preventDefault();
                                if (event.currentTarget.disabled) return;
                                event.currentTarget.blur();
                                event.currentTarget.disabled = true;
                                try {
                                    // REVIEW: Maybe unsaved changes won't be lost in all cases here, and for once where they are there is probably a better way to do it to avoid that.
                                    if (props.tab?.isModified()) {
                                        if (hasUnparseableChanges) {
                                            const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                                type: "warning",
                                                title: "Unsaved Changes",
                                                message: `${props.tab.name} has unsaved changes.`,
                                                detail: "Your changes will be lost if you don't save them first. Some of the changes were not able to be parsed to the actual data type of this entry, you can choose to save them anyway.",
                                                buttons: [
                                                    "Save All Changes and Proceed",
                                                    "Save Only Parseable Changes and Proceed",
                                                    "Discard Changes and Proceed",
                                                    "Cancel",
                                                ],
                                                noLink: true,
                                                defaultId: 0,
                                                cancelId: 3,
                                            });
                                            switch (result.response) {
                                                case 0:
                                                    props.dataStorageObject.data = convertEditorValueToData(data, "binary");
                                                    props.dataStorageObject.dataType = "binary";
                                                    await props.tab.save();
                                                    break;
                                                case 1:
                                                    await props.tab.save();
                                                    await props.tab.loadData(true);
                                                    break;
                                                case 2:
                                                    props.tab.hasUnsavedChanges = false;
                                                    await props.tab.loadData(true);
                                                    break;
                                                case 3:
                                                    return;
                                            }
                                        } else {
                                            const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                                type: "warning",
                                                title: "Unsaved Changes",
                                                message: `${props.tab.name} has unsaved changes.`,
                                                detail: "Your changes will be lost if you don't save them first.",
                                                buttons: ["Save Changes and Proceed", "Discard Changes and Proceed", "Cancel"],
                                                noLink: true,
                                                defaultId: 0,
                                                cancelId: 2,
                                            });
                                            switch (result.response) {
                                                case 0:
                                                    await props.tab.save();
                                                    await props.tab.loadData(true);
                                                    break;
                                                case 1:
                                                    props.tab.hasUnsavedChanges = false;
                                                    await props.tab.loadData(true);
                                                    break;
                                                case 2:
                                                    return;
                                            }
                                        }
                                    } else if (hasUnparseableChanges) {
                                        const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                            type: "warning",
                                            title: "Unparseable Unsaved Changes",
                                            message: `${props.tab?.name ?? "This tab"} has unparseable unsaved changes.`,
                                            detail: "Your changes will be lost if you don't save them first. The unsaved changes were not able to be parsed to the actual data type of this entry, you can choose to save them anyway.",
                                            buttons: ["Save Unparseable Changes and Proceed", "Discard Changes and Proceed", "Cancel"],
                                            noLink: true,
                                            defaultId: 0,
                                            cancelId: 2,
                                        });
                                        switch (result.response) {
                                            case 0:
                                                props.tab.hasUnsavedChanges = true;
                                                props.dataStorageObject.data = await convertEditorValueToData(data, "binary");
                                                props.dataStorageObject.dataType = "binary";
                                                await props.tab.save();
                                                break;
                                            case 1:
                                                props.tab.hasUnsavedChanges = false;
                                                await props.tab.loadData(true);
                                                break;
                                            case 2:
                                                return;
                                        }
                                    } else {
                                        await props.tab.loadData(true);
                                    }
                                    props.tab.rawMode = true;
                                    if (props.tab.parentTab.selectedTab !== props.tab) return;
                                    props.tab.parentTab.emit("reloadCurrentSubTab");
                                } finally {
                                    if (event.currentTarget) event.currentTarget.disabled = false;
                                }
                            }}
                        >
                            Edit in Raw Mode
                        </button>
                    )}
                    {props.tab.rawMode && (
                        <button
                            type="button"
                            title="Use this to switch the editor back to normal mode."
                            onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                if (!props.tab) throw new ReferenceError("props.tab is undefined.");
                                event.preventDefault();
                                if (event.currentTarget.disabled) return;
                                event.currentTarget.blur();
                                event.currentTarget.disabled = true;
                                try {
                                    // REVIEW: Maybe unsaved changes won't be lost in all cases here, and for once where they are there is probably a better way to do it to avoid that.
                                    if (props.tab?.isModified()) {
                                        const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                            type: "warning",
                                            title: "Unsaved Changes",
                                            message: `${props.tab.name} has unsaved changes.`,
                                            detail: "Your changes will be lost if you don't save them first.",
                                            buttons: ["Save Changes and Proceed", "Discard Changes and Proceed", "Cancel"],
                                            noLink: true,
                                            defaultId: 0,
                                            cancelId: 2,
                                        });
                                        switch (result.response) {
                                            case 0:
                                                await props.tab.save();
                                                delete props.tab.currentState.options.dataStorageObject;
                                                break;
                                            case 1:
                                                props.tab.hasUnsavedChanges = false;
                                                delete props.tab.currentState.options.dataStorageObject;
                                                break;
                                            case 2:
                                                return;
                                        }
                                    } else {
                                        delete props.tab.currentState.options.dataStorageObject;
                                    }
                                    props.tab.rawMode = false;
                                    if (props.tab.parentTab.selectedTab !== props.tab) return;
                                    props.tab.parentTab.emit("reloadCurrentSubTab");
                                } finally {
                                    if (event.currentTarget) event.currentTarget.disabled = false;
                                }
                            }}
                        >
                            Exit Raw Mode
                        </button>
                    )}
                </div>,
                widgetID,
                -1
            );
            return (): void => {
                if (props.overlayBarRegistry && !props.readonly) {
                    props.overlayBarRegistry.unregisterWidget(widgetID);
                }
            };
        }
        return (): void => {};
    });
    // const supportedDataTypes: DataStorageObject["dataType"][] = ["binary"];
    // if (props.dataStorageObject?.dataType !== undefined && !supportedDataTypes.includes(props.dataStorageObject.dataType)) {
    //     return (
    //         <Notice
    //             title="Unsupported Data Type"
    //             subtitle={`The data type "${props.dataStorageObject.dataType}" is not yet supported in the hex editor.`}
    //             detail={`Supported data types: ${supportedDataTypes.join(", ")}`}
    //             image="under_construction_cropped"
    //         />
    //     );
    // }
    const editorConainterRef = useRef<HTMLDivElement>(null);
    const editorErrorMessageDisplayBoxRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HexEditorHandle>(null);
    let lastChangeTime: number = Date.now() - 1000;
    let lastChangeStartTime: number = Date.now() - 1000;
    let hasUnparseableChanges: boolean = false;
    let waitForParseToCompleteBeforeNextChangeHandle: Promise<void> | null = null;
    async function handleEditorValueChanged(newValue: number[] | [...number[], null]): Promise<void> {
        const currentChangeTime: number = Date.now();
        lastChangeStartTime = currentChangeTime;
        await waitForParseToCompleteBeforeNextChangeHandle;
        if (currentChangeTime !== lastChangeStartTime) return;
        if (currentChangeTime - lastChangeStartTime < 500 && lastChangeTime >= lastChangeStartTime) {
            setTimeout(async (): Promise<void> => {
                if (currentChangeTime !== lastChangeStartTime) return;
                const delayUntilParsePromise: PromiseWithResolvers<void> = Promise.withResolvers();
                waitForParseToCompleteBeforeNextChangeHandle = delayUntilParsePromise.promise;
                lastChangeTime = Date.now();
                saveNewValue: try {
                    try {
                        var value = await convertEditorValueToData(newValue);
                    } catch (e) {
                        console.error(e);
                        hasUnparseableChanges = true;
                        setError(String(e));
                        break saveNewValue;
                    }
                    hasUnparseableChanges = false;
                    setError(null);
                    props.dataStorageObject.data = value;
                    props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
                } catch (e) {
                    console.error(e);
                } finally {
                    waitForParseToCompleteBeforeNextChangeHandle = null;
                    delayUntilParsePromise.resolve();
                }
            }, 500);
        } else {
            lastChangeStartTime = currentChangeTime;
            lastChangeTime = currentChangeTime;
            const delayUntilParsePromise: PromiseWithResolvers<void> = Promise.withResolvers();
            waitForParseToCompleteBeforeNextChangeHandle = delayUntilParsePromise.promise;
            saveNewValue: try {
                try {
                    var value = await convertEditorValueToData(newValue);
                } catch (e) {
                    console.error(e);
                    hasUnparseableChanges = true;
                    setError(String(e));
                    break saveNewValue;
                }
                hasUnparseableChanges = false;
                setError(null);
                props.dataStorageObject.data = value;
                props.onValueChange?.(props.dataStorageObject, { newValue: value, type: "changeContents" });
            } catch (e) {
                console.error(e);
            } finally {
                waitForParseToCompleteBeforeNextChangeHandle = null;
                delayUntilParsePromise.resolve();
            }
        }
    }
    const supportedSyncEditorValueDataTypes = ["binary"] as const satisfies DataStorageObject["dataType"][];
    function isSupportedSyncEditorValueDataType(dataType: DataStorageObject["dataType"]): dataType is (typeof supportedSyncEditorValueDataTypes)[number] {
        return (supportedSyncEditorValueDataTypes as DataStorageObject["dataType"][]).includes(dataType);
    }
    function convertDataToEditorValueSync(): number[] | undefined {
        switch (props.dataStorageObject.dataType) {
            case "binary":
                return Array.from(props.dataStorageObject.data);
            default:
                return undefined;
        }
    }
    async function convertDataToEditorValue(): Promise<number[]> {
        if (isSupportedSyncEditorValueDataType(props.dataStorageObject.dataType)) {
            return convertDataToEditorValueSync()!;
        }
        switch (props.dataStorageObject.dataType) {
            default:
                if (props.tab) return Array.from(await props.tab.exportRawData());
                throw new TypeError(
                    `The data type "${props.dataStorageObject.dataType}" is not yet supported in the hex editor when props.tab is not provided.`
                );
        }
    }
    async function convertEditorValueToData(editorValue: number[] | [...number[], null]): Promise<(typeof props.dataStorageObject)["data"]>;
    async function convertEditorValueToData<T extends DataStorageObject["dataType"]>(
        editorValue: number[] | [...number[], null],
        dataType: T
    ): Promise<Extract<DataStorageObject, { dataType: T }>["data"]>;
    async function convertEditorValueToData(
        editorValue: number[] | [...number[], null],
        dataType: DataStorageObject["dataType"] = props.dataStorageObject.dataType
    ): Promise<(typeof props.dataStorageObject)["data"]> {
        const value: number[] = editorValue.at(-1) === null ? (editorValue.slice(0, -1) as number[]) : (editorValue as number[]);
        switch (dataType) {
            case "binary":
                return Buffer.from(value) satisfies Extract<DataStorageObject, { dataType: typeof dataType }>["data"];
            default:
                if (props.tab) {
                    const data = await props.tab.parseRawData(Buffer.from(value), props.dataStorageObject.sourceType);
                    // TODO: Maybe add conversion when the requested type does not match, or make a new method on the TabManagerSubTab class for parsing raw data from a format type to a specific data type, or add that into the existing parseRawData method as an optional third parameter.
                    if (dataType !== data.dataType)
                        throw new TypeError(
                            `The binary data failed to convert to the requested data type "${dataType}", it converted to "${data.dataType}" instead.`
                        );
                    return data.data as Extract<DataStorageObject, { dataType: typeof dataType }>["data"];
                }
                throw new TypeError(`The data type "${dataType}" is not yet supported in the hex editor when props.tab is not provided.`);
        }
    }
    let hasError: boolean = false;
    function setError(error: string | null): void {
        if (!editorConainterRef.current) return;
        if (error === null) {
            if (!hasError) return;
            hasError = false;
            editorConainterRef.current.classList.remove("hexEditorValueError");
            // if (editorConainterRef.current.clientWidth-(editorConainterRef.current.querySelector(".editHex")?.clientWidth ?? Infinity) > 500) {

            // }
            if (editorErrorMessageDisplayBoxRef.current) editorErrorMessageDisplayBoxRef.current.textContent = "";
            editorConainterRef.current.style.setProperty("--hex-editor-error-message", "");
            return;
        }
        hasError = true;
        editorConainterRef.current.classList.add("hexEditorValueError");
        if (editorErrorMessageDisplayBoxRef.current && editorErrorMessageDisplayBoxRef.current.clientWidth > 250) {
            editorConainterRef.current.style.setProperty("--hex-editor-error-message", "");
            editorErrorMessageDisplayBoxRef.current.textContent = String(error);
        } else {
            if (editorErrorMessageDisplayBoxRef.current) editorErrorMessageDisplayBoxRef.current.textContent = "";
            editorConainterRef.current.style.setProperty("--hex-editor-error-message", JSON.stringify(error));
        }
    }
    const editorParams = new URLSearchParams({ contentType: props.contentType ?? "Unknown" });
    const data: [...number[], null] | ([] & (number | null)[]) = _React.useMemo(
        (): [...number[], null] | [] =>
            isSupportedSyncEditorValueDataType(props.dataStorageObject.dataType) ? [...convertDataToEditorValueSync()!, null] : [],
        []
    );
    const rerenderEditorRef: RefObject<() => void> = useRef((): void => {});
    // If `data` is large, you probably want it to be mutable rather than cloning it over and over.
    // `nonce` can be used to update the editor when `data` is reference that does not change.
    let hexEditorBackspaceKeyDown = false;
    let hexEditorDeleteKeyDown = false;
    function HexEditorInternal({ rerenderRef }: { rerenderRef: RefObject<() => void> }): JSX.Element {
        useEffect((): (() => void) => {
            if (!editorRef.current) return (): void => {};
            if (props.dataStorageObject.hexEditor.scrollTop !== undefined) editorRef.current.scrollTo(props.dataStorageObject.hexEditor.scrollTop);
            if (!editorConainterRef.current) return (): void => {};
            const hexEditorBodyElement: Element | null = editorConainterRef.current.querySelector(".hexEditorBody");
            if (!hexEditorBodyElement) return (): void => {};
            function scrollHandler(): void {
                props.dataStorageObject.hexEditor.scrollTop = hexEditorBodyElement!.scrollTop;
            }
            function keyHandler(event: KeyboardEvent): void {
                if (event.type === "keydown") {
                    if (event.key === "Backspace") hexEditorBackspaceKeyDown = true;
                    else if (event.key === "Delete") hexEditorDeleteKeyDown = true;
                } else if (event.type === "keyup") {
                    if (event.key === "Backspace") hexEditorBackspaceKeyDown = false;
                    else if (event.key === "Delete") hexEditorDeleteKeyDown = false;
                }
            }
            hexEditorBodyElement.addEventListener("scroll", scrollHandler);
            window.addEventListener("keydown", keyHandler, { capture: true });
            window.addEventListener("keyup", keyHandler, { capture: true });
            return (): void => {
                hexEditorBodyElement.removeEventListener("scroll", scrollHandler);
                window.removeEventListener("keydown", keyHandler);
                window.removeEventListener("keyup", keyHandler);
            };
        });
        const [nonce, setNonce] = useState(0);
        // The callback facilitates updates to the source data.
        const handleSetValue = _React.useCallback(
            (offset: number, value: number): void => {
                if (!editorRef.current) return;
                let cursorShift = 1;
                // HACK: This is a temporary fix for the issue where Backspace and Delete just set the value to 0 instead of deleting it.
                if (hexEditorBackspaceKeyDown || hexEditorDeleteKeyDown) data.splice(offset, 1);
                else data[offset] = value;
                if (hexEditorBackspaceKeyDown) cursorShift = 0;
                else if (hexEditorDeleteKeyDown) cursorShift = 0;
                if (data.at(-1) !== null) data.push(null);
                handleEditorValueChanged(data);
                setNonce((v: number): number => v + 1);
                requestAnimationFrame(function fixHexEditorCursorPosition(): void {
                    if (!editorRef.current) return;
                    editorRef.current.setSelectionRange(offset + cursorShift);
                });
            },
            [data]
        );
        rerenderRef.current = (): void => setNonce((v: number): number => v + 1);
        return (
            <HexEditor
                columns={0x10}
                data={
                    // HACK: The data has a null value at the end as a workaround to allow the user to add more bytes, otherwise the editor clamps the index that the value was added at, causing the value to replace the last value instead of adding a new value.
                    data as number[]
                }
                nonce={nonce}
                onSetValue={handleSetValue}
                theme={{ hexEditor: oneDarkPro }}
                showAscii
                showColumnLabels
                showRowLabels
                readOnly={!!props.readonly}
                ref={editorRef}
            />
        );
    }
    if (!isSupportedSyncEditorValueDataType(props.dataStorageObject.dataType) && !data.length) {
        useEffect((): void => {
            if (!editorConainterRef.current) return;
            if (data.length) return;
            convertDataToEditorValue().then((editorValue: number[]): void => {
                if (data.length) return;
                data.push(...editorValue, null);
                if (!editorConainterRef.current) return;
                // setNonce((v: number): number => v + 1);
                render(null, editorConainterRef.current);
                render(
                    <>
                        <HexEditorInternal rerenderRef={rerenderEditorRef} />
                        <div class="hexEditorErrorMessageDisplayBox" ref={editorErrorMessageDisplayBoxRef}></div>
                    </>,
                    editorConainterRef.current
                );
            });
        });
        return (
            <div class="hexEditorContainer" ref={editorConainterRef}>
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <div style="flex: 1; overflow: auto;">
                        <LoadingScreenContents message="Converting to binary..." />
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div class="hexEditorContainer" ref={editorConainterRef}>
            <HexEditorInternal rerenderRef={rerenderEditorRef} />
            <div class="hexEditorErrorMessageDisplayBox" ref={editorErrorMessageDisplayBoxRef}></div>
        </div>
        /* <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <UnderConstruction subtitle="This editor is under construction." detail="The hex editor has not been implemented yet." />
            </div>
        </div> */
    );
}
