import type { JSX } from "preact";
import _React from "preact/compat";

export default function NoneTab(): JSX.SpecificElement<"h1"> {
    return (
        <center>
            <h2 class="nsel">Select a tab from the left sidebar to get started.</h2>
        </center>
    );
}
