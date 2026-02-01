import type { JSX } from "preact";
import _React from "preact/compat";
import { integrations } from "../integrations";

// DEBUG: This is to allow testing the functionality manually through the DevTools console.
// @ts-ignore: // TEMP
globalThis.integrations = integrations;
console.log(integrations);

export interface IntegrationsTabProps {
    tab: TabManagerTab;
}

export default function IntegrationsTab(props: IntegrationsTabProps): JSX.SpecificElement<"center"> {
    return (
        <center>
            <h2>The integrations tab has not been implemented yet.</h2>
        </center>
    );
}
