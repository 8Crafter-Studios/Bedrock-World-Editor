import type { RefObject, JSX } from "preact";

export interface CollapsibleSectionProps {
    children?: any;
    title: string;
    amount?: number;
    open?: boolean;
    containerRef?: RefObject<HTMLDivElement>;
    titleRef?: RefObject<HTMLDivElement>;
    amountRef?: RefObject<HTMLDivElement>;
    contentRef?: RefObject<HTMLDivElement>;
}

export default function CollapsibleSection(props: CollapsibleSectionProps): JSX.Element {
    return (
        <div class={`collapsible-section ${props.open ? "open" : ""}`} ref={props.containerRef}>
            <div class="collapsible-section-button button_container nsel ndrg">
                <button
                    type="button"
                    class="btn"
                    style={{ width: "100%", padding: "calc(((10px / 3) * var(--gui-scale)) + 1px) calc(((14px / 3) * var(--gui-scale)) + 1px)", display: "flex" }}
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
                        ref={props.titleRef}
                        style={{
                            fontFamily: "Minecraft-Ten",
                            fontSize: "calc(10px * var(--gui-scale))",
                            textAlign: "left",
                            flexGrow: 1,
                        }}
                    >
                        {props.title}
                    </div>
                    <div
                        class="collapsible-section-amount"
                        style={{
                            fontFamily: "Minecraft-Ten",
                            fontSize: "calc(10px * var(--gui-scale))",
                            textAlign: "right",
                            float: "right",
                            marginRight: "calc(14px * var(--gui-scale))",
                        }}
                        ref={props.amountRef}
                    >
                        {props.amount}
                    </div>
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/dark_plus.png"
                        class="piximg collapsible-section-closed-icon invert_on_dark_theme"
                        style={{ width: "calc(10px * var(--gui-scale))", height: "calc(10px * var(--gui-scale))", float: "right" }}
                    />
                    <img
                        aria-hidden="true"
                        src="resource://images/ui/glyphs/dark_minus.png"
                        class="piximg collapsible-section-open-icon invert_on_dark_theme"
                        style={{ width: "calc(10px * var(--gui-scale))", height: "calc(10px * var(--gui-scale))", float: "right" }}
                    />
                </button>
            </div>
            <div class="collapsible-section-content" ref={props.contentRef}>
                {props.children}
            </div>
        </div>
    );
}
