import type { IpcRendererEvent } from "electron";
const { ipcRenderer } = require("electron") as typeof import("electron");
import { dialog } from "@electron/remote";
import { existsSync, globSync, readFileSync } from "node:fs";
import path from "node:path";
import * as NBT from "prismarine-nbt";
import type { NBTSchemas } from "mcbe-leveldb";

ipcRenderer.on("console-action", function <
    T extends Exclude<keyof Console, "Console">,
>(_event: IpcRendererEvent, action: T, ...args: Parameters<Console[T]>): void {
    console[action](...(args as []));
});

ipcRenderer.on(
    "open-file",
    async function (_event: IpcRendererEvent, filePath: string, type?: IpcRendererOpenFileType, tabMode?: TabManagerTabMode): Promise<void> {
        type ??= "unset";
        getCurrentWindow().focus();
        switch (true) {
            case type === "nbt":
            case type === "unset" && ["nbt", "mcstructure", "schem", "schematic", "snbt", "dat"].includes(path.extname(filePath).slice(1).toLowerCase()):
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for NBT tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "nbt",
                    mode: tabMode,
                });
                break;
            case type === "json":
            case type === "unset" &&
                ["json", "jsonc", "mcouicconfig", "ouicconfig", "mcbweconfig", "bweconfig"].includes(path.extname(filePath).slice(1).toLowerCase()):
            case type === "unset" && [".prettierrc", ".eslintrc", ".hintrc"].includes(path.basename(filePath).toLowerCase()):
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for JSON tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "json",
                    mode: tabMode,
                });
                break;
            // TEMP: This is just until JSONL support is added.
            case type === "unset" && ["jsonl"].includes(path.extname(filePath).slice(1).toLowerCase()):
                dialog.showMessageBox({
                    type: "warning",
                    title: "Feature Not Implemented",
                    message: `Unable to open the file at ${path}.`,
                    detail: "The ability to open JSON Lines (.jsonl) files has not been implemented yet.",
                    buttons: ["OK"],
                    noLink: true,
                });
                break;
            case type === "xml":
            case type === "unset" && ["xml"].includes(path.extname(filePath).slice(1).toLowerCase()):
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for XML tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "xml",
                    mode: tabMode,
                });
                break;
            case type === "text":
            case type === "unset" && ["txt", "md"].includes(path.extname(filePath).slice(1).toLowerCase()):
            case type === "unset" &&
                [".gitattributes", ".gitignore", ".gitmodules", ".git", ".mcattributes", ".mcignore", ".npmrc", ".npmignore", "license"].includes(
                    path.basename(filePath).toLowerCase()
                ):
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for text tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "text",
                    mode: tabMode,
                });
                break;
            case type === "binary":
            case type === "unset":
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for binary tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "binary",
                    mode: tabMode,
                });
                break;
            default:
                dialog.showMessageBox({
                    type: "error",
                    title: "Unknown Tab Type",
                    message: `Unable to open the file at ${path}.`,
                    detail: `The ability to open this type of file has not been implemented yet. Unknown type: ${type}`,
                    buttons: ["OK"],
                    noLink: true,
                });
        }
    }
);

ipcRenderer.on("open-world-folder", async function (_event: IpcRendererEvent, folderPath: string, tabMode?: TabManagerTabMode): Promise<void> {
    getCurrentWindow().focus();
    tabManager.openTab({
        icon:
            existsSync(path.join(folderPath, "world_icon.jpeg")) ?
                path.join(folderPath, "world_icon.jpeg")
            :   globSync(path.join(folderPath, "world_icon.*"))[0],
        name:
            existsSync(path.join(folderPath, "levelname.txt")) ?
                readFileSync(path.join(folderPath, "levelname.txt"), { encoding: "utf-8" })
            :   ((NBT.parseUncompressed(readFileSync(path.join(folderPath, "level.dat")), "little") as NBTSchemas.NBTSchemaTypes.LevelDat).value.LevelName
                    ?.value ?? "Unknown Name"),
        path: folderPath,
        type: "world",
        mode: tabMode,
    });
});

ipcRenderer.on("open-leveldb-folder", async function (_event: IpcRendererEvent, folderPath: string, tabMode?: TabManagerTabMode): Promise<void> {
    getCurrentWindow().focus();
    tabManager.openTab({
        icon: "resource://images/ui/glyphs/icon_bookshelf.png", // TODO: Add supports for using the custom icon set for the folder if it exists.
        name: path.basename(folderPath), // TODO: Implement something to get a better name for the tab (as it will often times just be `db`).
        path: folderPath,
        type: "leveldb",
        mode: tabMode,
    });
});

declare global {
    type IpcRendererOpenFileType = "nbt" | "json" | "xml" | "text" | "binary" | "unset";
    namespace Electron {
        interface WebContents {
            send<_T extends 1, T extends Exclude<keyof Console, "Console">>(
                channel: "console-action",
                action: T,
                ...args: globalThis.Parameters<Console[T]>
            ): void;
            send<_T extends 1>(channel: "open-file", path: string, type?: IpcRendererOpenFileType, tabMode?: TabManagerTabMode | `${TabManagerTabMode}`): void;
            send<_T extends 1>(channel: "open-world-folder", path: string, tabMode?: TabManagerTabMode | `${TabManagerTabMode}`): void;
            send<_T extends 1>(channel: "open-leveldb-folder", path: string, tabMode?: TabManagerTabMode | `${TabManagerTabMode}`): void;
        }
    }
}
