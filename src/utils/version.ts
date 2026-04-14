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
const VERSION: string = require(path.join(__dirname, "../".repeat(/* +!isDev +  */ 2) + "package.json"))
    .version as (typeof import("../../package.json"))["version"];

/**
 * The build of the app, sourced from `package.json`.
 *
 * It is in valid semver build format (the part after the +).
 */
const VERSION_BUILD: string | null =
    (require(path.join(__dirname, "../".repeat(/* +!isDev +  */ 2) + "package.json")).build as (typeof import("../../package.json"))["build"]) ?? null;

/**
 * The full version of the app, source from the combination of {@link VERSION} and {@link VERSION_BUILD}.
 *
 * It is in valid semver.
 */
const VERSION_FULL: string = VERSION + (VERSION_BUILD !== null ? `+${VERSION_BUILD}` : "");

/**
 * The version of the app to be displayed, in development mode it is {@link VERSION_FULL}, in production mode it is {@link VERSION}.
 */
const VERSION_DISP: string = isDev ? VERSION_FULL : VERSION;

/**
 * The version of the app to be displayed, in development mode it is {@link VERSION_FULL} with the "BUILD." part removed, in production mode it is {@link VERSION}.
 */
const VERSION_DISP_SHORT: string = isDev ? VERSION + (VERSION_BUILD !== null ? `+${VERSION_BUILD.replace(/^BUILD\./, "")}` : "") : VERSION;

/**
 * The version of the `mcbe-leveldb` node module.
 */
const VERSION_MCBE_LEVELDB: string = require("mcbe-leveldb/package.json").version;

/**
 * The version of the `@8crafter/leveldb-zlib` node module.
 */
const VERSION_LEVELDB_ZLIB: string = require("@8crafter/leveldb-zlib/package.json").version;

globalThis.VERSION = VERSION;
globalThis.VERSION_BUILD = VERSION_BUILD;
globalThis.VERSION_FULL = VERSION_FULL;
globalThis.VERSION_DISP = VERSION_DISP;
globalThis.VERSION_DISP_SHORT = VERSION_DISP_SHORT;
globalThis.VERSION_MCBE_LEVELDB = VERSION_MCBE_LEVELDB;
globalThis.VERSION_LEVELDB_ZLIB = VERSION_LEVELDB_ZLIB;

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

        /**
         * The build of the app, sourced from `package.json`.
         *
         * It is in valid semver build format (the part after the +).
         *
         * @global
         */
        var VERSION_BUILD: string | null;

        /**
         * The version of the app, sourced from `package.json`.
         *
         * It is in valid semver format.
         *
         * @global
         */
        var VERSION_FULL: string;

        /**
         * The version of the app to be displayed, in development mode it is {@link VERSION_FULL}, in production mode it is {@link VERSION}.
         *
         * @global
         */
        var VERSION_DISP: string;

        /**
         * The shortened version of the app to be displayed, in development mode it is {@link VERSION_FULL} with the "BUILD." part removed, in production mode it is {@link VERSION}.
         *
         * @global
         */
        var VERSION_DISP_SHORT: string;

        /**
         * The version of the `mcbe-leveldb` node module.
         *
         * @global
         */
        var VERSION_MCBE_LEVELDB: string;

        /**
         * The version of the `@8crafter/leveldb-zlib` node module.
         *
         * @global
         */
        var VERSION_LEVELDB_ZLIB: string;
    }
}
