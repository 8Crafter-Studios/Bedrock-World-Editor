import { BrowserWindow } from "@electron/remote";
import type { Dimension, SubChunkIndexDimensionVectorXZ } from "mcbe-leveldb";
import type { JSX, RefObject, TargetedEvent } from "preact";
import { render, useEffect, useRef } from "preact/compat";

export interface ShowDBKeyCreationDialogOptions<O extends DBKeyCreationPromptOptionItem> {
    options: O[];
    // /**
    //  * The title of the dialog.
    //  *
    //  * @default "Select Tab"
    //  */
    // title?: string;
    /**
     * The message of the dialog.
     *
     * @default undefined
     */
    message?: string | undefined;
    /**
     * The text of the submit button.
     *
     * @default "Create"
     */
    submitButtonText?: string | undefined;
    /**
     * The text of the cancel button.
     *
     * @default "Cancel"
     */
    cancelButtonText?: string | undefined;
}

/**
 * An option item for the {@link DBKeyCreationPrompt} component.
 */
type DBKeyCreationPromptOptionItem = "chunkX" | "chunkZ" | "subchunkIndex" | "dimension";

/**
 * Result types for each option item in the {@link DBKeyCreationPromptOptionItem} type.
 */
interface DBKeyCreationPromptOptionItemResults {
    chunkX: number;
    chunkZ: number;
    subchunkIndex: SubChunkIndexDimensionVectorXZ;
    dimension: Dimension;
}

/**
 * The type of the result's `data` property.
 */
type DBKeyCreationPromptOptionItemsToDataObject<O extends DBKeyCreationPromptOptionItem> = Pick<DBKeyCreationPromptOptionItemResults, O>;

/**
 * The result of the {@link showDBKeyCreationDialog} function.
 */
export type ShowDBKeyCreationDialogResult<O extends DBKeyCreationPromptOptionItem> =
    | {
          canceled: false;
          data: DBKeyCreationPromptOptionItemsToDataObject<O>;
      }
    | {
          canceled: true;
      };

/**
 * Props for the {@link DBKeyCreationDialog} component.
 */
export interface DBKeyCreationDialogProps<O extends DBKeyCreationPromptOptionItem> extends ShowDBKeyCreationDialogOptions<O> {
    onSubmit(data: DBKeyCreationPromptOptionItemsToDataObject<O>): void;
    onCancel(): void;
}

