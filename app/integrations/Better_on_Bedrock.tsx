import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef } from "preact/compat";
import {
    dimensionIdToDimensionVectorDimensionSync,
    dimensionVectorDimensionToInt,
    getPlayerNameFromUUIDSync,
    toLong,
    type Dimension,
    type DimensionMCCE,
    type NBTSchemas,
    type Vector3,
} from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import {
    INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS,
    INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS,
    type Integration,
    type IntegrationMenuProps,
    type IntegrationWithOverlays,
} from ".";
import { LoadingScreenContents, preloadedIcons } from "../app";
import { app, clipboard, dialog, shell } from "@electron/remote";
import Notice from "../components/Notice";
import type { WorldEditor2DIntegrationMapImageItem } from "../components/WorldEditor2D";
import {
    IntegrationWorldEditor2DOverlay,
    type IntegrationWorldEditor2DOverlayRenderItemOptions,
    type IntegrationWorldEditor2DOverlayRequiredData,
} from "./integrationUtils";
import { MenuDivider, MenuHeader, MenuItem } from "@szhsin/react-menu";
import type { WorldXPackHistoryJSONSchema, WorldXPacksJSONSchema } from "../tabs/packs";
import json5 from "json5";
import { readFile } from "node:fs/promises";
import path from "node:path";

// const LAYER_NAMES = ["waystones"] as const satisfies readonly string[];
// const LAYER_INDICES = Object.fromEntries(
//     LAYER_NAMES.map((name: (typeof LAYER_NAMES)[number]): readonly [name: (typeof LAYER_NAMES)[number], index: number] => [
//         name,
//         WorldEditor2DLayerRegistry.register("integration_Better_on_Bedrock", name),
//     ])
// ) as Readonly<Record<(typeof LAYER_NAMES)[number], number>>;

/**
 * The image to be used for the global waystone icon.
 */
let globalWaystoneIconImage: HTMLImageElement | "loading" | "error" | undefined;
/**
 * The image to be used for the player waystone icon.
 */
let playerWaystoneIconImage: HTMLImageElement | "loading" | "error" | undefined;

function loadIconImages(): void {
    if (globalWaystoneIconImage === undefined) {
        globalWaystoneIconImage = "loading";
        const imageElement = new Image();
        imageElement.src = "resource://integrations/Better-on-Bedrock/waystone_item_globe.png";
        imageElement.onload = (): void => void (globalWaystoneIconImage = imageElement);
        imageElement.onerror = (error: unknown): void => {
            console.error("Error while loading the global waystone icon image:", error);
            globalWaystoneIconImage = "error";
        };
    }
    if (playerWaystoneIconImage === undefined) {
        playerWaystoneIconImage = "loading";
        const imageElement = new Image();
        imageElement.src = "resource://integrations/Better-on-Bedrock/waystone_item_steve.png";
        imageElement.onload = (): void => void (playerWaystoneIconImage = imageElement);
        imageElement.onerror = (error: unknown): void => {
            console.error("Error while loading the player waystone icon image:", error);
            playerWaystoneIconImage = "error";
        };
    }
}

interface GlobalWaystoneItemV1 {
    version: 1;
    name: string;
    dimension: number;
    position: Vector3;
}

interface PlayerWaystoneItemV1 {
    version: 1;
    playerUUID: bigint;
    playerName: string | null;
    specialPlayerKeyType: "~local_player" | "~local_player.Editor" | null;
    name: string;
    dimension: number;
    position: Vector3;
}

interface GlobalWaystoneItemV2 {
    version: 2;
    name: string;
    dimension: number;
    color: [r: number, g: number, b: number, a: number];
    position: Vector3;
}

interface PlayerWaystoneItemV2 {
    version: 2;
    playerUUID: bigint;
    playerName: string | null;
    specialPlayerKeyType: "~local_player" | "~local_player.Editor" | null;
    name: string;
    dimension: number;
    color: [r: number, g: number, b: number, a: number];
    position: Vector3;
}

type GlobalWaystoneItem = GlobalWaystoneItemV1 | GlobalWaystoneItemV2;

type PlayerWaystoneItem = PlayerWaystoneItemV1 | PlayerWaystoneItemV2;

interface GlobalWaystoneImageItemMeta {
    type: "integration_Better_on_Bedrock:global_waystone";
    value: GlobalWaystoneItem;
}

interface PlayerWaystoneImageItemMeta {
    type: "integration_Better_on_Bedrock:player_waystone";
    value: PlayerWaystoneItem;
}

function validateIsVector3ValueType(
    value: NBT.Tags[NBT.TagType] | undefined
): value is { type: "list"; value: { type: "float"; value: [x: number, y: number, z: number] } } {
    if (!value) return false;
    if (value.type !== "list") return false;
    if (value.value.type !== "float") return false;
    if (value.value.value.length !== 3) return false;
    return true;
}

const formatter = new Intl.NumberFormat();

export class IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones extends IntegrationWorldEditor2DOverlay<
    GlobalWaystoneItem,
    GlobalWaystoneImageItemMeta
