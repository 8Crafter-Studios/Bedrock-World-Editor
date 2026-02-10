import type { JSX } from "preact";
import _React from "preact/compat";
import UnderConstruction from "../components/UnderConstruction";

export interface JSONEditorTabProps {
    tab: TabManagerSubTab;
}

export default function JSONEditorTab(props: JSONEditorTabProps): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <UnderConstruction subtitle="This editor is under construction." detail="The JSON editor has not been implemented yet." />
            </div>
        </div>
    );
}
