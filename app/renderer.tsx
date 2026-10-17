import "./index.css";
import "overlayscrollbars/overlayscrollbars.css";
import "../src/libs/@szhsin/react-menu/index.css";
import "../src/libs/@szhsin/react-menu/core.css";
import "../src/importjQueryUtils.ts";
import { render } from "preact/compat";
import App from "./app.tsx";
import "jquery";
import { existsSync, type Stats } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { dialog } from "@electron/remote";
// @ts-expect-error: #DEBUG
globalThis.mcbeLeveldbUri = (async (): Promise<typeof import("mcbe-leveldb")> => await import("mcbe-leveldb")).toString().split('"')[1];

// This makes everything in the app run faster, especially loading of things like chunks in the world map.
// TODO: When the app is actively loading stuff, this should run even when the window isn't focuses.
// TODO: Add a config option to set whether this should always be on, never be on, or only be on when the window is focused (default).
{
    const currentWindow: Electron.BrowserWindow = getCurrentWindow();
    let lastFocusCheck: number = Date.now();
    let lastFocusValue: boolean = currentWindow.isFocused();
    currentWindow.on("focus", (): void => {
        lastFocusCheck = Date.now();
        if (!lastFocusValue && nextIdleCallback !== undefined) {
            clearTimeout(nextIdleCallback);
            preventIdle();
        }
        lastFocusValue = true;
    });
    let nextIdleCallback: number | undefined;
    const preventIdle: () => void = (): void => {
        if (lastFocusValue) {
            if (lastFocusCheck + 1000 < Date.now()) {
                lastFocusCheck = Date.now();
                lastFocusValue = currentWindow.isFocused();
            }
        } else if (lastFocusCheck + 5000 < Date.now()) {
            lastFocusCheck = Date.now();
            lastFocusValue = currentWindow.isFocused();
        }
        if (lastFocusValue && !("__DISABLE_IDLE_PREVENTION__" in window && window.__DISABLE_IDLE_PREVENTION__)) setImmediate(preventIdle);
        else nextIdleCallback = setTimeout(preventIdle, 5000);
    };
    preventIdle();
}

declare module "preact" {
    namespace JSX {
        interface SpecificElement<
            V extends keyof IntrinsicElements | HTMLAttributes<any>,
            P = V extends keyof IntrinsicElements ? IntrinsicElements[V] : V,
            T = P extends HTMLAttributes<infer T> ? T : never,
        > extends VNode<ClassAttributes<T> & P> {}
        interface OnlyVisibleOnThemesHTMLAttributes<T extends EventTarget = HTMLUnknownElement> extends HTMLAttributes<T> {
            /**
             * Whether the contents of the element should be visible when the current theme is light.
             *
             * @default false
             */
            light?: boolean;
            /**
             * Whether the contents of the element should be visible when the current theme is dark.
             *
             * @default false
             */
            dark?: boolean;
            /**
             * Whether the contents of the element should be visible when the current theme is blue.
             *
             * @default false
             */
            blue?: boolean;
        }
        interface IntrinsicElements {
            /**
             * A custom element used to make the elements inside of it only show when the current theme is one of the specified themes.
             */
            only_visible_on_themes: OnlyVisibleOnThemesHTMLAttributes<HTMLUnknownElement> /* 
            ItemListItemColumn: HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions; */;
            /**
             * The deprecated HTML center element.
             */
            center: HTMLAttributes<HTMLElement>;
            // REMOVE
            "purple-border_background": {
                // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
                children?: any[] | any;
            };
        }
        interface InputHTMLAttributes {
            inputmode?: Signalish<LooseAutocomplete<"decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url"> | undefined>;
            inputMode?: Signalish<LooseAutocomplete<"decimal" | "email" | "none" | "numeric" | "search" | "tel" | "text" | "url"> | undefined>;
        }
    }
}

class PurpleBorderBackgroundElement extends HTMLElement {
    public constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot!.innerHTML = `
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceL.png" style="height: calc(100% - 1.75vw); width: 1vw; left: 0px; top: 0.875vw; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceR.png" style="height: calc(100% - 1.75vw); width: 1vw; right: 0px; top: 0.875vw; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceT.png" style="height: 1vw; width: calc(100% - 1.75vw); left: 0.875vw; top: 0px; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceB.png" style="height: 1vw; width: calc(100% - 1.75vw); left: 0.875vw; bottom: 0px; z-index: -5;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceTL.png" style="height: 1vw; width: 1vw; left: 0px; top: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceTR.png" style="height: 1vw; width: 1vw; right: 0px; top: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceBL.png" style="height: 1vw; width: 1vw; left: 0px; bottom: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceBR.png" style="height: 1vw; width: 1vw; right: 0px; bottom: 0px; z-index: -4;
    position: absolute; image-rendering: pixelated;">
    <img src="resource://images/ui/backgrounds/purpleBorder_sliceC.png" style="height: calc(100% - 1.75vw); width: calc(100% - 1.75vw); right: 0.875vw; bottom: 0.875vw; z-index: -6;
    position: absolute; image-rendering: pixelated;">
    <slot></slot>`;
    }
}

