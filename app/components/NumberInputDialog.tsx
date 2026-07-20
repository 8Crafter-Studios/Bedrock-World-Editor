import { BrowserWindow } from "@electron/remote";
import type { Dimension, SubChunkIndexDimensionVectorXZ } from "mcbe-leveldb";
import type { JSX, RefObject, TargetedEvent } from "preact";
import { render, useEffect, useRef } from "preact/compat";

/**
 * Options for the {@link showNumberInputDialog} function.
 */
export interface ShowNumberInputDialogOptions {
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
     * The label of the option.
     *
     * @default "Number"
     */
    optionLabel?: string | undefined;
    /**
     * The step of the option.
     *
     * @default 1
     */
    optionStep?: number | undefined;
    /**
     * The default value of the option.
     *
     * @default 0
     */
    optionDefaultValue?: number | undefined;
    /**
     * The minimum value of the option.
     *
     * If not specified, there is no minimum value.
     */
    optionMinValue?: number | undefined;
    /**
     * The maximum value of the option.
     *
     * If not specified, there is no maximum value.
     */
    optionMaxValue?: number | undefined;
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
 * The result of the {@link showNumberInputDialog} function.
 */
export type ShowNumberInputDialogResult =
    | {
          canceled: false;
          value: number;
      }
    | {
          canceled: true;
      };

/**
 * Props for the {@link NumberInputDialog} component.
 */
export interface NumberInputDialogProps extends ShowNumberInputDialogOptions {
    onSubmit(value: number): void;
    onCancel(): void;
}

/**
 * Renders a dialog for inputting a number.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function NumberInputDialog(props: NumberInputDialogProps): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const optionListRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const dialogTimestamp: number = Date.now();
    return (
        <div class="NumberInputDialog" ref={containerRef}>
            {props.message !== undefined && <p>{props.message}</p>}
            <div class="NumberInputDialogOptionList" ref={optionListRef}>
                <div class="NumberInputDialogOptionList_optionItemGroup">
                    <label for={`NumberInputDialogOptionList_optionItem_${dialogTimestamp}_0_chosenNumber`}>{props.optionLabel ?? "Number"}</label>
                    <input
                        type="number"
                        step={props.optionStep ?? 1}
                        id={`NumberInputDialogOptionList_optionItem_${dialogTimestamp}_0_chosenNumber`}
                        class="NumberInputDialogOptionList_optionItem NumberInputDialogOptionList_textInputOptionItem"
                        data-optionid="chosenNumber"
                        data-optionvalue={props.optionDefaultValue ?? 0}
                        data-optionvaluetype="number"
                        value={props.optionDefaultValue ?? 0}
                        defaultValue={props.optionDefaultValue ?? 0}
                        min={props.optionMinValue}
                        max={props.optionMaxValue}
                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                            if (!optionListRef.current) return;
                            event.currentTarget.dataset.optionvalue = event.currentTarget.value;
                        }}
                    />
                </div>
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
                        const optionElements: HTMLElement[] = Array.from(optionListRef.current.querySelectorAll(".NumberInputDialogOptionList_optionItem"));
                        const optionElement: HTMLElement | undefined = optionElements.find((element) => element.dataset.optionid === "chosenNumber");
                        if (!optionElement) throw new ReferenceError(`Option element not found for option ID chosenNumber.`);
                        props.onSubmit(Number(optionElement.dataset.optionvalue));
                    }}
                >
                    {props.submitButtonText ?? "Submit"}
                </button>
            </div>
        </div>
    );
}

/**
 * Shows a dialog for inputting a number.
 *
 * @param options The options for the dialog.
 * @returns A promise that resolves with the result of the dialog.
 */
export default async function showNumberInputDialog(options: ShowNumberInputDialogOptions): Promise<ShowNumberInputDialogResult> {
    return new Promise((resolve: (value: ShowNumberInputDialogResult) => void): void => {
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
            <NumberInputDialog
                {...options}
                onSubmit={(value: number): void => {
                    render(null, innerContainer);
                    container.remove();
                    resolve({ canceled: false, value });
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
