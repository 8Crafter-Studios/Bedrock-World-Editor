import { BrowserWindow } from "@electron/remote";
import { dimensions, type Dimension, type SubChunkIndexDimensionVectorXZ } from "mcbe-leveldb";
import type { JSX, RefObject, TargetedEvent } from "preact";
import { render, useEffect, useRef } from "preact/compat";

/**
 * Options for the {@link showLocationInputDialog} function.
 */
export interface ShowLocationInputDialogOptions<O extends LocationInputPromptOptionItem> {
    options: O[];
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
     * @default undefined
     */
    message?: string | undefined;
    /**
     * The text of the submit button.
     *
     * @default "Submit"
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
 * An option item for the {@link LocationInputPrompt} component.
 */
type LocationInputPromptOptionItem = "chunkX" | "chunkZ" | "subchunkIndex" | "x" | "y" | "z" | "dimension";

/**
 * Result types for each option item in the {@link LocationInputPromptOptionItem} type.
 */
interface LocationInputPromptOptionItemResults {
    chunkX: number;
    chunkZ: number;
    subchunkIndex: number;
    x: number;
    y: number;
    z: number;
    dimension: Dimension | number;
}

/**
 * The type of the result's `data` property.
 */
type LocationInputPromptOptionItemsToDataObject<O extends LocationInputPromptOptionItem> = Pick<LocationInputPromptOptionItemResults, O>;

/**
 * The result of the {@link showLocationInputDialog} function.
 */
export type ShowLocationInputDialogResult<O extends LocationInputPromptOptionItem> =
    | {
          canceled: false;
          data: LocationInputPromptOptionItemsToDataObject<O>;
      }
    | {
          canceled: true;
      };

/**
 * Props for the {@link LocationInputDialog} component.
 */
export interface LocationInputDialogProps<O extends LocationInputPromptOptionItem> extends ShowLocationInputDialogOptions<O> {
    onSubmit(data: LocationInputPromptOptionItemsToDataObject<O>): void;
    onCancel(): void;
}

/**
 * Renders a dialog for inputting a location.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function LocationInputDialog<O extends LocationInputPromptOptionItem>(props: LocationInputDialogProps<O>): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const dialogTimestamp: number = Date.now();
    return (
        <div class="LocationInputDialog" ref={containerRef}>
            {props.message && <p>{props.message}</p>}
            <div class="LocationInputDialogOptionList" ref={optionListRef}>
                {...props.options.map((optionId: LocationInputPromptOptionItem, index: number) => {
                    const optionElementId = `LocationInputDialogOptionList_optionItem_${dialogTimestamp}_${index}_${optionId}`;
                    switch (optionId) {
                        case "chunkX":
                            return (
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Chunk X</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
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
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Chunk Z</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
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
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Subchunk Index</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
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
                        case "x":
                            return (
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>X</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
                                        data-optionid="x"
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
                        case "y":
                            return (
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Y</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
                                        data-optionid="y"
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
                        case "z":
                            return (
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Z</label>
                                    <input
                                        type="number"
                                        step="1"
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_textInputOptionItem"
                                        data-optionid="z"
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
                        case "dimension":
                            return (
                                <div class="LocationInputDialogOptionList_optionItemGroup">
                                    <label for={optionElementId}>Dimension</label>
                                    <select
                                        id={optionElementId}
                                        class="LocationInputDialogOptionList_optionItem LocationInputDialogOptionList_dropdownOptionItem"
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
                        const optionElements: HTMLElement[] = Array.from(optionListRef.current.querySelectorAll(".LocationInputDialogOptionList_optionItem"));
                        const data = Object.fromEntries(
                            props.options.map((option: LocationInputPromptOptionItem): [option: LocationInputPromptOptionItem, value: unknown] => {
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
                        ) as LocationInputPromptOptionItemsToDataObject<O>;
                        props.onSubmit(data);
                    }}
                >
                    {props.submitButtonText ?? "Submit"}
                </button>
            </div>
        </div>
    );
}

/**
 * Shows a dialog for inputting a location.
 *
 * @param options The options for the dialog.
 * @returns A promise that resolves with the result of the dialog.
 */
export default async function showLocationInputDialog<O extends LocationInputPromptOptionItem>(
    options: ShowLocationInputDialogOptions<O>
): Promise<ShowLocationInputDialogResult<O>> {
    return new Promise((resolve: (value: ShowLocationInputDialogResult<O>) => void): void => {
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
            <LocationInputDialog
                {...options}
                onSubmit={(data: LocationInputPromptOptionItemsToDataObject<O>): void => {
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
