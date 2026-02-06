import type { JSX } from "preact";
import _React from "preact/compat";
import UnderConstruction from "./UnderConstruction";

export interface HexEditorProps {
    tab: TabManagerSubTab;
}

export default function HexEditor(props: HexEditorProps): JSX.SpecificElement<"div"> {
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <div style="flex: 1; overflow: auto;">
                <UnderConstruction subtitle="This editor is under construction." detail="The hex editor has not been implemented yet." />
            </div>
        </div>
    );
}
