import type { JSX } from "preact";

/**
 * A tab contents cell that represents when the parsed data containing the value this cell represents is not available due to one or more arrays in the NBT exceeding the maximum allowed size.
 *
 * @returns The JSX element.
 */
export function TabContentsCell_NBTArraySizeLimitExceeded(): JSX.Element {
    // The title is included on both as a workaround for macOS.
    const hoverText = "Parsing was skipped because one or more arrays exceed the maximum allowed size.";
    return (
        <td title={hoverText}>
            <span title={hoverText} style="color: orange;">
                ⚠
            </span>
        </td>
    );
}
