import type { JSX } from "preact";
import _React from "preact/compat";
import { integrations } from "../integrations";

console.log(integrations); // DEBUG: This is to allow testing the functionality manually through the DevTools console.

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
