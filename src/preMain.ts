import { app } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";

export const isSecondInstance: boolean =
    !started ?
        !app.requestSingleInstanceLock() ?
            (app.quit(), true)
        :   false
    :   false;

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    process.env.resourcesPath = path.join(__dirname, "../../", "resources/");
} else {
    process.env.resourcesPath = path.join(__dirname, "../../../", "resources/");
}
