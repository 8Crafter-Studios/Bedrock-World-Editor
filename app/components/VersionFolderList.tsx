// @ts-nocheck This file is not ready for use yet, it should be ignored for now.
// @eslint-ignore

import type { JSX } from "preact";
import ItemListItem, { ItemListItemColumn } from "./ItemListItem";
import ItemList, { type ItemListOptions } from "./ItemList";
import type { VersionFolder } from "../../src/utils/InstallationManager";
const { Menu } = require("@electron/remote") as typeof import("@electron/remote");

export interface VersionFolderOptionsMenuItemConstructorOptions extends Omit<Electron.MenuItemConstructorOptions, "click"> {
    click?: (
        menuItem: Electron.MenuItem & {
            readonly folderPath: string;
        },
        window: Electron.BrowserWindow,
        event: Electron.Event
    ) => void;
}

export interface VersionFolderListOptions extends Omit<ItemListOptions, "tableHeaders"> {
    versionFolders: VersionFolder[];
    optionsList: VersionFolderOptionsMenuItemConstructorOptions[] | ((versionFolder: VersionFolder) => VersionFolderOptionsMenuItemConstructorOptions[]);
}

export default function VersionFolderList(
    options: VersionFolderListOptions
): JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & VersionFolderListOptions> {
    function getOptionsMenuForVersionFolder(versionFolder: VersionFolder): Electron.Menu {
        const optionsList: VersionFolderOptionsMenuItemConstructorOptions[] =
            typeof options.optionsList === "function" ? options.optionsList(versionFolder) : options.optionsList;
        return Menu.buildFromTemplate(optionsList as Electron.MenuItemConstructorOptions[]);
    }
    return (
        <ItemList
            headerInfoLabels={
                options.headerInfoLabels ?? {
                    left: {
                        defaultText: `${options.versionFolders.length} Version${options.versionFolders.length === 1 ? "" : "s"}`,
                    },
                }
            }
            headerTitle={options.headerTitle ?? "Versions"}
            tableHeaders={[
                { label: "Version", width: "40%", paddingOverride: "0" },
                { label: "Installation Status", width: "60%" },
            ]}
            wrapperId={options.wrapperId}
        >
            {options.versionFolders.length === 0 && (
                <>
                    No Minecraft versions detected.
                    <br />
                    Please verify you are using a custom launcher such as <a href="https://bedrocklauncher.github.io/">bedrock launcher</a>. If you have another
                    launcher, please go to <code>{"Preferences > Installing"}</code> and add the folder containing all of your Minecraft version folders to the{" "}
                    <code>Version Folder Search Locations</code> list.
                </>
            )}
            {...options.versionFolders.map(
                (versionFolder: VersionFolder): JSX.Element => (
                    <VersionFolderListItem
                        displayVersionColoredHTML={versionFolder.getDisplayVersionColoredHTML()}
                        versionFolderPath={versionFolder.path}
                        installationStatus={
                            versionFolder.installationStatus +
                            (versionFolder.installationStatus === "Installed" || versionFolder.installationStatus === "Partially Failed Installation"
                                ? ` (v${versionFolder.installedVersion})` + (versionFolder.getIsUpdateAvailable() ? " (Update Available)" : "")
                                : "")
                        }
                        onOptionsButtonMouseDown={(): void => {
                            SoundEffects.popB();
                        }}
                        onOptionsButtonClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            getOptionsMenuForVersionFolder(versionFolder).popup({
                                window: getCurrentWindow(),
                                x: event.clientX,
                                y: event.clientY,
                            });
                        }}
                    />
                )
            )}
        </ItemList>
    );
}

interface VersionFolderListItemOptions {
    displayVersion?: string;
    displayVersionColoredHTML?: string;
    versionFolderPath: string;
    installationStatus: string;
    onOptionsButtonMouseDown?: JSX.MouseEventHandler<HTMLButtonElement>;
    onOptionsButtonClick: JSX.MouseEventHandler<HTMLButtonElement>;
}

export function VersionFolderListItem(
    options: VersionFolderListItemOptions
): JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & VersionFolderListItemOptions> {
    return (
        <ItemListItem headerSizes={["40%", "60%"]}>
            <ItemListItemColumn containerType="Span" contentType={options.displayVersionColoredHTML ? "RawHTML" : "Text"}>
                {options.displayVersionColoredHTML ? options.displayVersionColoredHTML : options.displayVersion}
            </ItemListItemColumn>
            <ItemListItemColumn containerType="None" contentType="Other">
                {/* <textarea
                name="structurename"
                autocapitalize="off"
                autocomplete="off"
                spellcheck={false}
                inputmode="text"
                required
                rows={1}
                {...{ pattern: "/[^:/]+:[^:]+/" }}
                class="form-control"
                style="margin-left: 10px; width: calc(100% - 47px); max-width: calc(100% - 47px); height: -webkit-fill-available;"
                data-value="structurename"
            ></textarea> */}
                <span style="padding: 8.5px 0px; display: inline-block; margin-left: 10px;">{options.installationStatus}</span>
                <button
                    type="button"
                    class="btn nsel"
                    name="options"
                    title="Options"
                    style="float: right; margin: 3px 0px; display: flex/* ; transform: translate(0, 50%) */; padding: calc(2.5px * var(--gui-scale));"
                    onMouseDown={options.onOptionsButtonMouseDown}
                    onClick={options.onOptionsButtonClick}
                >
                    <only_visible_on_themes light blue>
                        <img
                            width="16"
                            height="16"
                            src="resource://images/ui/glyphs/Options-Horizontal.png"
                            style="image-rendering: pixelated; filter: invert(); width: calc(8px * var(--gui-scale)); height: calc(8px * var(--gui-scale));"
                            aria-hidden="true"
                        ></img>
                    </only_visible_on_themes>
                    <only_visible_on_themes dark>
                        <img
                            width="16"
                            height="16"
                            src="resource://images/ui/glyphs/Options-Horizontal.png"
                            style="image-rendering: pixelated; width: calc(8px * var(--gui-scale)); height: calc(8px * var(--gui-scale));"
                            aria-hidden="true"
                        ></img>
                    </only_visible_on_themes>
                </button>
            </ItemListItemColumn>
        </ItemListItem>
    );
}