export function DBKeyCreationDialog<O extends DBKeyCreationPromptOptionItem>(props: DBKeyCreationDialogProps<O>): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const dialogTimestamp: number = Date.now();
    return (
        <div class="DBKeyCreationDialog" ref={containerRef}>
            <p>{props.message ?? "Please enter the parameters for the new LevelDB key."}</p>
            <div class="DBKeyCreationDialogOptionList" ref={optionListRef}>
                {...props.options.map((optionId: DBKeyCreationPromptOptionItem, index: number) => {
                    const optionElementId = `DBKeyCreationDialogOptionList_optionItem_${dialogTimestamp}_${index}_${optionId}`;
                    switch (optionId) {
                        case "chunkX":
                            return (
                                <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Chunk X</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_textInputOptionItem"
                                        data-optionid="chunkX"
                                        data-optionvalue={0}
                                        data-optionvaluetype="number"
                                        value={0}
                                        defaultValue={0}
                                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                            if (!optionListRef.current) return;
                                            event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                        }}
                                    />
                                </div>
                            );
                        case "chunkZ":
                            return (
                                <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Chunk Z</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_textInputOptionItem"
                                        data-optionid="chunkZ"
                                        data-optionvalue={0}
                                        data-optionvaluetype="number"
                                        value={0}
                                        defaultValue={0}
                                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                            if (!optionListRef.current) return;
                                            event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                        }}
                                    />
                                </div>
                            );
                        case "subchunkIndex":
                            return (
                                <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Subchunk Index</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_textInputOptionItem"
                                        data-optionid="subchunkIndex"
                                        data-optionvalue={0}
                                        data-optionvaluetype="number"
                                        value={0}
                                        defaultValue={0}
                                        min={0}
                                        max={15}
                                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                            if (!optionListRef.current) return;
                                            event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                        }}
                                    />
                                </div>
                            );
                        case "dimension":
                            return (
                                <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Dimension</label>
                                    <select
                                        id={optionElementId}
                                        class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_dropdownOptionItem"
                                        data-optionid="dimension"
                                        data-optionvalue="overworld"
                                        data-optionvaluetype="string"
                                        value="overworld"
                                        defaultValue="overworld"
                                        onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                                            if (!optionListRef.current) return;
                                            event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                        }}
                                    >
                                        <option value="overworld" selected>
                                            Overworld
                                        </option>
                                        <option value="nether">Nether</option>
                                        <option value="the_end">The End</option>
                                    </select>
                                </div>
                            );
                    }
                })}
            </div>
            <div style={{ display: "flex", flexDirection: "row", width: "100%" }}>
                <button type="button" class="genericRoundButtonH" style={{ flex: 1 }} onClick={props.onCancel}>
                    {props.cancelButtonText ?? "Cancel"}
                </button>
                <button
                    type="button"
                    class="genericRoundButtonH"
                    style={{ flex: 1 }}
                    onClick={(): void => {
                        if (!optionListRef.current) return;
                        const optionElements: HTMLElement[] = Array.from(optionListRef.current.querySelectorAll(".DBKeyCreationDialogOptionList_optionItem"));
                        const data = Object.fromEntries(
                            props.options.map((option: DBKeyCreationPromptOptionItem): [option: DBKeyCreationPromptOptionItem, value: unknown] => {
                                const optionElement: HTMLElement | undefined = optionElements.find((element) => element.dataset.optionid === option);
                                if (!optionElement) throw new ReferenceError(`Option element not found for option ID ${option}.`);
                                const optionValueType = optionElement.dataset.optionvaluetype as "string" | "number";
                                switch (optionValueType) {
                                    case "string":
                                        return [option, optionElement.dataset.optionvalue];
                                    case "number":
                                        return [option, Number(optionElement.dataset.optionvalue)];
                                }
                            })
                        ) as DBKeyCreationPromptOptionItemsToDataObject<O>;
                        props.onSubmit(data);
                    }}
                >
                    {props.submitButtonText ?? "Create"}
                </button>
            </div>
        </div>
    );
}

export default async function showDBKeyCreationDialog<O extends DBKeyCreationPromptOptionItem>(
    options: ShowDBKeyCreationDialogOptions<O>
): Promise<ShowDBKeyCreationDialogResult<O>> {
    return new Promise((resolve: (value: ShowDBKeyCreationDialogResult<O>) => void): void => {
        const container: HTMLDivElement = document.createElement("div");
        container.style.position = "fixed";
        container.style.zIndex = "1200000";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        const innerContainer: HTMLDivElement = document.createElement("div");
        innerContainer.style.width = "-webkit-fill-available";
        innerContainer.style.height = "-webkit-fill-available";
        innerContainer.style.margin = "5px";
        innerContainer.style.padding = "25px";
        innerContainer.style.borderRadius = "25px";
        innerContainer.style.backgroundColor = "#88888888";
        innerContainer.style.backdropFilter = "blur(5px)";
        innerContainer.style.overflow = "auto";
        render(
            <DBKeyCreationDialog
                {...options}
                onSubmit={(data: DBKeyCreationPromptOptionItemsToDataObject<O>): void => {
                    render(null, innerContainer);
                    container.remove();
                    resolve({ canceled: false, data });
                }}
                onCancel={(): void => {
                    render(null, innerContainer);
                    container.remove();
                    resolve({ canceled: true });
                }}
            />,
            innerContainer
        );
        container.appendChild(innerContainer);
        $("#page-overlay-container").append(container);
    });
}
