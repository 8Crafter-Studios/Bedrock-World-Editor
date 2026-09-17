import { dimensions, type Dimension } from "mcbe-leveldb";
import type { JSX, RefObject, TargetedEvent } from "preact";
import { render, useRef } from "preact/compat";

/**
 * Options for the {@link showLocationRangeInputDialog} function.
 */
export interface ShowLocationRangeInputDialogOptions<O extends LocationRangeInputPromptOptionItem> {
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
     * The text of the general section label.
     *
     * @default undefined
     */
    generalLabel?: string | undefined;
    /**
     * The text of the from section label.
     *
     * @default "From"
     */
    fromLabel?: string | undefined;
    /**
     * The text of the to section label.
     *
     * @default "To"
     */
    toLabel?: string | undefined;
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
 * An option item for the {@link LocationRangeInputPrompt} component.
 */
type LocationRangeInputPromptOptionItem = "chunkX" | "chunkZ" | "subchunkIndex" | "x" | "y" | "z" | "dimension";

/**
 * Result types for each option item in the {@link LocationRangeInputPromptOptionItem} type that is shown for both the start and end of the range.
 */
interface LocationRangeInputPromptRangeOptionItemResults {
    chunkX: number;
    chunkZ: number;
    subchunkIndex: number;
    x: number;
    y: number;
    z: number;
}

/**
 * Result types for each option item in the {@link LocationRangeInputPromptOptionItem} type that is shown only once, as well as the `from` and `to` properties containing the options for the start and end of the range.
 */
interface LocationRangeInputPromptOptionItemResults {
    from: LocationRangeInputPromptRangeOptionItemResults;
    to: LocationRangeInputPromptRangeOptionItemResults;
    dimension: Dimension | number;
}

/**
 * The type of the result's `data` property.
 */
type LocationRangeInputPromptOptionItemsToDataObject<O extends LocationRangeInputPromptOptionItem> = Pick<
    Omit<LocationRangeInputPromptOptionItemResults, "from" | "to">,
    Extract<O, keyof LocationRangeInputPromptOptionItemResults>
> &
    Record<
        keyof Pick<LocationRangeInputPromptOptionItemResults, "from" | "to">,
        Pick<LocationRangeInputPromptRangeOptionItemResults, Extract<O, keyof LocationRangeInputPromptRangeOptionItemResults>>
    >;

/**
 * The result of the {@link showLocationRangeInputDialog} function.
 */
export type ShowLocationRangeInputDialogResult<O extends LocationRangeInputPromptOptionItem> =
    | {
          canceled: false;
          data: LocationRangeInputPromptOptionItemsToDataObject<O>;
      }
    | {
          canceled: true;
      };

/**
 * Props for the {@link LocationRangeInputDialog} component.
 */
export interface LocationRangeInputDialogProps<O extends LocationRangeInputPromptOptionItem> extends ShowLocationRangeInputDialogOptions<O> {
    onSubmit(this: void, data: LocationRangeInputPromptOptionItemsToDataObject<O>): void;
    onCancel(this: void): void;
}

/**
 * Renders a dialog for inputting a location range.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function LocationRangeInputDialog<O extends LocationRangeInputPromptOptionItem>(props: LocationRangeInputDialogProps<O>): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListGeneralRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListFromRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListToRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const dialogTimestamp: number = Date.now();
    const generalOptionItems = ["dimension"] as const satisfies LocationRangeInputPromptOptionItem[];
    return (
        <div class="LocationRangeInputDialog" ref={containerRef}>
            {props.message && <p>{props.message}</p>}
            {props.generalLabel && props.options.some((v: O): boolean => generalOptionItems.includes(v as never)) && <p>{props.generalLabel}</p>}
            <div class="LocationRangeInputDialogOptionList LocationRangeInputDialogOptionList_general" ref={optionListGeneralRef}>
                {...props.options
                    .filter((v: LocationRangeInputPromptOptionItem): v is Extract<O, (typeof generalOptionItems)[number]> =>
                        generalOptionItems.includes(v as never)
                    )
                    .map((optionId: (typeof generalOptionItems)[number], index: number): JSX.Element => {
                        const optionElementId = `LocationRangeInputDialogOptionList_optionItem_general_${dialogTimestamp}_${index}_${optionId}`;
                        switch (optionId) {
                            case "dimension":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Dimension</label>
                                        <select
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_general LocationRangeInputDialogOptionList_dropdownOptionItem"
                                            data-optionid="dimension"
                                            data-optionvalue="overworld"
                                            data-optionvaluetype="string"
                                            value="overworld"
                                            defaultValue="overworld"
                                            onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                                                if (!optionListGeneralRef.current) return;
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
                            default:
                                throw new Error(`Unknown option ID: ${optionId as string}.`);
                        }
                    })}
            </div>
            <p>{props.fromLabel ?? "From"}</p>
            <div class="LocationRangeInputDialogOptionList LocationRangeInputDialogOptionList_from" ref={optionListFromRef}>
                {...props.options
                    .filter(
                        (v: LocationRangeInputPromptOptionItem): v is Exclude<O, (typeof generalOptionItems)[number]> =>
                            !generalOptionItems.includes(v as never)
                    )
                    .map((optionId: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>, index: number): JSX.Element => {
                        const optionElementId = `LocationRangeInputDialogOptionList_optionItem_from_${dialogTimestamp}_${index}_${optionId}`;
                        switch (optionId) {
                            case "chunkX":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Chunk X</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="chunkX"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "chunkZ":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Chunk Z</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="chunkZ"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "subchunkIndex":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Subchunk Index</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="subchunkIndex"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            min={0}
                                            max={15}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "x":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>X</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="x"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "y":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Y</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="y"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "z":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Z</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_from LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="z"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListFromRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            default:
                                throw new Error(`Unknown option ID: ${optionId as string}.`);
                        }
                    })}
            </div>
            <p>{props.toLabel ?? "To"}</p>
            <div class="LocationRangeInputDialogOptionList LocationRangeInputDialogOptionList_to" ref={optionListToRef}>
                {...props.options
                    .filter(
                        (v: LocationRangeInputPromptOptionItem): v is Exclude<O, (typeof generalOptionItems)[number]> =>
                            !generalOptionItems.includes(v as never)
                    )
                    .map((optionId: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>, index: number): JSX.Element => {
                        const optionElementId = `LocationRangeInputDialogOptionList_optionItem_to_${dialogTimestamp}_${index}_${optionId}`;
                        switch (optionId) {
                            case "chunkX":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Chunk X</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="chunkX"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "chunkZ":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Chunk Z</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="chunkZ"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "subchunkIndex":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Subchunk Index</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="subchunkIndex"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            min={0}
                                            max={15}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "x":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>X</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="x"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "y":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Y</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="y"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            case "z":
                                return (
                                    <div class="LocationRangeInputDialogOptionList_optionItemGroup">
                                        <label for={optionElementId}>Z</label>
                                        <input
                                            type="number"
                                            step="1"
                                            id={optionElementId}
                                            class="LocationRangeInputDialogOptionList_optionItem LocationRangeInputDialogOptionList_optionItem_to LocationRangeInputDialogOptionList_textInputOptionItem"
                                            data-optionid="z"
                                            data-optionvalue={0}
                                            data-optionvaluetype="number"
                                            value={0}
                                            defaultValue={0}
                                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                                if (!optionListToRef.current) return;
                                                event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                                            }}
                                        />
                                    </div>
                                );
                            default:
                                throw new Error(`Unknown option ID: ${optionId as string}.`);
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
                        if (!optionListGeneralRef.current || !optionListFromRef.current || !optionListToRef.current) return;
                        const optionElementsGeneral: HTMLElement[] = Array.from(
                            optionListGeneralRef.current.querySelectorAll(".LocationRangeInputDialogOptionList_optionItem_general")
                        );
                        const optionElementsFrom: HTMLElement[] = Array.from(
                            optionListFromRef.current.querySelectorAll(".LocationRangeInputDialogOptionList_optionItem_from")
                        );
                        const optionElementsTo: HTMLElement[] = Array.from(
                            optionListToRef.current.querySelectorAll(".LocationRangeInputDialogOptionList_optionItem_to")
                        );
                        const data = {
                            from: Object.fromEntries(
                                props.options
                                    .filter(
                                        (option: O): option is Exclude<O, (typeof generalOptionItems)[number]> => !generalOptionItems.includes(option as never)
                                    )
                                    .map(
                                        (
                                            option: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>
                                        ): [option: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>, value: unknown] => {
                                            const optionElement: HTMLElement | undefined = optionElementsFrom.find(
                                                (element) => element.dataset.optionid === option
                                            );
                                            if (!optionElement) throw new ReferenceError(`Option element not found for option ID ${option} in from section.`);
                                            const optionValueType = optionElement.dataset.optionvaluetype as "string" | "number";
                                            switch (optionValueType) {
                                                case "string":
                                                    return [option, optionElement.dataset.optionvalue];
                                                case "number":
                                                    return [option, Number(optionElement.dataset.optionvalue)];
                                                default:
                                                    throw new Error(`Unknown option value type ${optionValueType as string}.`);
                                            }
                                        }
                                    )
                            ) as LocationRangeInputPromptOptionItemsToDataObject<O>["from"],
                            to: Object.fromEntries(
                                props.options
                                    .filter(
                                        (option: O): option is Exclude<O, (typeof generalOptionItems)[number]> => !generalOptionItems.includes(option as never)
                                    )
                                    .map(
                                        (
                                            option: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>
                                        ): [option: Exclude<LocationRangeInputPromptOptionItem, (typeof generalOptionItems)[number]>, value: unknown] => {
                                            const optionElement: HTMLElement | undefined = optionElementsTo.find(
                                                (element) => element.dataset.optionid === option
                                            );
                                            if (!optionElement) throw new ReferenceError(`Option element not found for option ID ${option} in to section.`);
                                            const optionValueType = optionElement.dataset.optionvaluetype as "string" | "number";
                                            switch (optionValueType) {
                                                case "string":
                                                    return [option, optionElement.dataset.optionvalue];
                                                case "number":
                                                    return [option, Number(optionElement.dataset.optionvalue)];
                                                default:
                                                    throw new Error(`Unknown option value type ${optionValueType as string}.`);
                                            }
                                        }
                                    )
                            ) as LocationRangeInputPromptOptionItemsToDataObject<O>["to"],
                            ...(Object.fromEntries(
                                props.options
                                    .filter((option: O): option is Extract<O, (typeof generalOptionItems)[number]> =>
                                        generalOptionItems.includes(option as never)
                                    )
                                    .map((option: (typeof generalOptionItems)[number]): [option: (typeof generalOptionItems)[number], value: unknown] => {
                                        const optionElement: HTMLElement | undefined = optionElementsGeneral.find(
                                            (element) => element.dataset.optionid === option
                                        );
                                        if (!optionElement) throw new ReferenceError(`Option element not found for option ID ${option} in general section.`);
                                        const optionValueType = optionElement.dataset.optionvaluetype as "string" | "number";
                                        switch (optionValueType) {
                                            case "string":
                                                return [option, optionElement.dataset.optionvalue];
                                            case "number":
                                                return [option, Number(optionElement.dataset.optionvalue)];
                                            default:
                                                throw new Error(`Unknown option value type ${optionValueType as string}.`);
                                        }
                                    })
                            ) as Pick<LocationRangeInputPromptOptionItemsToDataObject<O>, Extract<O, keyof LocationRangeInputPromptOptionItemResults>>),
                        } satisfies LocationRangeInputPromptOptionItemsToDataObject<O>;
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
 * Shows a dialog for inputting a location range.
 *
 * @param options The options for the dialog.
 * @returns A promise that resolves with the result of the dialog.
 */
export default async function showLocationRangeInputDialog<O extends LocationRangeInputPromptOptionItem>(
    options: ShowLocationRangeInputDialogOptions<O>
): Promise<ShowLocationRangeInputDialogResult<O>> {
    return await new Promise((resolve: (value: ShowLocationRangeInputDialogResult<O>) => void): void => {
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
            <LocationRangeInputDialog
                {...options}
                onSubmit={(data: LocationRangeInputPromptOptionItemsToDataObject<O>): void => {
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
