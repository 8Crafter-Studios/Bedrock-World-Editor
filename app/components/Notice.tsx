import type { CSSProperties, JSX } from "preact";
import _React from "preact/compat";
import type { ComponentMessageContents } from "./commonComponentUtils";

/**
 * Props for the {@link Notice} component.
 */
export interface NoticeProps {
    /**
     * The title of the notice.
     *
     * This is displayed in a `<h1>` element at the top of the notice.
     *
     * If `null`, no title will be displayed.
     *
     * If a string, the title will be displayed as plain text.
     */
    title: ComponentMessageContents | string | null;
    /**
     * The subtitle of the notice.
     *
     * This is displayed in a `<p>` element below the title but above the image.
     *
     * If `null`, no subtitle will be displayed.
     *
     * If a string, the subtitle will be displayed as plain text.
     */
    subtitle: ComponentMessageContents | string | null;
    /**
     * The detail of the notice.
     *
     * This is displayed in a `<p>` element below the image.
     *
     * If `null` or not specified, no detail will be displayed.
     *
     * If a string, the detail will be displayed as plain text.
     */
    detail: ComponentMessageContents | string | null;
    /**
     * The path to the image to display in the notice.
     */
    image: NoticeImageID;
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

export type NoticeImageID =
    | "access_denied"
    | "connection_error"
    | "empty"
    | "feedback"
    | "generic_empty"
    | "generic_error"
    | "no_content"
    | "no_news"
    | "no_showcaseable"
    | "no_words_yet"
    | "nothing_to_see"
    | "search_error"
    | "under_construction_cropped"
    | "under_construction";

export const NOTICE_IMAGE_SIZES: Record<NoticeImageID, [width: number, height: number]> = {
    access_denied: [256, 96],
    connection_error: [128, 48],
    empty: [512, 192],
    feedback: [256, 96],
    generic_empty: [256, 96],
    generic_error: [260, 98],
    no_content: [256, 96],
    no_news: [260, 112],
    no_showcaseable: [128, 48],
    no_words_yet: [224, 96],
    nothing_to_see: [256, 96],
    search_error: [128, 48],
    under_construction_cropped: [192, 72],
    under_construction: [260, 72],
};

/**
 * Renders a notice.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function Notice(props: NoticeProps): JSX.SpecificElement<"center"> {
    const title: ComponentMessageContents | string | null = props.title;
    const subtitle: ComponentMessageContents | string | null = props.subtitle;
    const detail: ComponentMessageContents | string | null = props.detail;
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
                // REVIEW: Figure out if the max zoom should be 1x, 2x, 3x, or 4x (currently it is set to 4x).
                style={{
                    width: `min(calc(100% - mod(100%, ${NOTICE_IMAGE_SIZES[props.image][0]}px)), ${NOTICE_IMAGE_SIZES[props.image][0]}px * ${Math.floor((4 * 260) / NOTICE_IMAGE_SIZES[props.image][0])})`,
                }}
                aria-hidden="true"
                src={`resource://images/ui/art/${props.image}.png`}
            />
            {detail !== null &&
                (typeof detail === "string" ? <p>{detail}</p>
                : detail.type === "text" ? <p>{detail.content}</p>
                : <p dangerouslySetInnerHTML={{ __html: detail.content }} />)}
        </center>
    );
}
