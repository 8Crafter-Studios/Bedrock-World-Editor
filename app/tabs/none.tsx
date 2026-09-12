import type { JSX } from "preact";
import _React from "preact/compat";

/**
 * The start tab.
 *
 * This tab what is rendered when no tab is selected.
 *
 * It instructs the user to select a tab from the left sidebar to get started.
 *
 * @returns The JSX element.
 */
export default function NoneTab(): JSX.SpecificElement<"center"> {
    return (
        <center>
            <h2 class="nsel">Select a tab from the left sidebar to get started.</h2>
        </center>
    );
}
