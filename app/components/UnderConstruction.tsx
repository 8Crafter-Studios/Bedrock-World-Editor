import type { CSSProperties, JSX } from "preact";
import _React from "preact/compat";
import type { ComponentMessageContents } from "./commonComponentUtils";

/**
 * Props for the {@link UnderConstruction} component.
 */
export interface UnderConstructionProps {
    /**
     * The title of the notice.
     *
     * This is displayed in a `<h1>` element at the top of the notice.
     *
     * If `null`, no title will be displayed.
     *
     * If a string, the title will be displayed as plain text.
     *
     * @default "Under Construction"
     */
    title?: ComponentMessageContents | string | null | undefined;
    /**
     * The subtitle of the notice.
     *
     * This is displayed in a `<p>` element below the title but above the image.
     *
     * If `null`, no subtitle will be displayed.
     *
     * If a string, the subtitle will be displayed as plain text.
     *
     * @default "This page is under construction."
     */
    subtitle?: ComponentMessageContents | string | null | undefined;
    /**
     * The detail of the notice.
     *
     * This is displayed in a `<p>` element below the image.
     *
     * If `null` or not specified, no detail will be displayed.
     *
     * If a string, the detail will be displayed as plain text.
     *
     * @default null
     */
    detail?: ComponentMessageContents | string | null | undefined;
    /**
     * The CSS styles for the container `<center>` element.
     *
     * If `null`, no styles will be applied.
     *
     * Specifying this as a string will disable the default styles.
     *
     * Specifying this as an object will merge the object with the default styles (any properties in the object will override the default styles).
     *
     * @default
     * ```ts
     * type defaultStyle = {
     *     width: "100%",
     *     height: "100%",
     * }
     * ```
     */
    style?: string | CSSProperties | null | undefined;
}

/**
 * Renders a notice that the page is under construction.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function UnderConstruction(props: UnderConstructionProps): JSX.SpecificElement<"center"> {
    const title: ComponentMessageContents | string | null = props.title === undefined ? "Under Construction" : props.title;
    const subtitle: ComponentMessageContents | string | null = props.subtitle === undefined ? "This page is under construction." : props.subtitle;
    const detail: ComponentMessageContents | string | null = props.detail === undefined ? null : props.detail;
    return (
        <center
            style={
                props.style === null ? undefined
                : typeof props.style === "string" ?
                    props.style
                :   {
                        display: "inline-block",
                        width: "-webkit-fill-available",
                        height: "-webkit-fill-available",
                        ...props.style,
                    }

            }
        >
            {title !== null &&
                (typeof title === "string" ? <h1>{title}</h1>
                : title.type === "text" ? <h1>{title.content}</h1>
                : <h1 dangerouslySetInnerHTML={{ __html: title.content }} />)}
            {subtitle !== null &&
                (typeof subtitle === "string" ? <p>{subtitle}</p>
                : subtitle.type === "text" ? <p>{subtitle.content}</p>
                : <p dangerouslySetInnerHTML={{ __html: subtitle.content }} />)}
            <img
                class="piximg ndrg nsel"
                // REVIEW: Figure out if the max zoom should be 1x, 2x, 3x, or 4x (currently it is set to 2x).
                style={{ width: "min(calc(100% - mod(100%, 260px)), 260px * 2)" }}
                aria-hidden="true"
                src="resource://images/ui/art/under_construction.png"
            />
            {detail !== null &&
                (typeof detail === "string" ? <p>{detail}</p>
                : detail.type === "text" ? <p>{detail.content}</p>
                : <p dangerouslySetInnerHTML={{ __html: detail.content }} />)}
        </center>
    );
}
