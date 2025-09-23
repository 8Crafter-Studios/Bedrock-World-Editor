import type { JSX } from "preact";
import _React from "preact/compat";

export interface JSONEditorTabProps {
    tab: TabManagerSubTab;
}

export default function JSONEditorTab(props: JSONEditorTabProps): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <h2>The JSON editor has not been implemented yet.</h2>
            </div>
        </div>
    );
}
