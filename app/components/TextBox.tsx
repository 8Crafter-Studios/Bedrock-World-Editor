import mergeRefs from "merge-refs";
import type { JSX, RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

export interface TextBoxProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: never;
    onChange?: (this: HTMLInputElement, ev: Event) => any;
    onInput?: JSX.InputEventHandler<HTMLInputElement>;
    label: string;
    description?: JSX.Element | JSX.Element[] | string;
    inputProperties?: JSX.InputHTMLAttributes<HTMLInputElement> & { [key: PropertyKey]: unknown };
    inputStyle?: JSX.CSSProperties;
    inputRef?: RefObject<HTMLInputElement>;
    inputTitleText?: string;
    placeholder?: string;
    value?: string;
    required?: boolean;
    popupHelpInfo?: JSX.Element | JSX.Element[] | string;
}

export default function TextBox(props: TextBoxProps): JSX.SpecificElement<"div"> {
    const inputRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
    const popupHelpInfoRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): (() => void) => {
        if (inputRef.current && props.onChange) {
            inputRef.current.addEventListener("change", props.onChange);
        }
        return (): void => {
            if (inputRef.current && props.onChange) {
                inputRef.current.removeEventListener("change", props.onChange);
            }
        };
    });
    return (
        <label style={{ display: "block", marginBottom: "calc((1px * var(--gui-scale)) + 1px)" }}>
            <label
                class={"nsel ndrg" + (props.popupHelpInfo ? " text-box-popup-help-info-label" : "")}
                onMouseOver={(event: JSX.TargetedMouseEvent<HTMLLabelElement>): void => {
                    if (!popupHelpInfoRef.current) return;
                    popupHelpInfoRef.current.style.top = `${event.clientY}px`;
                    popupHelpInfoRef.current.style.left = `${event.clientX}px`;
                }}
                onMouseMove={(event: JSX.TargetedMouseEvent<HTMLLabelElement>): void => {
                    if (!popupHelpInfoRef.current) return;
                    popupHelpInfoRef.current.style.top = `${event.clientY}px`;
                    popupHelpInfoRef.current.style.left = `${event.clientX}px`;
                }}
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: "calc((2px * var(--gui-scale)) + 1px)",
                }}
            >
                <span class="nsel ndrg text-box-title-label">{props.label}</span>
                {props.popupHelpInfo && (
                    <img
                        title="Help"
                        src="resource://images/ui/glyphs/Information_9x9.png"
                        style={{
                            width: "calc(9px * var(--gui-scale))",
                            imageRendering: "pixelated",
                            marginLeft: "calc(3px * var(--gui-scale))",
                        }}
                    />
                )}
            </label>
            {props.popupHelpInfo && (
                <div
                    ref={popupHelpInfoRef}
                    class="nsel ndrg"
                    style={{
                        display: "block",
                        position: "fixed",
                    }}
                >
                    <purple-border_background>
                        <div style={{ padding: "calc(6px * var(--gui-scale))", wordBreak: "break-word" }}>
                            {typeof props.popupHelpInfo === "string" ? props.popupHelpInfo.replaceAll(/(?<!^|\s)(?!$|\s)/g, "\xAD") : props.popupHelpInfo}
                        </div>
                    </purple-border_background>
                </div>
            )}
            <input
                title={props.inputTitleText}
                type="text"
                class="form-control"
                style={{
                    width: "-webkit-fill-available",
                    ...props.inputStyle,
                }}
                ref={mergeRefs(inputRef, props.inputRef)}
                onInput={props.onInput}
                placeholder={props.placeholder}
                value={props.value}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellcheck={false}
                inputMode="text"
                required={props.required}
                aria-autocomplete="none"
                {...props.inputProperties}
            />
            {props.description && typeof props.description === "string" ? (
                <div>{props.description}</div>
            ) : props.description instanceof Array ? (
                props.description
            ) : (
                props.description
            )}
            <div class="text-box-error-message" style={{ display: "none", color: "red", fontFamily: "Monocraft" }}></div>
        </label>
    );
}
