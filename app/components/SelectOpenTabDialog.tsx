import { BrowserWindow } from "@electron/remote";
import type { JSX, RefObject } from "preact";
import { render, useEffect, useRef } from "preact/compat";

/**
 * Options for the {@link showSelectOpenTabDialog} function.
 */
export interface ShowSelectOpenTabDialogOptions {
    excludedTabs: { windowID: number; tabID: bigint }[];
    // /**
    //  * The title of the dialog.
    //  *
    //  * @default "Select Tab"
    //  */
    // title?: string;
    /**
     * The message of the dialog.
     *
     * @default "Select an open tab."
     */
    message?: string | undefined;
    /**
     * The text of the cancel button.
     *
     * @default "Cancel"
     */
    cancelButtonText?: string | undefined;
    /**
     * A list of tab types to include.
     *
     * If not specified, all tabs will be included.
     *
     * @default undefined
     */
    tabTargetTypeFilter?: TabManagerTab["type"][] | undefined;
}

/**
 * The result of the {@link showSelectOpenTabDialog} function.
 */
export type ShowSelectOpenTabDialogResult =
    | {
          canceled: false;
          window: Electron.BrowserWindow;
          tabID: bigint;
      }
    | {
          canceled: true;
      };

/**
 * Props for the {@link SelectOpenTabDialog} component.
 */
export interface SelectOpenTabDialogProps extends ShowSelectOpenTabDialogOptions {
    onTabSelected(this: void, window: Electron.BrowserWindow, tabID: bigint): void;
    onCancel(this: void): void;
}

/**
 * Renders a dialog for selecting an open tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export function SelectOpenTabDialog(props: SelectOpenTabDialogProps): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const windowListRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): void => {
        void (async function loadSelectOpenTabDialogContents(): Promise<void> {
            // TODO: Add an error handler to this function.
            if (!containerRef.current || !windowListRef.current) return;
            const openWindows: Electron.BrowserWindow[] = BrowserWindow.getAllWindows();
            const includedOpenWindows: Electron.BrowserWindow[] = (
                await Promise.all(
                    openWindows.map(
                        async (targetWindow: Electron.BrowserWindow): Promise<boolean> =>
                            (await targetWindow.webContents.executeJavaScript(`typeof tabManager !== "undefined" && tabManager.openTabs.length > 0`)) as boolean
                    )
                )
            )
                .map((result: boolean, index: number): Electron.BrowserWindow | undefined => (result ? openWindows[index] : undefined))
                .filter((targetWindow: Electron.BrowserWindow | undefined): targetWindow is Electron.BrowserWindow => targetWindow !== undefined);
            if (!containerRef.current || !windowListRef.current) return;
            const includedTabs: { windowID: number; tabID: bigint; name: string }[][] = (
                await Promise.all(
                    includedOpenWindows.map(
                        async (targetWindow: Electron.BrowserWindow): Promise<{ windowID: number; tabID: bigint; name: string }[]> =>
                            (await targetWindow.webContents.executeJavaScript(
                                `tabManager.openTabs${
                                    props.tabTargetTypeFilter ? `.filter((tab) => ${JSON.stringify(props.tabTargetTypeFilter)}.includes(tab.type))` : ""
                                }.map((tab) => ({ windowID: ${targetWindow.id}, tabID: tab.id, name: tab.name }))`
                            )) as { windowID: number; tabID: bigint; name: string }[]
                    )
                )
            )
                .map((tabList: { windowID: number; tabID: bigint; name: string }[]): { windowID: number; tabID: bigint; name: string }[] =>
                    tabList.filter(
                        (tab: { windowID: number; tabID: bigint; name: string }): boolean =>
                            !props.excludedTabs.some(
                                (excludedTab: { windowID: number; tabID: bigint }): boolean =>
                                    excludedTab.windowID === tab.windowID && excludedTab.tabID === tab.tabID
                            )
                    )
                )
                .filter((tabList: { windowID: number; tabID: bigint; name: string }[]): boolean => tabList.length > 0)
                .sort(
                    (a: { windowID: number; tabID: bigint; name: string }[], b: { windowID: number; tabID: bigint; name: string }[]): number =>
                        a[0]!.windowID - b[0]!.windowID
                );
            if (!containerRef.current || !windowListRef.current) return;
            render(
                includedTabs.map(
                    (tabList: { windowID: number; tabID: bigint; name: string }[]): JSX.SpecificElement<"div"> => (
                        <div class="selectOpenTabDialogWindowListItem">
                            <div class="selectOpenTabDialogWindowListItemWindowName">Window {tabList[0]!.windowID}</div>
                            <div class="selectOpenTabDialogWindowListItemTabList">
                                {tabList.map(
                                    (tab: { windowID: number; tabID: bigint; name: string }): JSX.SpecificElement<"div"> => (
                                        <div class="selectOpenTabDialogWindowListItemTabListItem">
                                            <button
                                                type="button"
                                                onClick={(): void => {
                                                    props.onTabSelected(
                                                        openWindows.find((targetWindow: Electron.BrowserWindow): boolean => targetWindow.id === tab.windowID)!,
                                                        tab.tabID
                                                    );
                                                }}
                                            >
                                                {tab.name}
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )
                ),
                windowListRef.current
            );
        })();
    });
    return (
        <div class="selectOpenTabDialog" ref={containerRef}>
            <p>{props.message ?? "Select an open tab."}</p>
            <div class="selectOpenTabDialogWindowList" ref={windowListRef}>
                {/* TO-DO: Add a proper loading screen. */}
                Loading...
            </div>
            <button type="button" onClick={props.onCancel}>
                {props.cancelButtonText ?? "Cancel"}
            </button>
        </div>
    );
}

/**
 * Shows a dialog for selecting an open tab.
 *
 * @param options The options for the dialog.
 * @returns A promise that resolves with the result of the dialog.
 */
export default async function showSelectOpenTabDialog(options: ShowSelectOpenTabDialogOptions): Promise<ShowSelectOpenTabDialogResult> {
    return await new Promise((resolve: (value: ShowSelectOpenTabDialogResult) => void): void => {
        const container: HTMLDivElement = document.createElement("div");
        container.style.position = "fixed";
        container.style.zIndex = "1200000";
        container.style.top = "0";
        container.style.left = "0";
        container.style.width = "100%";
        container.style.height = "100%";
        const innerContainer: HTMLDivElement = document.createElement("div");
        innerContainer.style.width = "-webkit-fill-available";
        innerContainer.style.height = "-webkit-fill-available";
        innerContainer.style.margin = "5px";
        innerContainer.style.padding = "25px";
        innerContainer.style.borderRadius = "25px";
        innerContainer.style.backgroundColor = "#88888888";
        innerContainer.style.backdropFilter = "blur(5px)";
        innerContainer.style.overflow = "auto";
        render(
            <SelectOpenTabDialog
                {...options}
                onTabSelected={(window: Electron.BrowserWindow, tabID: bigint): void => {
                    render(null, innerContainer);
                    container.remove();
                    resolve({ canceled: false, window, tabID });
                }}
                onCancel={(): void => {
                    render(null, innerContainer);
                    container.remove();
                    resolve({ canceled: true });
                }}
            />,
            innerContainer
        );
        container.appendChild(innerContainer);
        $("#page-overlay-container").append(container);
    });
}
