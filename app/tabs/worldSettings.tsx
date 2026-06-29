import type { JSX } from "preact";
import _React from "preact/compat";
import GenericNBTEditorTab from "./genericNBTEditor";

/**
 * Props for the {@link WorldSettingsTab} component.
 */
export interface WorldSettingsTabProps {
    tab: TabManagerSubTab;
}

/**
 * The world settings tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function WorldSettingsTab(props: WorldSettingsTabProps): JSX.Element {
    return <GenericNBTEditorTab tab={props.tab} />;
}