> {
    public static readonly typeId = "integration_Better_on_Bedrock:global_waystone";
    public readonly label = "Global Waystones";
    public readonly integration: IntegrationWithOverlays = thisIntegration;
    public constructor(tab: TabManagerTab) {
        super(tab);
        loadIconImages();
    }
    public get assetsLoaded(): boolean {
        if (typeof globalWaystoneIconImage !== "object") return false;
        return true;
    }
    public async loadData(): Promise<void> {
        if (this.state.get() === "loading") return;
        this.items.length = 0;
        if (this.tab.type !== "world" && this.tab.type !== "leveldb") {
            this.state.set("N/A");
            return;
        }
        if (!this.tab.db) {
            this.state.set("N/A");
            return;
        }
        this.state.set("loading");
        try {
            await this.tab.awaitDBOpen;
            if (!this.tab.db.isOpen()) throw new Error("Database is not open.");
            let dimensionNameIdTable: (NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name">) | null;
            loadDimensionNameIdTable: try {
                const rawDimensionNameIdTable: Buffer | null = await this.tab.db.get("DimensionNameIdTable");
                if (!rawDimensionNameIdTable) {
                    dimensionNameIdTable = null;
                    break loadDimensionNameIdTable;
                }
                const parsedDimensionNameIdTable: NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name"> = NBT.parseUncompressed(
                    rawDimensionNameIdTable,
                    "little",
                    { noArraySizeCheck: false }
                ) as NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name">;
                dimensionNameIdTable = parsedDimensionNameIdTable;
            } catch (e) {
                dimensionNameIdTable = null;
                console.error(
                    "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones::loadDimensionNameIdTable] Error loading dimension name ID table:",
                    e
                );
            }
            let dynamicProperties: NBTSchemas.NBTSchemaTypes.DynamicProperties & NBT.NBT;
            {
                const dynamicPropertiesDataRaw: Buffer | null = await this.tab.db.get("DynamicProperties");
                if (!dynamicPropertiesDataRaw) {
                    this.state.set("no_data");
                    return;
                }
                try {
                    const parsedDynamicPropertiesData: NBT.NBT = NBT.parseUncompressed(dynamicPropertiesDataRaw, "little", { noArraySizeCheck: false });
                    if (parsedDynamicPropertiesData.type !== "compound") throw new Error("Expected DynamicProperties to be a compound tag.");
                    dynamicProperties = parsedDynamicPropertiesData as NBTSchemas.NBTSchemaTypes.DynamicProperties & NBT.NBT;
                } catch (e) {
                    this.state.set("error");
                    console.error(
                        "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones::loadDynamicPropertiesData] Failed to parse DynamicProperties NBT data. error:",
                        e
                    );
                    return;
                }
            }
            if (dynamicProperties) {
                const UUIDs = ["40d18d86-f454-4361-bbcf-b118274dec17"] as const;
                for (const UUID of UUIDs) {
                    const data = dynamicProperties.value[UUID]?.value as NBT.Compound["value"] | undefined;
                    if (!data) continue;
                    for (const [key, value] of Object.entries(data)) {
                        try {
                            if (!validateIsVector3ValueType(value)) continue;
                            const match =
                                /^Warp:(.*?)-([\u0001-\u0008\u000b-\u000c\u000e-\u001f\u0021-\u0039\u003b-\uffff]+:[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u0021-\u0039\u003b-\uffff]+)$/.exec(
                                    key
                                ) as (RegExpExecArray & [match: string, name: string, dimension: string]) | null;
                            if (!match) continue;
                            let [, name, dimension] = match;
                            {
                                // TEST: Make sure this works for all possible poisoned names that are possible to differentiate.
                                const origDimensionNamespace: string = dimension.split(":")[0]!;
                                if (origDimensionNamespace.length > 1 && origDimensionNamespace.includes("-")) {
                                    if (/^.*?-minecraft$/.test(origDimensionNamespace)) {
                                        name += "-";
                                        // OPTIMIZE: This indexOf call can be replaced with a numeric literal.
                                        const index: number = dimension.indexOf("minecraft:");
                                        name += dimension.substring(0, index - 1);
                                        dimension = dimension.substring(index);
                                    } else if (dimensionNameIdTable && !(origDimensionNamespace in dimensionNameIdTable.value.entries.value)) {
                                        // BUG: This won't work properly if the user enters some poisoned data as the waystone name,
                                        // and there is two different custom dimension namespaces, where one is something like `a:` and the other is `-a:`,
                                        // because then if the user puts a `-` at the end of the dimension name,
                                        // it won't be able to tell if the waystone name just ends with `-` and the dimension namespace is `a:`,
                                        // or if the name does not end with `-` and the dimension namespace is `-a:`.
                                        for (let i = 0; i < origDimensionNamespace.length - 1; i++) {
                                            if (origDimensionNamespace[i] !== "-") continue;
                                            if (!(origDimensionNamespace.substring(i + 1) in dimensionNameIdTable.value.entries.value)) continue;
                                            name += "-";
                                            name += dimension.substring(0, i);
                                            dimension = dimension.substring(i + 1);
                                            break;
                                        }
                                        if (dimension.startsWith(`${origDimensionNamespace}:`)) {
                                            name += "-";
                                            const index: number = origDimensionNamespace.lastIndexOf("-", origDimensionNamespace.length - 2);
                                            name += dimension.substring(0, index);
                                            dimension = dimension.substring(index + 1);
                                        }
                                    }
                                }
                            }
                            const [x, y, z] = value.value.value;
                            if (dimensionNameIdTable) {
                                this.items.push({
                                    version: 1,
                                    name,
                                    dimension: dimensionVectorDimensionToInt(dimensionIdToDimensionVectorDimensionSync(dimension, dimensionNameIdTable)),
                                    position: { x, y, z },
                                });
                            } else {
                                const dim: string = dimension.replace(/^minecraft:/, "");
                                const dimId: number = dimensionVectorDimensionToInt(dim as Dimension | DimensionMCCE);
                                if (dimId === -1) {
                                    console.error(
                                        "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones::loadData] Error loading data for global v1 waystone, unknown dimension:",
                                        dimension,
                                        "waystone:",
                                        name,
                                        "key:",
                                        key,
                                        "value:",
                                        value
                                    );
                                    continue;
                                }
                                this.items.push({
                                    version: 1,
                                    name,
                                    dimension: dimId,
                                    position: { x, y, z },
                                });
                            }
                        } catch (e) {
                            console.error(
                                "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones::loadData] Error loading data for global v1 waystone; error:",
                                e,
                                "key:",
                                key,
                                "value:",
                                value
                            );
                        }
                    }
                }
            }
            // ~DEBUG
            // this.items.push(
            //     {
            //         version: 2,
            //         waystoneType: "player",
            //         name: "Waystone 1",
            //         dimension: 0,
            //         color: [20, 255, 20, 255],
            //         position: { x: 0, y: 50, z: 75 },
            //     },
            //     {
            //         version: 2,
            //         waystoneType: "global",
            //         name: "Waystone 2",
            //         dimension: 1,
            //         color: [255, 20, 255, 80],
            //         position: { x: 25, y: 20, z: 15 },
            //     }
            // );
            this.state.set("loaded");
        } catch (e) {
            this.state.set("error");
            console.error(
                "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones::loadData] Error loading waystone data:",
                e
            );
        }
    }
    public override renderItems(
        options: IntegrationWorldEditor2DOverlayRenderItemOptions
    ): (WorldEditor2DIntegrationMapImageItem<this> & { meta: GlobalWaystoneImageItemMeta })[] {
        return this.items
            .filter((item: GlobalWaystoneItem): boolean => item.dimension === options.dimension)
            .map((item: GlobalWaystoneItem): WorldEditor2DIntegrationMapImageItem<this> & { meta: GlobalWaystoneImageItemMeta } =>
                this.renderItem(item, options)
            );
    }
    public renderItem(
        item: GlobalWaystoneItem,
        options: IntegrationWorldEditor2DOverlayRenderItemOptions
    ): WorldEditor2DIntegrationMapImageItem<this> & { meta: GlobalWaystoneImageItemMeta } {
        if (typeof globalWaystoneIconImage !== "object") throw new Error("Waystone icon image not loaded.");
        return {
            img: globalWaystoneIconImage,
            // The `- 7.5` instead of -8 accounts for the location being an integer block coordinate instead of the coordinate of the center of a block.
            x: Math.floor(((item.position.x - 7.5) / 16) * options.currentScale) / options.currentScale,
            y: Math.floor(((item.position.z - 7.5) / 16) * options.currentScale) / options.currentScale,
            size: 32 / options.currentScale,
            meta: {
                type: "integration_Better_on_Bedrock:global_waystone",
                overlay: this,
                value: item,
            },
        };
    }
    public contextMenuContents({ meta }: Record<"meta", WorldEditor2DIntegrationMapImageItem<this>["meta"] & GlobalWaystoneImageItemMeta>): JSX.Element {
        return (
            <>
                {/* TODO: Add associated player info when player waystone support is implemented. */}
                {/* TODO: When format version 2 releases, this should display v1 data as `(Legacy)` or `(Legacy Global)`/`(Legacy Player)`. */}
                <MenuHeader>
                    Waystone
                    <span style={{ textTransform: "none" }}>{` (Global) - ${thisIntegration.name}`}</span>
                </MenuHeader>
                {/* TODO: Implement this when format version 2 releases. */}
                {/* {meta.newerDataAvailableForWaystone && (
                    <MenuItem inert>
                        <span style={{ color: "color-mix(in lab, var(--text-color) 35%, rgba(255, 128, 0, 1))" }}>Newer data is available for this waystone</span>
                    </MenuItem>
                )} */}
                <MenuItem
                    title="Copy waystone name to clipboard"
                    onClick={(): void => {
                        if (typeof meta.value.name !== "string") throw new Error("meta.value.name is not a string.");
                        clipboard.writeText(meta.value.name);
                    }}
                >
                    {meta.value.name}
                </MenuItem>
                {meta.value.version === 2 && (
                    <MenuItem
                        title="Copy RGBA HEX color to clipboard"
                        onClick={(): void => {
                            if (meta.value.version !== 2) throw new Error("meta.value.version is not 2.");
                            clipboard.writeText(
                                `#${meta.value.color.map((v: number): string => Math.max(0, Math.min(v, 255)).toString(16).padStart(2, "0")).join("")}`
                            );
                        }}
                    >
                        Color: {`#${meta.value.color.map((v: number): string => Math.max(0, Math.min(v, 255)).toString(16).padStart(2, "0")).join("")}`}
                    </MenuItem>
                )}
                <MenuDivider />
                <MenuItem
                    title="Copy location to clipboard"
                    onClick={(): void => {
                        clipboard.writeText(`${meta.value.position.x} ${meta.value.position.y} ${meta.value.position.z}`);
                    }}
                >
                    X: {formatter.format(meta.value.position.x)} Y: {formatter.format(meta.value.position.y)} Z: {formatter.format(meta.value.position.z)}
                    {/* <img
                                src="resource://images/ui/glyphs/Copy_16x.png"
                                style={{ width: "16px", imageRendering: "pixelated", marginLeft: 2 }}
                                aria-hidden="true"
                            /> */}
                </MenuItem>
            </>
        );
        // return (
        //     <>
        //         <MenuItem disabled>ERROR: Handler not yet implemented for items from overlay type: {meta.type}</MenuItem>
        //     </>
        // );
    }
    public static override requiredData: IntegrationWorldEditor2DOverlayRequiredData;
}

