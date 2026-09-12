import type { JSX } from "preact";
import _React from "preact/compat";
import UnderConstruction from "../components/UnderConstruction";

/**
 * Props for the {@link JSONEditorTab} component.
 */
export interface JSONEditorTabProps {
    tab: TabManagerSubTab;
}

/**
 * The JSON editor tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 *
 * @todo
 */
export default function JSONEditorTab(props: JSONEditorTabProps): JSX.SpecificElement<"div"> {
    void props; // TEMP
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <UnderConstruction subtitle="This editor is under construction." detail="The JSON editor has not been implemented yet." />
            </div>
        </div>
    );
}
