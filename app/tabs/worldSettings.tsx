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
 * This tab currently only allows you to edit `level.dat` but in the future is planned to have options for changing the world name, world icon, and other settings stored in other locations (like the `game_flatworldlayers` LevelDB key).
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function WorldSettingsTab(props: WorldSettingsTabProps): JSX.Element {
    // TODO: There should be an additional mode for this tab that has options for changing the world name and the world icon.
    return <GenericNBTEditorTab tab={props.tab} />;
}
