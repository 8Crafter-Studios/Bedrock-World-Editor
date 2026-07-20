import { BrowserWindow } from "@electron/remote";
import {
    DBChunkKeyEntryContentTypes,
    DBEntryContentTypes,
    dimensions,
    type DBChunkKeyEntryContentType,
    type DBEntryContentType,
    type Dimension,
    type SubChunkIndexDimensionVectorXZ,
} from "mcbe-leveldb";
import type { JSX, RefObject, TargetedEvent } from "preact";
import { render, useEffect, useRef } from "preact/compat";

/**
 * Options for the {@link showDBKeyCreationDialog} function.
 */
export interface ShowDBKeyCreationDialogOptions<O extends DBKeyCreationPromptOptionItemType> {
    options: (O | DBKeyCreationPromptOptionItemWithProperties<O>)[];
    dimensionTypes?: Record<Dimension | `${string}:${string}`, number> | undefined;
    dimensionTypeNameMapping?: Record<Dimension | `${string}:${string}`, string> | undefined;
    // /**
    //  * The title of the dialog.
    //  *
    //  * @default "Select Tab"
    //  */
    // title?: string;
    /**
     * The message of the dialog.
     *
     * @default "Please enter the parameters for the new LevelDB key."
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
 * An option item type for the {@link DBKeyCreationPrompt} component.
 */
type DBKeyCreationPromptOptionItemType = "chunkX" | "chunkZ" | "subchunkIndex" | "dimension" | "entryType_chunk" | "entryType_any";

/**
 * An option item for the {@link DBKeyCreationPrompt} component.
 */
type DBKeyCreationPromptOptionItemWithProperties<O extends DBKeyCreationPromptOptionItemType> = {
    chunkX: { type: O };
    chunkZ: { type: O };
    subchunkIndex: { type: O };
    dimension: { type: O };
    entryType_chunk: {
        type: O;
        defaultValue: DBChunkKeyEntryContentType;
    };
    entryType_any: {
        type: O;
        defaultValue: DBEntryContentType;
    };
}[O];

/**
 * Result types for each option item in the {@link DBKeyCreationPromptOptionItemType} type.
 */
interface DBKeyCreationPromptOptionItemResults {
    chunkX: number;
    chunkZ: number;
    subchunkIndex: number;
    dimension: Dimension | number;
    entryType_chunk: DBChunkKeyEntryContentType;
    entryType_any: DBEntryContentType;
}

/**
 * The type of the result's `data` property.
 */
type DBKeyCreationPromptOptionItemsToDataObject<O extends DBKeyCreationPromptOptionItemType> = Pick<DBKeyCreationPromptOptionItemResults, O>;

/**
 * The result of the {@link showDBKeyCreationDialog} function.
 */
export type ShowDBKeyCreationDialogResult<O extends DBKeyCreationPromptOptionItemType> =
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
export interface DBKeyCreationDialogProps<O extends DBKeyCreationPromptOptionItemType> extends ShowDBKeyCreationDialogOptions<O> {
    onSubmit(data: DBKeyCreationPromptOptionItemsToDataObject<O>): void;
    onCancel(): void;
}

/**
 * Renders a dialog for inputting details for creating a new LevelDB key.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function DBKeyCreationDialog<O extends DBKeyCreationPromptOptionItemType>(props: DBKeyCreationDialogProps<O>): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const dialogTimestamp: number = Date.now();
    return (
        <div class="DBKeyCreationDialog" ref={containerRef}>
            <p>{props.message ?? "Please enter the parameters for the new LevelDB key."}</p>
            <div class="DBKeyCreationDialogOptionList" ref={optionListRef}>
                {...props.options.map(
                    (
                        option: DBKeyCreationPromptOptionItemType | DBKeyCreationPromptOptionItemWithProperties<DBKeyCreationPromptOptionItemType>,
                        index: number
                    ) => {
                        const optionId: DBKeyCreationPromptOptionItemType = typeof option === "string" ? option : option.type;
                        function fakeAssertOptionType<T extends DBKeyCreationPromptOptionItemType>(
                            option: DBKeyCreationPromptOptionItemType | DBKeyCreationPromptOptionItemWithProperties<DBKeyCreationPromptOptionItemType>,
                            optionType: T
                        ): asserts option is T | DBKeyCreationPromptOptionItemWithProperties<T> {}
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
                                                const chosenOption: HTMLOptionElement | undefined = [...event.currentTarget.querySelectorAll("option")].find(
                                                    (option: HTMLOptionElement): boolean => option.value === event.currentTarget.value
                                                );
                                                if (chosenOption) event.currentTarget.dataset.optionvaluetype = chosenOption.dataset.valuetype ?? "string";
                                            }}
                                        >
                                            {props.dimensionTypes ?
                                                (Object.entries(props.dimensionTypes) as [Dimension | `${string}:${string}`, number][])
                                                    .sort(
                                                        (
                                                            [, a]: [Dimension | `${string}:${string}`, number],
                                                            [, b]: [Dimension | `${string}:${string}`, number]
                                                        ): number => a - b
                                                    )
                                                    .map(
                                                        ([key, value]: [Dimension | `${string}:${string}`, number]): JSX.Element => (
                                                            <option value={dimensions[value] ?? value} data-valuetype={typeof (dimensions[value] ?? value)}>
                                                                {props.dimensionTypeNameMapping ? props.dimensionTypeNameMapping[key] : key}
                                                            </option>
                                                        )
                                                    )
                                            :   <>
                                                    <option value="overworld" selected>
                                                        Overworld
                                                    </option>
                                                    <option value="nether">Nether</option>
                                                    <option value="the_end">The End</option>
                                                </>
                                            }
                                        </select>
                                    </div>
                                );
                            case "entryType_chunk":
                                fakeAssertOptionType(option, optionId);
                                return (
                                    <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Entry Type</label>
                                        <select
                                            id={optionElementId}
                                            class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_dropdownOptionItem"
                                            data-optionid="entryType_chunk"
                                            data-optionvalue={typeof option === "string" ? "" : option.defaultValue}
                                            data-optionvaluetype="string"
                                            value={typeof option === "string" ? "" : option.defaultValue}
                                            defaultValue={typeof option === "string" ? "" : option.defaultValue}
                                            onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                                                if (!optionListRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        >
                                            <option value="" selected={typeof option === "string"} disabled>
                                                Choose Entry Type
                                            </option>
                                            {DBChunkKeyEntryContentTypes.map(
                                                (entryType: DBChunkKeyEntryContentType): JSX.Element => (
                                                    <option value={entryType} selected={entryType === (typeof option === "string" ? "" : option.defaultValue)}>
                                                        {entryType}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                );
                            case "entryType_any":
                                fakeAssertOptionType(option, optionId);
                                return (
                                    <div class="DBKeyCreationDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Entry Type</label>
                                        <select
                                            id={optionElementId}
                                            class="DBKeyCreationDialogOptionList_optionItem DBKeyCreationDialogOptionList_dropdownOptionItem"
                                            data-optionid="entryType_any"
                                            data-optionvalue={typeof option === "string" ? "" : option.defaultValue}
                                            data-optionvaluetype="string"
                                            value={typeof option === "string" ? "" : option.defaultValue}
                                            defaultValue={typeof option === "string" ? "" : option.defaultValue}
                                            onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                                                if (!optionListRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        >
                                            <option value="" selected={typeof option === "string"} disabled>
                                                Choose Entry Type
                                            </option>
                                            {DBEntryContentTypes.map(
                                                (entryType: DBEntryContentType): JSX.Element => (
                                                    <option value={entryType} selected={entryType === (typeof option === "string" ? "" : option.defaultValue)}>
                                                        {entryType}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                );
                        }
                    }
                )}
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
                            props.options.map(
                                (
                                    option: DBKeyCreationPromptOptionItemType | DBKeyCreationPromptOptionItemWithProperties<DBKeyCreationPromptOptionItemType>
                                ): [option: DBKeyCreationPromptOptionItemType, value: unknown] => {
                                    const optionId: DBKeyCreationPromptOptionItemType = typeof option === "string" ? option : option.type;
                                    const optionElement: HTMLElement | undefined = optionElements.find((element) => element.dataset.optionid === optionId);
                                    if (!optionElement) throw new ReferenceError(`Option element not found for option ID ${optionId}.`);
                                    const optionValueType = optionElement.dataset.optionvaluetype as "string" | "number";
                                    switch (optionValueType) {
                                        case "string":
                                            if (["entryType_chunk", "entryType_any"].includes(optionId) && !optionElement.dataset.optionvalue) {
                                                throw new TypeError(`Option not selected for option ID ${optionId}.`);
                                            }
                                            return [optionId, optionElement.dataset.optionvalue];
                                        case "number":
                                            return [optionId, Number(optionElement.dataset.optionvalue)];
                                    }
                                }
                            )
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

/**
 * Shows a dialog for inputting details for creating a new LevelDB key.
 *
 * @param options The options for the dialog.
 * @returns A promise that resolves with the result of the dialog.
 */
export default async function showDBKeyCreationDialog<O extends DBKeyCreationPromptOptionItemType>(
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
