import type { JSX } from "preact";
import _React from "preact/compat";
import GenericNBTEditorTab from "./genericNBTEditor";

export interface WorldSettingsTabProps {
    tab: TabManagerSubTab;
}

export default function WorldSettingsTab(props: WorldSettingsTabProps): JSX.SpecificElement<"center"> {
    return (
        <GenericNBTEditorTab tab={props.tab} />
    );
}