export class IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones extends IntegrationWorldEditor2DOverlay<
    PlayerWaystoneItem,
    PlayerWaystoneImageItemMeta
> {
    public static readonly typeId = "integration_Better_on_Bedrock:player_waystone";
    public readonly label = "Player Waystones";
    public readonly integration: IntegrationWithOverlays = thisIntegration;
    public constructor(tab: TabManagerTab) {
        super(tab);
        loadIconImages();
    }
    public get assetsLoaded(): boolean {
        if (typeof playerWaystoneIconImage !== "object") return false;
        return true;
    }
    // FIXME: Add handling for when a player shares a UUID with ~local_player or ~local_player.Editor and both have the same waystone data.
    public async loadData(): Promise<void> {
        if (this.state.get() === "loading") return;
        this.items.length = 0;
        if (this.tab.type !== "world" && this.tab.type !== "leveldb") {
            this.state.set("N/A");
            return;
        }
        if (!this.tab.db) {
            this.state.set("N/A");
            return;
        }
        this.state.set("loading");
        try {
            await this.tab.awaitDBOpen;
            if (!this.tab.db.isOpen()) throw new Error("Database is not open.");
            if (!this.tab.cachedDBKeys) await this.tab.awaitCachedDBKeys;
            if (!this.tab.cachedDBKeys) throw new Error("cachedDBKeys is not available.");
            let dimensionNameIdTable: (NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name">) | null;
            loadDimensionNameIdTable: try {
                const rawDimensionNameIdTable: Buffer | null = await this.tab.db.get("DimensionNameIdTable");
                if (!rawDimensionNameIdTable) {
                    dimensionNameIdTable = null;
                    break loadDimensionNameIdTable;
                }
                const parsedDimensionNameIdTable: NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name"> = NBT.parseUncompressed(
                    rawDimensionNameIdTable,
                    "little",
                    { noArraySizeCheck: false }
                ) as NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & Pick<NBT.NBT, "name">;
                dimensionNameIdTable = parsedDimensionNameIdTable;
            } catch (e) {
                dimensionNameIdTable = null;
                console.error(
                    "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadDimensionNameIdTable] Error loading dimension name ID table:",
                    e
                );
            }
            let dynamicProperties: (NBTSchemas.NBTSchemaTypes.DynamicProperties & NBT.NBT) | null;
            {
                const dynamicPropertiesDataRaw: Buffer | null = await this.tab.db.get("DynamicProperties");
                loadDynamicPropertiesData: {
                    if (!dynamicPropertiesDataRaw) {
                        dynamicProperties = null;
                        break loadDynamicPropertiesData;
                    }
                    try {
                        const parsedDynamicPropertiesData: NBT.NBT = NBT.parseUncompressed(dynamicPropertiesDataRaw, "little", { noArraySizeCheck: false });
                        if (parsedDynamicPropertiesData.type !== "compound") throw new Error("Expected DynamicProperties to be a compound tag.");
                        dynamicProperties = parsedDynamicPropertiesData as NBTSchemas.NBTSchemaTypes.DynamicProperties & NBT.NBT;
                    } catch (e) {
                        dynamicProperties = null;
                        console.error(
                            "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadDynamicPropertiesData] Failed to parse DynamicProperties NBT data. error:",
                            e
                        );
                    }
                }
            }
            for (const playerKey of this.tab.cachedDBKeys.Player) {
                // BUG: This currently does not work for non-host players from certain older versions due to the keys using the same format as PlayerClient and because a thing to differentiate them from PlayerClient entries has not been implemented yet.
                try {
                    const rawPlayerData: Buffer | null = await this.tab.db.get(playerKey);
                    if (!rawPlayerData) continue;
                    const player = NBT.parseUncompressed(rawPlayerData, "little", { noArraySizeCheck: false }) as NBTSchemas.NBTSchemaTypes.Player &
                        Pick<NBT.NBT, "name">;
                    const stringKey: string = playerKey.toString("utf-8");
                    const data: string[] | undefined = player.value?.Tags?.value?.value;
                    if (!data) continue;
                    if (!player.value.UniqueID?.value) continue;
                    const specialPlayerKeyType: PlayerWaystoneItem["specialPlayerKeyType"] =
                        stringKey === "~local_player" ? "~local_player"
                        : stringKey === "~local_player.Editor" ? "~local_player.Editor"
                        : null;
                    const playerUUID: bigint = toLong(player.value.UniqueID.value);
                    let playerName: string | null | undefined;
                    for (const tag of data) {
                        try {
                            const match =
                                /^Warp:(.*?)-(-?\d+)\|(-?\d+)\|(-?\d+)\|([\u0001-\u0008\u000b-\u000c\u000e-\u001f\u0021-\u0039\u003b-\uffff]+:[\u0001-\u0008\u000b-\u000c\u000e-\u001f\u0021-\u0039\u003b-\uffff]+)$/.exec(
                                    tag
                                ) as (RegExpExecArray & [match: string, name: string, x: string, y: string, z: string, dimension: string]) | null;
                            if (!match) continue;
                            const [, name, xS, yS, zS, dimension] = match;
                            const [x, y, z] = [Number(xS), Number(yS), Number(zS)];
                            if (dimensionNameIdTable) {
                                if (playerName === undefined) playerName = dynamicProperties && getPlayerNameFromUUIDSync(dynamicProperties, playerUUID);
                                this.items.push({
                                    version: 1,
                                    playerUUID,
                                    playerName,
                                    specialPlayerKeyType,
                                    name,
                                    dimension: dimensionVectorDimensionToInt(dimensionIdToDimensionVectorDimensionSync(dimension, dimensionNameIdTable)),
                                    position: { x, y, z },
                                });
                            } else {
                                const dim: string = dimension.replace(/^minecraft:/, "");
                                const dimId: number = dimensionVectorDimensionToInt(dim as Dimension | DimensionMCCE);
                                if (dimId === -1) {
                                    console.error(
                                        "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadData] Error loading data for player v1 waystone, unknown dimension:",
                                        dimension,
                                        "waystone:",
                                        name,
                                        "tag:",
                                        tag
                                    );
                                    continue;
                                }
                                if (playerName === undefined) playerName = dynamicProperties && getPlayerNameFromUUIDSync(dynamicProperties, playerUUID);
                                this.items.push({
                                    version: 1,
                                    playerUUID,
                                    playerName,
                                    specialPlayerKeyType,
                                    name,
                                    dimension: dimId,
                                    position: { x, y, z },
                                });
                            }
                        } catch (e) {
                            console.error(
                                "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadData] Error loading data for player v1 waystone; error:",
                                e,
                                "tag",
                                tag
                            );
                        }
                    }
                } catch (e) {
                    console.error(
                        "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadData] Error loading player data; error:",
                        e,
                        "key:",
                        playerKey
                    );
                }
            }
            this.state.set("loaded");
        } catch (e) {
            this.state.set("error");
            console.error(
                "[integration::Better_on_Bedrock::IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones::loadData] Error loading waystone data:",
                e
            );
        }
    }
    public override renderItems(
        options: IntegrationWorldEditor2DOverlayRenderItemOptions
    ): (WorldEditor2DIntegrationMapImageItem<this> & { meta: PlayerWaystoneImageItemMeta })[] {
        return this.items
            .filter((item: PlayerWaystoneItem): boolean => item.dimension === options.dimension)
            .map((item: PlayerWaystoneItem): WorldEditor2DIntegrationMapImageItem<this> & { meta: PlayerWaystoneImageItemMeta } =>
                this.renderItem(item, options)
            );
    }
    public renderItem(
        item: PlayerWaystoneItem,
        options: IntegrationWorldEditor2DOverlayRenderItemOptions
    ): WorldEditor2DIntegrationMapImageItem<this> & { meta: PlayerWaystoneImageItemMeta } {
        if (typeof playerWaystoneIconImage !== "object") throw new Error("Waystone icon image not loaded.");
        return {
            img: playerWaystoneIconImage,
            // The `- 7.5` instead of -8 accounts for the location being an integer block coordinate instead of the coordinate of the center of a block.
            x: Math.floor(((item.position.x - 7.5) / 16) * options.currentScale) / options.currentScale,
            y: Math.floor(((item.position.z - 7.5) / 16) * options.currentScale) / options.currentScale,
            size: 32 / options.currentScale,
            meta: {
                type: "integration_Better_on_Bedrock:player_waystone",
                overlay: this,
                value: item,
            },
        };
    }
    public contextMenuContents({ meta }: Record<"meta", WorldEditor2DIntegrationMapImageItem<this>["meta"] & PlayerWaystoneImageItemMeta>): JSX.Element {
        return (
            <>
                {/* TODO: Add associated player info when player waystone support is implemented. */}
                {/* TODO: When format version 2 releases, this should display v1 data as `(Legacy)` or `(Legacy Global)`/`(Legacy Player)`. */}
                <MenuHeader>
                    Waystone
                    <span style={{ textTransform: "none" }}>{` (Player) - ${thisIntegration.name}`}</span>
                </MenuHeader>
                {/* TODO: Implement this when format version 2 releases. */}
                {/* {meta.newerDataAvailableForWaystone && (
                    <MenuItem inert>
                        <span style={{ color: "color-mix(in lab, var(--text-color) 35%, rgba(255, 128, 0, 1))" }}>Newer data is available for this waystone</span>
                    </MenuItem>
                )} */}
                <MenuItem
                    title="Copy waystone name to clipboard"
                    onClick={(): void => {
                        if (typeof meta.value.name !== "string") throw new Error("meta.value.name is not a string.");
                        clipboard.writeText(meta.value.name);
                    }}
                >
                    {meta.value.name}
                </MenuItem>
                {meta.value.version === 2 && (
                    <MenuItem
                        title="Copy RGBA HEX color to clipboard"
                        onClick={(): void => {
                            if (meta.value.version !== 2) throw new Error("meta.value.version is not 2.");
                            clipboard.writeText(
                                `#${meta.value.color.map((v: number): string => Math.max(0, Math.min(v, 255)).toString(16).padStart(2, "0")).join("")}`
                            );
                        }}
                    >
                        Color: {`#${meta.value.color.map((v: number): string => Math.max(0, Math.min(v, 255)).toString(16).padStart(2, "0")).join("")}`}
                    </MenuItem>
                )}
                {meta.value.playerName !== null && (
                    <MenuItem
                        title="Copy player name to clipboard"
                        onClick={(): void => {
                            if (typeof meta.value.playerName !== "string") throw new Error("meta.value.playerName is not a string.");
                            clipboard.writeText(meta.value.playerName);
                        }}
                    >
                        Player Name: {meta.value.playerName}
                    </MenuItem>
                )}
                <MenuItem
                    title="Copy player UUID to clipboard"
                    onClick={(): void => {
                        if (typeof meta.value.playerUUID !== "bigint") throw new Error("meta.value.playerUUID is not a bigint.");
                        clipboard.writeText(String(meta.value.playerUUID));
                    }}
                >
                    Player UUID: {meta.value.playerUUID}
                    {meta.value.specialPlayerKeyType !== null && ` (${meta.value.specialPlayerKeyType})`}
                </MenuItem>
                <MenuDivider />
                <MenuItem
                    title="Copy location to clipboard"
                    onClick={(): void => {
                        clipboard.writeText(`${meta.value.position.x} ${meta.value.position.y} ${meta.value.position.z}`);
                    }}
                >
                    X: {formatter.format(meta.value.position.x)} Y: {formatter.format(meta.value.position.y)} Z: {formatter.format(meta.value.position.z)}
                    {/* <img
                                src="resource://images/ui/glyphs/Copy_16x.png"
                                style={{ width: "16px", imageRendering: "pixelated", marginLeft: 2 }}
                                aria-hidden="true"
                            /> */}
                </MenuItem>
                {/* IDEA: Add a go to player button. */}
            </>
        );
        // return (
        //     <>
        //         <MenuItem disabled>ERROR: Handler not yet implemented for items from overlay type: {meta.type}</MenuItem>
        //     </>
        // );
    }
    public static override requiredData: IntegrationWorldEditor2DOverlayRequiredData;
}

