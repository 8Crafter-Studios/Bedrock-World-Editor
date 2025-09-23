/**
 * src/utils/version.ts
 * @module
 * @description A file that defines the global VERSION variable.
 * @supports Preload
 */
import path from "node:path";

/**
 * Whether the app is running in development mode.
 */
const isDev: boolean = process.env.NODE_ENV === "development";

/**
 * The version of the app, sourced from `package.json`.
 *
 * It is in valid semver format.
 */
const VERSION: string = require(path.join(__dirname, "../".repeat(/* +!isDev +  */2) + "package.json"))
    .version as typeof import("../../package.json")["version"];

globalThis.VERSION = VERSION;

declare global {
    namespace globalThis {
        /**
         * The version of the app, sourced from `package.json`.
         *
         * It is in valid semver format.
         *
         * @global
         */
        var VERSION: string;
    }
}