customElements.define("purple-border_background", PurpleBorderBackgroundElement);

render(<App />, document.getElementById("app")!);

// console.log(document.getElementById("app"));

document.addEventListener("dragenter", (event: DragEvent): void => {
    if (!event.dataTransfer) return;
    console.log(Array.from(event.dataTransfer.items).map((v: DataTransferItem): { kind: string; type: string } => ({ kind: v.kind, type: v.type })));
    if (!event.dataTransfer.types.includes("Files")) {
        if (event.dataTransfer.types.includes("text/uri-list")) {
            $(".fullscreen-drop-overlay").hide();
            $("#file-drop-import-overlay").show();
            if (Array.from(event.dataTransfer.items).filter((v: DataTransferItem): boolean => v.type === "#file-drop-import-overlay").length > 1) {
                $("#file-drop-import-overlay").addClass("has-multiple");
            } else $("#file-drop-import-overlay").removeClass("has-multiple");
        }
        return;
    }
    $(".fullscreen-drop-overlay").hide();
    // REVIEW: Make sure that dragging files from the file manager only has one data type for all supported OSes.
    const overlayType: `#${string}` = event.dataTransfer.types.length > 1 ? "#file-drop-import-overlay" : "#file-drop-open-overlay";
    $(overlayType).show();
    if (Array.from(event.dataTransfer.items).filter((v: DataTransferItem): boolean => v.kind === "file").length > 1) {
        $(overlayType).addClass("has-multiple");
    } else $(overlayType).removeClass("has-multiple");
});
document.addEventListener("dragover", (event: DragEvent): void => {
    if (!event.dataTransfer) return;
    if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes("text/uri-list")) return;
    event.preventDefault();
});
document.addEventListener("dragleave", (event: DragEvent): void => {
    if (!event.dataTransfer) return;
    if (!event.dataTransfer.types.includes("Files") && !event.dataTransfer.types.includes("text/uri-list")) return;
    if (!(event.target instanceof Element) || !event.target.classList.contains("fullscreen-drop-overlay")) return;
    $(".fullscreen-drop-overlay").hide();
});
// ~TODO: When mobile support is added, this may need to somehow preserve the dragged FileSystemEntry/DirectoryEntry so the user can still access the file.
// TODO: Modifier keys should affect the mode it opens it, or allow an advanced menu to select the mode after dropping.
document.addEventListener("drop", (event: DragEvent): void => {
    $(".fullscreen-drop-overlay").hide();
    if (!event.dataTransfer) return;
    if (event.dataTransfer.files.length === 0) {
        if (event.dataTransfer.types.includes("text/uri-list")) {
            // TEMP: Add support for external non-filesystem files from URIs later, it should open them in copy or readonly mode.
            void Promise.all(
                Array.from(event.dataTransfer.items)
                    .filter((v: DataTransferItem): boolean => v.type === "text/uri-list")
                    .map(
                        async (v: DataTransferItem): Promise<string> =>
                            await new Promise<string>((resolve: FunctionStringCallback): void => void v.getAsString(resolve))
                    )
            ).then((uris: string[]): void => {
                void dialog.showMessageBox({
                    type: "warning",
                    title: "Feature Not Implemented",
                    message: "Unable to open the dropped URIs.",
                    // TEST: See if getAsFile works with URIs.
                    detail: `The ability to open dropped URIs has not been implemented yet.\nFailed URIs: ${JSON.stringify(uris)}`,
                    buttons: ["OK"],
                    noLink: true,
                });
            });
        }
        return;
    }
    event.preventDefault();
    const currentWindow: Electron.BrowserWindow = getCurrentWindow();
    void (async function handleDroppedFiles(): Promise<void> {
        if (!event.dataTransfer) throw new Error("event.dataTransfer is null");
        if (event.dataTransfer.files.length === 0) throw new Error("event.dataTransfer.files is empty");
        const foundNonFileSystemFiles: string[] = []; // TEMP
        for (const file of event.dataTransfer.files) {
            const filePath: string = electron.webUtils.getPathForFile(file);
            // TEMP: Add support for external non-filesystem files later, it should open them in copy or readonly mode.
            if (!filePath) {
                foundNonFileSystemFiles.push(file.name);
                continue;
            }
            if (!existsSync(filePath)) {
                console.warn("Dropped file does not exist:", filePath, file);
                continue;
            }
            const statResult: Stats = await stat(filePath);
            if (statResult.isDirectory()) {
                if (existsSync(path.join(filePath, "level.dat"))) currentWindow.webContents.send<1>("open-world-folder", filePath);
                else currentWindow.webContents.send<1>("open-leveldb-folder", filePath);
                continue;
            }
            currentWindow.webContents.send<1>("open-file", filePath);
        }
        // TEMP
        if (foundNonFileSystemFiles.length) {
            void dialog.showMessageBox({
                type: "warning",
                title: "Feature Not Implemented",
                message: "Unable to open some of the dropped files.",
                detail: `The ability to open dropped files that are not stored on the filesystem has not been implemented yet.\nFailed files: ${JSON.stringify(foundNonFileSystemFiles)}`,
                buttons: ["OK"],
                noLink: true,
            });
        }
    })();
});