const thisIntegration = {
    id: "Better_on_Bedrock",
    name: "Better on Bedrock",
    author: "FoxyStar Studios",
    description: "A comprehensive expansion project designed to enhance and extend the Minecraft: Bedrock Edition experience.",
    links: {
        Documentation: { url: "https://wiki.foxystar.net/docs/maps/better-on-bedrock/" },
        Discord: { url: "https://discord.gg/dzthEfVDFj" },
        BedrockBuddy: { url: "https://bedrockbuddy.com/addons/better-on-bedrock" },
        "Minecraft Marketplace": { url: "https://www.minecraft.net/en-us/marketplace/pdp/foxystar-studios/6c3a6979-dc77-41c6-b19e-0071dabedf71" },
    },
    worldEditor2D: {
        overlays: [IntegrationWorldEditor2DOverlay_Better_on_Bedrock_GlobalWaystones, IntegrationWorldEditor2DOverlay_Better_on_Bedrock_PlayerWaystones],
    },
    async checkIfDetected(tab: TabManagerTab): Promise<boolean> {
        // TODO: Maybe add handling for when the LevelDB is corrupted.
        if (tab.type !== "world" && tab.type !== "leveldb") return false;
        if (!tab.db) return false;
        await tab.awaitDBOpen;
        if (!tab.db?.isOpen()) throw new Error("Database is not open.");
        const UUIDs = ["40d18d86-f454-4361-bbcf-b118274dec17"] as const;
        dynamicPropertiesUUIDCheck: {
            const data = await tab.db.get("DynamicProperties");
            if (!data) break dynamicPropertiesUUIDCheck;
            let parsedData: NBT.NBT;
            try {
                parsedData = NBT.parseUncompressed(data, "little", { noArraySizeCheck: false });
            } catch (e) {
                console.error(
                    "[integration::Better_on_Bedrock::checkIfDetected::dynamicPropertiesUUIDCheck] Failed to parse DynamicProperties NBT data. error:",
                    e
                );
                break dynamicPropertiesUUIDCheck;
            }
            const dynamicProperties: NBTSchemas.NBTSchemaTypes.DynamicProperties = parsedData as NBTSchemas.NBTSchemaTypes.DynamicProperties;
            for (const UUID of UUIDs) {
                if (UUID in dynamicProperties.value) {
                    return true;
                }
            }
        }
        worldBehaviorPacksUUIDCheck: {
            try {
                const worldBehaviorPacksJSON: WorldXPacksJSONSchema = json5.parse(
                    await readFile(path.join(tab.tempPath ?? tab.path, "world_behavior_packs.json"), "utf-8")
                );
                const matchingPack = worldBehaviorPacksJSON.find((pack) => UUIDs.some((uuid) => pack.pack_id === uuid));
                if (!matchingPack) break worldBehaviorPacksUUIDCheck;
                // IDEA: Maybe add a version check.
                return true;
            } catch (e) {
                console.error(
                    "[integration::Better_on_Bedrock::checkIfDetected::worldBehaviorPacksUUIDCheck] An error occurred while checking world_behavior_packs.json for the add-on's UUID. error:",
                    e
                );
                break worldBehaviorPacksUUIDCheck;
            }
        }
        worldBehaviorPackHistoryUUIDCheck: {
            try {
                const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                    await readFile(path.join(tab.tempPath ?? tab.path, "world_behavior_pack_history.json"), "utf-8")
                );
                const matchingPack = worldBehaviorPackHistoryJSON.packs.find((pack) => UUIDs.some((uuid) => pack.uuid === uuid));
                if (!matchingPack) break worldBehaviorPackHistoryUUIDCheck;
                // IDEA: Maybe add a version check.
                return true;
            } catch (e) {
                console.error(
                    "[integration::Better_on_Bedrock::checkIfDetected::worldBehaviorPackHistoryUUIDCheck] An error occurred while checking world_behavior_pack_history.json for the add-on's UUID. error:",
                    e
                );
                break worldBehaviorPackHistoryUUIDCheck;
            }
        }
        playerCheck: {
            break playerCheck; // TEMP
        }
        // TODO
        return false;
    },
    integrationMenu(this: unknown, props: IntegrationMenuProps): JSX.Element {
        if (props.tab.type !== "world" && props.tab.type !== "leveldb") {
            return (
                <center>
                    <Notice
                        title="Error"
                        subtitle="An error has occurred."
                        detail={`ERROR: This integration menu does not support the ${JSON.stringify(props.tab.type)} tab type.`}
                        image="generic_error"
                    />
                </center>
            );
        }
        const tablesContainerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
        const viewOptionsRefs = {
            viewOptionsContainer: useRef<HTMLDivElement>(null),
            viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
        };
        function IntegrationLinks(): JSX.Element | false {
            return (
                !!thisIntegration.links &&
                Object.keys(thisIntegration.links).length > 0 && (
                    <div style={{ display: "grid" }}>
                        {...Object.entries(thisIntegration.links).map(
                            ([buttonLabel, { url, description }]: [string, NonNullable<Integration["links"]>[string]]): JSX.Element => {
                                return (
                                    <button
                                        type="button"
                                        class="genericRoundButton"
                                        title={description}
                                        onClick={(): void => {
                                            try {
                                                var parsedUri: URL | undefined = new URL(url);
                                            } catch {}
                                            if (parsedUri === undefined || !INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS.includes(parsedUri.protocol)) {
                                                switch (
                                                    dialog.showMessageBoxSync(getCurrentWindow(), {
                                                        type: "info",
                                                        title: "Bedrock World Editor",
                                                        message:
                                                            parsedUri === undefined ? "Do you want Bedrock World Editor to open the URI?"
                                                            : INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS.includes(parsedUri.protocol) ?
                                                                "Do you want Bedrock World Editor to open the external website?"
                                                            :   `Do you want Bedrock World Editor to open the URI in ${app.getApplicationNameForProtocol(url)}?`,
                                                        detail: url,
                                                        buttons: [
                                                            "Open",
                                                            "Copy",
                                                            // "Configure Trusted Domains", // IDEA: Implement a trusted domains config option.
                                                            "Cancel",
                                                        ],
                                                        noLink: true,
                                                    })
                                                ) {
                                                    case 0:
                                                        void shell.openExternal(url);
                                                        break;
                                                    case 1:
                                                        clipboard.writeText(url);
                                                        break;
                                                    // no default
                                                }
                                                return;
                                            }
                                            void shell.openExternal(url);
                                        }}
                                    >
                                        {buttonLabel}
                                    </button>
                                );
                            }
                        )}
                    </div>
                )
            );
        }
        // function NoApplicableActions(): JSX.Element {
        //     return (
        //         <center>
        //             <h2 class="nsel">This integration has no applicable actions for this tab.</h2>
        //         </center>
        //     );
        // }
        function ActionMenu_2DWorldMap_Settings(): JSX.Element {
            const abortController: AbortController | null = currentAbortController;
            const buttonRef: RefObject<HTMLButtonElement> = useRef<HTMLButtonElement>(null);
            return (
                <>
                    <div style={{ marginLeft: "1em" }}>
                        <h2 class="nsel">2D World Map Settings</h2>
                        <p>Settings for the 2D world map.</p>

                        <p style={{ fontSize: "0.8em", color: "gray" }}>There aren't any available settings yet.</p>
                        {/* TODO (Config): Add settings here. */}
                    </div>
                    {/* <button
                        type="button"
                        class="genericRoundButton"
                        onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                            if (!tablesContainerRef.current) return;
                            if (
                                dialog.showMessageBoxSync(getCurrentWindow(), {
                                    type: "info",
                                    title: "Bedrock World Editor",
                                    message: `This will attempt to repair ${props.tab.cachedDBKeys?.Data3D.length ?? "?"} chunk(s). Continue?`,
                                    buttons: ["Yes", "No"],
                                    noLink: true,
                                })
                            ) {
                                return;
                            }
                            event.currentTarget.blur();
                            event.currentTarget.disabled = true;
                            event.currentTarget.textContent = "Repairing Chunks...";
                            const action_repair_crashing_chunks = thisIntegration.autoApplyActions.find((a) => a.id === "repair_crashing_chunks")!;
                            await action_repair_crashing_chunks.apply(props.tab, true);
                            abortController?.signal.throwIfAborted();
                            if (buttonRef.current) {
                                buttonRef.current.textContent = "Repair Chunks";
                                buttonRef.current.disabled = false;
                            }
                        }}
                        ref={buttonRef}
                    >
                        Repair Chunks
                    </button> */}
                </>
            );
        }
        type ApplicableAction = never;
        const applicableActions: ApplicableAction[] = [];
        const loadingActions: ApplicableAction[] = [];
        const actionData = {} satisfies Partial<Record<ApplicableAction, Record<PropertyKey, unknown>>>;
        function updateTablesContents(): void {
            if (!tablesContainerRef.current) return;
            // if (applicableActions.length === 0) {
            //     if (loadingActions.length === 0) {
            //         render(null, tablesContainerRef.current);
            //         render(<NoApplicableActions />, tablesContainerRef.current);
            //         return;
            //     }
            //     return;
            // }
            render(null, tablesContainerRef.current);
            render(
                <>
                    {...[
                        <ActionMenu_2DWorldMap_Settings key="actionMenu:Better_on_Bedrock:2DWorldMap_settings" />,
                        loadingActions.length > 0 && <LoadingScreenContents message="Loading integration actions..." preserveTextOffset={true} />,
                    ]
                        .filter(Boolean as unknown as (v: false | JSX.Element) => v is JSX.Element)
                        .flatMap((v: JSX.Element): JSX.Element | JSX.Element[] => [<hr />, v])}
                </>,
                tablesContainerRef.current
            );
        }
        let currentAbortController: AbortController | null = null;
        useEffect((): (() => void) => {
            const abortController = (currentAbortController = new AbortController());
            applicableActions.length = 0;
            loadingActions.length = 0;
            loadingActions.push();
            updateTablesContents(); // TEMP
            return (): void => {
                void abortController.abort("Effect cleanup");
                if (tablesContainerRef.current) render(null, tablesContainerRef.current);
            };
        });
        return (
            <>
                <div
                    class="widget-overlay-bar widget-overlay-bar-transparent"
                    style="display: flex; flex-direction: row;"
                    ref={viewOptionsRefs.viewOptionsContainer}
                >
                    <div class="widget-overlay tabbed-selector">
                        <button
                            type="button"
                            title="Back"
                            class="image-only-button widget-overlay-back-button"
                            onClick={(_event: TargetedMouseEvent<HTMLButtonElement>): void => {
                                props.closeIntegrationMenu();
                            }}
                        >
                            <img src={preloadedIcons.back} style={{ width: "15px", imageRendering: "pixelated", marginRight: "1px" }} aria-hidden="true" />
                        </button>
                    </div>
                    {/* <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                        <button
                            type="button"
                            class={mode === "detected" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                mode = "detected";
                                updateTablesContents();
                            }}
                        >
                            Detected
                        </button>
                        <button
                            type="button"
                            class={mode === "undetected" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                mode = "undetected";
                                updateTablesContents();
                            }}
                        >
                            Undetected
                        </button>
                        <button
                            type="button"
                            class={mode === "loading" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                mode = "loading";
                                updateTablesContents();
                            }}
                        >
                            Loading
                        </button>
                    </div> */}
                </div>
                <div class="nsel ndrg integrationMenu-integrationHeaderInfoContainer" style="display: flex; flex-direction: column;">
                    <div class="integrationMenu-integrationTitleAndIconContainer" style="display: flex; flex-direction: row;">
                        <img class="piximg integrationMenu-integrationIcon" aria-hidden="true" src="resource://integrations/Better-on-Bedrock/pack_icon.png" />
                        <div class="integrationMenu-integrationTitleContainer" style="display: flex; flex-direction: column;">
                            <h2 class="integrationMenu-integrationTitle">{thisIntegration.name}</h2>
                            <h4 class="integrationMenu-integrationAuthor">
                                by{" "}
                                {typeof thisIntegration.author === "string" ?
                                    thisIntegration.author
                                :   (thisIntegration.author as Exclude<Integration["author"], string>).join(", ")}
                            </h4>
                        </div>
                    </div>
                    <p class="integrationMenu-integrationDescription">{thisIntegration.description}</p>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <IntegrationLinks />
                </div>
                <div style="display: flex; flex-direction: column;" ref={tablesContainerRef}>
                    <LoadingScreenContents message="Loading integration actions..." preserveTextOffset={true} />
                </div>
            </>
        );
    },
} satisfies Integration;

export default thisIntegration;
