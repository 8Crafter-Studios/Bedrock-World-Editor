import type { JSX, RefObject, TargetedEvent } from "preact";
import _React, { hydrate, render, useEffect, useRef } from "preact/compat";
import UnderConstruction from "../components/UnderConstruction";
import { createObservable, type Observable } from "../../src/utils/miscUtils";
import Notice from "../components/Notice";
import type { OpenDialogReturnValue } from "electron";
import { dialog } from "@electron/remote";
import CollapsibleSection from "../components/CollapsibleSection";
import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import path from "node:path";

/**
 * A settings tab for the {@link SettingsPage | settings page}.
 */
type SettingsTab = "general" | "video" | "audio" | "integrations" | "advanced" | "debug";

/**
 * The settings page.
 *
 * @returns The JSX element.
 */
export default function SettingsPage(): JSX.Element {
    const containerRef: RefObject<HTMLElement> = useRef(null);
    const selectedTab: Observable<SettingsTab> = createObservable<SettingsTab>("general");
    selectedTab.observe((): void => {
        if (containerRef.current === null) return;
        render(null, containerRef.current);
        render(<SettingsTabRenderer selectedTab={selectedTab.get()} />, containerRef.current);
    });
    return (
        <div style="width: -webkit-fill-available; height: 0; flex: 1; display: flex; flex-direction: row;">
            <SettingsLeftSidebar selectedTab={selectedTab} />
            <main style="width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1;" id="main" ref={containerRef}>
                <SettingsTabRenderer selectedTab={selectedTab.get()} />
            </main>
        </div>
    );
}

/**
 * Props for the {@link SettingsTabRenderer} component.
 */
interface SettingsTabRendererProps {
    selectedTab: SettingsTab;
}

