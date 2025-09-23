import mergeRefs from "merge-refs";
import type { JSX, RefObject } from "preact";
import _React, { useRef, useEffect, Component } from "preact/compat";

/**
 * The props for a dropdown component.
 */
export interface DropdownProps<T extends string = string> {
    /**
     * The label of the dropdown, this is displayed above the dropdown.
     */
    label: string;
    /**
     * The id of the dropdown.
     */
    id: string;
    /**
     * The options for the dropdown.
     */
    options: DropdownOption<T>[];
    /**
     * The minimum width of the dropdown.
     *
     * @default "50px"
     */
    minWidth?: string;
    /**
     * This is the function that is called when an option is selected.
     *
     * @param value The value of the selected option.
     *
     * @default undefined
     */
    onChange?(value: T): void;
    /**
     * Whether the dropdown is initially disabled.
     *
     * Setting this will true will set the `disabled` property of the {@link dropdownButtonRef | dropdown button} to true.
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * This is the span element that contains the text displayed in the {@link dropdownButtonRef | dropdown button}.
     *
     * @default undefined
     */
    selectedOptionTextDisplayRef?: RefObject<HTMLSpanElement>;
    /**
     * This is the div that contains the dropdown contents.
     *
     * Inside of this is a single div element that contains div elements for each option,
     * each of these div elements contains and input (a hidden radio input element that is
     * checked when the option is selected), div (the thing that renders the checkbox image),
     * and label (the option's label).
     *
     * @default undefined
     */
    dropdownContentsRef?: RefObject<HTMLDivElement>;
    /**
     * This is the button that shows/hides the dropdown.
     *
     * This is what you disable to disable the dropdown.
     *
     * @default undefined
     */
    dropdownButtonRef?: RefObject<HTMLButtonElement>;
}

/**
 * A dropdown.
 *
 * If you need to dynamically disable or enable the dropdown, you just set the dropdown button to be disabled.
 *
 * @param props The props for the dropdown.
 * @returns The dropdown component.
 */
export default function Dropdown<T extends string = string>(props: DropdownProps<T>): JSX.Element {
    const selectedOptionTextDisplayRef: RefObject<HTMLSpanElement> = useRef<HTMLSpanElement>(null);
    const dropdownButtonRef: RefObject<HTMLButtonElement> = useRef<HTMLButtonElement>(null);
    function onChange(value: T): void {
        selectedOptionTextDisplayRef.current!.textContent =
            props.options.find((option: DropdownOption): boolean | undefined => option.value === value)?.label ?? null;
        props.onChange?.(value);
    }
    return (
        <div class="mcdropdown nsel" id={props.id} style="display: inline-block">
            <label>{props.label}</label>
            <br />
            <button
                class="btn dropdownbutton even-button-padding"
                data-dropdown-component="dropdownbutton"
                type="button"
                onTouchStart={(): void => {}}
                style={`min-width: calc(${props.minWidth ?? "50px"} * var(--gui-scale)); text-align: left;`}
                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                    if (event.currentTarget.disabled) return;
                    SoundEffects.popB();
                }}
                onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                    event.preventDefault();
                    if (event.currentTarget.disabled) return;
                    if (event.currentTarget.parentElement?.querySelector('[data-dropdown-component="dropdowncontents"]')?.hasAttribute("hidden")) {
                        event.currentTarget.querySelector("[data-dropdown-component='cv']")?.setAttribute("hidden", "");
                        event.currentTarget.querySelector("[data-dropdown-component='cvsel']")?.removeAttribute("hidden");
                        event.currentTarget.parentElement?.querySelector('[data-dropdown-component="dropdowncontents"]')?.removeAttribute("hidden");
                    } else {
                        event.currentTarget.querySelector("[data-dropdown-component='cv']")?.removeAttribute("hidden");
                        event.currentTarget.querySelector("[data-dropdown-component='cvsel']")?.setAttribute("hidden", "");
                        event.currentTarget.parentElement?.querySelector('[data-dropdown-component="dropdowncontents"]')?.setAttribute("hidden", "");
                    }
                }}
                disabled={props.disabled}
                ref={mergeRefs(dropdownButtonRef, props.dropdownButtonRef)}
            >
                <span data-dropdown-component="selectedOptionTextDisplay" ref={mergeRefs(selectedOptionTextDisplayRef, props.selectedOptionTextDisplayRef)}>
                    {props.options.find((option: DropdownOption): boolean | undefined => option.default)?.label}
                </span>
                <div
                    style={`width: calc(11px * var(--gui-scale) + (9 * var(--gui-scale) * 1px) - (var(--gui-scale) * 1px - 1px)); /* height: calc(11px * var(--gui-scale));  */margin: 0px; padding: 0px; display: inline-block;`}
                ></div>
                <img
                    data-dropdown-component="cv"
                    src="resource://images/ui/dropdown/dropdown_chevron.png"
                    inert
                    class="nsel"
                    style="right: calc((9 * var(--gui-scale) * 1px) - (var(--gui-scale) * 1px - 1px)); top: round(down, calc((calc(calc((29 * var(--gui-scale)) - 2) * 1px) - (11px * var(--gui-scale))) / 2) - 2px, 1px); position: absolute; width: calc(11px * var(--gui-scale))"
                />
                <img
                    data-dropdown-component="cvsel"
                    src="resource://images/ui/dropdown/dropdown_chevron_up.png"
                    inert
                    class="nsel"
                    style="right: calc((9 * var(--gui-scale) * 1px) - (var(--gui-scale) * 1px - 1px)); top: round(down, calc((calc(calc((29 * var(--gui-scale)) - 2) * 1px) - (11px * var(--gui-scale))) / 2) - 2px, 1px); position: absolute; width: calc(11px * var(--gui-scale))"
                    hidden
                />
                <style>
                    {`.dark_theme [data-dropdown-component="cv"], .dark_theme [data-dropdown-component="cvsel"]{
    filter: invert();
}`}
                </style>
            </button>
            <div data-dropdown-component="dropdowncontents" class="dropdowncontents" hidden style="display: flex;" ref={props.dropdownContentsRef}>
                <div style="flex-grow: 1; width: 0;">
                    {...props.options.map((option: DropdownOption): JSX.SpecificElement<"div"> => {
                        return (
                            <div
                                ref={option.ref}
                                data-dropdown-component="dropdownoption"
                                class="mcdropdownoption"
                                onTouchStart={(): void => {}}
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLInputElement>): void => {
                                    if (dropdownButtonRef.current?.disabled) return;
                                    const radioInput: Element | null = event.currentTarget.querySelector("input[type='radio']");
                                    if (radioInput instanceof HTMLInputElement && !radioInput.disabled) {
                                        SoundEffects.popB();
                                    }
                                }}
                                onClick={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                    event.preventDefault();
                                    if (dropdownButtonRef.current?.disabled) return;
                                    const radioInput: Element | null = event.currentTarget.querySelector("input[type='radio']");
                                    if (radioInput instanceof HTMLInputElement && !radioInput.disabled) {
                                        radioInput.checked = true;
                                        onChange(option.value as T);
                                    }
                                }}
                            >
                                <input
                                    type="radio"
                                    name={props.id}
                                    id={`dropdownOption_${props.id}_${option.value}`}
                                    value={option.value}
                                    class="mcradio"
                                    checked={option.default}
                                />
                                <div class="mcradiocheckbox"></div>
                                <label for={`dropdownOption_${props.id}_${option.value}`}>{option.label}</label>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export interface DropdownOption<T extends string = string> {
    label: string;
    value: T;
    default?: boolean;
    ref?: RefObject<HTMLDivElement>;
}
