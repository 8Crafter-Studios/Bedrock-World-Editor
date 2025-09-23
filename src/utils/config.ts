/**
 * src/utils/config.ts
 * @module
 * @description A file containing the config class, which is used to store and retrieve app settings.
 * @supports Main, Preload, Renderer
 */
import { existsSync, mkdirSync, readFileSync, Stats, watchFile, writeFileSync } from "node:fs";
import { globSync } from "glob";
import path from "node:path";
// import os from "node:os";
import { APP_DATA_FOLDER_PATH } from "./URLs";
import process from "node:process";
import { EventEmitter } from "node:events";
import "../init/JSONB.ts";
const nativeTheme =
    process.type === "browser"
        ? (require("electron") as typeof import("electron")).nativeTheme
        : (require("@electron/remote") as typeof import("@electron/remote")).nativeTheme;

namespace exports {
    export const volumeCategories: ["master", "ui"] = ["master", "ui"];
    export const volumeCategoryDisplayMapping = {
        master: "Master",
        ui: "UI",
    } as const satisfies { [category in (typeof volumeCategories)[number]]: string };
    type VolumeConfigBase = { [category in (typeof volumeCategories)[number]]: number };
    type ViewsConfigBase = { [category in TabManagerTabGenericSubTabID]: object };
    type ConfigEventMap_SettingChangedEvents = {
        /**
         * Emitted when the corresponding setting is changed.
         */
        [key in PropertyPathsWithoutOuterContainingProperties<ConfigJSON> as `settingChanged:${Join<key, ".">}`]: [
            value: GetPropertyValueAtPath<ConfigJSON, key>
        ];
    };
    export interface ConfigEventMap extends ConfigEventMap_SettingChangedEvents {
        /**
         * Emitted when the config is updated.
         */
        configUpdated: [data: ConfigJSON];
        /**
         * Emitted when a setting is changed.
         */
        settingChanged: {
            [key in PropertyPathsWithoutOuterContainingProperties<ConfigJSON> as Join<key, ".">]: [
                key: Join<key, ".">,
                value: GetPropertyValueAtPath<ConfigJSON, key>
            ];
        }[Join<PropertyPathsWithoutOuterContainingProperties<ConfigJSON>, ".">];
    }
    type GetBaseJSONTypeOfConfig_Inner<T extends Config | SubConfigValueTypes> = Omit<
        ExcludeMethods<ExcludeReadonlyProps<T>>,
        "constructor" | keyof EventEmitter
    >;
    type GetBaseJSONTypeOfConfig<T extends Config | SubConfigValueTypes, P extends boolean = false> = P extends true
        ? Partial<GetBaseJSONTypeOfConfig_Inner<T>>
        : GetBaseJSONTypeOfConfig_Inner<T>;
    type GetSubConfigJSONTypeOfConfig_Inner<T extends Config | SubConfigValueTypes, P extends boolean = false> = Mutable<{
        [key in Exclude<keyof T, symbol> as T[key] extends SubConfigValueTypes ? key : never]: key extends symbol
            ? never
            : T[key] extends SubConfigValueTypes
            ? GetJSONTypeOfConfig<T[key], P>
            : never;
    }>;
    type GetSubConfigJSONTypeOfConfig<T extends Config | SubConfigValueTypes, P extends boolean = false> = P extends true
        ? Partial<GetSubConfigJSONTypeOfConfig_Inner<T, P>>
        : GetSubConfigJSONTypeOfConfig_Inner<T>;
    type GetJSONTypeOfConfigA<T extends Config | SubConfigValueTypes, P extends boolean = false> = {
        [key in Exclude<NonNullable<keyof GetBaseJSONTypeOfConfig<T, false>>, symbol>]: GetBaseJSONTypeOfConfig<T, P>[key];
    } & {
        [key in Exclude<NonNullable<keyof GetSubConfigJSONTypeOfConfig<T, false>>, symbol>]: key extends symbol
            ? never
            : T[key] extends SubConfigValueTypes
            ? GetJSONTypeOfConfig<T[key], P>
            : never;
    };
    type GetJSONTypeOfConfigB<T extends Config | SubConfigValueTypes, P extends boolean = false> = P extends true
        ? Partial<MergeObjectTypes<GetJSONTypeOfConfigA<T, P>>>
        : MergeObjectTypes<GetJSONTypeOfConfigA<T, P>>;

