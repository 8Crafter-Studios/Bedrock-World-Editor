import type { RefObject, JSX } from "preact";

/**
 * Props for the {@link CollapsibleSection} component.
 */
export interface CollapsibleSectionProps {
    children?: any;
    title: string;
    // amount?: number;
    open?: boolean;
    containerRef?: RefObject<HTMLDivElement>;
    titleRef?: RefObject<HTMLDivElement>;
    // amountRef?: RefObject<HTMLDivElement>;
    contentRef?: RefObject<HTMLDivElement>;
}

/**
 * A collapsible section.
 *
 * @param props The props for the collapsible section.
 * @returns The JSX element for the collapsible section.
 */
export default function CollapsibleSection(props: CollapsibleSectionProps): JSX.Element {
    return (
        <div class={`collapsible-section ${props.open ? "open" : ""} widget-overlay`} style={{ height: "unset" }} ref={props.containerRef!}>
            <div class="collapsible-section-button button_container nsel ndrg">
                <button
                    type="button"
                    class="genericRoundButton"
                    style={{ width: "-webkit-fill-available", padding: "5px 6px", display: "flex" }}
                    onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
                        if (event.currentTarget.disabled) return;
                        SoundEffects.popB();
                    }}
                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
                        event.preventDefault();
                        if (event.currentTarget.disabled) return;
                        event.currentTarget.blur();
                        event.currentTarget.parentElement!.parentElement!.classList.toggle("open");
                    }}
                >
                    <div
                        class="collapsible-section-title"
                        ref={props.titleRef!}
                        style={{
                            textAlign: "left",
                        }}
                    >
                        {props.title}
                    </div>
                    {/* <div
                        class="collapsible-section-amount"
                        style={{
                            fontFamily: "Minecraft-Ten",
                            fontSize: "calc(10px * var(--gui-scale))",
                            textAlign: "right",
                            float: "right",
                            marginRight: "calc(14px * var(--gui-scale))",
                        }}
                        ref={props.amountRef!}
                    >
                        {props.amount}
                    </div> */}
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/Chevron-Right.png"
                        class="piximg collapsible-section-closed-icon invert_on_dark_theme"
                        style={{ width: "10px", height: "10px", margin: "auto 0 auto auto", float: "right" }}
                    />
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/Chevron-Down.png"
                        class="piximg collapsible-section-open-icon invert_on_dark_theme"
                        style={{ width: "10px", height: "10px", margin: "auto 0 auto auto", float: "right" }}
                    />
                </button>
            </div>
            <div class="collapsible-section-content" style={{ margin: "10px 11px" }} ref={props.contentRef!}>
                {props.children}
            </div>
        </div>
    );
}