/**
 * Renders the current settings tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
function SettingsTabRenderer(props: SettingsTabRendererProps): JSX.Element {
    switch (props.selectedTab) {
        case "general":
            return (
                <div style="width: -webkit-fill-available; height: -webkit-fill-available; padding: 10px; display: flex; flex-direction: column; overflow: auto;">
                    <label
                        for="settings_general_showWorldSizesOnWorldList"
                        class="nsel ndrg"
                        title="Whether or not to show the world sizes on the world selector list on the main menu."
                    >
                        <input
                            id="settings_general_showWorldSizesOnWorldList"
                            type="checkbox"
                            checked={config.showWorldSizesOnWorldList}
                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                config.showWorldSizesOnWorldList = event.currentTarget.checked;
                            }}
                        />
                        Show World Sizes on World List
                    </label>
                    <br class="nsel ndrg" />
                    <label for="settings_general_fileSizeUnits" class="nsel ndrg">
                        File Size Units
                    </label>
                    <select
                        id="settings_general_fileSizeUnits"
                        class="nsel ndrg"
                        onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                            config.fileSizeUnits = event.currentTarget.value as typeof config.fileSizeUnits;
                        }}
                    >
                        <option value="binary" selected={config.fileSizeUnits === "binary"}>
                            Binary (KiB, MiB, GiB, etc.)
                        </option>
                        <option value="metric" selected={config.fileSizeUnits === "metric"}>
                            Metric (kB, MB, GB, etc.)
                        </option>
                    </select>
                    {process.platform === "darwin" && (
                        <>
                            <br class="nsel ndrg" />
                            <label
                                for="settings_general_quitOnCloseAllWindows"
                                class="nsel ndrg"
                                title="Whether to quit the application when all windows are closed. (Darwin (macOS) only)"
                            >
                                <input
                                    id="settings_general_quitOnCloseAllWindows"
                                    type="checkbox"
                                    checked={config.quitOnCloseAllWindows}
                                    onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                        config.quitOnCloseAllWindows = event.currentTarget.checked;
                                    }}
                                />
                                Quit When All Windows Are Closed
                            </label>
                        </>
                    )}
                    <br class="nsel ndrg" />
                    <label class="nsel ndrg">Minecraft Data Folders</label>
                    <CollapsibleSection title="Help">
                        <p>The Minecraft data folders, should be globs.</p>
                        <p>
                            These are folders that will directly contain a <code>minecraftWorlds</code> or <code>worlds</code> folder containing all your
                            Minecraft world folders.
                        </p>
                        <p>These are shown on the start screen.</p>
                        <p>Globs containing symlinks are fully supported.</p>
                        <br />
                        <p>These globs support several environment variables.</p>
                        <p>The following variables are supported:</p>
                        <code>%appdata%</code> - This corresponds to the <code>APPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Roaming</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Roaming</code>).
                        <br />
                        <code>Home/</code> (Case sensitive) - This must be placed at the start of the glob to be used. This corresponds to the <code>HOME</code>{" "}
                        environment variable. This leads to your user folder on Windows, Linux, and macOS.
                        <br />
                        <code>%userprofile%</code> - This corresponds to the <code>USERPROFILE</code> environment variable. This leads to your user folder on
                        Windows.
                        <br />
                        <code>%programdata%</code> - This corresponds to the <code>ProgramData</code> environment variable. This leads to your{" "}
                        <code>ProgramData</code> folder on Windows (ex. <code>C:\ProgramData</code>).
                        <br />
                        <code>%programfiles%</code> - This corresponds to the <code>ProgramFiles</code> environment variable. This leads to your{" "}
                        <code>Program Files</code> folder on Windows (ex. <code>C:\Program Files</code>).
                        <br />
                        <code>%localappdata%</code> - This corresponds to the <code>LOCALAPPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Local</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Local</code>).
                        <br />
                        <code>%temp%</code> - This corresponds to the <code>TEMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmp%</code> - This corresponds to the <code>TMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmpdir%</code> - This corresponds to the <code>TMPDIR</code> environment variable. This leads to your temp folder on Linux and
                        macOS (ex. <code>/var/folders/cn/rqmj4cps1_10dkhr6krq0yww0000gn/T/</code>).
                        <br />
                        <code>%public%</code> - This corresponds to the <code>PUBLIC</code> environment variable. This leads to your public folder on Windows
                        (ex. <code>C:\Users\Public</code>).
                        <br />
                        <code>%Home%</code> - This corresponds to the <code>HOME</code> environment variable. This leads to your user folder on Windows, Linux,
                        and macOS.
                        <br />
                        <code>%APP_DATA_FOLDER_PATH%</code> - This corresponds to the app's data folder path (the path where the app stores all of its data,
                        such as configs, temporary world copies, etc.).
                    </CollapsibleSection>
                    <MinecraftWorldFoldersOption
                        configOption="minecraftDataFolders"
                        selectDialogOptions={{
                            buttonLabel: "Add to Minecraft Data Folders",
                            message: "Select a folder to add to the list of Minecraft data folders",
                            title: "Add Minecraft Data Folder",
                        }}
                    />
                    <br class="nsel ndrg" />
                    <label class="nsel ndrg">Isolated Minecraft Data Folders</label>
                    <CollapsibleSection title="Help">
                        <p>The isolated Minecraft data folders, should be globs.</p>
                        <p>
                            These are folders that directly contain all your Minecraft world folders. The app will not be able to access development resource or
                            behavior packs that worlds in these folders are using, only resource and behavior packs that are stored in the worlds files.
                        </p>
                        <p>These are shown on the start screen.</p>
                        <p>Globs containing symlinks are fully supported.</p>
                        <br />
                        <p>These globs support several environment variables.</p>
                        <p>The following variables are supported:</p>
                        <code>%appdata%</code> - This corresponds to the <code>APPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Roaming</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Roaming</code>).
                        <br />
                        <code>Home/</code> (Case sensitive) - This must be placed at the start of the glob to be used. This corresponds to the <code>HOME</code>{" "}
                        environment variable. This leads to your user folder on Windows, Linux, and macOS.
                        <br />
                        <code>%userprofile%</code> - This corresponds to the <code>USERPROFILE</code> environment variable. This leads to your user folder on
                        Windows.
                        <br />
                        <code>%programdata%</code> - This corresponds to the <code>ProgramData</code> environment variable. This leads to your{" "}
                        <code>ProgramData</code> folder on Windows (ex. <code>C:\ProgramData</code>).
                        <br />
                        <code>%programfiles%</code> - This corresponds to the <code>ProgramFiles</code> environment variable. This leads to your{" "}
                        <code>Program Files</code> folder on Windows (ex. <code>C:\Program Files</code>).
                        <br />
                        <code>%localappdata%</code> - This corresponds to the <code>LOCALAPPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Local</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Local</code>).
                        <br />
                        <code>%temp%</code> - This corresponds to the <code>TEMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmp%</code> - This corresponds to the <code>TMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmpdir%</code> - This corresponds to the <code>TMPDIR</code> environment variable. This leads to your temp folder on Linux and
                        macOS (ex. <code>/var/folders/cn/rqmj4cps1_10dkhr6krq0yww0000gn/T/</code>).
                        <br />
                        <code>%public%</code> - This corresponds to the <code>PUBLIC</code> environment variable. This leads to your public folder on Windows
                        (ex. <code>C:\Users\Public</code>).
                        <br />
                        <code>%Home%</code> - This corresponds to the <code>HOME</code> environment variable. This leads to your user folder on Windows, Linux,
                        and macOS.
                        <br />
                        <code>%APP_DATA_FOLDER_PATH%</code> - This corresponds to the app's data folder path (the path where the app stores all of its data,
                        such as configs, temporary world copies, etc.).
                    </CollapsibleSection>
                    <MinecraftWorldFoldersOption
                        configOption="isolatedMinecraftWorldsFolders"
                        selectDialogOptions={{
                            buttonLabel: "Add to Extra Minecraft Data Folders",
                            message: "Select a folder to add to the list of extra Minecraft data folders",
                            title: "Add Extra Minecraft Data Folder",
                        }}
                    />
                    <br class="nsel ndrg" />
                    <label class="nsel ndrg">Extra Minecraft Data Folders</label>
                    <CollapsibleSection title="Help">
                        <p>The extra Minecraft data folders, should be globs.</p>
                        <p>
                            These are folders that will directly contain a <code>minecraftWorlds</code> or <code>worlds</code> folder containing all your
                            Minecraft world folders.
                        </p>
                        <p>
                            These are <b>not</b> shown on the start screen unless you click show more.
                        </p>
                        <p>Globs containing symlinks are fully supported.</p>
                        <br />
                        <p>These globs support several environment variables.</p>
                        <p>The following variables are supported:</p>
                        <code>%appdata%</code> - This corresponds to the <code>APPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Roaming</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Roaming</code>).
                        <br />
                        <code>Home/</code> (Case sensitive) - This must be placed at the start of the glob to be used. This corresponds to the <code>HOME</code>{" "}
                        environment variable. This leads to your user folder on Windows, Linux, and macOS.
                        <br />
                        <code>%userprofile%</code> - This corresponds to the <code>USERPROFILE</code> environment variable. This leads to your user folder on
                        Windows.
                        <br />
                        <code>%programdata%</code> - This corresponds to the <code>ProgramData</code> environment variable. This leads to your{" "}
                        <code>ProgramData</code> folder on Windows (ex. <code>C:\ProgramData</code>).
                        <br />
                        <code>%programfiles%</code> - This corresponds to the <code>ProgramFiles</code> environment variable. This leads to your{" "}
                        <code>Program Files</code> folder on Windows (ex. <code>C:\Program Files</code>).
                        <br />
                        <code>%localappdata%</code> - This corresponds to the <code>LOCALAPPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Local</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Local</code>).
                        <br />
                        <code>%temp%</code> - This corresponds to the <code>TEMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmp%</code> - This corresponds to the <code>TMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmpdir%</code> - This corresponds to the <code>TMPDIR</code> environment variable. This leads to your temp folder on Linux and
                        macOS (ex. <code>/var/folders/cn/rqmj4cps1_10dkhr6krq0yww0000gn/T/</code>).
                        <br />
                        <code>%public%</code> - This corresponds to the <code>PUBLIC</code> environment variable. This leads to your public folder on Windows
                        (ex. <code>C:\Users\Public</code>).
                        <br />
                        <code>%Home%</code> - This corresponds to the <code>HOME</code> environment variable. This leads to your user folder on Windows, Linux,
                        and macOS.
                        <br />
                        <code>%APP_DATA_FOLDER_PATH%</code> - This corresponds to the app's data folder path (the path where the app stores all of its data,
                        such as configs, temporary world copies, etc.).
                    </CollapsibleSection>
                    <MinecraftWorldFoldersOption
                        configOption="extraMinecraftDataFolders"
                        selectDialogOptions={{
                            buttonLabel: "Add to Extra Minecraft Data Folders",
                            message: "Select a folder to add to the list of extra Minecraft data folders",
                            title: "Add Extra Minecraft Data Folder",
                        }}
                    />
                    <br class="nsel ndrg" />
                    <label class="nsel ndrg">Extra Isolated Minecraft Data Folders</label>
                    <CollapsibleSection title="Help">
                        <p>The extra isolated Minecraft data folders, should be globs.</p>
                        <p>
                            These are folders that directly contain all your Minecraft world folders. The app will not be able to access development resource or
                            behavior packs that worlds in these folders are using, only resource and behavior packs that are stored in the worlds files.
                        </p>
                        <p>
                            These are <b>not</b> shown on the start screen unless you click show more.
                        </p>
                        <p>Globs containing symlinks are fully supported.</p>
                        <br />
                        <p>These globs support several environment variables.</p>
                        <p>The following variables are supported:</p>
                        <code>%appdata%</code> - This corresponds to the <code>APPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Roaming</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Roaming</code>).
                        <br />
                        <code>Home/</code> (Case sensitive) - This must be placed at the start of the glob to be used. This corresponds to the <code>HOME</code>{" "}
                        environment variable. This leads to your user folder on Windows, Linux, and macOS.
                        <br />
                        <code>%userprofile%</code> - This corresponds to the <code>USERPROFILE</code> environment variable. This leads to your user folder on
                        Windows.
                        <br />
                        <code>%programdata%</code> - This corresponds to the <code>ProgramData</code> environment variable. This leads to your{" "}
                        <code>ProgramData</code> folder on Windows (ex. <code>C:\ProgramData</code>).
                        <br />
                        <code>%programfiles%</code> - This corresponds to the <code>ProgramFiles</code> environment variable. This leads to your{" "}
                        <code>Program Files</code> folder on Windows (ex. <code>C:\Program Files</code>).
                        <br />
                        <code>%localappdata%</code> - This corresponds to the <code>LOCALAPPDATA</code> environment variable. This leads to your{" "}
                        <code>AppData/Local</code> folder on Windows (ex. <code>C:\Users\USERNAME\AppData\Local</code>).
                        <br />
                        <code>%temp%</code> - This corresponds to the <code>TEMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmp%</code> - This corresponds to the <code>TMP</code> environment variable. This leads to your <code>Temp</code> folder on
                        Windows (ex. <code>C:\Users\USERNAME\AppData\Local\Temp</code>).
                        <br />
                        <code>%tmpdir%</code> - This corresponds to the <code>TMPDIR</code> environment variable. This leads to your temp folder on Linux and
                        macOS (ex. <code>/var/folders/cn/rqmj4cps1_10dkhr6krq0yww0000gn/T/</code>).
                        <br />
                        <code>%public%</code> - This corresponds to the <code>PUBLIC</code> environment variable. This leads to your public folder on Windows
                        (ex. <code>C:\Users\Public</code>).
                        <br />
                        <code>%Home%</code> - This corresponds to the <code>HOME</code> environment variable. This leads to your user folder on Windows, Linux,
                        and macOS.
                        <br />
                        <code>%APP_DATA_FOLDER_PATH%</code> - This corresponds to the app's data folder path (the path where the app stores all of its data,
                        such as configs, temporary world copies, etc.).
                    </CollapsibleSection>
                    <MinecraftWorldFoldersOption
                        configOption="extraIsolatedMinecraftWorldsFolders"
                        selectDialogOptions={{
                            buttonLabel: "Add to Extra Minecraft Data Folders",
                            message: "Select a folder to add to the list of extra Minecraft data folders",
                            title: "Add Extra Minecraft Data Folder",
                        }}
                    />
                </div>
            );
        case "video":
            return (
                <div style="width: -webkit-fill-available; height: -webkit-fill-available; padding: 10px; display: flex; flex-direction: column; overflow: auto;">
                    <label for="settings_video_theme" class="nsel ndrg">
                        Theme
                    </label>
                    <select
                        id="settings_video_theme"
                        class="nsel ndrg"
                        style="width: auto;"
                        onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                            config.theme = event.currentTarget.value as typeof config.theme;
                        }}
                    >
                        <option value="auto" selected={config.theme === "auto"}>
                            Auto
                        </option>
                        <option value="dark" selected={config.theme === "dark"}>
                            Dark
                        </option>
                        <option value="light" selected={config.theme === "light"}>
                            Light
                        </option>
                    </select>
                </div>
            );
        case "audio":
            return (
                <Notice
                    title="No Settings"
                    subtitle="This settings tab is empty."
                    detail={`The ${props.selectedTab} settings tab does not have any settings.`}
                    image="generic_empty"
                />
            );
        case "integrations":
            return (
                <UnderConstruction
                    subtitle="This settings tab is under construction."
                    detail={`The ${props.selectedTab} settings tab has not been implemented yet.`}
                />
            );
        case "advanced":
            return (
                <div style="width: -webkit-fill-available; height: -webkit-fill-available; padding: 10px; display: flex; flex-direction: column; overflow: auto;">
                    <label for="settings_advanced_useAsyncModeInEntryViews" class="nsel ndrg">
                        Use Async Mode in Entry Views
                    </label>
                    <select
                        id="settings_advanced_useAsyncModeInEntryViews"
                        class="nsel ndrg"
                        title="Whether to use async mode in entry views.

Async mode loads NBT data for entries only when the page containing them is selected or when searching through them.

It loads data as needed and unloads it after, this makes the initial view load faster and dramatically reduces memory usage, but makes it slightly slower to switch between pages, and makes searching through entries a lot slower.

- Auto: Automatically determine whether async mode should be used based on the number of entries in the view and the total number of LevelDB keys in the world.
- Always: Use async mode in entry views.
- Never: Don't use async mode in entry views."
                        onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                            config.useAsyncModeInEntryViews = event.currentTarget.value === "auto" ? "auto" : event.currentTarget.value === "true";
                        }}
                    >
                        <option value="auto" selected={config.useAsyncModeInEntryViews === "auto"}>
                            Auto
                        </option>
                        <option value="true" selected={config.useAsyncModeInEntryViews === true}>
                            Always
                        </option>
                        <option value="false" selected={config.useAsyncModeInEntryViews === false}>
                            Never
                        </option>
                    </select>
                    <br class="nsel ndrg" />
                    <label
                        for="settings_advanced_asyncModeEntryThreshold"
                        class="nsel ndrg"
                        title='When useAsyncModeInEntryViews is "auto", this is the number of entries in the view before async mode is used.'
                    >
                        Async Mode Entry Threshold
                    </label>
                    <input
                        id="settings_advanced_asyncModeEntryThreshold"
                        type="number"
                        min="1"
                        step="1"
                        value={config.asyncModeEntryThreshold}
                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                            config.asyncModeEntryThreshold = event.currentTarget.valueAsNumber;
                        }}
                    />
                    <br class="nsel ndrg" />
                    <label
                        for="settings_advanced_asyncModeTotalKeyCountThreshold"
                        class="nsel ndrg"
                        title='When useAsyncModeInEntryViews is "auto", this is the total number of LevelDB keys in the world before async mode is used.'
                    >
                        Async Mode Total Key Count Threshold
                    </label>
                    <input
                        id="settings_advanced_asyncModeTotalKeyCountThreshold"
                        type="number"
                        min="1"
                        step="1"
                        value={config.asyncModeTotalKeyCountThreshold}
                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                            config.asyncModeEntryThreshold = event.currentTarget.valueAsNumber;
                        }}
                    />
                    <br class="nsel ndrg" />
                    <label
                        for="settings_advanced_noLookupEntityDimensionDigestKeyThreshold"
                        class="nsel ndrg"
                        title="The number of Digest LevelDB keys in the world that will disable looking up the dimension of entities in the Entities left sidebar tab."
                    >
                        No Lookup Entity Dimension Digest Key Threshold
                    </label>
                    <input
                        id="settings_advanced_noLookupEntityDimensionDigestKeyThreshold"
                        type="number"
                        min="1"
                        step="1"
                        value={config.noLookupEntityDimensionDigestKeyThreshold}
                        onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                            config.noLookupEntityDimensionDigestKeyThreshold = event.currentTarget.valueAsNumber;
                        }}
                    />
                </div>
            );
        case "debug":
            return (
                <div style="width: -webkit-fill-available; height: -webkit-fill-available; padding: 10px; display: flex; flex-direction: column; overflow: auto;">
                    <label for="settings_debug_debugHUDDropShadow" class="nsel ndrg">
                        <input
                            id="settings_debug_debugHUDDropShadow"
                            type="checkbox"
                            checked={config.debugHUDDropShadow}
                            onChange={(event: TargetedEvent<HTMLInputElement, Event>): void => {
                                config.debugHUDDropShadow = event.currentTarget.checked;
                            }}
                        />
                        Debug HUD Drop Shadow
                    </label>
                    <br class="nsel ndrg" />
                    <label for="settings_debug_debugHUD" class="nsel ndrg">
                        Debug HUD
                    </label>
                    <select
                        id="settings_debug_debugHUD"
                        class="nsel ndrg"
                        onChange={(event: TargetedEvent<HTMLSelectElement, Event>): void => {
                            config.debugHUD = event.currentTarget.value as typeof config.debugHUD;
                        }}
                    >
                        <option value="none" selected={config.debugHUD === "none"}>
                            Off
                        </option>
                        <option value="top" selected={config.debugHUD === "top"}>
                            Top
                        </option>
                        <option value="basic" selected={config.debugHUD === "basic"}>
                            Basic
                        </option>
                        <option value="config" selected={config.debugHUD === "config"}>
                            Config
                        </option>
                        <option value="config_views" selected={config.debugHUD === "config_views"}>
                            Config (Views)
                        </option>
                        <option value="tab" selected={config.debugHUD === "tab"}>
                            Tab
                        </option>
                    </select>
                </div>
            );
        default:
            return <Notice title="Error" subtitle="Something went wrong..." detail={`Invalid settings tab: ${props.selectedTab}`} image="generic_error" />;
    }
}

/**
 * Props for the {@link SettingsLeftSidebar} component.
 */