    type GetJSONTypeOfConfigInner<T extends Config | SubConfigValueTypes, P extends boolean = false> = {
        [key in Exclude<NonNullable<keyof GetBaseJSONTypeOfConfig<T, false> | keyof GetSubConfigJSONTypeOfConfig<T, false>>, symbol> as T[key] extends never
            ? never
            : key]: key extends keyof GetSubConfigJSONTypeOfConfig<T>
            ? T[key] extends SubConfigValueTypes
                ? GetJSONTypeOfConfig<T[key], P>
                : never
            : key extends keyof GetBaseJSONTypeOfConfig<T, false>
            ? GetBaseJSONTypeOfConfig<T, P>[key]
            : never;
    };
    type GetJSONTypeOfConfig<T extends Config | SubConfigValueTypes, P extends boolean = false> = P extends true
        ? Partial<GetJSONTypeOfConfigInner<T, P>>
        : GetJSONTypeOfConfigInner<T>;
    type ConfigJSONBase<P extends boolean = false> = GetBaseJSONTypeOfConfig<Config, P>;
    type ConfigJSONSubConfigs<P extends boolean = false> = P extends true
        ? Partial<Mutable<{ [key in keyof Config as key extends symbol ? never : Config[key] extends SubConfigValueTypes ? key : never]: Config[key] }>>
        : Mutable<{ [key in keyof Config as key extends symbol ? never : Config[key] extends SubConfigValueTypes ? key : never]: Config[key] }>;
    export type ConfigJSON<P extends boolean = false> = GetJSONTypeOfConfig<Config, P>;
    function cullUndefinedProperties<T extends { [key: PropertyKey]: unknown }>(
        obj: T
    ): { [key in keyof T as undefined extends T[key] ? never : key]: Exclude<T[key], undefined> } {
        return Object.fromEntries(Object.entries(obj).filter(([key, value]: [key: string, value: unknown]): boolean => value !== undefined)) as any;
    }
    type DeepSubConfigKeyStructureOfConfig<T extends Config | SubConfigValueTypes> = OmitNeverValueKeys<{
        [key in keyof T as key extends symbol ? never : T[key] extends SubConfigValueTypes ? key : never]: T[key] extends never
            ? never
            : T[key] extends SubConfigValueTypes
            ? DeepSubConfigKeyStructureOfConfig<T[key]>
            : never;
    }>;
    const subConfigKeyStructure = {
        volume: {},
        views: {
            players: {
                modeSettings: {
                    simple: {},
                    raw: {
                        sections: {
                            client: {},
                            server: {},
                        },
                    },
                },
            },
            entities: {
                modeSettings: {
                    simple: {},
                },
            },
            maps: {
                modeSettings: {
                    simple: {},
                },
            }
        },
    } as const satisfies DeepSubConfigKeyStructureOfConfig<Config>;
    /**
     * A class for managing the config file.
     */
    class Config extends EventEmitter<ConfigEventMap> {
        /**
         * The default values for the config file.
         */
        public static readonly defaults = Object.freeze({
            minecraftDataFolders: [
                "%localappdata%/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang",
                "%localappdata%/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang",
                "Home/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang",
                "Home/.local/share/mcpelauncher/games/com.mojang",
                "Home/Library/Application Support/mcpelauncher/games/com.mojang",
            ],
            extraMinecraftDataFolders: [
                "%appdata%/.minecraft_bedrock/installations/*/packageData",
                "%appdata%/.minecraft_bedrock/installations/*/*/packageData",
            ],
            attemptToKeepCurrentConfigWhenUpdatingVersion: false,
            GUIScale: 0,
            GUIScaleOverride: null,
            theme: "auto",
            debugHUD: "none",
            panorama: "off",
            panoramaPerspective: 400,
            panoramaRotateDirection: "counterclockwise",
            panoramaRotateSpeed: 2.5,
            volume: { master: 100, ui: 100 },
            views: {
                players: {
                    mode: "simple",
                    modeSettings: {
                        simple: {
                            columns: ["Name", "UUID", "Permissions"],
                        },
                        raw: {
                            sections: {
                                client: {
                                    columns: ["DBKey", "Name", "MsaId", "SelfSignedId", "ServerId"],
                                },
                                server: {
                                    columns: ["DBKey", "ClientId", "Name", "UUID", "Permissions", "Location", "Rotation", "Spawn", "GameMode", "Level"],
                                },
                            },
                        },
                    },
                },
                entities: {
                    mode: "simple",
                    modeSettings: {
                        simple: {
                            columns: ["DBKey", "TypeID", "UUID", "Name", "Location", "Rotation"],
                        },
                    },
                },
                maps: {
                    mode: "simple",
                    modeSettings: {
                        simple: {
                            columns: ["Preview", "DBKey", "ID", "Scale", "FullyExplored", "Location", "Height", "ParentMapID"],
                        },
                    },
                },
            },
        } as const satisfies ConfigJSON);
        /**
         * The currently loaded data from the config file.
         */
        #currentlyLoadedData: ConfigJSON = this.readConfigFile();
        public constructor(options?: ConstructorParameters<typeof EventEmitter>[0]) {
            super(options);
            this.readConfigFile();
            watchFile(path.join(APP_DATA_FOLDER_PATH, "./config.json"), (current: Stats, previous: Stats): void => {
                if (current.mtimeMs !== previous.mtimeMs) {
                    this.#currentlyLoadedData = this.readConfigFile() ?? this.#currentlyLoadedData;
                }
            });
        }
        /**
         * Saves changes to the config file.
         *
         * @param data The data to save.
         */
        public saveChanges(data: ConfigJSON<true>): void {
            const existingData: ConfigJSON = this.getConfigData(true);
            function mergeConfigData<
                T extends Config | SubConfigValueTypes,
                Path extends PropertyPathsWithoutOuterContainingProperties<Config> | [] = [],
                EndPath extends Path[number] = Path[number]
            >(oldData: GetJSONTypeOfConfig<T>, newData: GetJSONTypeOfConfig<T, true>, path: Path = [] as unknown as Path): GetJSONTypeOfConfig<T> {
                let data = { ...oldData, ...newData };

                for (const [key, value] of Object.entries(data) as [EndPath & keyof typeof data, any][]) {
                    console.log(0, path, key, value, oldData, newData, data);
                    if (key in (getPropertyAtPath(Config.defaults, path) ?? {}) && getPropertyAtPath(subConfigKeyStructure, [...(path as Path), key])) {
                        console.log(0.1, path, key, value);
                        if (data[key] !== undefined && (typeof data[key] !== "object" || data[key] === null)) {
                            continue;
                        }
                        if (newData[key as keyof typeof newData] !== undefined) {
                            console.log(1, path, key, data[key], data);
                            if (oldData[key as keyof typeof oldData] !== undefined) {
                                data[key] = mergeConfigData(oldData[key as keyof typeof oldData]!, newData[key as keyof typeof newData]!, [
                                    ...path,
                                    key,
                                ] as any) as any;
                            } else {
                                data[key] = newData[key as keyof typeof newData]! as any;
                            }
                            console.log(2, path, key, data[key], data);
                            // return data[key];
                        } else if (key in data) {
                            console.log(3, path, key, data[key], data);
                            // return data[key];
                        } else {
                            console.log(4, path, key, data[key], data);
                            data[key] = getPropertyAtPath(existingData, [...path, key]) ?? getPropertyAtPath(Config.defaults, [...path, key]) ?? ({} as any);
                            console.log(5, path, key, data[key], data);
                            // return data[key];
                        }
                    }
                }
                return data;
            }
            const newData: ConfigJSON = mergeConfigData<Config, []>(existingData, data);
            this.#currentlyLoadedData = newData;
            if (!existsSync(APP_DATA_FOLDER_PATH)) {
                mkdirSync(APP_DATA_FOLDER_PATH, { recursive: true });
            }
            writeFileSync(path.join(APP_DATA_FOLDER_PATH, "./config.json"), JSONB.stringify(newData, null, 4), { encoding: "utf-8" });
            const emitConfigChange = (data: object, path: PropertyPathsWithoutOuterContainingProperties<Config> | [] = []): boolean => {
                let success: boolean = false;
                const dataAtCurrentPath = getPropertyAtPath(data, path);
                if (!dataAtCurrentPath) return false;
                for (const [key, value] of Object.entries(dataAtCurrentPath) as [string | number, any][]) {
                    const fullKey: ConfigEventMap["settingChanged"][0] = [...path, key].join(".") as ConfigEventMap["settingChanged"][0];
                    if (
                        [...path, key].reduce(
                            (previousValue: any, currentValue: string | number): any =>
                                previousValue ? (currentValue in previousValue ? previousValue[currentValue] : undefined) : undefined,
                            subConfigKeyStructure as any
                        )
                    ) {
                        if (emitConfigChange(data, [...path, key] as any)) {
                            success = true;
                            continue;
                        }
                    }
                    if (getPropertyAtPath(Config.defaults, path as any)) {
                        success = true;
                        this.emit(`settingChanged:${fullKey}`, value as any);
                        this.emit("settingChanged", fullKey, value as any);
                    }
                }
                return success;
            };
            emitConfigChange(data);
            this.emit("configUpdated", newData);
        }
        /**
         * Gets the config data.
         *
         * @param forceReloadIfUndefined Whether to force a reload if the data is undefined. Defaults to `false`.
         * @returns The config data.
         */
        public getConfigData(forceReloadIfUndefined: boolean = false): ConfigJSON {
            /* 
            if (!disableConfigUpdate && Date.now() - this.#lastDataLoadTime > 1000) {
                this.#currentlyLoadedData = this.readConfigFile() ?? this.#currentlyLoadedData;
                this.#lastDataLoadTime = Date.now();
            } */
            return this.#currentlyLoadedData ?? (forceReloadIfUndefined ? this.readConfigFile() : undefined);
        }
        /**
         * Reads the config file.
         *
         * @returns The data from the config file.
         */
        public readConfigFile(): ConfigJSON {
            if (!existsSync(path.join(APP_DATA_FOLDER_PATH, "./config.json"))) {
                mkdirSync(APP_DATA_FOLDER_PATH, { recursive: true });
                writeFileSync(path.join(APP_DATA_FOLDER_PATH, "./config.json"), JSONB.stringify(Config.defaults, null, 4), { encoding: "utf-8" });
            }
            return { ...Config.defaults, ...JSONB.parse(readFileSync(path.join(APP_DATA_FOLDER_PATH, "./config.json"), { encoding: "utf-8" })) };
        }
        /**
         * The Minecraft data folders, should be globs.
         *
         * These are folders that will directly contain a `minecraftWorlds` folder containing all your Minecraft world folders.
         *
         * These are shown on the start screen.
         *
         * @default
         * ```typescript
         * [
         *     "%localappdata%/Packages/Microsoft.MinecraftUWP_8wekyb3d8bbwe/LocalState/games/com.mojang",
         *     "%localappdata%/Packages/Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe/LocalState/games/com.mojang",
         *     "Home/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang",
         *     "Home/.local/share/mcpelauncher/games/com.mojang",
         *     "Home/Library/Application Support/mcpelauncher/games/com.mojang",
         * ]
         * ```
         */
        public get minecraftDataFolders(): string[] {
            return this.getConfigData().minecraftDataFolders ?? Config.defaults.minecraftDataFolders;
        }
        public set minecraftDataFolders(value: string[] | undefined) {
            this.saveChanges({ minecraftDataFolders: value ?? Config.defaults.minecraftDataFolders });
        }
        /**
         * The extra Minecraft data folders, should be globs.
         *
         * These are folders that will directly contain a `minecraftWorlds` folder containing all your Minecraft world folders.
         *
         * These are not shown on the start screen unless you click show more
         *
         * @default
         * ```typescript
         * [
         *     "%appdata%/.minecraft_bedrock/installations/*\/packageData",
         *     "%appdata%/.minecraft_bedrock/installations/*\/*\/packageData",
         * ]
         * ```
         */
        public get extraMinecraftDataFolders(): string[] {
            return this.getConfigData().extraMinecraftDataFolders ?? Config.defaults.extraMinecraftDataFolders;
        }
        public set extraMinecraftDataFolders(value: string[] | undefined) {
            this.saveChanges({ extraMinecraftDataFolders: value ?? Config.defaults.extraMinecraftDataFolders });
        }
        /**
         * The parsed version folder search locations.
         *
         * This replaces special codes with their corresponding environment variable values.
         */
        public get parsedMinecraftDataFolders(): string[] {
            return this.minecraftDataFolders
                .map((location: string): string[] =>
                    globSync(
                        location
                            .replaceAll(/%appdata%/gi, process.env.APPDATA!)
                            .replace(/^Home(?=\/)/, process.env.HOME!)
                            .replaceAll(/%userprofile%/gi, process.env.USERPROFILE!)
                            .replaceAll(/%programdata%/gi, process.env.ProgramData!)
                            .replaceAll(/%programfiles%/gi, process.env.ProgramFiles!)
                            .replaceAll(/%localappdata%/gi, process.env.LOCALAPPDATA!)
                            .replaceAll(/%temp%/gi, process.env.TEMP!)
                            .replaceAll(/%tmp%/gi, process.env.TMP!)
                            .replaceAll(/%public%/gi, process.env.PUBLIC!)
                            .replaceAll(/\\/g, "/")
                            .replace(/(?<!\/)$/, "/"),
                        {
                            absolute: true,
                            realpath: true,
                        }
                    )
                )
                .flat();
        }
        /**
         * The parsed version folder search locations.
         *
         * This replaces special codes with their corresponding environment variable values.
         */
        public get parsedExtraMinecraftDataFolders(): string[] {
            return this.extraMinecraftDataFolders
                .map((location: string): string[] =>
                    globSync(
                        location
                            .replaceAll(/%appdata%/gi, process.env.APPDATA!)
                            .replace(/^Home(?=\/)/, process.env.HOME!)
                            .replaceAll(/%userprofile%/gi, process.env.USERPROFILE!)
                            .replaceAll(/%programdata%/gi, process.env.ProgramData!)
                            .replaceAll(/%programfiles%/gi, process.env.ProgramFiles!)
                            .replaceAll(/%localappdata%/gi, process.env.LOCALAPPDATA!)
                            .replaceAll(/%temp%/gi, process.env.TEMP!)
                            .replaceAll(/%tmp%/gi, process.env.TMP!)
                            .replaceAll(/%public%/gi, process.env.PUBLIC!)
                            .replaceAll(/\\/g, "/")
                            .replace(/(?<!\/)$/, "/"),
                        {
                            absolute: true,
                        }
                    )
                )
                .flat();
        }
        /**
         * The GUI scale of the app.
         *
         * This is added to {@link baseGUIScale} to get the actual GUI scale.
         *
         * @deprecated
         *
         * @default 0
         *
         * @example -1
         */
        public get GUIScale(): number {
            return this.getConfigData().GUIScale ?? Config.defaults.GUIScale;
        }
        public set GUIScale(value: number | undefined) {
            this.saveChanges({ GUIScale: value ?? Config.defaults.GUIScale });
        }
        /**
         * The GUI scale override of the app.
         *
         * If this is not `null`, this will override the value of {@link actualGUIScale}.
         *
         * @deprecated
         *
         * @default null
         *
         * @example 3
         */
        public get GUIScaleOverride(): number | null {
            return this.getConfigData().GUIScaleOverride ?? Config.defaults.GUIScaleOverride;
        }
        public set GUIScaleOverride(value: number | null | undefined) {
            this.saveChanges({ GUIScaleOverride: value ?? Config.defaults.GUIScaleOverride });
        }
        /**
         * The base GUI scale of the app.
         *
         * It is calculated using this expression:
         * ```typescript
         * Math.max(1, Math.min(Math.floor(innerWidth / 320), Math.floor(innerHeight / 240)))
         * ```
         *
         * @readonly
         *
         * @deprecated
         */
        public get baseGUIScale(): number {
            return Math.max(1, Math.min(Math.floor((innerWidth - 280) / 320), Math.floor(innerHeight / 240)));
        }
        /**
         * The calculated GUI scale of the app.
         *
         * This is the sum of {@link baseGUIScale} and {@link GUIScale}.
         *
         * Note: {@link GUIScale} will be clamped to be between `-Math.max(baseGUIScale - 3, 0)` and `0`.
         *
         * @readonly
         *
         * @deprecated
         */
        public get calculatedGUIScale(): number {
            const baseGUIScale: number = this.baseGUIScale;
            return Math.max(baseGUIScale + Math.max(this.GUIScale, -Math.max(baseGUIScale - 3, 0)), 1);
        }
        /**
         * The actual GUI scale of the app.
         *
         * If {@link GUIScaleOverride} is not `null`, this will be the value of {@link GUIScaleOverride}.
         *
         * Otherwise, this is the sum of {@link baseGUIScale} and {@link GUIScaleOverride}.
         *
         * @readonly
         *
         * @deprecated
         */
        public get actualGUIScale(): number {
            return this.GUIScaleOverride ?? this.calculatedGUIScale;
        }
        /**
         * Whether to attempt to keep the current config when updating the version.
         */
        public get attemptToKeepCurrentConfigWhenUpdatingVersion(): boolean {
            return this.getConfigData().attemptToKeepCurrentConfigWhenUpdatingVersion ?? Config.defaults.attemptToKeepCurrentConfigWhenUpdatingVersion;
        }
        public set attemptToKeepCurrentConfigWhenUpdatingVersion(value: boolean | undefined) {
            this.saveChanges({ attemptToKeepCurrentConfigWhenUpdatingVersion: value ?? Config.defaults.attemptToKeepCurrentConfigWhenUpdatingVersion });
        }
        public get theme(): "auto" | "dark" | "light" | "blue" {
            return this.getConfigData().theme ?? Config.defaults.theme;
        }
        public set theme(value: "auto" | "dark" | "light" | "blue" | undefined) {
            this.saveChanges({ theme: value ?? Config.defaults.theme });
        }
        public get actualTheme(): "dark" | "light" | "blue" {
            return this.theme === "auto" ? (nativeTheme.shouldUseDarkColors ? "dark" : "light") : this.theme;
        }
        public get debugHUD(): (typeof ConfigConstants.debugOverlayModeList)[number] {
            return this.getConfigData().debugHUD ?? Config.defaults.debugHUD;
        }
        public set debugHUD(value: (typeof ConfigConstants.debugOverlayModeList)[number] | undefined) {
            this.saveChanges({ debugHUD: value ?? Config.defaults.debugHUD });
        }
        public get panorama(): (typeof ConfigConstants.panoramaList)[number] {
            return this.getConfigData().panorama ?? Config.defaults.panorama;
        }
        public set panorama(value: (typeof ConfigConstants.panoramaList)[number] | undefined) {
            this.saveChanges({ panorama: value ?? Config.defaults.panorama });
        }
        public get panoramaPerspective(): number {
            return this.getConfigData().panoramaPerspective ?? Config.defaults.panoramaPerspective;
        }
        public set panoramaPerspective(value: number | undefined) {
            this.saveChanges({ panoramaPerspective: value ?? Config.defaults.panoramaPerspective });
        }
        public get panoramaRotateDirection(): "clockwise" | "counterclockwise" {
            return this.getConfigData().panoramaRotateDirection ?? Config.defaults.panoramaRotateDirection;
        }
        public set panoramaRotateDirection(value: "clockwise" | "counterclockwise" | undefined) {
            this.saveChanges({ panoramaRotateDirection: value ?? Config.defaults.panoramaRotateDirection });
        }
        public get panoramaRotateSpeed(): number {
            return this.getConfigData().panoramaRotateSpeed ?? Config.defaults.panoramaRotateSpeed;
        }
        public set panoramaRotateSpeed(value: number | undefined) {
            this.saveChanges({ panoramaRotateSpeed: value ?? Config.defaults.panoramaRotateSpeed });
        }
        /**
         * The volume options.
         *
         * Each category *should* be between 0 and 100 (inclusive).
         *
         * @readonly
         */
        public readonly volume: VolumeConfig = new VolumeConfig(this);
        /**
         * The views options.
         *
         * @readonly
         */
        public readonly views: ViewsConfig = new ViewsConfig(this);
        /**
         * Constants for properties of the config.
         *
         * These are not settings.
         */
        public readonly constants: typeof ConfigConstants = ConfigConstants;
    }
    type SubConfigValueTypes = (typeof subConfigValueClasses)[number]["prototype"];
    /**
     * The volume config.
     */
    class VolumeConfig implements VolumeConfigBase {
        /**
         * The config that this volume config belongs to.
         *
         * @readonly
         */
        readonly #config: Config;
        /**
         * Creates a new volume config.
         *
         * @param config The config that this volume config belongs to.
         */
        public constructor(config: Config) {
            this.#config = config;
        }
        /**
         * The master volume.
         *
         * @default 100
         */
        public get master(): number {
            return this.#config.getConfigData().volume?.master ?? Config.defaults.volume.master;
        }
        public set master(value: number | undefined) {
            this.#config.saveChanges({ volume: { master: value ?? Config.defaults.volume.master } });
        }
        /**
         * The UI volume.
         *
         * @default 100
         */
        public get ui(): number {
            return this.#config.getConfigData().volume?.ui ?? Config.defaults.volume.ui;
        }
        public set ui(value: number | undefined) {
            this.#config.saveChanges({ volume: { ui: value ?? Config.defaults.volume.ui } });
        }
    }
    /**
     * The volume config.
     */
    class ViewsConfig implements Partial<ViewsConfigBase> {
        /**
         * The config that this volume config belongs to.
         *
         * @readonly
         */
        readonly #config: Config;
        /**
         * Creates a new volume config.
         *
         * @param config The config that this volume config belongs to.
         */
        public constructor(config: Config) {
            this.#config = config;
        }
        public readonly players = new (class PlayersViewConfig extends DeepSubConfig<ViewsConfig> {
            public get mode(): ConfigConstants.views.Players.PlayersTabMode {
                return this[DeepSubConfig_configSymbol].#config.getConfigData().views?.players?.mode ?? Config.defaults.views.players.mode;
            }
            public set mode(value: ConfigConstants.views.Players.PlayersTabMode | undefined) {
                this[DeepSubConfig_configSymbol].#config.saveChanges({ views: { players: { mode: value ?? Config.defaults.views.players.mode } } });
            }
            public readonly modeSettings = new ((() => {
                const subConfigClassSymbol: unique symbol = Symbol.for("PlayersViewConfig_ModeSettings_subConfig");
                class PlayersViewConfig_ModeSettings
                    extends DeepSubConfig<PlayersViewConfig>
                    implements Record<ConfigConstants.views.Players.PlayersTabMode, (typeof subConfigValueClasses)[number]["prototype"]>
                {
                    public static readonly __subConfigClassSymbol__: symbol = subConfigClassSymbol;
                    public static readonly [subConfigClassSymbol] = (() => {
                        abstract class PlayersViewConfig_ModeSettings_SubConfig<
                            T extends ConfigConstants.views.Players.PlayersTabMode,
                            M extends (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)[T] = (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)[T],
                            HasNullSection extends null extends M[number] ? true : false = null extends M[number] ? true : false,
                            HasNonNullSection extends Extract<M[number], string> extends never ? false : true = Extract<M[number], string> extends never
                                ? false
                                : true
                        > extends DeepSubConfig<PlayersViewConfig_ModeSettings> {
                            public readonly modes: M;
                            public constructor(config: PlayersViewConfig_ModeSettings, public readonly mode: T) {
                                super(config);
                                this.modes = ConfigConstants.views.Players.playersTabModeToSectionIDs[mode] as M;
                            }
                            public get columns(): HasNullSection extends true
                                ? (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                      ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<T, M[number]>,
                                      keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                  >][number][]
                                : never {
                                if ((this.modes as M[number][]).includes(null)) {
                                    return ((
                                        this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.getConfigData().views
                                            ?.players?.modeSettings?.[this.mode] as any
                                    )?.columns ??
                                        (
                                            Config.defaults.views.players.modeSettings[this.mode] as unknown as Extract<
                                                (typeof Config)["defaults"]["views"]["players"]["modeSettings"][T],
                                                { columns: any }
                                            >
                                        ).columns) as any;
                                } else {
                                    return void 0 as never;
                                }
                            }
                            public set columns(
                                value: HasNullSection extends true
                                    ? (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                          ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<T, M[number]>,
                                          keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                      >][number][]
                                    : never
                            ) {
                                if ((this.modes as M[number][]).includes(null)) {
                                    this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.saveChanges({
                                        views: { players: { modeSettings: { [this.mode]: { columns: value } } } },
                                    });
                                }
                            }
                            public abstract readonly sections: HasNonNullSection extends true
                                ? DeepSubConfig<any> & {
                                      [K in NonNullable<M[number]>]: DeepSubConfig<any> & {
                                          columns: (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                              ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<T, NonNullable<M[number]>>,
                                              keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                          >][number][];
                                      };
                                  }
                                : never;
                        }
                        return PlayersViewConfig_ModeSettings_SubConfig;
                    })();
                    public readonly simple = new (class PlayersViewConfig_ModeSettings_simple extends PlayersViewConfig_ModeSettings[
                        subConfigClassSymbol
                    ]<"simple"> {
                        public declare readonly sections: never;
                    })(this, "simple");
                    public readonly raw = new (class PlayersViewConfig_ModeSettings_raw extends PlayersViewConfig_ModeSettings[subConfigClassSymbol]<"raw"> {
                        public readonly sections = new (class PlayersViewConfig_ModeSettings_raw_sections
                            extends DeepSubConfig<PlayersViewConfig_ModeSettings_raw>
                            implements
                                Extract<
                                    {
                                        [K in (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)["raw"][number]]: DeepSubConfig<PlayersViewConfig_ModeSettings_raw_sections> & {
                                            columns: (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                                ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<
                                                    "raw",
                                                    (typeof ConfigConstants.views.Players.playersTabModeToSectionIDs)["raw"][number]
                                                >,
                                                keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                            >][number][];
                                        };
                                    },
                                    any
                                >
                        {
                            public readonly client =
                                new (class PlayersViewConfig_ModeSettings_raw_sections_client extends DeepSubConfig<PlayersViewConfig_ModeSettings_raw_sections> {
                                    public get columns(): (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                        ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<"raw", "client">,
                                        keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                    >][number][] {
                                        return (
                                            this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][
                                                DeepSubConfig_configSymbol
                                            ][DeepSubConfig_configSymbol].#config.getConfigData().views?.players?.modeSettings?.raw?.sections?.client
                                                ?.columns ?? Config.defaults.views.players.modeSettings.raw.sections.client.columns
                                        );
                                    }
                                    public set columns(
                                        value:
                                            | (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                                  ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<"raw", "client">,
                                                  keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                              >][number][]
                                            | undefined
                                    ) {
                                        this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][
                                            DeepSubConfig_configSymbol
                                        ].#config.saveChanges({
                                            views: {
                                                players: {
                                                    modeSettings: {
                                                        raw: {
                                                            sections: {
                                                                client: { columns: value },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        });
                                    }
                                })(this);
                            public readonly server =
                                new (class PlayersViewConfig_ModeSettings_raw_sections_client extends DeepSubConfig<PlayersViewConfig_ModeSettings_raw_sections> {
                                    public get columns(): (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                        ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<"raw", "server">,
                                        keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                    >][number][] {
                                        return (
                                            this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][
                                                DeepSubConfig_configSymbol
                                            ][DeepSubConfig_configSymbol].#config.getConfigData().views?.players?.modeSettings?.raw?.sections?.server
                                                ?.columns ?? Config.defaults.views.players.modeSettings.raw.sections.server.columns
                                        );
                                    }
                                    public set columns(
                                        value:
                                            | (typeof ConfigConstants.views.Players.playersTabModeToColumnIDs)[Extract<
                                                  ConfigConstants.views.Players.PlayersTabSectionModeFromPlayersTabModeAndSectionID<"raw", "server">,
                                                  keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                                              >][number][]
                                            | undefined
                                    ) {
                                        this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][
                                            DeepSubConfig_configSymbol
                                        ].#config.saveChanges({
                                            views: {
                                                players: {
                                                    modeSettings: {
                                                        raw: {
                                                            sections: {
                                                                server: { columns: value },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        });
                                    }
                                })(this);
                        })(this);
                    })(this, "raw");
                }
                return PlayersViewConfig_ModeSettings;
            })())(this);
        })(this);
        public readonly entities = new (class EntitiesViewConfig extends DeepSubConfig<ViewsConfig> {
            public get mode(): ConfigConstants.views.Entities.EntitiesTabMode {
                return this[DeepSubConfig_configSymbol].#config.getConfigData().views?.entities?.mode ?? Config.defaults.views.entities.mode;
            }
            public set mode(value: ConfigConstants.views.Entities.EntitiesTabMode | undefined) {
                this[DeepSubConfig_configSymbol].#config.saveChanges({ views: { entities: { mode: value ?? Config.defaults.views.entities.mode } } });
            }
            public readonly modeSettings = new ((() => {
                const subConfigClassSymbol: unique symbol = Symbol.for("EntitiesViewConfig_ModeSettings_subConfig");
                class EntitiesViewConfig_ModeSettings
                    extends DeepSubConfig<EntitiesViewConfig>
                    implements Record<ConfigConstants.views.Entities.EntitiesTabMode, (typeof subConfigValueClasses)[number]["prototype"]>
                {
                    public static readonly __subConfigClassSymbol__: symbol = subConfigClassSymbol;
                    public static readonly [subConfigClassSymbol] = (() => {
                        abstract class EntitiesViewConfig_ModeSettings_SubConfig<
                            T extends ConfigConstants.views.Entities.EntitiesTabMode,
                            M extends (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[T] = (typeof ConfigConstants.views.Entities.entitiesTabModeToSectionIDs)[T],
                            HasNullSection extends null extends M[number] ? true : false = null extends M[number] ? true : false,
                            HasNonNullSection extends Extract<M[number], string> extends never ? false : true = Extract<M[number], string> extends never
                                ? false
                                : true
                        > extends DeepSubConfig<EntitiesViewConfig_ModeSettings> {
                            public readonly modes: M;
                            public constructor(config: EntitiesViewConfig_ModeSettings, public readonly mode: T) {
                                super(config);
                                this.modes = ConfigConstants.views.Entities.entitiesTabModeToSectionIDs[mode] as M;
                            }
                            public get columns(): HasNullSection extends true
                                ? (typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs)[Extract<
                                      ConfigConstants.views.Entities.EntitiesTabSectionModeFromEntitiesTabModeAndSectionID<T, M[number]>,
                                      keyof typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs
                                  >][number][]
                                : never {
                                if ((this.modes as M[number][]).includes(null)) {
                                    return ((
                                        this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.getConfigData().views
                                            ?.entities?.modeSettings?.[this.mode] as any
                                    )?.columns ??
                                        (
                                            Config.defaults.views.entities.modeSettings[this.mode] as unknown as Extract<
                                                (typeof Config)["defaults"]["views"]["entities"]["modeSettings"][T],
                                                { columns: any }
                                            >
                                        ).columns) as any;
                                } else {
                                    return void 0 as never;
                                }
                            }
                            public set columns(
                                value: HasNullSection extends true
                                    ? (typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs)[Extract<
                                          ConfigConstants.views.Entities.EntitiesTabSectionModeFromEntitiesTabModeAndSectionID<T, M[number]>,
                                          keyof typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs
                                      >][number][]
                                    : never
                            ) {
                                if ((this.modes as M[number][]).includes(null)) {
                                    this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.saveChanges({
                                        views: { entities: { modeSettings: { [this.mode]: { columns: value } } } },
                                    });
                                }
                            }
                            public abstract readonly sections: HasNonNullSection extends true
                                ? DeepSubConfig<any> & {
                                      [K in NonNullable<M[number]>]: DeepSubConfig<any> & {
                                          columns: (typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs)[Extract<
                                              ConfigConstants.views.Entities.EntitiesTabSectionModeFromEntitiesTabModeAndSectionID<T, NonNullable<M[number]>>,
                                              keyof typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs
                                          >][number][];
                                      };
                                  }
                                : never;
                        }
                        return EntitiesViewConfig_ModeSettings_SubConfig;
                    })();
                    public readonly simple = new (class EntitiesViewConfig_ModeSettings_simple extends EntitiesViewConfig_ModeSettings[
                        subConfigClassSymbol
                    ]<"simple"> {
                        public declare readonly sections: never;
                    })(this, "simple");
                }
                return EntitiesViewConfig_ModeSettings;
            })())(this);
        })(this);
        public readonly maps = new (class MapsViewConfig extends DeepSubConfig<ViewsConfig> {
            public get mode(): ConfigConstants.views.Maps.MapsTabMode {
                return this[DeepSubConfig_configSymbol].#config.getConfigData().views?.maps?.mode ?? Config.defaults.views.maps.mode;
            }
            public set mode(value: ConfigConstants.views.Maps.MapsTabMode | undefined) {
                this[DeepSubConfig_configSymbol].#config.saveChanges({ views: { maps: { mode: value ?? Config.defaults.views.maps.mode } } });
            }
            public readonly modeSettings = new ((() => {
                const subConfigClassSymbol: unique symbol = Symbol.for("MapsViewConfig_ModeSettings_subConfig");
                class MapsViewConfig_ModeSettings
                    extends DeepSubConfig<MapsViewConfig>
                    implements Record<ConfigConstants.views.Maps.MapsTabMode, (typeof subConfigValueClasses)[number]["prototype"]>
                {
                    public static readonly __subConfigClassSymbol__: symbol = subConfigClassSymbol;
                    public static readonly [subConfigClassSymbol] = (() => {
                        abstract class MapsViewConfig_ModeSettings_SubConfig<
                            T extends ConfigConstants.views.Maps.MapsTabMode,
                            M extends (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[T] = (typeof ConfigConstants.views.Maps.mapsTabModeToSectionIDs)[T],
                            HasNullSection extends null extends M[number] ? true : false = null extends M[number] ? true : false,
                            HasNonNullSection extends Extract<M[number], string> extends never ? false : true = Extract<M[number], string> extends never
                                ? false
                                : true
                        > extends DeepSubConfig<MapsViewConfig_ModeSettings> {
                            public readonly modes: M;
                            public constructor(config: MapsViewConfig_ModeSettings, public readonly mode: T) {
                                super(config);
                                this.modes = ConfigConstants.views.Maps.mapsTabModeToSectionIDs[mode] as M;
                            }
                            public get columns(): HasNullSection extends true
                                ? (typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs)[Extract<
                                      ConfigConstants.views.Maps.MapsTabSectionModeFromMapsTabModeAndSectionID<T, M[number]>,
                                      keyof typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs
                                  >][number][]
                                : never {
                                if ((this.modes as M[number][]).includes(null)) {
                                    return ((
                                        this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.getConfigData().views
                                            ?.maps?.modeSettings?.[this.mode] as any
                                    )?.columns ??
                                        (
                                            Config.defaults.views.maps.modeSettings[this.mode] as unknown as Extract<
                                                (typeof Config)["defaults"]["views"]["maps"]["modeSettings"][T],
                                                { columns: any }
                                            >
                                        ).columns) as any;
                                } else {
                                    return void 0 as never;
                                }
                            }
                            public set columns(
                                value: HasNullSection extends true
                                    ? (typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs)[Extract<
                                          ConfigConstants.views.Maps.MapsTabSectionModeFromMapsTabModeAndSectionID<T, M[number]>,
                                          keyof typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs
                                      >][number][]
                                    : never
                            ) {
                                if ((this.modes as M[number][]).includes(null)) {
                                    this[DeepSubConfig_configSymbol][DeepSubConfig_configSymbol][DeepSubConfig_configSymbol].#config.saveChanges({
                                        views: { maps: { modeSettings: { [this.mode]: { columns: value } } } },
                                    });
                                }
                            }
                            public abstract readonly sections: HasNonNullSection extends true
                                ? DeepSubConfig<any> & {
                                      [K in NonNullable<M[number]>]: DeepSubConfig<any> & {
                                          columns: (typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs)[Extract<
                                              ConfigConstants.views.Maps.MapsTabSectionModeFromMapsTabModeAndSectionID<T, NonNullable<M[number]>>,
                                              keyof typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs
                                          >][number][];
                                      };
                                  }
                                : never;
                        }
                        return MapsViewConfig_ModeSettings_SubConfig;
                    })();
                    public readonly simple = new (class MapsViewConfig_ModeSettings_simple extends MapsViewConfig_ModeSettings[subConfigClassSymbol]<"simple"> {
                        public declare readonly sections: never;
                    })(this, "simple");
                }
                return MapsViewConfig_ModeSettings;
            })())(this);
        })(this);
    }
    const DeepSubConfig_configSymbol: unique symbol = Symbol.for("DeepSubConfig_sourceConfig");
    class DeepSubConfig<T extends Config | (typeof subConfigValueClasses)[number]["prototype"] = Config> {
        /**
         * The config that this deep sub-config belongs to.
         *
         * @readonly
         */
        public readonly [DeepSubConfig_configSymbol]: T;
        /**
         * Creates a new deep sub-config.
         *
         * @param config The config that this deep sub-config belongs to.
         */
        public constructor(config: T) {
            this[DeepSubConfig_configSymbol] = config;
        }
    }
    const subConfigValueClasses = [VolumeConfig, ViewsConfig, DeepSubConfig] as const;

    export namespace ConfigConstants {
        export const debugOverlayModeList = ["none", "top", "basic", "config"] as const;
        export const debugOverlayModes = {
            none: "Off",
            top: "Top",
            basic: "Basic",
            config: "Config",
        } as const satisfies { [key in (typeof config)["debugHUD"]]: string };
        export const panoramaList = [
            "off",
            "beta",
            "buzzy-bees",
            "chase-the-skies",
            "creeking",
            "education-demo",
            "preview",
            "spring-to-life",
            "trails-and-tales",
            "tricky-trials",
            "wild-update",
            "windows-10-edition-beta",
        ] as const;
        export const panoramaDisplayMapping = {
            off: "Off",
            beta: "Beta",
            "buzzy-bees": "Buzzy Bees",
            "chase-the-skies": "Chase the Skies",
            creeking: "Creeking",
            "education-demo": "Education Demo",
            preview: "Preview",
            "spring-to-life": "Spring to Life",
            "trails-and-tales": "Trails and Tales",
            "tricky-trials": "Tricky Trials",
            "wild-update": "Wild Update",
            "windows-10-edition-beta": "Windows 10 Edition Beta",
        };
        export namespace views {
            export namespace Players {
                export const columnIDToDisplayName = {
                    ClientId: "Client ID",
                    DBKey: "DB Key",
                    GameMode: "Game Mode",
                    Level: "Level",
                    Location: "Location",
                    LocationCompact: { optionLabel: "Location (Compact)", headerLabel: "Location" },
                    Permissions: "Permissions",
                    MsaId: "Msa ID",
                    Name: "Name",
                    SelfSignedId: "Self-Signed ID",
                    ServerId: "Server ID",
                    UUID: "UUID",
                    raw_permissionsLevel: { optionLabel: "Permissions Level (Raw)", headerLabel: "Permissions Level" },
                    raw_playerPermissionsLevel: { optionLabel: "Player Permissions Level (Raw)", headerLabel: "Player Permissions Level" },
                    Rotation: "Rotation",
                    Spawn: "Spawn",
                    SpawnCompact: { optionLabel: "Spawn (Compact)", headerLabel: "Spawn" },
                } as const satisfies { [key in PlayersTabModeToColumnType[PlayersTabSectionMode]]: string | { optionLabel: string; headerLabel: string } };

                export const playersTabModeToSectionIDs = {
                    simple: [null],
                    raw: ["client", "server"],
                } as const satisfies { [key in PlayersTabMode]: (string | null)[] };

                export const playersTabModeSectionHeaderNames = {
                    simple: [null],
                    raw: ["Client", "Server"],
                } as const satisfies { [key in PlayersTabMode]: (string | null)[] };

                export const playersTabModeToColumnIDs = {
                    simple: ["DBKey", "Name", "UUID", "Permissions"],
                    raw_client: ["DBKey", "Name", "MsaId", "SelfSignedId", "ServerId"],
                    raw_server: [
                        "DBKey",
                        "ClientId",
                        "Name",
                        "UUID",
                        "Permissions",
                        "Location",
                        "LocationCompact",
                        "Rotation",
                        "Spawn",
                        "SpawnCompact",
                        "GameMode",
                        "Level",
                        "raw_playerPermissionsLevel",
                        "raw_permissionsLevel",
                    ],
                } as const;

                export type PlayersTabMode = "simple" | "raw";

                export type PlayersTabSectionModeFromPlayersTabModeAndSectionID<
                    M extends PlayersTabMode,
                    S extends (typeof playersTabModeToSectionIDs)[M][number]
                > = Extract<
                    S extends null ? M : null extends S ? M | `${M}_${NonNullable<S>}` : `${M}_${NonNullable<S>}`,
                    keyof typeof ConfigConstants.views.Players.playersTabModeToColumnIDs
                >;

                export type PlayersTabSectionMode =
                    | {
                          [key in PlayersTabMode]: null extends (typeof playersTabModeToSectionIDs)[key][number] ? key : never;
                      }[PlayersTabMode]
                    | {
                          [key in PlayersTabMode]: Exclude<(typeof playersTabModeToSectionIDs)[key][number], null> extends string
                              ? `${key}_${Exclude<(typeof playersTabModeToSectionIDs)[key][number], null>}`
                              : never;
                      }[PlayersTabMode];

                export type PlayersTabModeToColumnType = { [key in PlayersTabSectionMode]: (typeof playersTabModeToColumnIDs)[key][number] };
            }
            export namespace Entities {
                export const columnIDToDisplayName = {
                    DBKey: "DB Key",
                    Location: "Location",
                    LocationCompact: { optionLabel: "Location (Compact)", headerLabel: "Location" },
                    TypeID: "Type ID",
                    Name: "Name",
                    UUID: "UUID",
                    Rotation: "Rotation",
                } as const satisfies { [key in EntitiesTabModeToColumnType[EntitiesTabSectionMode]]: string | { optionLabel: string; headerLabel: string } };

                export const entitiesTabModeToSectionIDs = {
                    simple: [null],
                } as const satisfies { [key in EntitiesTabMode]: (string | null)[] };

                export const entitiesTabModeSectionHeaderNames = {
                    simple: [null],
                } as const satisfies { [key in EntitiesTabMode]: (string | null)[] };

                export const entitiesTabModeToColumnIDs = {
                    simple: ["DBKey", "TypeID", "UUID", "Name", "Location", "LocationCompact", "Rotation"],
                } as const;

                export type EntitiesTabMode = "simple";

                export type EntitiesTabSectionModeFromEntitiesTabModeAndSectionID<
                    M extends EntitiesTabMode,
                    S extends (typeof entitiesTabModeToSectionIDs)[M][number]
                > = Extract<
                    S extends null ? M : null extends S ? M | `${M}_${NonNullable<S>}` : `${M}_${NonNullable<S>}`,
                    keyof typeof ConfigConstants.views.Entities.entitiesTabModeToColumnIDs
                >;

                export type EntitiesTabSectionMode =
                    | {
                          [key in EntitiesTabMode]: null extends (typeof entitiesTabModeToSectionIDs)[key][number] ? key : never;
                      }[EntitiesTabMode]
                    | {
                          [key in EntitiesTabMode]: Exclude<(typeof entitiesTabModeToSectionIDs)[key][number], null> extends string
                              ? `${key}_${Exclude<(typeof entitiesTabModeToSectionIDs)[key][number], null>}`
                              : never;
                      }[EntitiesTabMode];

                export type EntitiesTabModeToColumnType = { [key in EntitiesTabSectionMode]: (typeof entitiesTabModeToColumnIDs)[key][number] };
            }
            export namespace Maps {
                export const columnIDToDisplayName = {
                    DBKey: "DB Key",
                    Location: "Location",
                    LocationCompact: { optionLabel: "Location (Compact)", headerLabel: "Location" },
                    Preview: "Preview",
                    ID: "ID",
                    Scale: "Scale",
                    DecorationCount: "Decoration Count",
                    FullyExplored: "Fully Explored",
                    Height: "Height",
                    ParentMapID: "Parent Map ID",
                } as const satisfies { [key in MapsTabModeToColumnType[MapsTabSectionMode]]: string | { optionLabel: string; headerLabel: string } };

                export const mapsTabModeToSectionIDs = {
                    simple: [null],
                } as const satisfies { [key in MapsTabMode]: (string | null)[] };

                export const mapsTabModeSectionHeaderNames = {
                    simple: [null],
                } as const satisfies { [key in MapsTabMode]: (string | null)[] };

                export const mapsTabModeToColumnIDs = {
                    simple: ["Preview", "DBKey", "ID", "Scale", "FullyExplored", "Location", "LocationCompact", "DecorationCount", "Height", "ParentMapID"],
                } as const;

                export type MapsTabMode = "simple";

                export type MapsTabSectionModeFromMapsTabModeAndSectionID<
                    M extends MapsTabMode,
                    S extends (typeof mapsTabModeToSectionIDs)[M][number]
                > = Extract<
                    S extends null ? M : null extends S ? M | `${M}_${NonNullable<S>}` : `${M}_${NonNullable<S>}`,
                    keyof typeof ConfigConstants.views.Maps.mapsTabModeToColumnIDs
                >;

                export type MapsTabSectionMode =
                    | {
                          [key in MapsTabMode]: null extends (typeof mapsTabModeToSectionIDs)[key][number] ? key : never;
                      }[MapsTabMode]
                    | {
                          [key in MapsTabMode]: Exclude<(typeof mapsTabModeToSectionIDs)[key][number], null> extends string
                              ? `${key}_${Exclude<(typeof mapsTabModeToSectionIDs)[key][number], null>}`
                              : never;
                      }[MapsTabMode];

                export type MapsTabModeToColumnType = { [key in MapsTabSectionMode]: (typeof mapsTabModeToColumnIDs)[key][number] };
            }
            export namespace ViewFiles {
                export const columnIDToDisplayName = {
                    DBKey: "DB Key",
                    ContentType: "Content Type",
                } as const satisfies { [key in ViewFilesTabModeToColumnType[ViewFilesTabSectionMode]]: string | { optionLabel: string; headerLabel: string } };

                export const viewFilesTabModeToSectionIDs = {
                    simple: [null],
                } as const satisfies { [key in ViewFilesTabMode]: (string | null)[] };

                export const viewFilesTabModeSectionHeaderNames = {
                    simple: [null],
                } as const satisfies { [key in ViewFilesTabMode]: (string | null)[] };

                export const viewFilesTabModeToColumnIDs = {
                    simple: ["DBKey", "ContentType"],
                } as const;

                export type ViewFilesTabMode = "simple";

                export type ViewFilesTabSectionModeFromViewFilesTabModeAndSectionID<
                    M extends ViewFilesTabMode,
                    S extends (typeof viewFilesTabModeToSectionIDs)[M][number]
                > = Extract<
                    S extends null ? M : null extends S ? M | `${M}_${NonNullable<S>}` : `${M}_${NonNullable<S>}`,
                    keyof typeof ConfigConstants.views.ViewFiles.viewFilesTabModeToColumnIDs
                >;

                export type ViewFilesTabSectionMode =
                    | {
                          [key in ViewFilesTabMode]: null extends (typeof viewFilesTabModeToSectionIDs)[key][number] ? key : never;
                      }[ViewFilesTabMode]
                    | {
                          [key in ViewFilesTabMode]: Exclude<(typeof viewFilesTabModeToSectionIDs)[key][number], null> extends string
                              ? `${key}_${Exclude<(typeof viewFilesTabModeToSectionIDs)[key][number], null>}`
                              : never;
                      }[ViewFilesTabMode];

                export type ViewFilesTabModeToColumnType = { [key in ViewFilesTabSectionMode]: (typeof viewFilesTabModeToColumnIDs)[key][number] };
            }
        }
    }

    /**
     * A class for managing the config file.
     */
    export const config = new Config();
}

export import config = exports.config;
import { getPropertyAtPath } from "./getPropertyAtPath";

globalThis.volumeCategories = exports.volumeCategories;
globalThis.volumeCategoryDisplayMapping = exports.volumeCategoryDisplayMapping;
globalThis.config = config;
globalThis.ConfigConstants = exports.ConfigConstants;

declare global {
    export import volumeCategories = exports.volumeCategories;
    export import volumeCategoryDisplayMapping = exports.volumeCategoryDisplayMapping;
    export import config = exports.config;
    export import ConfigConstants = exports.ConfigConstants;
    export import ConfigEventMap = exports.ConfigEventMap;
    export import ConfigJSON = exports.ConfigJSON;
}
