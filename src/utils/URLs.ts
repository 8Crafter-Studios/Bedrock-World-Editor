/**
 * src/utils/URLs.ts
 * @module
 * @description A file containing URLs and file paths used by the app.
 * @supports Main, Preload, Renderer
 */
/** */
import path from "node:path";
import process from "node:process";

/**
 * The path to the app data folder for the app.
 */
export const APP_DATA_FOLDER_PATH: string = path.join(
    process.env.APPDATA || (process.platform === "darwin" ? `${process.env.HOME!}/Library/Application Support` : `${process.env.HOME!}/.local/share`),
    "bedrock_world_editor"
);
