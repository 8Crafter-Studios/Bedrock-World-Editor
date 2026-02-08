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
    async function (_event: IpcRendererEvent, filePath: string, type?: "nbt" | "json" | "xml" | "text" | "binary" | "unset"): Promise<void> {
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
                });
                break;
            case type === "binary":
            case type === "unset":
                tabManager.openTab({
                    icon: undefined, // TODO: Add an icon for binary tabs, and add support for using the custom icon set for the file if it exists.
                    name: path.basename(filePath),
                    path: filePath,
                    type: "binary",
                });
                break;
            default:
                dialog.showMessageBox({
                    type: "warning",
                    title: "Feature Not Implemented",
                    message: `Unable to open the file at ${path}.`,
                    detail: `The ability to open this type of file has not been implemented yet. Unknown type: ${type}`,
                    buttons: ["OK"],
                    noLink: true,
                });
        }
    }
);

ipcRenderer.on("open-world-folder", async function (_event: IpcRendererEvent, folderPath: string): Promise<void> {
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
    });
});

ipcRenderer.on("open-leveldb-folder", async function (_event: IpcRendererEvent, folderPath: string): Promise<void> {
    getCurrentWindow().focus();
    tabManager.openTab({
        icon: "resource://images/ui/glyphs/icon_bookshelf.png", // TODO: Add supports for using the custom icon set for the folder if it exists.
        name: "LevelDB", // TODO: Implement something to get a name for the tab.
        path: folderPath,
        type: "leveldb",
    });
});

declare global {
    namespace Electron {
        interface WebContents {
            send<_T extends 1, T extends Exclude<keyof Console, "Console">>(
                channel: "console-action",
                action: T,
                ...args: globalThis.Parameters<Console[T]>
            ): void;
            send<_T extends 1>(channel: "open-file", path: string, type?: "nbt" | "json" | "binary" | "unset"): void;
            send<_T extends 1>(channel: "open-world-folder", path: string): void;
            send<_T extends 1>(channel: "open-leveldb-folder", path: string): void;
        }
    }
}