interface SettingsLeftSidebarProps {
    selectedTab: Observable<SettingsTab>;
}

/**
 * The left sidebar for the settings page.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
function SettingsLeftSidebar(props: SettingsLeftSidebarProps): JSX.SpecificElement<"ul"> {
    let previousTab: SettingsTab = props.selectedTab.get();
    function onSubTabSwitch({ previousTab, newTab }: { previousTab: SettingsTab; newTab: SettingsTab }): void {
        $(`#settings_left_sidebar .sidebar_button[data-path-id=${previousTab}]`).removeClass("active");
        $(`#settings_left_sidebar .sidebar_button[data-path-id=${newTab}]`).addClass("active");
    }
    useEffect((): (() => void) => {
        $(`#settings_left_sidebar .sidebar_button[data-path-id=${[previousTab]}]`).addClass("active");
        const unsubscribeSelectedTabObserver: () => boolean = props.selectedTab.observe((selectedTab: SettingsTab): void => {
            if (previousTab === selectedTab) return;
            onSubTabSwitch({ previousTab, newTab: selectedTab });
            previousTab = selectedTab;
        });
        $("#settings_left_sidebar .sidebar_button").on("click", (event: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>): void => {
            if (props.selectedTab.get() === (event.currentTarget.dataset.pathId as SettingsTab)) return;
            props.selectedTab.set(event.currentTarget.dataset.pathId as SettingsTab);
        });
        return (): void => {
            unsubscribeSelectedTabObserver();
        };
    }, []);
    interface Tab {
        icon: string;
        id: SettingsTab;
        name: string;
        resolution: [width: number, height: number];
        /**
         * @todo
         */
        submenu?: JSX.Element | undefined;
    }
    const tabs: Tab[] = (
        [
            {
                icon: "resource://images/ui/glyphs/dev_glyph_color.png",
                id: "general",
                name: "General",
                resolution: [14, 14],
            },
            {
                icon: "resource://images/ui/glyphs/video_glyph_color.png",
                id: "video",
                name: "Video",
                resolution: [15, 12],
            },
            {
                icon: "resource://images/ui/glyphs/sound_glyph_color.png",
                id: "audio",
                name: "Audio",
                resolution: [15, 12],
            },
            {
                icon: "resource://images/ui/glyphs/Source.png",
                id: "integrations",
                name: "Integrations",
                resolution: [12, 12],
            },
            {
                icon: "resource://images/ui/glyphs/debug_glyph_color.png",
                id: "advanced",
                name: "Advanced",
                resolution: [15, 15],
            },
            {
                icon: "resource://images/ui/glyphs/debug_glyph_color.png",
                id: "debug",
                name: "Debug",
                resolution: [15, 15],
            },
            // props.tab.type === "world" && { icon: "resource://images/ui/glyphs/Add-Ons_Side-Nav_Icon_24x24.png", id: "packs", name: "Packs", resolution: 12 },
            // { icon: "resource://images/ui/glyphs/FriendsIcon.png", id: "players", name: "Players", resolution: 15 },
            // { icon: "resource://images/ui/glyphs/icon_panda.png", id: "entities", name: "Entities", resolution: 16 },
            // { icon: "resource://images/ui/glyphs/structure_block.png", id: "structures", name: "Structures", resolution: 16 },
            // { icon: "resource://images/ui/glyphs/world_glyph_color.png", id: "world", name: "World", resolution: 17 },
            // { icon: "resource://images/ui/glyphs/icon_map.png", id: "maps", name: "Maps", resolution: 16 },
            // { icon: "resource://images/ui/glyphs/Data-Empty.png", id: "dynamic-properties", name: "Dynamic Properties", resolution: 12 },
            // { icon: "resource://images/ui/glyphs/icon_best3.png", id: "scoreboards", name: "Scoreboards", resolution: 12 },
            // { icon: "resource://images/ui/glyphs/village_plains.png", id: "villages", name: "Villages", resolution: 8 },
            // { icon: "resource://images/ui/glyphs/realmPortalSmall.png", id: "portals", name: "Portals", resolution: 10 },
            // { icon: "resource://images/ui/glyphs/timer.png", id: "ticks", name: "Ticks", resolution: 11 },
            // { icon: "resource://images/ui/glyphs/timer.png", id: "ticking-areas", name: "Ticking Areas", resolution: 11 },
            // { icon: "resource://images/ui/glyphs/icon_wandering_trader.png", id: "schedulerwt", name: "SchedulerWT", resolution: 16 },
            // { icon: "resource://images/ui/glyphs/Folder-Closed.png", id: "view-files", name: "View Files", resolution: 12 },
            // { icon: "resource://images/ui/glyphs/flame_full_image.png", id: "fun", name: "Fun", resolution: 13 },
            // { icon: "resource://images/ui/glyphs/Source.png", id: "integrations", name: "Integrations", resolution: 12 },
        ] as const satisfies (Tab | false | undefined)[]
    ).filter((tab: Tab | false | undefined): tab is Tab => !!tab) as Tab[];
    return (
        <div style="display: flex; flex-direction: column; height: 100%; width: 200px; overflow: hidden auto;" id="settings_left_sidebar">
            {tabs.map((tab: Tab): JSX.SpecificElement<"div"> => {
                const maxHeightFromWidth: number = Math.floor(36 * (tab.resolution[1] / tab.resolution[0]));
                const maxHeightFromRes: number = 36 - (36 % tab.resolution[1]);
                const allowed: number = Math.min(maxHeightFromWidth, maxHeightFromRes);
                const finalHeight: number = allowed - (allowed % tab.resolution[1]);
                return (
                    <div
                        class="sidebar_button nsel"
                        data-path-id={tab.id}
                        // onMouseDown={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                        //     if (event.currentTarget.hasAttribute("disabled")) return;
                        //     SoundEffects.popB();
                        // }}
                        style={{ paddingRight: "1px", lineHeight: "1em", textAlign: "left", flexShrink: 0 }}
                    >
                        <div style="display: inline-block; vertical-align: middle; width: 36px; height: 36px; text-align: center;">
                            <img
                                aria-hidden="true"
                                src={tab.icon}
                                class="nsel ndrg"
                                style={`display: inline-block; vertical-align: middle; width: auto; height: ${finalHeight}px; margin: ${
                                    (36 - finalHeight) / 2
                                }px 0;`}
                            />
                        </div>
                        {tab.name}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Props for the {@link MinecraftWorldFoldersOption} component.
 */
interface MinecraftWorldFoldersOptionProps {
    configOption: "minecraftDataFolders" | "extraMinecraftDataFolders" | "isolatedMinecraftWorldsFolders" | "extraIsolatedMinecraftWorldsFolders";
    selectDialogOptions: Required<Pick<Electron.OpenDialogOptions, "buttonLabel" | "message" | "title">>;
}

function MinecraftWorldFoldersOption(props: MinecraftWorldFoldersOptionProps): JSX.SpecificElement<"div"> {
    const worldFolderLocationsListContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    let worldFolderLocations: string[] = config[props.configOption];
    function updateWorldFolderLocations(locations?: typeof worldFolderLocations): void {
        if (!worldFolderLocationsListContainerRef.current) return;
        worldFolderLocations = locations ?? config[props.configOption];
        Array.from(worldFolderLocationsListContainerRef.current.children)
            .slice(worldFolderLocations.length)
            .forEach((child: Element): void => child.remove());
        render(<WorldFolderLocationList locations={worldFolderLocations} />, worldFolderLocationsListContainerRef.current);
    }
    function appendWorldFolderLocation(location: string = ""): void {
        if (!worldFolderLocationsListContainerRef.current) return;
        worldFolderLocations = config[props.configOption];
        hydrate(<WorldFolderLocationList locations={[...worldFolderLocations, location]} />, worldFolderLocationsListContainerRef.current);
    }
    function WorldFolderLocationList(listProps: {
        locations?: typeof worldFolderLocations;
    }): JSX.SpecificElement<"div", JSX.HTMLAttributes<HTMLDivElement>, HTMLDivElement>[] {
        listProps.locations ??= worldFolderLocations;
        return listProps.locations.map((location: string, index: number): JSX.SpecificElement<"div"> => {
            const inputRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
            useEffect((): void => {
                if (inputRef.current) {
                    inputRef.current.addEventListener("change", (): void => {
                        if (!inputRef.current) return;
                        worldFolderLocations = config[props.configOption];
                        config[props.configOption] = [
                            ...worldFolderLocations.slice(0, index),
                            inputRef.current.value,
                            ...worldFolderLocations.slice(index + 1),
                        ];
                    });
                }
            });
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                    }}
                >
                    <input
                        ref={inputRef}
                        title="A folder path."
                        type="text"
                        class="form-control"
                        style={{
                            fontFamily: "monospace",
                            flexGrow: 1,
                        }}
                        value={location}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        spellcheck={false}
                        inputMode="text"
                        required
                        aria-autocomplete="none"
                        onInput={(event: JSX.TargetedInputEvent<HTMLInputElement>): void => {
                            if (event.currentTarget.value.length === 0 || /[<>"|?]/.test(event.currentTarget.value)) {
                                event.currentTarget.style.color = "red";
                                event.currentTarget.style.borderColor = "red";
                            } else {
                                event.currentTarget.style.color = "";
                                event.currentTarget.style.borderColor = "";
                            }
                        }}
                    />
                    <button
                        type="button"
                        class="nsel"
                        title="Remove"
                        style={{ padding: "1px", aspectRatio: "1/1" }}
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (event.currentTarget.disabled) return;
                            worldFolderLocations = config[props.configOption];
                            config[props.configOption] = [...worldFolderLocations.slice(0, index), ...worldFolderLocations.slice(index + 1)];
                        }}
                    >
                        <only_visible_on_themes light blue>
                            <img
                                width="24"
                                height="24"
                                src="resource://images/ui/glyphs/delete.png"
                                class="nsel ndrg"
                                aria-hidden="true"
                                style={{
                                    imageRendering: "pixelated",
                                    width: "24px",
                                    height: "24px",
                                }}
                            ></img>
                        </only_visible_on_themes>
                        <only_visible_on_themes dark>
                            <img
                                width="24"
                                height="24"
                                src="resource://images/ui/glyphs/delete.png"
                                class="nsel ndrg"
                                aria-hidden="true"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "invert()",
                                    width: "24px",
                                    height: "24px",
                                }}
                            ></img>
                        </only_visible_on_themes>
                    </button>
                </div>
            );
        });
    }
    useEffect((): (() => void) => {
        config.on(`settingChanged:${props.configOption}`, updateWorldFolderLocations);
        return (): void => {
            config.off(`settingChanged:${props.configOption}`, updateWorldFolderLocations);
        };
    });
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div
                ref={worldFolderLocationsListContainerRef}
                style={{
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <WorldFolderLocationList />
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <button
                    type="button"
                    style={{ flexGrow: 1 }}
                    onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                        if (event.currentTarget.disabled) return;
                        appendWorldFolderLocation();
                    }}
                >
                    Add Folder
                </button>
                <button
                    type="button"
                    style={{ flexGrow: 1 }}
                    onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                        if (event.currentTarget.disabled) return;
                        const result: OpenDialogReturnValue = await dialog.showOpenDialog({
                            properties: ["openDirectory", "multiSelections", "treatPackageAsDirectory", "showHiddenFiles"],
                            buttonLabel: props.selectDialogOptions.buttonLabel,
                            message: props.selectDialogOptions.message,
                            title: props.selectDialogOptions.title,
                        });
                        if (result.canceled) return;
                        switch (props.configOption) {
                            case "minecraftDataFolders":
                            case "extraMinecraftDataFolders": {
                                const validPaths: string[] = [];
                                const invalidPaths: string[] = [];
                                for (const filePath of result.filePaths) {
                                    if (
                                        (existsSync(path.join(filePath, "minecraftWorlds")) &&
                                            statSync(path.join(filePath, "minecraftWorlds")).isDirectory()) ||
                                        (existsSync(path.join(filePath, "worlds")) && statSync(path.join(filePath, "worlds")).isDirectory())
                                    ) {
                                        validPaths.push(filePath);
                                    } else {
                                        invalidPaths.push(filePath);
                                    }
                                }
                                if (invalidPaths.length) {
                                    const warningResult: Electron.MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                        type: "warning",
                                        title: "Invalid Paths",
                                        message: `The following paths do not contain a "minecraftWorlds" or "worlds" folder, would you like to add them anyway?:\n\n${invalidPaths.join("\n")}`,
                                        detail: `Please select the folder containing the minecraftWorlds or worlds folder. If your worlds are in a folder with a name other than "minecraftWorlds" or "worlds", please add that folder to the ${props.configOption === "extraMinecraftDataFolders" ? "extra " : ""}isolated Minecraft data folders list instead.`,
                                        buttons: ["Add Anyway", ...(validPaths.length ? ["Add Valid Paths Only"] : []), "Cancel"],
                                        noLink: true,
                                    });
                                    switch (warningResult.response) {
                                        case 0:
                                            config[props.configOption] = config[props.configOption].concat(result.filePaths);
                                            return;
                                        case 0 + +!!validPaths.length:
                                            config[props.configOption] = config[props.configOption].concat(validPaths);
                                            return;
                                        case 1 + +!!validPaths.length:
                                        default:
                                            return;
                                    }
                                }
                                config[props.configOption] = config[props.configOption].concat(result.filePaths);
                                return;
                            }
                            case "isolatedMinecraftWorldsFolders":
                            case "extraIsolatedMinecraftWorldsFolders": {
                                const validPaths: string[] = [];
                                const invalidPaths: string[] = [];
                                for (const filePath of result.filePaths) {
                                    if (
                                        (existsSync(path.join(filePath, "minecraftWorlds")) &&
                                            statSync(path.join(filePath, "minecraftWorlds")).isDirectory() &&
                                            readdirSync(path.join(filePath, "minecraftWorlds"), { withFileTypes: true }).some(
                                                (item: Dirent<string>): boolean =>
                                                    item.isDirectory() && existsSync(path.join(filePath, "minecraftWorlds", item.name, "level.dat"))
                                            )) ||
                                        (existsSync(path.join(filePath, "worlds")) &&
                                            statSync(path.join(filePath, "worlds")).isDirectory() &&
                                            readdirSync(path.join(filePath, "worlds"), { withFileTypes: true }).some(
                                                (item: Dirent<string>): boolean =>
                                                    item.isDirectory() && existsSync(path.join(filePath, "worlds", item.name, "level.dat"))
                                            ))
                                    ) {
                                        invalidPaths.push(filePath);
                                    } else {
                                        validPaths.push(filePath);
                                    }
                                }
                                if (invalidPaths.length) {
                                    const warningResult: Electron.MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                        type: "warning",
                                        title: "Possibly Invalid Paths",
                                        message: `The following paths appear to be the paths containing the "minecraftWorlds" or "worlds" folder that contains your Minecraft worlds, the isolated lists are for the folders that directly contain the world folders, would you like to add them anyway?:\n\n${invalidPaths.join("\n")}`,
                                        detail: `Please select the folder containing the actual world folders. If these folders are the containers of "minecraftWorlds" or "worlds" folders, please add these folders to the ${props.configOption === "extraIsolatedMinecraftWorldsFolders" ? "extra " : ""}Minecraft data folders list instead.`,
                                        buttons: ["Add Anyway", ...(validPaths.length ? ["Add Valid Paths Only"] : []), "Cancel"],
                                        noLink: true,
                                    });
                                    switch (warningResult.response) {
                                        case 0:
                                            config[props.configOption] = config[props.configOption].concat(result.filePaths);
                                            return;
                                        case 0 + +!!validPaths.length:
                                            config[props.configOption] = config[props.configOption].concat(validPaths);
                                            return;
                                        case 1 + +!!validPaths.length:
                                        default:
                                            return;
                                    }
                                }
                                config[props.configOption] = config[props.configOption].concat(result.filePaths);
                                return;
                            }
                        }
                    }}
                >
                    Select Folders
                </button>
                <button
                    type="button"
                    style={{ flexGrow: 1 }}
                    onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                        if (event.currentTarget.disabled) return;
                        config[props.configOption] = undefined;
                    }}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
