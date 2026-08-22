// TEST: Test this with custom dimensions.
// TEST: Test this with custom biomes.
import { app, clipboard, dialog } from "@electron/remote";
import { ControlledMenu, MenuDivider, MenuHeader, MenuItem, SubMenu } from "@szhsin/react-menu";
import type { MessageBoxReturnValue, SaveDialogReturnValue } from "electron";
import {
    BiomeData,
    chunkBlockIndexToOffset,
    DBChunkKeyEntryContentTypes,
    DBChunkLinkedContentTypes,
    DBEntryContentTypes,
    dimensions,
    dimensionVectorDimensionToInt,
    entryContentTypeToFormatMap,
    generateChunkKeyFromIndices,
    getBiomeTypeFromID,
    getChunkKeyIndices,
    getDimensionTypes,
    getDimensionTypesSync,
    getKeyDisplayName,
    intToDimensionVectorDimension,
    offsetToChunkBlockIndex,
    toLong,
    type DBChunkKeyEntryContentType,
    type DBChunkLinkedContentType,
    type DBEntryContentType,
    type Dimension,
    type DimensionLocation,
    type DimensionVector2,
    type DimensionVectorXZ,
    type NBTSchemas,
    type Vector2,
    type Vector3,
    type VectorXZ,
} from "mcbe-leveldb";
import mergeRefs from "merge-refs";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import { useEffect, useRef, useState } from "preact/compat";
import * as NBT from "prismarine-nbt";
import type { EditorWidgetOverlayBarWidgetRegistry } from "./EditorWidgetOverlayBar";
import { CanvasTileEngine, useCanvasTileEngine, type EngineHandle } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { blendPixelOverBackground } from "../../src/utils/imageUtils";
import { scaleNearest } from "../../src/utils/ImageResizer";
import { getLevelChunkMetaDataForChunk } from "../integrations/WorldEdit_Bedrock";
import type { LevelDB } from "@8crafter/leveldb-zlib";
import Notice from "./Notice";
import showNumberInputDialog, { type ShowNumberInputDialogResult } from "./NumberInputDialog";
import showLocationInputDialog, { type ShowLocationInputDialogResult } from "./LocationInputDialog";
const mime = require("mime-types") as typeof import("mime-types");

/**
 * The data storage object for the {@link WorldEditor2D}.
 */
export type WorldEditor2DDataStorageObject = {
    /**
     * The options for the {@link WorldEditor2D}.
     */
    worldEditor2D: {
        /**
         * The render type for the map.
         *
         * - `biomes`: Renders the biomes of the chunks.
         * - `blocks_accurate`: Renders the blocks of the chunks with accurate colors. // TODO
         * - `heightmap`: Renders the heightmap of the chunks. // TODO
         * - `blocks_map`: Renders the blocks of the chunks with their map colors. // TODO
         */
        renderType: "biomes" | "blocks_accurate" | "heightmap" | "blocks_map";
        /**
         * Whether to show the heightmap via shading over the existing rendered data.
         *
         * Does not apply to the `heightmap` render type.
         */
        heightmap: boolean;
        /**
         * The layer to render.
         *
         * - `surface`: The surface layer.
         * - `underground`: The surface layer, except if there is a cave biome (excluding the deep dark) at any y-level at that location, the cave biome will be shown instead.
         * - `bottom`: The bottom layer (y=-51). Only supported in the overworld.
         * - `<number>`: A specific y-level to render.
         */
        layer: "surface" | "underground" | "bottom" | number;
        /**
         * The zoom level for the map.
         */
        zoom: number;
        /**
         * The dimension to render.
         *
         * If a string is passed, it must be the ID of a vanilla dimension.
         *
         * If a number is passed, that number is the numeric ID of the dimension, it can be a vanilla or custom dimension.
         */
        dimension: Dimension | number;
        /**
         * The position of the center of the map.
         *
         * The position is chunk coordinates.
         */
        position: Vector2;
        /**
         * Whether to show the chunk grid overlay on the map.
         *
         * If `auto`, it will be shown if the zoom level is at least 8.
         */
        showGrid: boolean | "auto";
        /**
         * Whether to show the corresponding nether or overworld coordinates and chunk coordinates in the hover details overlay when in the overworld or the nether.
         */
        showCorrespondingNetherOrOverworldCoordinates: boolean;
        /**
         * The overlays to render on the map.
         */
        dataOverlays: {
            /**
             * Renders players on the map.
             *
             * @todo
             */
            players: boolean;
            /**
             * Renders entities on the map.
             *
             * @todo
             */
            entities: boolean;
            /**
             * Renders bounding boxes for spawning for structures (HardcodedSpawners and AABBVolumes).
             *
             * @todo
             */
            structureSpawningBoundingBoxes: boolean;
            /**
             * Renders portals on the map.
             */
            portals: boolean;
        };
    };
};

// IDEA: Maybe add a way to save some parts of the configs that are in the data storage object.

/**
 * Initializes the properties of the {@link WorldEditor2DDataStorageObject} onto the target object.
 *
 * This function mutates the original object.
 *
 * @param dataStorageObject The data storage object to initialize.
 * @returns The initialized data storage object.
 */
export function initWorldEditor2DDataStorageObjectProps<T extends object>(dataStorageObject: T): WorldEditor2DDataStorageObject & T {
    return Object.assign(dataStorageObject, {
        worldEditor2D: {
            renderType: "biomes",
            heightmap: config.views.world.modeSettings["2D"].showHeightmapDefault,
            layer: "surface",
            zoom: config.views.world.modeSettings["2D"].defaultMapScale,
            dimension: "overworld",
            position: { x: 0, y: 0 },
            showGrid: config.views.world.modeSettings["2D"].showGridDefault /* "auto" */ /* TEMP */,
            showCorrespondingNetherOrOverworldCoordinates: true,
            dataOverlays: {
                players: false,
                entities: false,
                structureSpawningBoundingBoxes: false,
                portals: true,
            },
        },
    } satisfies WorldEditor2DDataStorageObject);
}

/**
 * The properties for the {@link WorldEditor2D} component.
 */
export interface WorldEditor2DRendererProps {
    /**
     * The tab associated with this editor.
     */
    tab: TabManagerTab;
    dataStorageObject: WorldEditor2DDataStorageObject;
    readonly?: boolean | undefined;
    canvasRef?: RefObject<HTMLCanvasElement> | undefined;
    containerRef?: RefObject<HTMLDivElement> | undefined;
    interactionRef?: RefObject<WorldEditor2DInteraction> | undefined;
    /**
     * An optional overlay bar widget registry to allow the 2D world editor to register widgets for the overlay bar.
     *
     * @default undefined
     */
    overlayBarRegistry?: EditorWidgetOverlayBarWidgetRegistry | undefined;
}

/**
 * An interface containing methods to interacting with the 2D world editor.
 */
export interface WorldEditor2DInteraction {
    // updateMap(): void;
    $TODO?: never;
}

// IDEA: Implement multi-threading where it offloads chunk loading and image bitmap creation to separate worker threads.

/**
 * This is the fallback image to be used for chunks that have an error while loading or rendering.
 */
let FALLBACK_ERROR_CHUNK_IMAGE: Blob | "loading" | "error" | undefined;
let fallbackErrorChunkImageData: ImageData | null = null;

interface AnimatedChunkImage {
    getImageData(size: number, timestamp: number): ImageData;
}

/**
 * This is the image to be used for chunks that are still loading.
 */
let LOADING_CHUNK_IMAGE: AnimatedChunkImage | "no_data" | "loading" | "error" | undefined;

/**
 * This is the image to be used for chunks that have not started loading yet.
 */
let LOADING_PENDING_CHUNK_IMAGE: AnimatedChunkImage | "no_data" | "loading" | "error" | undefined;

/**
 * This is the image to be used for chunks that have no data.
 */
let NO_DATA_CHUNK_IMAGE: AnimatedChunkImage | "no_data" | "loading" | "error" | undefined;

/**
 * Icons for the map.
 */
const MAP_ICONS: {
    /**
     * The image to be used for the portal icon.
     */
    portalIconImage: HTMLImageElement | "loading" | "error" | undefined;
} = {
    portalIconImage: undefined,
};

/**
 * The rendering layers for the map.
 */
const MAP_LAYERS = {
    chunks: 0,
    grid: 1,
    worldBorder: 51,
    portalsOverlay: 52,
} as const satisfies Record<string, number>;

// TODO (Important): These should be moved to the config.
const HEIGHT_MAP_MODE: "normalized" | "difference" = "difference";
const HEIGHT_MAP_DIFFERENCE_MODE_STRENGTH: number = 1 / 10;
const HEIGHT_MAP_DIFFERENCE_MODE_MIN_TINT: number = 0.2; /* 0.6 */
const HEIGHT_MAP_DIFFERENCE_MODE_MAX_TINT: number = 1.8; /* 1.4 */

/**
 * The background color of the map.
 */
const MAP_BACKGROUND_COLOR: [r: number, g: number, b: number] = [0x0f, 0x17, 0x2a];

function generateErrorImageData(): ImageData {
    const imageDataBuffer: Uint8ClampedArray = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < 16 * 16; i++) {
        if (Math.floor(i / 16) === 0 || Math.floor(i / 16) === 15 || i % 16 === 0 || i % 16 === 15) {
            imageDataBuffer[i * 4] = 255;
            imageDataBuffer[i * 4 + 1] = 0;
            imageDataBuffer[i * 4 + 2] = 0;
            imageDataBuffer[i * 4 + 3] = 255;
            continue;
        }
        for (let j = 0; j < 3; j++) {
            imageDataBuffer[i * 4 + j] = Math.floor(Math.random() * 256);
        }
        imageDataBuffer[i * 4 + 3] = 255;
    }
    return new ImageData(imageDataBuffer, 16, 16);
}

// https://www.chunkbase.com/apps/biome-finder
// const biomeColors = Object.fromEntries(Array.from(document.querySelector(".max-h-\\[300px\\].overflow-x-hidden.overflow-y-auto[aria-label=\"Suggestions\"][role=\"listbox\"]").querySelectorAll(`div > div.text-foreground > div[cmdk-group-items=""] > div'`)).map(v=>[v.children[2].textContent, v.children[1].style.backgroundColor])); biomeColors;
// https://minecraft.wiki/w/Biome#Biome_IDs
// const biomeNames = Object.fromEntries(Array.from(document.querySelectorAll(`[data-description="Bedrock Biome IDs"] > tbody > tr`)).map(v=>[v.children[0].children[1].textContent, v.children[1].children[0].textContent])); biomeNames;
// const biomeColorMap = Object.fromEntries(Object.entries(biomeColors).map(([k, v])=>[biomeNames[k] ? `minecraft:${biomeNames[k]}` : `/\* FIX */:${k}`, v])); biomeColorMap;
const biomeColorMap: Record<keyof (typeof BiomeData)["int_map"], `rgb(${number}, ${number}, ${number})`> &
    Record<string, `rgb(${number}, ${number}, ${number})`> = {
    "minecraft:plains": "rgb(141, 179, 96)",
    "minecraft:ice_plains": "rgb(255, 255, 255)",
    "minecraft:mushroom_island": "rgb(255, 0, 255)",
    "minecraft:savanna": "rgb(189, 178, 95)",
    "minecraft:sunflower_plains": "rgb(181, 219, 136)",
    "minecraft:ice_plains_spikes": "rgb(180, 220, 220)",
    "minecraft:forest": "rgb(5, 102, 33)",
    "minecraft:taiga": "rgb(11, 102, 89)",
    "minecraft:jungle": "rgb(83, 123, 9)",
    "minecraft:jungle_edge": "rgb(98, 139, 23)",
    "minecraft:birch_forest": "rgb(48, 116, 68)",
    "minecraft:roofed_forest": "rgb(64, 81, 26)",
    "minecraft:cold_taiga": "rgb(49, 85, 74)",
    "minecraft:mega_taiga": "rgb(89, 102, 81)",
    "minecraft:flower_forest": "rgb(45, 142, 73)",
    "minecraft:birch_forest_mutated": "rgb(88, 156, 108)",
    "minecraft:redwood_taiga_mutated": "rgb(129, 142, 121)",
    "minecraft:bamboo_jungle": "rgb(118, 142, 20)",
    "minecraft:grove": "rgb(146, 178, 160)",
    "minecraft:cherry_grove": "rgb(247, 185, 220)",
    "minecraft:pale_garden": "rgb(108, 111, 150)",
    "minecraft:dappled_forest": "rgb(154, 63, 53)",
    "minecraft:dripstone_caves": "rgb(193, 165, 143)",
    "minecraft:lush_caves": "rgb(223, 150, 52)",
    "minecraft:deep_dark": "rgb(0, 0, 0)",
    "minecraft:sulfur_caves": "rgb(200, 200, 40)",
    "minecraft:extreme_hills": "rgb(96, 96, 96)",
    "minecraft:extreme_hills_plus_trees": "rgb(34, 85, 28)",
    "minecraft:stone_beach": "rgb(162, 162, 132)",
    "minecraft:savanna_plateau": "rgb(167, 157, 100)",
    "minecraft:extreme_hills_mutated": "rgb(136, 136, 136)",
    "minecraft:savanna_mutated": "rgb(229, 218, 135)",
    "minecraft:meadow": "rgb(140, 164, 112)",
    "minecraft:snowy_slopes": "rgb(218, 241, 241)",
    "minecraft:frozen_peaks": "rgb(234, 251, 251)",
    "minecraft:jagged_peaks": "rgb(186, 188, 182)",
    "minecraft:stony_peaks": "rgb(209, 209, 209)",
    "minecraft:swampland": "rgb(7, 249, 178)",
    "minecraft:mangrove_swamp": "rgb(36, 196, 142)",
    "minecraft:desert": "rgb(250, 148, 24)",
    "minecraft:beach": "rgb(250, 222, 85)",
    "minecraft:cold_beach": "rgb(250, 240, 192)",
    "minecraft:mesa": "rgb(217, 69, 21)",
    "minecraft:mesa_plateau_stone": "rgb(176, 151, 101)",
    "minecraft:mesa_bryce": "rgb(255, 109, 61)",
    "minecraft:ocean": "rgb(0, 0, 112)",
    "minecraft:river": "rgb(0, 0, 255)",
    "minecraft:frozen_ocean": "rgb(112, 112, 214)",
    "minecraft:frozen_river": "rgb(160, 160, 255)",
    "minecraft:deep_ocean": "rgb(0, 0, 48)",
    "minecraft:warm_ocean": "rgb(0, 0, 172)",
    "minecraft:lukewarm_ocean": "rgb(0, 0, 144)",
    "minecraft:cold_ocean": "rgb(32, 32, 112)",
    "minecraft:deep_lukewarm_ocean": "rgb(0, 0, 64)",
    "minecraft:deep_cold_ocean": "rgb(32, 32, 56)",
    "minecraft:deep_frozen_ocean": "rgb(64, 64, 144)",
    "minecraft:ice_mountains": "rgb(160, 160, 160)",
    "minecraft:mushroom_island_shore": "rgb(160, 0, 255)",
    "minecraft:desert_hills": "rgb(210, 95, 18)",
    "minecraft:taiga_hills": "rgb(22, 57, 51)",
    "minecraft:extreme_hills_edge": "rgb(114, 120, 154)",
    "minecraft:jungle_hills": "rgb(44, 66, 5)",
    "minecraft:birch_forest_hills": "rgb(31, 95, 50)",
    "minecraft:cold_taiga_hills": "rgb(36, 63, 54)",
    "minecraft:mega_taiga_hills": "rgb(69, 79, 62)",
    "minecraft:forest_hills": "rgb(80, 112, 80)",
    "minecraft:mesa_plateau": "rgb(202, 140, 101)",
    "minecraft:deep_warm_ocean": "rgb(0, 0, 80)",
    "minecraft:desert_mutated": "rgb(255, 188, 64)",
    "minecraft:taiga_mutated": "rgb(51, 142, 129)",
    "minecraft:swampland_mutated": "rgb(47, 255, 218)",
    "minecraft:jungle_mutated": "rgb(123, 163, 49)",
    "minecraft:jungle_edge_mutated": "rgb(138, 179, 63)",
    "minecraft:birch_forest_hills_mutated": "rgb(71, 135, 90)",
    "minecraft:roofed_forest_mutated": "rgb(104, 121, 66)",
    "minecraft:cold_taiga_mutated": "rgb(89, 125, 114)",
    "minecraft:redwood_taiga_hills_mutated": "rgb(109, 119, 102)",
    "minecraft:extreme_hills_plus_trees_mutated": "rgb(120, 152, 120)",
    "minecraft:savanna_plateau_mutated": "rgb(207, 197, 140)",
    "minecraft:mesa_plateau_stone_mutated": "rgb(216, 191, 141)",
    "minecraft:mesa_plateau_mutated": "rgb(242, 180, 141)",
    "minecraft:bamboo_jungle_hills": "rgb(59, 71, 10)",
    "minecraft:hell": "rgb(191, 59, 59)",
    "minecraft:soulsand_valley": "rgb(94, 56, 48)",
    "minecraft:crimson_forest": "rgb(221, 8, 8)",
    "minecraft:warped_forest": "rgb(73, 144, 123)",
    "minecraft:basalt_deltas": "rgb(64, 54, 54)",
    "minecraft:the_end": "rgb(128, 128, 255)",
    // Manual
    "minecraft:legacy_frozen_ocean": "rgb(96, 128, 192)",
};

const failedVanillaBiomeColorLookups: number[] = [];

function getBiomeColor(biomeId: number): `rgb(${number}, ${number}, ${number})` {
    if (biomeId < 10000) {
        const biomeNamespacedId = getBiomeTypeFromID(biomeId);
        const biomeColor: `rgb(${number}, ${number}, ${number})` | undefined = biomeNamespacedId ? biomeColorMap[biomeNamespacedId] : undefined;
        if (biomeColor !== undefined) return biomeColor;
        if (biomeNamespacedId !== undefined && !failedVanillaBiomeColorLookups.includes(biomeId)) {
            console.warn("Could not find biome color for", biomeNamespacedId, `(${biomeId})`);
            failedVanillaBiomeColorLookups.push(biomeId);
        } else if (!failedVanillaBiomeColorLookups.includes(biomeId)) {
            console.warn("Could not find biome color for biome with numeric ID", biomeId, "because the biome's namespaced ID could not be found");
            failedVanillaBiomeColorLookups.push(biomeId);
        }
        const color: [r: number, g: number, b: number] = biomeIdToFallbackColor(biomeId);
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }

    // IDEA: Add mappings for custom biomes for popular add-ons.

    const color: [r: number, g: number, b: number] = biomeIdToFallbackColor(biomeId);
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

// REVIEW: Make sure that two IDs that are close to each other won't always have similar colors.
/**
 * Converts a biome numeric ID to a fallback color.
 *
 * This is meant to be used if the color mapping cannot be found.
 *
 * @param id The biome numeric ID, should be between 0 and 65535 (inclusive).
 * @returns The fallback color.
 */
function biomeIdToFallbackColor(id: number): [r: number, g: number, b: number] {
    id &= 0xffff;

    let x: number = id;
    x ^= x << 7;
    x ^= x >> 9;
    x ^= x << 8;

    const r = (x >> 16) & 0xff;
    const g = (x >> 8) & 0xff;
    const b = x & 0xff;

    return [r, g, b];
}
/**
 * Converts a biome numeric ID to a biome namespaced ID.
 *
 * @param id The biome numeric ID, should be between 0 and 65535 (inclusive).
 * @param customBiomeIdMapping The custom biome ID mapping, if provided it will allow for the namespaced IDs of custom biomes to be resolved.
 * @returns The biome namespaced ID, or `undefined` if the ID could not be resolved.
 */
function getBiomeNamespacedIdFromNumericId(id: number, customBiomeIdMapping?: NBTSchemas.NBTSchemaTypes.BiomeIdsTable): string | undefined {
    if (id < 10000) return getBiomeTypeFromID(id);
    return customBiomeIdMapping?.value.list.value.value.find((v) => v.id.value === id)?.name.value;
}

/**
 * Gets the height range for a chunk.
 *
 * @param db The LevelDB.
 * @param chunk The chunk.
 * @param levelChunkMetaDataDictionary The level chunk meta data dictionary.
 * @param additionalInfo Additional information about the chunk.
 * @returns The height range, or `null` if the height range could not be found.
 */
async function getHeightRangeForChunk(
    db: LevelDB,
    chunk: DimensionVectorXZ,
    levelChunkMetaDataDictionary: NBTSchemas.NBTSchemaTypes.LevelChunkMetaDataDictionary | undefined,
    additionalInfo?:
        | {
              type: "Data3D";
              subchunkCount?: number | undefined;
              dimension?: Dimension | number | undefined;
              version?: number | undefined;
              isOldWorldType?: boolean | undefined;
          }
        | {
              type: "Data2D";
              dimension?: Dimension | number | undefined;
              legacyVersion?: never; // In case this is ever needed.s
              version?: number | undefined;
              isOldWorldType?: boolean | undefined;
          }
        | { type: "Data2DLegacy" | "LegacyTerrain" }
): Promise<[min: number, max: number] | null> {
    if (additionalInfo?.type === "LegacyTerrain") return [0, 128];
    if (additionalInfo?.type === "Data2DLegacy") return [0, 128];
    if (additionalInfo?.type === "Data2D" && additionalInfo.dimension === "overworld" && additionalInfo.isOldWorldType === true) return [0, 128];
    if (
        additionalInfo?.type === "Data2D" &&
        additionalInfo.dimension === "overworld" &&
        additionalInfo.isOldWorldType === undefined &&
        additionalInfo.version !== undefined &&
        additionalInfo.version > 22
    ) {
        return [0, 128];
    }
    if (additionalInfo?.type === "Data2D" && additionalInfo.dimension === "overworld") return [0, 256];
    if (additionalInfo?.type === "Data2D" && additionalInfo.dimension === "nether") return [0, 128];
    if (additionalInfo?.type === "Data2D" && additionalInfo.dimension === "the_end") return [0, 256];
    try {
        const chunkMetaData = await getLevelChunkMetaDataForChunk(db, chunk, levelChunkMetaDataDictionary);
        const heightRange = (chunkMetaData.LastSavedDimensionHeightRange ?? chunkMetaData.OriginalDimensionHeightRange).value;
        return [heightRange.min.value, heightRange.max.value];
    } catch (e) {
        if (e instanceof ReferenceError && e.message === "LevelChunkMetaDataDictionary data not found.") {
            if (additionalInfo?.type === "Data3D" && additionalInfo.subchunkCount !== undefined) {
                if (
                    additionalInfo.subchunkCount === 8 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "nether" || additionalInfo.dimension === 1))
                )
                    return [0, 128];
                if (
                    additionalInfo.subchunkCount === 16 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "the_end" || additionalInfo.dimension === 2))
                )
                    return [0, 256];
                if (
                    additionalInfo.subchunkCount === 24 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0))
                )
                    return [-64, 320];

                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version < 39 &&
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0) &&
                    additionalInfo.isOldWorldType === false
                ) {
                    return [-64, 320];
                }
                // TEST: Figure out what happens if a 1.17.41.1 old world with the C&C experimental toggle has the toggle disabled.
                // TEST: Figure out what happens if a 1.17.41.1 old world with the C&C experimental toggle is changed to an infinite world. Maybe it will lower the terrain to be a much lower y level? In which case the below logic is perfect.
                // NOTE: The above two tests apply to the duplicate of the below code inside of the missing meta data hash handling below.
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version < 39 && // Version 35 fixed the old world type to use Data2D instead of Data3D.
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0) &&
                    additionalInfo.isOldWorldType === true
                ) {
                    return [0, 128];
                }

                // In version 1.18.0.22, the only way for an updated chunk to have 32 subchunks is if it was from an old world type, where new Data2D keys were generated and the Data3D keys were left alone.
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version > 34 &&
                    additionalInfo.version < 37 &&
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0)
                ) {
                    return [0, 128];
                }

                // In version 1.18.0.22, the old world type's Data3D keys were not updated to have 65 subchunks.
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version > 34 &&
                    additionalInfo.version < 37 &&
                    additionalInfo.subchunkCount === 65 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0)
                ) {
                    return [-64, 320];
                }
            }
        } else if (e instanceof ReferenceError && e.message === "Level chunk meta data hash not found.") {
            if (additionalInfo?.type === "Data3D" && additionalInfo.subchunkCount !== undefined) {
                if (
                    additionalInfo.subchunkCount === 8 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "nether" || additionalInfo.dimension === 1))
                )
                    return [0, 128];
                if (
                    additionalInfo.subchunkCount === 16 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "the_end" || additionalInfo.dimension === 2))
                )
                    return [0, 256];
                if (
                    additionalInfo.subchunkCount === 24 ||
                    (additionalInfo.subchunkCount === 25 && (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0))
                )
                    return [-64, 320];

                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version < 39 &&
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0) &&
                    additionalInfo.isOldWorldType === false
                ) {
                    return [-64, 320];
                }
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version < 39 && // Version 35 fixed the old world type to use Data2D instead of Data3D.
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0) &&
                    additionalInfo.isOldWorldType === true
                ) {
                    return [0, 128];
                }

                // In version 1.18.0.22, the only way for an updated chunk to have 32 subchunks is if it was from an old world type, where new Data2D keys were generated and the Data3D keys were left alone.
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version > 34 &&
                    additionalInfo.version < 37 &&
                    additionalInfo.subchunkCount === 32 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0)
                ) {
                    return [0, 128];
                }

                // In version 1.18.0.22, the old world type's Data3D keys were not updated to have 65 subchunks.
                if (
                    additionalInfo.version !== undefined &&
                    additionalInfo.version > 34 &&
                    additionalInfo.version < 37 &&
                    additionalInfo.subchunkCount === 65 &&
                    (additionalInfo.dimension === "overworld" || additionalInfo.dimension === 0)
                ) {
                    return [-64, 320];
                }
            }
        }
        return null;
    }
}

/**
 * The 2D world editor.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 *
 * @throws {Error} If the data type is invalid or not supported by the 2D world editor.
 */
export function WorldEditor2D(props: WorldEditor2DRendererProps): JSX.Element {
    if (props.tab.type !== "world" && props.tab.type !== "leveldb") {
        return (
            <Notice
                title="Unsupported Tab Type"
                subtitle={`The world map is not supported for tabs of type ${String(props.tab.type)}.`}
                detail={null}
                image="nothing_to_see"
            />
        );
    }
    const formatter = new Intl.NumberFormat();
    const containerRef: RefObject<HTMLDivElement> = mergeRefs(useRef<HTMLDivElement>(null), props.containerRef);
    const canvasRef: RefObject<HTMLCanvasElement> = mergeRefs(useRef<HTMLCanvasElement>(null), props.canvasRef);
    if (FALLBACK_ERROR_CHUNK_IMAGE === undefined) {
        FALLBACK_ERROR_CHUNK_IMAGE = "loading";
        fetch("resource://images/ui/misc/bug_pack_icon_16x.png")
            .then((response: Response): Promise<Blob> => response.blob())
            .then(async (blob: Blob): Promise<void> => {
                FALLBACK_ERROR_CHUNK_IMAGE = blob;
                const imageBitmap = await createImageBitmap(blob);
                const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
                const ctx: OffscreenCanvasRenderingContext2D = canvas.getContext("2d")!;
                ctx.drawImage(imageBitmap, 0, 0);
                fallbackErrorChunkImageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
            })
            .catch((error: unknown): void => {
                FALLBACK_ERROR_CHUNK_IMAGE = "error";
                console.error("Error while fetching the fallback error chunk image:", error);
                fallbackErrorChunkImageData = generateErrorImageData();
            });
    }
    if (LOADING_CHUNK_IMAGE === undefined) {
        // LOADING_CHUNK_IMAGE = "loading";
        // fetch("resource://images/ui/misc/bug_pack_icon_16x.png")
        //     .then((response: Response): Promise<Blob> => response.blob())
        //     .then((blob: Blob): void => void (LOADING_CHUNK_IMAGE = blob))
        //     .catch((error: unknown): void => {
        //         LOADING_CHUNK_IMAGE = "error";
        //         console.error("Error while fetching the fallback error chunk image:", error);
        //     });
        // LOADING_CHUNK_IMAGE = "no_data";
        LOADING_CHUNK_IMAGE = {
            getImageData(size: number, timestamp: number): ImageData {
                size = Math.round(size);
                const rawPixels: Uint8ClampedArray = new Uint8ClampedArray(size * size * 4);
                const fadeOpacity: number = ((0.5 + Math.sin((timestamp / 1000) * Math.PI) * 0.5) * 0.2475 + 0.025) * 255;
                for (let i = 0; i < rawPixels.length; i += 4) rawPixels.set([255, 26, 255, fadeOpacity], i);
                return new ImageData(rawPixels, size, size);
            },
            // getImageData(size: number, timestamp: number): ImageData {
            //     const imageSize: [width: number, height: number] = [1, 1];
            //     const rawPixels: Uint8ClampedArray = new Uint8ClampedArray(imageSize[0] * imageSize[1] * 4);
            //     const fadeBrightness: number = 0.5 + Math.sin((timestamp / 1000) * Math.PI) * 0.5;
            //     rawPixels.set([fadeBrightness, fadeBrightness, fadeBrightness, 255], 0);
            //     const imgData = new ImageData(rawPixels, ...imageSize);
            //     const src = new OffscreenCanvas(...imageSize);
            //     const sctx: OffscreenCanvasRenderingContext2D = src.getContext("2d")!;
            //     sctx.putImageData(imgData, 0, 0);
            //     const dst = new OffscreenCanvas(size, size);
            //     const dctx: OffscreenCanvasRenderingContext2D = dst.getContext("2d")!;
            //     dctx.imageSmoothingEnabled = false;
            //     dctx.drawImage(src, 0, 0, dst.width, dst.height);
            //     return dctx.getImageData(0, 0, dst.width, dst.height);
            // },
        };
    }
    if (LOADING_PENDING_CHUNK_IMAGE === undefined) {
        LOADING_PENDING_CHUNK_IMAGE = {
            getImageData(size: number, timestamp: number): ImageData {
                size = Math.round(size);
                const rawPixels: Uint8ClampedArray = new Uint8ClampedArray(size * size * 4);
                const fadeOpacity: number = ((0.5 + Math.sin((timestamp / 1000) * Math.PI) * 0.5) * 0.2475 + 0.025) * 255;
                const color: [r: number, g: number, b: number, a: number] = blendPixelOverBackground(255, 255, 255, fadeOpacity, ...MAP_BACKGROUND_COLOR);
                for (let i = 0; i < rawPixels.length; i += 4) rawPixels.set(color, i);
                return new ImageData(rawPixels, size, size);
            },
        };
    }
    if (NO_DATA_CHUNK_IMAGE === undefined) {
        // NO_DATA_CHUNK_IMAGE = {
        //     getImageData(size: number, _timestamp: number): ImageData {
        //         size = Math.round(size);
        //         const rawPixels: Uint8ClampedArray = new Uint8ClampedArray(size * size * 4);
        //         const color: [r: number, g: number, b: number, a: number] = [...MAP_BACKGROUND_COLOR, 255];
        //         for (let i = 0; i < rawPixels.length; i += 4) rawPixels.set(color, i);
        //         return new ImageData(rawPixels, size, size);
        //     },
        // };
        // NO_DATA_CHUNK_IMAGE = "loading";
        // fetch("resource://images/ui/misc/bug_pack_icon_16x.png")
        //     .then((response: Response): Promise<Blob> => response.blob())
        //     .then((blob: Blob): void => void (NO_DATA_CHUNK_IMAGE = blob))
        //     .catch((error: unknown): void => {
        //         NO_DATA_CHUNK_IMAGE = "error";
        //         console.error("Error while fetching the no data chunk image:", error);
        //     });
        NO_DATA_CHUNK_IMAGE = "no_data";
    }
    if (MAP_ICONS.portalIconImage === undefined) {
        MAP_ICONS.portalIconImage = "loading";
        const imageElement = new Image();
        imageElement.src = "resource://images/ui/glyphs/realmPortalSmall_24x.png";
        imageElement.onload = (): void => void (MAP_ICONS.portalIconImage = imageElement);
        imageElement.onerror = (error: unknown): void => {
            console.error("Error while loading the portal icon image:", error);
            MAP_ICONS.portalIconImage = "error";
        };
    }

    let stopCurrentInteraction: (() => void) | undefined = undefined;
    // function updateMap(): void {
    //     data = (
    //         props.dataStorageObject.dataType === "NBT" ? props.dataStorageObject.data.parsed
    //         : props.dataStorageObject.dataType === "NBTCompound" ? props.dataStorageObject.data
    //         : props.dataStorageObject.data) as NBTSchemas.NBTSchemaTypes.Map;
    //     const canvas: HTMLCanvasElement = canvasRef.current!;
    //     const context: CanvasRenderingContext2D = canvas.getContext("2d")!;
    //     context.clearRect(0, 0, canvas.width, canvas.height);
    //     for (let i: number = 0; i < data.value.colors.value.length / 4; i++) {
    //         const r: number = data.value.colors.value[i * 4]! & 0xff;
    //         const g: number = data.value.colors.value[i * 4 + 1]! & 0xff;
    //         const b: number = data.value.colors.value[i * 4 + 2]! & 0xff;
    //         const a: number = data.value.colors.value[i * 4 + 3]! & 0xff;
    //         context.fillStyle = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a
    //             .toString(16)
    //             .padStart(2, "0")}`;
    //         context.fillRect(i % 128, Math.floor(i / 128), 1, 1);
    //     }
    // }
    if (props.interactionRef) {
        props.interactionRef.current = {
            // updateMap: updateMap,
        };
    }
    // function markTabAsModified(): void {
    //     if (props.tab) {
    //         props.tab.hasUnsavedChanges = true;
    //         if (props.tab.target.type === "LevelDBEntry") {
    //             props.tab.parentTab.setLevelDBIsModified();
    //         } else {
    //             props.tab.parentTab.setFileAsModified(props.tab.target.path);
    //         }
    //     }
    // }

    const [worldEditor2DAddMarkerMenu_isOpen, worldEditor2DAddMarkerMenu_setOpen] = useState(false);
    const [worldEditor2DAddMarkerMenu_anchorPoint, worldEditor2DAddMarkerMenu_setAnchorPoint] = useState({ x: 0, y: 0 });

    let levelDatLoaded: boolean | "loading" | "error" = false;
    let isOldWorld: boolean | null | undefined = undefined;
    let worldSpawn: DimensionLocation | null | undefined = undefined;
    let worldBorder: { from: VectorXZ; to: VectorXZ } | null | undefined = undefined;
    let netherScale: number | null | undefined = undefined;
    function unloadLevelDatData(): void {
        levelDatLoaded = false;
        isOldWorld = undefined;
        worldSpawn = undefined;
        worldBorder = undefined;
        netherScale = undefined;
    }
    async function loadNeededDataFromLevelDat(): Promise<void> {
        levelDatLoaded = "loading";
        try {
            if (props.tab.type !== "world") return;
            const filePath: string = path.join(props.tab.tempPath ?? props.tab.path, "level.dat");
            if (!existsSync(filePath)) throw new ReferenceError(`Could not find the level.dat file: ${filePath}`);
            let levelDat: NBTSchemas.NBTSchemaTypes.LevelDat;
            try {
                levelDat = await entryContentTypeToFormatMap.LevelDat.parse(await readFile(filePath));
            } catch (e) {
                console.error("Error while parsing the level.dat file while loading needed data from level.dat:", e, "filePath:", filePath);
                const fallbackFilePath: string = path.join(props.tab.tempPath ?? props.tab.path, "level.dat_old");
                if (!existsSync(fallbackFilePath)) throw new ReferenceError(`Could not find the level.dat_old file: ${fallbackFilePath}`, { cause: e });
                try {
                    levelDat = await entryContentTypeToFormatMap.LevelDat.parse(await readFile(fallbackFilePath));
                } catch (e) {
                    console.error(
                        "Error while parsing the level.dat_old file as a fallback while loading needed data from level.dat:",
                        e,
                        "fallbackFilePath:",
                        fallbackFilePath
                    );
                    levelDatLoaded = "error";
                    return;
                }
            }
            if (levelDat.value.Generator) isOldWorld = levelDat.value.Generator.value === 0;
            else isOldWorld = null;
            if (levelDat.value.SpawnX && levelDat.value.SpawnY && levelDat.value.SpawnZ) {
                worldSpawn = {
                    x: levelDat.value.SpawnX.value,
                    y: levelDat.value.SpawnY.value,
                    z: levelDat.value.SpawnZ.value,
                    // NOTE: If a way is added to set the world spawn to be in a different dimension, it should be added here.
                    dimension: "overworld",
                };
            } else worldSpawn = null;
            // REVIEW: This may be incorrect for other old world sizes, try changing the associated LevelDat properties and comparing the real world border to the one calculated here.
            if (
                levelDat.value.Generator?.value === 0 &&
                levelDat.value.LimitedWorldOriginX &&
                levelDat.value.LimitedWorldOriginZ &&
                levelDat.value.limitedWorldWidth &&
                levelDat.value.limitedWorldDepth
            ) {
                // LimitedWorldOriginX: 52,
                // LimitedWorldOriginY: 32767,
                // LimitedWorldOriginZ: 4,
                // limitedWorldDepth: 16,
                // limitedWorldWidth: 16,
                // border is from -192, -224 to 303, 239
                const originX = Math.floor(levelDat.value.LimitedWorldOriginX.value / 16) * 16;
                const originZ = Math.floor(levelDat.value.LimitedWorldOriginZ.value / 16) * 16;

                // BUG: On a 1.18.0.22 beta world using the old world type, this gave incorrect results:
                // LimitedWorldOriginX: 308,
                // LimitedWorldOriginY: 32767,
                // LimitedWorldOriginZ: 24,
                // limitedWorldDepth: 16,
                // limitedWorldWidth: 16,
                // border is from 176, -112 to 431, 143
                // but this calculated the border as from 64, -208 to 559, 255

                const widthChunks = levelDat.value.limitedWorldWidth.value;
                const depthChunks = levelDat.value.limitedWorldDepth.value;

                worldBorder = {
                    from: {
                        x: originX - (widthChunks - 1) * 16,
                        z: originZ - (depthChunks - 2) * 16,
                    },
                    to: {
                        x: originX + widthChunks * 16 - 1,
                        z: originZ + (depthChunks - 1) * 16 - 1,
                    },
                };
            } else worldBorder = null;
            if (levelDat.value.NetherScale) netherScale = levelDat.value.NetherScale.value;
            else netherScale = null;
            levelDatLoaded = true;
            onLevelDatDataChanged();
        } catch (e) {
            console.error("Error while loading needed data from level.dat:", e);
            if (levelDatLoaded === "loading") levelDatLoaded = "error";
        }
    }
    function onLevelDatDataChanged(): void {
        if (!engineRef.current?.isReady) return;
        engineRef.current.clearLayer(51);
        if (worldBorder) {
            engineRef.current.drawRect(
                {
                    x: (worldBorder.to.x + 1 + worldBorder.from.x) / 32 - 0.5,
                    y: (worldBorder.to.z + 1 + worldBorder.from.z) / 32 - 0.5,
                    width: (worldBorder.to.x + 1 - worldBorder.from.x) / 16,
                    height: (worldBorder.to.z + 1 - worldBorder.from.z) / 16,
                    style: { strokeStyle: "#00ffff", lineWidth: 2 },
                },
                2
            );
        }
    }
    loadNeededDataFromLevelDat();

    useEffect((): (() => void) => {
        const widgetID: string = `WorldEditor2D_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        if (engineRef.current?.isReady) {
            if (levelDatLoaded === true) onLevelDatDataChanged();
            // updateMap();
            // stopCurrentInteraction = void function a(): void {};
            stopCurrentInteraction = void function stopCurrentInteractionCallback(): void {
                // TODO
                stopCurrentInteraction = undefined;
            };
            if (props.overlayBarRegistry && !props.readonly) {
                props.overlayBarRegistry.registerWidget(
                    <>
                        <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                            <button
                                type="button"
                                title="Filter Biomes"
                                class="image-only-button"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                    event.currentTarget.dataset.preventImmediateReopen = "false";
                                    if (!dimensionSwitcherContextMenuInteractionRef.current) return;
                                    if (!dimensionSwitcherContextMenuInteractionRef.current.isOpen) return;
                                    event.currentTarget.dataset.preventImmediateReopen = "true";
                                    dimensionSwitcherContextMenuInteractionRef.current.setOpen(false);
                                }}
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    // TODO
                                    if (event.currentTarget.dataset.preventImmediateReopen === "true") {
                                        event.currentTarget.dataset.preventImmediateReopen = "false";
                                        return;
                                    }
                                    if (!containerRef.current) return;
                                    // if (!dimensionSwitcherContextMenuInteractionRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    // dimensionSwitcherContextMenuInteractionRef.current.openContextMenu({ x: event.clientX, y: event.clientY });
                                }}
                                disabled
                            >
                                <img
                                    // TODO: This should change to Filter_Fill_16x.png when a biome filter is active.
                                    src="resource://images/ui/glyphs/Filter_16x.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Overlays"
                                class="image-only-button"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                    event.currentTarget.dataset.preventImmediateReopen = "false";
                                    if (!visibleOverlaysContextMenuInteractionRef.current) return;
                                    if (!visibleOverlaysContextMenuInteractionRef.current.isOpen) return;
                                    event.currentTarget.dataset.preventImmediateReopen = "true";
                                    visibleOverlaysContextMenuInteractionRef.current.setOpen(false);
                                }}
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (event.currentTarget.dataset.preventImmediateReopen === "true") {
                                        event.currentTarget.dataset.preventImmediateReopen = "false";
                                        return;
                                    }
                                    if (!containerRef.current) return;
                                    if (!visibleOverlaysContextMenuInteractionRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    visibleOverlaysContextMenuInteractionRef.current.openContextMenu({ x: event.clientX, y: event.clientY });
                                }}
                            >
                                <img src="resource://images/ui/glyphs/Eye_16x.png" style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                title="2D Map Settings"
                                class="image-only-button"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                    event.currentTarget.dataset.preventImmediateReopen = "false";
                                    if (!settingsContextMenuInteractionRef.current) return;
                                    if (!settingsContextMenuInteractionRef.current.isOpen) return;
                                    event.currentTarget.dataset.preventImmediateReopen = "true";
                                    settingsContextMenuInteractionRef.current.setOpen(false);
                                }}
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (event.currentTarget.dataset.preventImmediateReopen === "true") {
                                        event.currentTarget.dataset.preventImmediateReopen = "false";
                                        return;
                                    }
                                    if (!containerRef.current) return;
                                    if (!settingsContextMenuInteractionRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    settingsContextMenuInteractionRef.current.openContextMenu({ x: event.clientX, y: event.clientY });
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/config_small_down1.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Switch Layer"
                                class="image-only-button"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                    event.currentTarget.dataset.preventImmediateReopen = "false";
                                    if (!layerContextMenuInteractionRef.current) return;
                                    if (!layerContextMenuInteractionRef.current.isOpen) return;
                                    event.currentTarget.dataset.preventImmediateReopen = "true";
                                    layerContextMenuInteractionRef.current.setOpen(false);
                                }}
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (event.currentTarget.dataset.preventImmediateReopen === "true") {
                                        event.currentTarget.dataset.preventImmediateReopen = "false";
                                        return;
                                    }
                                    if (!containerRef.current) return;
                                    if (!layerContextMenuInteractionRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    layerContextMenuInteractionRef.current.openContextMenu({ x: event.clientX, y: event.clientY });
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/flat_plane_stack_v2.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Switch Dimension"
                                class="image-only-button"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                    event.currentTarget.dataset.preventImmediateReopen = "false";
                                    if (!dimensionSwitcherContextMenuInteractionRef.current) return;
                                    if (!dimensionSwitcherContextMenuInteractionRef.current.isOpen) return;
                                    event.currentTarget.dataset.preventImmediateReopen = "true";
                                    dimensionSwitcherContextMenuInteractionRef.current.setOpen(false);
                                }}
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (event.currentTarget.dataset.preventImmediateReopen === "true") {
                                        event.currentTarget.dataset.preventImmediateReopen = "false";
                                        return;
                                    }
                                    if (!containerRef.current) return;
                                    if (!dimensionSwitcherContextMenuInteractionRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    dimensionSwitcherContextMenuInteractionRef.current.openContextMenu({ x: event.clientX, y: event.clientY });
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/realms_stories_pause_menu_icon.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                        <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                            <button
                                type="button"
                                title="Zoom Out"
                                class="image-only-button"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (!containerRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const centerPosition: import("@canvas-tile-engine/core").Coords = engineRef.current.getCenterCoords();
                                    engineRef.current.instance?.zoomOut(1.5);
                                    engineRef.current.goCoords(centerPosition.x, centerPosition.y, 0);
                                }}
                            >
                                <img src="resource://images/ui/glyphs/zoom_out.png" style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                title="Reset Zoom"
                                class="image-only-button"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (!containerRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const centerPosition: import("@canvas-tile-engine/core").Coords = engineRef.current.getCenterCoords();
                                    engineRef.current.setScale(config.views.world.modeSettings["2D"].defaultMapScale);
                                    engineRef.current.goCoords(centerPosition.x, centerPosition.y, 0);
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/zoom_reset.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Zoom In"
                                class="image-only-button"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (!containerRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const centerPosition: import("@canvas-tile-engine/core").Coords = engineRef.current.getCenterCoords();
                                    engineRef.current.instance?.zoomIn(1.5);
                                    engineRef.current.goCoords(centerPosition.x, centerPosition.y, 0);
                                }}
                            >
                                <img src="resource://images/ui/glyphs/zoom_in.png" style={{ width: "16px", imageRendering: "pixelated" }} aria-hidden="true" />
                            </button>
                        </div>
                        <div class="widget-overlay tabbed-selector float-right" style={{ float: "right" }}>
                            <button
                                type="button"
                                title="Go to Random Chunk With Biome Data"
                                class="image-only-button"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    // IDEA: Add a version of this that only searching the Version and LegacyVersion keys instead and is Go to Random Chunk With Data.
                                    if (!containerRef.current) return;
                                    if (!props.tab.cachedDBKeys) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const t1: number = performance.now(); // DEBUG
                                    const chunksInDimension = new Set<`${number},${number}`>();
                                    const currentDimension =
                                        typeof props.dataStorageObject.worldEditor2D.dimension === "number" ?
                                            intToDimensionVectorDimension(props.dataStorageObject.worldEditor2D.dimension)
                                        :   props.dataStorageObject.worldEditor2D.dimension;
                                    for (const key of props.tab.cachedDBKeys.Data3D) {
                                        try {
                                            const { dimension, x, z } = getChunkKeyIndices(key);
                                            if (dimension === currentDimension) chunksInDimension.add(`${x},${z}`);
                                        } catch {}
                                    }
                                    for (const key of props.tab.cachedDBKeys.Data2D) {
                                        try {
                                            const { dimension, x, z } = getChunkKeyIndices(key);
                                            if (dimension === currentDimension) chunksInDimension.add(`${x},${z}`);
                                        } catch {}
                                    }
                                    for (const key of props.tab.cachedDBKeys.Data2DLegacy) {
                                        try {
                                            const { dimension, x, z } = getChunkKeyIndices(key);
                                            if (dimension === currentDimension) chunksInDimension.add(`${x},${z}`);
                                        } catch {}
                                    }
                                    for (const key of props.tab.cachedDBKeys.LegacyTerrain) {
                                        try {
                                            const { dimension, x, z } = getChunkKeyIndices(key);
                                            if (dimension === currentDimension) chunksInDimension.add(`${x},${z}`);
                                        } catch {}
                                    }
                                    if (chunksInDimension.size === 0) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `No chunks with biome data in dimension ${currentDimension} were found.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const chunkIndex: number = Math.floor(Math.random() * chunksInDimension.size);
                                    let chunk: VectorXZ | undefined;
                                    {
                                        let currentSetIndex: number = 0;
                                        for (const currentChunk of chunksInDimension) {
                                            if (currentSetIndex++ !== chunkIndex) continue;
                                            const [x, z] = currentChunk.split(",").map(Number) as [x: number, z: number];
                                            chunk = { x, z };
                                            break;
                                        }
                                    }
                                    if (!chunk) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `Failed to get the random chunk at index ${chunkIndex} from the set of chunks in this dimension with biome data.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    engineRef.current.instance?.goCoords(
                                        chunk.x + 0.5,
                                        chunk.z + 0.5,
                                        config.views.world.modeSettings["2D"].mapGoToPositionAnimationDuration
                                    );
                                    const t2: number = performance.now(); // DEBUG
                                    console.debug(`Go to Random Chunk With Biome Data took ${t2 - t1}ms.`); // DEBUG
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/random_dice.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Teleport"
                                class="image-only-button"
                                onClick={async (_event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (!containerRef.current) return;
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    const locationDialogResult: ShowLocationInputDialogResult<"x" | "z"> = await showLocationInputDialog({
                                        options: ["x", "z"],
                                        submitButtonText: "Teleport",
                                    });
                                    if (locationDialogResult.canceled) return;
                                    engineRef.current.instance?.goCoords(
                                        locationDialogResult.data.x / 16,
                                        locationDialogResult.data.z / 16,
                                        config.views.world.modeSettings["2D"].mapGoToPositionAnimationDuration
                                    );
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/ender_pearl.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                title="Go to Spawn"
                                class="image-only-button"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                                    if (!containerRef.current) return;
                                    if (worldSpawn === undefined) {
                                        await loadNeededDataFromLevelDat();
                                        if (levelDatLoaded === "error") {
                                            dialog.showMessageBox({
                                                type: "error",
                                                title: "Error",
                                                message: "An error occured while loading the needed data from level.dat.",
                                                buttons: ["OK"],
                                                noLink: true,
                                            });
                                            return;
                                        }
                                    }
                                    if (worldSpawn === undefined) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: "Something went wrong while finding the world spawn.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    if (worldSpawn === null) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: "The world spawn could not be found.",
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        event.currentTarget.disabled = true;
                                        return;
                                    }
                                    if (!engineRef.current?.instance) {
                                        dialog.showMessageBox({
                                            type: "error",
                                            title: "Error",
                                            message: `The 2D renderer engine is not ready yet.`,
                                            buttons: ["OK"],
                                            noLink: true,
                                        });
                                        return;
                                    }
                                    props.dataStorageObject.worldEditor2D.dimension = worldSpawn.dimension;
                                    reloadMap(false, "renderFrame");
                                    engineRef.current.instance?.goCoords(
                                        worldSpawn.x / 16,
                                        worldSpawn.z / 16,
                                        config.views.world.modeSettings["2D"].mapGoToPositionAnimationDuration
                                    );
                                    // worldEditor2DAddMarkerMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                    // worldEditor2DAddMarkerMenu_setOpen(true);
                                }}
                            >
                                <img
                                    src="resource://images/ui/glyphs/compass_item.png"
                                    style={{ width: "16px", imageRendering: "pixelated" }}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    </>,
                    widgetID,
                    -1
                );
            }
        }
        return (): void => {
            stopCurrentInteraction?.();
            if (props.overlayBarRegistry && !props.readonly) {
                props.overlayBarRegistry.unregisterWidget(widgetID);
            }
        };
    });
    const [worldEditor2DCanvasContextMenu_isOpen, worldEditor2DCanvasContextMenu_setOpen] = useState(false);
    const [worldEditor2DCanvasContextMenu_anchorPoint, worldEditor2DCanvasContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
    function onCanvasRightClick(event: JSX.TargetedMouseEvent<HTMLCanvasElement>): void {
        event.preventDefault();
        event.stopPropagation();
        const clickPosition: { x: number; y: number } = {
            x: event.clientX,
            y: event.clientY,
        };
        // console.log(clickPosition);

        worldEditor2DCanvasContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
        worldEditor2DCanvasContextMenu_setOpen(true);
    }
    const engineRef: RefObject<EngineHandle> = useRef<EngineHandle>(null);
    interface ContentsInteraction {
        rerenderContents(): void;
    }
    const contentsInteractionRef: RefObject<ContentsInteraction> = useRef<ContentsInteraction>(null);
    let lastMapDrawCall: number = 0;
    interface CachedChunkColorData {
        [x: number]: {
            [y: number]:
                | { imageData: ImageData /* Uint8Array */; biomeData: Int32Array; heightMap?: Uint16Array; heightRange?: [min: number, max: number] | null }
                | "loading"
                | "has_data"
                | "no_data"
                | "error";
        };
    }
    let cachedChunkColorData: CachedChunkColorData = {};
    interface CachedChunkImageBitmaps {
        [zoom: number]: {
            fallback_error_chunk_image: ImageBitmap | "loading";
            // loading_chunk_image: ImageBitmap | "loading" | "waiting_for_image" | "no_data" | "error";
            // no_data_chunk_image: ImageBitmap | "loading" | "waiting_for_image" | "no_data" | "error";
            [x: number]: {
                [y: number]: ImageBitmap | "loading" | "no_data" | "error";
            };
        };
    }
    let cachedChunkImageBitmaps: CachedChunkImageBitmaps = {};
    let chunkColorDataIsLoadingWithNoParallelization: boolean = false;
    let currentParallelLoadingChunks: `${number},${number}`[] = [];
    let chunkImageBitmapIsLoadingWithNoParallelization: boolean = false;
    let currentParallelLoadingImageBitmaps: { [zoom: number]: `${number},${number}`[] } = {};
    let mapReset: boolean = false;
    let levelChunkMetaDataDictionary: NBTSchemas.NBTSchemaTypes.LevelChunkMetaDataDictionary | "loading" | "no_data" | "error" | undefined;
    let dimensionNameIdTable: NBTSchemas.NBTSchemaTypes.DimensionNameIdTable | "loading" | "no_data" | "error" | undefined;
    let biomeIdsTable: NBTSchemas.NBTSchemaTypes.BiomeIdsTable | "loading" | "no_data" | "error" | undefined;
    let portalRecords: NBTSchemas.NBTSchemaTypes.Portals | "loading" | "no_data" | "error" | undefined;
    interface ComparisonMapPositionDetails {
        coords: import("@canvas-tile-engine/core").Coords;
        scale: number;
        size: { width: number; height: number };
    }
    let lastMapPositionDetails: ComparisonMapPositionDetails | undefined;
    // console.log(() => ({ engineRef.current, lastMapDrawCall, cachedChunkColorData, cachedChunkImageBitmaps }));

    async function loadLevelChunkMetaDataDictionary(): Promise<void> {
        if (biomeIdsTable === "loading") return;
        if (!props.tab.db) {
            levelChunkMetaDataDictionary = "error";
            return;
        }
        levelChunkMetaDataDictionary = "loading";
        if (!props.tab.db.isOpen()) {
            if (!props.tab.awaitDBOpen) {
                levelChunkMetaDataDictionary = "error";
                return;
            }
            await props.tab.awaitDBOpen;
        }
        if (!props.tab.db.isOpen()) {
            levelChunkMetaDataDictionary = "error";
            return;
        }

        try {
            const rawMetaDataDictionary: Buffer | null = await props.tab.db.get("LevelChunkMetaDataDictionary");
            if (!rawMetaDataDictionary) {
                levelChunkMetaDataDictionary = "no_data";
                return;
            }
            const metaDataDictionary: NBTSchemas.NBTSchemaTypes.LevelChunkMetaDataDictionary =
                await entryContentTypeToFormatMap.LevelChunkMetaDataDictionary.parse(rawMetaDataDictionary);
            levelChunkMetaDataDictionary = metaDataDictionary;
        } catch (e) {
            levelChunkMetaDataDictionary = "error";
            console.error("Error loading level chunk meta data dictionary:", e);
        }
    }
    async function loadDimensionNameIdTable(): Promise<void> {
        if (biomeIdsTable === "loading") return;
        if (!props.tab.db) {
            dimensionNameIdTable = "error";
            return;
        }
        dimensionNameIdTable = "loading";
        if (!props.tab.db.isOpen()) {
            if (!props.tab.awaitDBOpen) {
                dimensionNameIdTable = "error";
                return;
            }
            await props.tab.awaitDBOpen;
        }
        if (!props.tab.db.isOpen()) {
            dimensionNameIdTable = "error";
            return;
        }

        try {
            const rawDimensionNameIdTable: Buffer | null = await props.tab.db.get("DimensionNameIdTable");
            if (!rawDimensionNameIdTable) {
                dimensionNameIdTable = "no_data";
                return;
            }
            const parsedDimensionNameIdTable: NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & NBT.NBT = (await NBT.parse(rawDimensionNameIdTable, "little"))
                .parsed as NBTSchemas.NBTSchemaTypes.DimensionNameIdTable & NBT.NBT;
            dimensionNameIdTable = parsedDimensionNameIdTable;
        } catch (e) {
            dimensionNameIdTable = "error";
            console.error("Error loading dimension name ID table:", e);
        }
    }
    async function loadBiomeIdsTable(): Promise<void> {
        if (biomeIdsTable === "loading") return;
        if (!props.tab.db) {
            biomeIdsTable = "error";
            return;
        }
        biomeIdsTable = "loading";
        if (!props.tab.db.isOpen()) {
            if (!props.tab.awaitDBOpen) {
                biomeIdsTable = "error";
                return;
            }
            await props.tab.awaitDBOpen;
        }
        if (!props.tab.db.isOpen()) {
            biomeIdsTable = "error";
            return;
        }

        try {
            const rawBiomeIdsTable: Buffer | null = await props.tab.db.get("BiomeIdsTable");
            if (!rawBiomeIdsTable) {
                biomeIdsTable = "no_data";
                return;
            }
            const parsedBiomeIdsTable: NBTSchemas.NBTSchemaTypes.BiomeIdsTable & NBT.NBT = (await NBT.parse(rawBiomeIdsTable, "little"))
                .parsed as NBTSchemas.NBTSchemaTypes.BiomeIdsTable & NBT.NBT;
            biomeIdsTable = parsedBiomeIdsTable;
        } catch (e) {
            biomeIdsTable = "error";
            console.error("Error loading biome IDs table:", e);
        }
    }
    async function loadPortalRecords(): Promise<void> {
        if (portalRecords === "loading") return;
        if (!props.tab.db) {
            portalRecords = "error";
            return;
        }
        portalRecords = "loading";
        if (!props.tab.db.isOpen()) {
            if (!props.tab.awaitDBOpen) {
                portalRecords = "error";
                return;
            }
            await props.tab.awaitDBOpen;
        }
        if (!props.tab.db.isOpen()) {
            portalRecords = "error";
            return;
        }

        try {
            const rawPortalRecords: Buffer | null = await props.tab.db.get("portals");
            if (!rawPortalRecords) {
                portalRecords = "no_data";
                return;
            }
            const parsedPortalRecords: NBTSchemas.NBTSchemaTypes.Portals & NBT.NBT = (await NBT.parse(rawPortalRecords, "little"))
                .parsed as NBTSchemas.NBTSchemaTypes.Portals & NBT.NBT;
            portalRecords = parsedPortalRecords;
        } catch (e) {
            portalRecords = "error";
            console.error("Error loading portal records:", e);
        }
    }
    loadLevelChunkMetaDataDictionary();
    loadDimensionNameIdTable();
    loadBiomeIdsTable();
    loadPortalRecords();
    function cullCachedOutOfBoundsChunks(bounds: { min: Vector2; max: Vector2 }): void {
        const min: Vector2 = { x: Math.floor(bounds.min.x), y: Math.floor(bounds.min.y) };
        const max: Vector2 = { x: Math.ceil(bounds.max.x), y: Math.ceil(bounds.max.y) };
        for (const x in cachedChunkColorData) {
            if (Number(x) < min.x || Number(x) > max.x) {
                delete cachedChunkColorData[x];
                continue;
            }
            for (const y in cachedChunkColorData[x]!) {
                if (Number(y) < min.y || Number(y) > max.y) {
                    delete cachedChunkColorData[x][y];
                    continue;
                }
            }
        }
    }
    /** @deprecated */
    function cullCachedOutOfBoundsImageBitmaps(bounds: { min: Vector2; max: Vector2 }, scale: number): void {
        for (const zoom in cachedChunkImageBitmaps) {
            if (Number(zoom) !== scale) {
                delete cachedChunkImageBitmaps[zoom];
                continue;
            }
            const cachedChunkImageBitmapsZoom: { [x: number]: { [y: number]: ImageBitmap | "loading" | "no_data" | "error" } } =
                cachedChunkImageBitmaps[scale]!;
            for (const x in cachedChunkImageBitmapsZoom) {
                // Make sure it isn't one of the static non-numeric keys.
                if (isNaN(Number(x))) continue;
                if (Number(x) < bounds.min.x || Number(x) > bounds.max.x) {
                    delete cachedChunkImageBitmapsZoom[x];
                    continue;
                }
                for (const y in cachedChunkImageBitmapsZoom[x]!) {
                    if (Number(y) < bounds.min.y || Number(y) > bounds.max.y) {
                        delete cachedChunkImageBitmapsZoom[x][y];
                        continue;
                    }
                }
            }
        }
    }
    function cullEmptyZoomParallelChunkImageBitmapLists(currentScale: number): void {
        for (const zoom in currentParallelLoadingImageBitmaps) {
            if (Number(zoom) === currentScale) continue;
            if (currentParallelLoadingImageBitmaps[zoom]!.length !== 0) continue;
            delete currentParallelLoadingImageBitmaps[zoom];
        }
    }
    let data3dKeySet: Set<string>;
    let data3dKeyCount = 0;
    let data2dKeySet: Set<string>;
    let data2dKeyCount = 0;
    let data2dLegacyKeySet: Set<string>;
    let data2dLegacyKeyCount = 0;
    let legacyTerrainKeySet: Set<string>;
    let legacyTerrainKeyCount = 0;
    if (config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable && props.tab?.cachedDBKeys) {
        data3dKeySet = new Set(props.tab.cachedDBKeys.Data3D.map((buf: Buffer): string => buf.toString("hex")));
        data3dKeyCount = props.tab.cachedDBKeys.Data3D.length;
        data2dKeySet = new Set(props.tab.cachedDBKeys.Data2D.map((buf: Buffer): string => buf.toString("hex")));
        data2dKeyCount = props.tab.cachedDBKeys.Data2D.length;
        data2dLegacyKeySet = new Set(props.tab.cachedDBKeys.Data2DLegacy.map((buf: Buffer): string => buf.toString("hex")));
        data2dLegacyKeyCount = props.tab.cachedDBKeys.Data2DLegacy.length;
        legacyTerrainKeySet = new Set(props.tab.cachedDBKeys.LegacyTerrain.map((buf: Buffer): string => buf.toString("hex")));
        legacyTerrainKeyCount = props.tab.cachedDBKeys.LegacyTerrain.length;
    }

    function checkChunkForBiomeColorData(chunk: DimensionVectorXZ): boolean | null {
        if (!config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable || !props.tab?.cachedDBKeys) return null;
        if (!data3dKeySet || data3dKeyCount !== props.tab.cachedDBKeys.Data3D.length) {
            data3dKeySet = new Set(props.tab.cachedDBKeys.Data3D.map((buf: Buffer): string => buf.toString("hex")));
            data3dKeyCount = props.tab.cachedDBKeys.Data3D.length;
        }
        if (!data2dKeySet || data2dKeyCount !== props.tab.cachedDBKeys.Data2D.length) {
            data2dKeySet = new Set(props.tab.cachedDBKeys.Data2D.map((buf: Buffer): string => buf.toString("hex")));
            data2dKeyCount = props.tab.cachedDBKeys.Data2D.length;
        }
        if (!data2dLegacyKeySet || data2dLegacyKeyCount !== props.tab.cachedDBKeys.Data2DLegacy.length) {
            data2dLegacyKeySet = new Set(props.tab.cachedDBKeys.Data2DLegacy.map((buf: Buffer): string => buf.toString("hex")));
            data2dLegacyKeyCount = props.tab.cachedDBKeys.Data2DLegacy.length;
        }
        if (!legacyTerrainKeySet || legacyTerrainKeyCount !== props.tab.cachedDBKeys.LegacyTerrain.length) {
            legacyTerrainKeySet = new Set(props.tab.cachedDBKeys.LegacyTerrain.map((buf: Buffer): string => buf.toString("hex")));
            legacyTerrainKeyCount = props.tab.cachedDBKeys.LegacyTerrain.length;
        }
        if (data3dKeySet && data3dKeySet.has(generateChunkKeyFromIndices(chunk, "Data3D").toString("hex"))) {
            return true;
        }
        if (data2dKeySet && data2dKeySet.has(generateChunkKeyFromIndices(chunk, "Data2D").toString("hex"))) {
            return true;
        }
        if (data2dLegacyKeySet && data2dLegacyKeySet.has(generateChunkKeyFromIndices(chunk, "Data2DLegacy").toString("hex"))) {
            return true;
        }
        if (legacyTerrainKeySet && legacyTerrainKeySet.has(generateChunkKeyFromIndices(chunk, "LegacyTerrain").toString("hex"))) {
            return true;
        }
        return data3dKeySet && data2dKeySet && data2dLegacyKeySet && legacyTerrainKeySet ? false : null;
    }
    function normalizeHeightValue(value: number, min: number, range: number): number {
        return (value - min) / range;
    }
    // BUG: In some older chunk verisons in the nether and possible other dimensions, the height map is actually not shifted up 1, so the nether would say 127 instead of 128, though this may just be it not including bedrock. The heightmap displays should be updated to reflect this.
    async function getChunkBiomeColorData(
        chunk: DimensionVectorXZ
    ): Promise<{ colorData: Uint8ClampedArray; biomeData: Int32Array; heightMap?: Uint16Array; heightRange?: [min: number, max: number] | null } | null> {
        if (!props.tab?.db?.isOpen()) throw new Error("Database is not open.");
        if (config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable && props.tab?.cachedDBKeys) {
            if (!data3dKeySet || data3dKeyCount !== props.tab.cachedDBKeys.Data3D.length) {
                data3dKeySet = new Set(props.tab.cachedDBKeys.Data3D.map((buf: Buffer): string => buf.toString("hex")));
                data3dKeyCount = props.tab.cachedDBKeys.Data3D.length;
            }
            if (!data2dKeySet || data2dKeyCount !== props.tab.cachedDBKeys.Data2D.length) {
                data2dKeySet = new Set(props.tab.cachedDBKeys.Data2D.map((buf: Buffer): string => buf.toString("hex")));
                data2dKeyCount = props.tab.cachedDBKeys.Data2D.length;
            }
            if (!data2dLegacyKeySet || data2dLegacyKeyCount !== props.tab.cachedDBKeys.Data2DLegacy.length) {
                data2dLegacyKeySet = new Set(props.tab.cachedDBKeys.Data2DLegacy.map((buf: Buffer): string => buf.toString("hex")));
                data2dLegacyKeyCount = props.tab.cachedDBKeys.Data2DLegacy.length;
            }
            if (!legacyTerrainKeySet || legacyTerrainKeyCount !== props.tab.cachedDBKeys.LegacyTerrain.length) {
                legacyTerrainKeySet = new Set(props.tab.cachedDBKeys.LegacyTerrain.map((buf: Buffer): string => buf.toString("hex")));
                legacyTerrainKeyCount = props.tab.cachedDBKeys.LegacyTerrain.length;
            }
        }
        const colorData = new Uint8ClampedArray(16 * 16 * 4);
        const biomeData = new Int32Array(16 * 16);
        const heightMap = new Uint16Array(16 * 16);
        let __cachedOldWorldData2D__: Buffer | null = null;
        let version: number | undefined = undefined;
        // FIXME: If the world is an old world, and both Data3D and Data2D are present, and the version is between 35 and 38 (inclusive), then the Data2D should be used instead of the Data3D.
        data3dParser: {
            const data3dKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "Data3D");
            // if (CHECK_CACHED_DB_KEYS_FOR_DATA3D_KEY_IF_AVAILABLE && !props.tab.cachedDBKeys?.Data3D.some((key: Buffer): boolean => key.equals(data3dKey))) {
            //     break data3dParser;
            // }
            if (
                config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable &&
                data3dKeySet &&
                !data3dKeySet.has(data3dKey.toString("hex"))
            )
                break data3dParser;

            const versionRaw: Buffer | null = await props.tab.db.get(generateChunkKeyFromIndices(chunk, "Version"));
            version = versionRaw ? (versionRaw[0] ?? undefined) : undefined;

            checkIfOldWorldShouldUseData2D: if (
                isOldWorld &&
                version !== undefined &&
                version >= 35 // TEMP: See if maybe some versions between 23 and 30 (inclusive) had the old world type using Data2D keys instead of Data3D. For those versions, and maybe for these two, maybe this should be after Data3D is parsed so it can check the number of subchunks in the Data3D.
            ) {
                const data2dKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "Data2D");
                if (config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable && data2dKeySet) {
                    if (!data2dKeySet.has(data2dKey.toString("hex"))) break checkIfOldWorldShouldUseData2D;
                } else if (!props.tab.cachedDBKeys || props.tab.cachedDBKeys.Data2D.length) {
                    __cachedOldWorldData2D__ = await props.tab.db.get(data2dKey);
                    if (!__cachedOldWorldData2D__) break checkIfOldWorldShouldUseData2D;
                } else break checkIfOldWorldShouldUseData2D;
                if (!props.tab.cachedDBKeys || props.tab.cachedDBKeys.GeneratedPreCavesAndCliffsBlending.length) {
                    const generatedPreCavesAndCliffsBlendingKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "GeneratedPreCavesAndCliffsBlending");
                    const generatedPreCavesAndCliffsBlending: Buffer | null = await props.tab.db.get(generatedPreCavesAndCliffsBlendingKey);
                    if (generatedPreCavesAndCliffsBlending?.[0] === 1) break checkIfOldWorldShouldUseData2D;
                    // TEST: Check if GeneratedPreCavesAndCliffsBlending was present on all versions where Data2D is used instead of Data3D and if it was 0 in all of those versions for old world chunks, if that is the case, then this being 0 while Data2D is present can be used as a required condition to skip Data3D and use Data2D instead, and it would guarantee that this chunk data is for an old world chunk.
                    if (generatedPreCavesAndCliffsBlending?.[0] === 0) break data3dParser;
                }
                break data3dParser;
            }

            const data3d: Buffer | null = await props.tab.db.get(data3dKey);
            if (!data3d) break data3dParser;
            const data3dData: NBTSchemas.NBTSchemaTypes.Data3D = entryContentTypeToFormatMap.Data3D.parse(data3d);
            let heightRange: [number, number] | null;
            try {
                heightRange = await getHeightRangeForChunk(
                    props.tab.db,
                    chunk,
                    typeof levelChunkMetaDataDictionary === "object" ? levelChunkMetaDataDictionary : undefined,
                    {
                        type: "Data3D",
                        subchunkCount: data3dData.value.biomes.value.value.length,
                        dimension: chunk.dimension,
                        version,
                        isOldWorldType: isOldWorld ?? undefined,
                    }
                );
            } catch (e) {
                console.error("Error getting height range for chunk:", chunk, "Error:", e);
                heightRange = null;
            }
            for (let x = 0; x < 16; x++) {
                zLoop: for (let z = 0; z < 16; z++) {
                    if (props.dataStorageObject.worldEditor2D.layer === "surface") {
                        const heightMapPosition_unclamped: number | undefined = data3dData.value.heightMap.value.value[x]?.value[z];
                        heightMapPositionBiomeDataRetriever: if (
                            heightMapPosition_unclamped !== undefined &&
                            config.views.world.modeSettings["2D"].useData3DHeightmapForSurfaceBiomePosition
                        ) {
                            const heightMapPosition: number = (heightMapPosition_unclamped & 0xffff) - 1;
                            const subchunkIndex: number = Math.floor(heightMapPosition / 16);
                            const subchunk = data3dData.value.biomes.value.value[subchunkIndex];
                            if (!subchunk) break heightMapPositionBiomeDataRetriever;
                            const subchunkYOffset: number = heightMapPosition % 16;
                            const palette: number[] = subchunk.palette.value.value;
                            const biomeId: number | undefined = palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })]!];
                            if (biomeId === undefined) {
                                console.warn(
                                    "Could not find biome for",
                                    { x, y: subchunkYOffset, z, chunk, heightMapPosition },
                                    `(${offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })});`,
                                    "There was no palette entry at index",
                                    subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })],
                                    subchunk.values.value.value
                                );
                                break heightMapPositionBiomeDataRetriever;
                            }
                            const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                            const [r, g, b] = (color
                                .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                                ?.slice(1)
                                .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                            if (r === -1) {
                                throw new TypeError(
                                    `Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${subchunkIndex}; Subchunk Y offset: ${subchunkYOffset}; X: ${x}; Z: ${z}`
                                );
                            }
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            colorData.set([r, g, b, 255], colorDataIndex);
                            biomeData[colorDataIndex / 4] = biomeId;
                            heightMap[colorDataIndex / 4] = heightMapPosition_unclamped;
                            continue;
                        }

                        // This is for chunks generated on worlds using the Caves & Cliffs experimental toggle or in 1.18.0 betas before 1.18.0.25.
                        let maxOceanOnlySubchunkIndex: number | null = null;
                        if (version !== undefined && version < 39 && heightMapPosition_unclamped !== undefined) {
                            const heightMapPosition: number = (heightMapPosition_unclamped & 0xffff) - 1;
                            maxOceanOnlySubchunkIndex = Math.floor(heightMapPosition / 16);
                        }

                        for (let i = data3dData.value.biomes.value.value.length - 1; i >= 0; i--) {
                            const subchunk = data3dData.value.biomes.value.value[i];
                            if (!subchunk) continue;
                            if (subchunk.values.value.value.length !== 4096) continue;
                            const palette: number[] = subchunk.palette.value.value;

                            // This is for chunks generated on worlds using the Caves & Cliffs experimental toggle or in 1.18.0 betas before 1.18.0.25.
                            if (maxOceanOnlySubchunkIndex !== null && i > maxOceanOnlySubchunkIndex && palette.length === 1 && palette[0] === 0) continue;

                            const biomeId: number | undefined = palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: 15, z })]!];
                            if (biomeId === -1) {
                                for (let subchunkYOffset = 15; subchunkYOffset >= 0; subchunkYOffset--) {
                                    const biomeId: number | undefined =
                                        palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })]!];
                                    if (biomeId === -1) continue;
                                    if (biomeId === undefined) continue;
                                    const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                                    const [r, g, b] = (color
                                        .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                                        ?.slice(1)
                                        .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                                    if (r === -1)
                                        throw new TypeError(
                                            `Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${i}; X: ${x}; Y: ${subchunkYOffset}; Z: ${z}`
                                        );
                                    const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                                    colorData.set([r, g, b, 255], colorDataIndex);
                                    biomeData[colorDataIndex / 4] = biomeId;
                                    heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                                    continue zLoop;
                                }
                                continue;
                            }
                            if (biomeId === undefined) continue;
                            const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                            const [r, g, b] = (color
                                .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                                ?.slice(1)
                                .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                            if (r === -1) {
                                throw new TypeError(`Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${i}; X: ${x}; Y: 15; Z: ${z}`);
                            }
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            colorData.set([r, g, b, 255], colorDataIndex);
                            biomeData[colorDataIndex / 4] = biomeId;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue zLoop;
                        }
                        const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                        biomeData[colorDataIndex / 4] = -2;
                        heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                        continue;
                    }

                    if (props.dataStorageObject.worldEditor2D.layer === "underground") {
                        let fallbackBiomeId: number | undefined;
                        let fallbackBiomeIdDetails: (Vector3 & { i: number }) | undefined;
                        const CAVE_BIOMES: number[] = [
                            // Don't include the deep dark.
                            // BiomeData.int_map["minecraft:deep_dark"],
                            BiomeData.int_map["minecraft:dripstone_caves"],
                            BiomeData.int_map["minecraft:lush_caves"],
                            BiomeData.int_map["minecraft:sulfur_caves"],
                        ];
                        for (let i = data3dData.value.biomes.value.value.length - 1; i >= 0; i--) {
                            const subchunk = data3dData.value.biomes.value.value[i];
                            if (!subchunk) continue;
                            if (subchunk.values.value.value.length !== 4096) continue;
                            const palette: number[] = subchunk.palette.value.value;
                            for (let subchunkYOffset = 15; subchunkYOffset >= 0; subchunkYOffset--) {
                                const biomeId: number | undefined =
                                    palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })]!];
                                if (biomeId === -1) continue;
                                if (biomeId === undefined) continue;
                                fallbackBiomeId ??= biomeId;
                                fallbackBiomeIdDetails ??= { x, y: subchunkYOffset, z, i };
                                if (!CAVE_BIOMES.includes(biomeId)) continue;
                                const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                                const [r, g, b] = (color
                                    .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                                    ?.slice(1)
                                    .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                                if (r === -1)
                                    throw new TypeError(
                                        `Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${i}; X: ${x}; Y: ${subchunkYOffset}; Z: ${z}`
                                    );
                                const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                                colorData.set([r, g, b, 255], colorDataIndex);
                                biomeData[colorDataIndex / 4] = biomeId;
                                heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                                continue zLoop;
                            }
                        }
                        if (fallbackBiomeId === undefined || fallbackBiomeIdDetails === undefined) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(fallbackBiomeId);
                        const [r, g, b] = (color
                            .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                            ?.slice(1)
                            .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                        if (r === -1) {
                            throw new TypeError(
                                `Invalid biome color: ${color}; Biome ID: ${fallbackBiomeId}; Subchunk index: ${fallbackBiomeIdDetails.i}; X: ${fallbackBiomeIdDetails.x}; Y: ${fallbackBiomeIdDetails.y}; Z: ${fallbackBiomeIdDetails.z}`
                            );
                        }
                        const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                        colorData.set([r, g, b, 255], colorDataIndex);
                        biomeData[colorDataIndex / 4] = fallbackBiomeId;
                        heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                        continue;
                    }

                    if (props.dataStorageObject.worldEditor2D.layer === "bottom") {
                        const y = -51;
                        const minSubChunk = heightRange ? heightRange[0] / 16 : -4;
                        const subchunkIndex = Math.floor(y / 16) - minSubChunk;
                        const subchunk = data3dData.value.biomes.value.value[subchunkIndex];
                        if (!subchunk) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        if (subchunk.values.value.value.length !== 4096) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        const subchunkYOffset: number = (y + minSubChunk * 16) % 16;
                        const palette: number[] = subchunk.palette.value.value;
                        const biomeId: number | undefined = palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })]!];
                        if (biomeId === undefined) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                        const [r, g, b] = (color
                            .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                            ?.slice(1)
                            .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                        if (r === -1)
                            throw new TypeError(
                                `Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${subchunkIndex}; X: ${x}; Y: ${subchunkYOffset}; Z: ${z}`
                            );
                        const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                        colorData.set([r, g, b, 255], colorDataIndex);
                        biomeData[colorDataIndex / 4] = biomeId;
                        heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                        continue;
                    }

                    if (typeof props.dataStorageObject.worldEditor2D.layer === "number") {
                        const y: number = props.dataStorageObject.worldEditor2D.layer;
                        const minSubChunk = heightRange ? heightRange[0] / 16 : -4;
                        const subchunkIndex = Math.floor(y / 16) - minSubChunk;
                        const subchunk = data3dData.value.biomes.value.value[subchunkIndex];
                        if (!subchunk) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        if (subchunk.values.value.value.length !== 4096) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        const subchunkYOffset: number = (y + minSubChunk * 16) % 16;
                        const palette: number[] = subchunk.palette.value.value;
                        const biomeId: number | undefined = palette[subchunk.values.value.value[offsetToChunkBlockIndex({ x, y: subchunkYOffset, z })]!];
                        if (biomeId === undefined) {
                            const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            biomeData[colorDataIndex / 4] = -2;
                            heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                            continue;
                        }
                        const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                        const [r, g, b] = (color
                            .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                            ?.slice(1)
                            .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                        if (r === -1)
                            throw new TypeError(
                                `Invalid biome color: ${color}; Biome ID: ${biomeId}; Subchunk index: ${subchunkIndex}; X: ${x}; Y: ${subchunkYOffset}; Z: ${z}`
                            );
                        const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                        colorData.set([r, g, b, 255], colorDataIndex);
                        biomeData[colorDataIndex / 4] = biomeId;
                        heightMap[colorDataIndex / 4] = data3dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                        continue;
                    }
                }
            }
            return { colorData, biomeData, heightMap, heightRange };
        }
        data2dParser: {
            const data2dKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "Data2D");
            if (
                !__cachedOldWorldData2D__ &&
                config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable &&
                data2dKeySet &&
                !data2dKeySet.has(data2dKey.toString("hex"))
            )
                break data2dParser;
            const data2d: Buffer | null = __cachedOldWorldData2D__ ?? (await props.tab.db.get(data2dKey));
            if (!data2d) break data2dParser;
            const data2dData: NBTSchemas.NBTSchemaTypes.Data2D = entryContentTypeToFormatMap.Data2D.parse(data2d);
            if (data2dData.value.biomeData.value.value.length !== 16) {
                throw new Error(`Invalid Data2D biome data for chunk: ${JSON.stringify(chunk)}; There are not exactly 16 rows of biome data.`);
            }
            if (data2dData.value.biomeData.value.value.some((subchunk): boolean => subchunk.value.length !== 16)) {
                throw new Error(
                    `Invalid Data2D biome data for chunk: ${JSON.stringify(chunk)}; One or more rows of biome data do not contain exactly 16 entries.`
                );
            }
            let heightRange: [number, number] | null;
            try {
                heightRange = await getHeightRangeForChunk(
                    props.tab.db,
                    chunk,
                    typeof levelChunkMetaDataDictionary === "object" ? levelChunkMetaDataDictionary : undefined,
                    { type: "Data2D", dimension: chunk.dimension, version, isOldWorldType: isOldWorld ?? undefined }
                );
            } catch (e) {
                console.error("Error getting height range for chunk:", chunk, "Error:", e);
                heightRange = null;
            }
            for (let x = 0; x < 16; x++) {
                for (let z = 0; z < 16; z++) {
                    const biomeId: number = data2dData.value.biomeData.value.value[x]!.value[z]!;
                    const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                    const [r, g, b] = (color
                        .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                        ?.slice(1)
                        .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                    if (r === -1) throw new TypeError(`Invalid biome color: ${color}; Biome ID: ${biomeId}; X: ${x}; Z: ${z}`);
                    const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                    colorData.set([r, g, b, 255], colorDataIndex);
                    biomeData[colorDataIndex / 4] = biomeId;
                    heightMap[colorDataIndex / 4] = data2dData.value.heightMap.value.value[x]?.value[z] ?? 0;
                }
            }
            return { colorData, biomeData, heightMap, heightRange };
        }
        data2dLegacyParser: {
            const data2dLegacyKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "Data2DLegacy");
            if (
                config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable &&
                data2dLegacyKeySet &&
                !data2dLegacyKeySet.has(data2dLegacyKey.toString("hex"))
            ) {
                break data2dLegacyParser;
            }
            const data2dLegacy: Buffer | null = await props.tab.db.get(data2dLegacyKey);
            if (!data2dLegacy) break data2dLegacyParser;
            const data2dLegacyData: NBTSchemas.NBTSchemaTypes.Data2DLegacy = entryContentTypeToFormatMap.Data2DLegacy.parse(data2dLegacy);
            if (data2dLegacyData.value.biomeData.value.value.length !== 16) {
                throw new Error(`Invalid Data2DLegacy biome data for chunk: ${JSON.stringify(chunk)}; There are not exactly 16 rows of biome data.`);
            }
            if (data2dLegacyData.value.biomeData.value.value.some((subchunk): boolean => subchunk.value.length !== 16)) {
                throw new Error(
                    `Invalid Data2DLegacy biome data for chunk: ${JSON.stringify(chunk)}; One or more rows of biome data do not contain exactly 16 entries.`
                );
            }
            let heightRange: [number, number] | null;
            try {
                heightRange = await getHeightRangeForChunk(
                    props.tab.db,
                    chunk,
                    typeof levelChunkMetaDataDictionary === "object" ? levelChunkMetaDataDictionary : undefined,
                    { type: "Data2DLegacy" }
                );
            } catch (e) {
                console.error("Error getting height range for chunk:", chunk, "Error:", e);
                heightRange = null;
            }
            const rawColorData = data2dLegacyData.value.biomeData.value.value;
            for (let x = 0; x < 16; x++) {
                const rawColorData_row = rawColorData[x]!.value;
                for (let z = 0; z < 16; z++) {
                    const rawColorData_entry = rawColorData_row[z]!.value;
                    const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                    const biomeId: number = rawColorData_entry[0];
                    if (config.views.world.modeSettings["2D"].useGrassTintColorInsteadOfBiomeColorForOldChunkFormats) {
                        colorData.set([rawColorData_entry[1], rawColorData_entry[2], rawColorData_entry[3], 255], colorDataIndex);
                        biomeData[colorDataIndex / 4] = biomeId;
                        heightMap[colorDataIndex / 4] = data2dLegacyData.value.heightMap.value.value[x]?.value[z] ?? 0;
                        continue;
                    }
                    const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                    const [r, g, b] = (color
                        .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                        ?.slice(1)
                        .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                    if (r === -1) throw new TypeError(`Invalid biome color: ${color}; Biome ID: ${biomeId}; X: ${x}; Z: ${z}`);
                    colorData.set([r, g, b, 255], colorDataIndex);
                    biomeData[colorDataIndex / 4] = biomeId;
                    heightMap[colorDataIndex / 4] = data2dLegacyData.value.heightMap.value.value[x]?.value[z] ?? 0;
                }
            }
            return { colorData, biomeData, heightMap, heightRange };
        }
        legacyTerrainParser: {
            // REVIEW: LegacyTerrain may not actually contain biome IDs, the grass_color property either contains BiomeID,R,G,B entries or R,G,B,A entries, figure out which one it is.
            const legacyTerrainKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(chunk, "LegacyTerrain");
            if (
                config.views.world.modeSettings["2D"].checkCachedDBKeysForBiomeDataKeysIfAvailable &&
                legacyTerrainKeySet &&
                !legacyTerrainKeySet.has(legacyTerrainKey.toString("hex"))
            ) {
                break legacyTerrainParser;
            }
            const legacyTerrain: Buffer | null = await props.tab.db.get(legacyTerrainKey);
            if (!legacyTerrain) break legacyTerrainParser;
            const legacyTerrainData: NBTSchemas.NBTSchemaTypes.LegacyTerrain = entryContentTypeToFormatMap.LegacyTerrain.parse(legacyTerrain);
            if (legacyTerrainData.value.grass_color.value.value.length !== 1024) {
                throw new Error(`Invalid LegacyTerrain biome data for chunk: ${JSON.stringify(chunk)}; There are not exactly 1024 bytes of biome data.`);
            }
            let heightRange: [number, number] | null;
            try {
                heightRange = await getHeightRangeForChunk(
                    props.tab.db,
                    chunk,
                    typeof levelChunkMetaDataDictionary === "object" ? levelChunkMetaDataDictionary : undefined,
                    { type: "LegacyTerrain" }
                );
            } catch (e) {
                console.error("Error getting height range for chunk:", chunk, "Error:", e);
                heightRange = null;
            }
            const rawColorData: number[] = legacyTerrainData.value.grass_color.value.value;
            for (let x = 0; x < 16; x++) {
                for (let z = 0; z < 16; z++) {
                    const colorDataIndex: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                    const biomeId: number | undefined = rawColorData[colorDataIndex];
                    if (biomeId === undefined) continue;
                    if (config.views.world.modeSettings["2D"].useGrassTintColorInsteadOfBiomeColorForOldChunkFormats) {
                        colorData.set(
                            [rawColorData[colorDataIndex + 1]!, rawColorData[colorDataIndex + 2]!, rawColorData[colorDataIndex + 3]!, 255],
                            colorDataIndex
                        );
                        biomeData[colorDataIndex / 4] = biomeId;
                        heightMap[colorDataIndex / 4] = legacyTerrainData.value.height_map.value.value[colorDataIndex / 4] ?? 0;
                        continue;
                    }
                    const color: `rgb(${number}, ${number}, ${number})` = getBiomeColor(biomeId);
                    const [r, g, b] = (color
                        .match(/^rgb\((\d+), (\d+), (\d+)\)$/)
                        ?.slice(1)
                        .map(Number) ?? [-1, -1, -1]) as [number, number, number];
                    if (r === -1) throw new TypeError(`Invalid biome color: ${color}; Biome ID: ${biomeId}; X: ${x}; Z: ${z}`);
                    colorData.set([r, g, b, 255], colorDataIndex);
                    biomeData[colorDataIndex / 4] = biomeId;
                    heightMap[colorDataIndex / 4] = legacyTerrainData.value.height_map.value.value[colorDataIndex / 4] ?? 0;
                }
            }
            return { colorData, biomeData, heightMap, heightRange };
        }
        return null;
    }
    function offsetTo2DChunkBlockColorDataIndex(offset: VectorXZ): number {
        return ((offset.x & 0xf) | ((offset.z & 0xf) << 4)) * 4;
    }
    function offsetTo2DChunkBlockDataIndex(offset: VectorXZ): number {
        return (offset.x & 0xf) | ((offset.z & 0xf) << 4);
    }
    // function blockToPixelBounds(
    //     block: VectorXZ,
    //     bounds: { min: Vector2; max: Vector2 },
    //     _size: { width: number; height: number },
    //     scale: number
    // ): { min: Vector2; max: Vector2 } {
    //     return {
    //         min: { x: Math.floor((block.x / 16 - bounds.min.x) * scale), y: Math.floor((block.z / 16 - bounds.min.y) * scale) },
    //         max: { x: Math.ceil(((block.x + 1) / 16 - bounds.min.x) * scale), y: Math.ceil(((block.z + 1) / 16 - bounds.min.y) * scale) },
    //     };
    // }
    /** @deprecated */
    function drawCachedChunks(
        ctx: CanvasRenderingContext2D,
        bounds: { min: Vector2; max: Vector2 },
        blockBounds: { min: VectorXZ; max: VectorXZ },
        _size: { width: number; height: number },
        scale: number
    ): void {
        const roundedBounds: { min: Vector2; max: Vector2 } = {
            min: { x: Math.floor(bounds.min.x), y: Math.floor(bounds.min.y) },
            max: { x: Math.ceil(bounds.max.x), y: Math.ceil(bounds.max.y) },
        };
        blockBounds = {
            min: { x: Math.floor(blockBounds.min.x), z: Math.floor(blockBounds.min.z) },
            max: { x: Math.ceil(blockBounds.max.x), z: Math.ceil(blockBounds.max.z) },
        };
        if (!cachedChunkImageBitmaps[scale]) return;
        let loadingImage: ImageData;
        let loadingPendingImage: ImageData;
        let noDataImage: ImageData;
        for (let x = roundedBounds.min.x; x <= roundedBounds.max.x; x++) {
            for (let y = roundedBounds.min.y; y <= roundedBounds.max.y; y++) {
                if (cachedChunkImageBitmaps[scale][x]?.[y]) continue;
                if (typeof LOADING_PENDING_CHUNK_IMAGE === "object")
                    ctx.putImageData(
                        (loadingPendingImage ??= LOADING_PENDING_CHUNK_IMAGE.getImageData(scale, Date.now())),
                        (Number(x) - bounds.min.x) * scale,
                        (Number(y) - bounds.min.y) * scale
                    );
                continue;
            }
        }
        // for (const x in cachedChunkColorData) {
        for (const x in cachedChunkImageBitmaps[scale]) {
            // Make sure it isn't one of the static non-numeric keys.
            if (isNaN(Number(x))) continue;
            if (Number(x) < roundedBounds.min.x || Number(x) > roundedBounds.max.x) continue;
            // if (!cachedChunkColorData[x]) continue;
            if (!cachedChunkImageBitmaps[scale][x]) continue;
            // for (const y in cachedChunkColorData[x]!) {
            for (const y in cachedChunkImageBitmaps[scale][x]!) {
                if (Number(y) < roundedBounds.min.y || Number(y) > roundedBounds.max.y) continue;
                // if (!cachedChunkColorData[x][y]) continue;
                if (!cachedChunkImageBitmaps[scale][x]?.[y]) continue;
                const imageBitmap: ImageBitmap | "loading" | "no_data" | "error" = cachedChunkImageBitmaps[scale][x][y];
                if (imageBitmap === "loading") {
                    if (typeof LOADING_CHUNK_IMAGE === "object")
                        ctx.putImageData(
                            (loadingImage ??= LOADING_CHUNK_IMAGE.getImageData(scale, Date.now())),
                            (Number(x) - bounds.min.x) * scale,
                            (Number(y) - bounds.min.y) * scale
                        );
                    // IDEA: Maybe add an option to add a special backround for chunks that are loading.
                    continue;
                }
                if (imageBitmap === "error") {
                    if (cachedChunkImageBitmaps[scale].fallback_error_chunk_image === "loading") continue;
                    ctx.drawImage(
                        cachedChunkImageBitmaps[scale].fallback_error_chunk_image,
                        (Number(x) - bounds.min.x) * scale,
                        (Number(y) - bounds.min.y) * scale,
                        scale,
                        scale
                    );
                    continue;
                }
                if (imageBitmap === "no_data") {
                    if (typeof NO_DATA_CHUNK_IMAGE === "object")
                        ctx.putImageData(
                            (noDataImage ??= NO_DATA_CHUNK_IMAGE.getImageData(scale, Date.now())),
                            (Number(x) - bounds.min.x) * scale,
                            (Number(y) - bounds.min.y) * scale
                        );
                    // IDEA: Maybe add an option to add the transparent checkerboard background for chunks with no data.
                    continue;
                }
                ctx.drawImage(imageBitmap, (Number(x) - bounds.min.x) * scale, (Number(y) - bounds.min.y) * scale, scale, scale);
                // const colorData: Uint8Array | "loading" = cachedChunkColorData[x]![y]!;
                // const colorData: ImageData | "loading" = cachedChunkColorData[x]![y]!;
                // if (colorData === "loading") continue;
                // const chunkBlockBounds: { min: VectorXZ; max: VectorXZ } = {
                //     min: { x: Number(x) * 16, z: Number(y) * 16 },
                //     max: { x: Number(x) * 16 + 16, z: Number(y) * 16 + 16 },
                // };
                // // ~REVIEW: Maybe this should be <= instead of <.
                // for (let xB = chunkBlockBounds.min.x; xB < chunkBlockBounds.max.x; xB++) {
                //     // ~REVIEW: Maybe this should be <= instead of <.
                //     for (let zB = chunkBlockBounds.min.z; zB < chunkBlockBounds.max.z; zB++) {
                //         const index: number = offsetTo2DChunkBlockColorDataIndex({ x: xB, z: zB });
                //         if (isNaN(colorData[index + 0]!) || isNaN(colorData[index + 1]!) || isNaN(colorData[index + 2]!) || isNaN(colorData[index + 3]!)) {
                //             continue;
                //         }
                //         ctx.fillStyle = `rgba(${colorData[index + 0]},${colorData[index + 1]},${colorData[index + 2]},${colorData[index + 3]! / 255})`;
                //         const pixelBounds: { min: Vector2; max: Vector2 } = blockToPixelBounds({ x: xB, z: zB }, bounds, size, scale);
                //         ctx.fillRect(pixelBounds.min.x, pixelBounds.min.y, pixelBounds.max.x - pixelBounds.min.x, pixelBounds.max.y - pixelBounds.min.y);
                //     }
                // }
            }
        }
    }
    /** @deprecated */
    function drawCachedChunks_v2(
        ctx: CanvasRenderingContext2D,
        bounds: { min: Vector2; max: Vector2 },
        _blockBounds: { min: VectorXZ; max: VectorXZ },
        _size: { width: number; height: number },
        scale: number
    ): void {
        const scaleCache = cachedChunkImageBitmaps[scale];
        if (!scaleCache) return;

        const now = Date.now();

        const minX = Math.floor(bounds.min.x);
        const maxX = Math.ceil(bounds.max.x);
        const minY = Math.floor(bounds.min.y);
        const maxY = Math.ceil(bounds.max.y);

        let loadingPendingImage: ImageData | null = null;
        let loadingImage: ImageData | null = null;
        let noDataImage: ImageData | null = null;

        for (let x = minX; x <= maxX; x++) {
            const col = scaleCache[x];
            const screenX = (x - bounds.min.x) * scale;

            for (let y = minY; y <= maxY; y++) {
                const screenY = (y - bounds.min.y) * scale;

                const entry = col?.[y];
                if (!entry) {
                    if (typeof LOADING_PENDING_CHUNK_IMAGE === "object") {
                        if (!loadingPendingImage) {
                            loadingPendingImage = LOADING_PENDING_CHUNK_IMAGE.getImageData(scale, now);
                        }
                        ctx.putImageData(loadingPendingImage, screenX, screenY);
                    }
                    continue;
                }

                if (entry === "loading") {
                    if (typeof LOADING_CHUNK_IMAGE === "object") {
                        if (!loadingImage) {
                            loadingImage = LOADING_CHUNK_IMAGE.getImageData(scale, now);
                        }
                        ctx.putImageData(loadingImage, screenX, screenY);
                    }
                    continue;
                }

                if (entry === "error") {
                    const fallback = scaleCache.fallback_error_chunk_image;
                    if (fallback !== "loading") {
                        ctx.drawImage(fallback, screenX, screenY, scale, scale);
                    }
                    continue;
                }

                if (entry === "no_data") {
                    if (typeof NO_DATA_CHUNK_IMAGE === "object") {
                        if (!noDataImage) {
                            noDataImage = NO_DATA_CHUNK_IMAGE.getImageData(scale, now);
                        }
                        ctx.putImageData(noDataImage, screenX, screenY);
                    }
                    continue;
                }

                // Normal cached chunk
                ctx.drawImage(entry as ImageBitmap, screenX, screenY, scale, scale);
            }
        }
    }
    // const bgTile: ImageData = ((): ImageData => {
    //     const rawPixels: Uint8ClampedArray = new Uint8ClampedArray(16 * 16 * 4);
    //     const color: [r: number, g: number, b: number, a: number] = [...MAP_BACKGROUND_COLOR, 255];
    //     for (let i = 0; i < rawPixels.length; i += 4) rawPixels.set(color, i);
    //     return new ImageData(rawPixels, 16, 16);
    // })();
    function drawCachedChunks_v3(
        ctx: CanvasRenderingContext2D,
        bounds: { min: Vector2; max: Vector2 },
        _blockBounds: { min: VectorXZ; max: VectorXZ },
        size: { width: number; height: number },
        scale: number
    ): void {
        const tileSizePx: number = Math.max(1, Math.round(scale));

        const frameWidth: number = size.width;
        const frameHeight: number = size.height;

        const frame = new Uint8ClampedArray(frameWidth * frameHeight * 4);
        const now: number = Date.now();

        const loadingPendingTile: Uint8ClampedArray | null =
            typeof LOADING_PENDING_CHUNK_IMAGE === "object" ? LOADING_PENDING_CHUNK_IMAGE.getImageData(tileSizePx, now).data : null;

        const loadingTile: Uint8ClampedArray | null = typeof LOADING_CHUNK_IMAGE === "object" ? LOADING_CHUNK_IMAGE.getImageData(tileSizePx, now).data : null;

        const noDataTile: Uint8ClampedArray | null = typeof NO_DATA_CHUNK_IMAGE === "object" ? NO_DATA_CHUNK_IMAGE.getImageData(tileSizePx, now).data : null;

        const errorImageData: ImageData = fallbackErrorChunkImageData ?? generateErrorImageData();
        const errorTile: Uint8ClampedArray = scaleNearest(errorImageData.data, errorImageData.width, errorImageData.height, tileSizePx).data;

        const minChunkX: number = Math.floor(bounds.min.x);
        const maxChunkX: number = Math.ceil(bounds.max.x);
        const minChunkY: number = Math.floor(bounds.min.y);
        const maxChunkY: number = Math.ceil(bounds.max.y);

        const heightMapEnabled: boolean = props.dataStorageObject.worldEditor2D.heightmap;

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            const col = cachedChunkColorData[cx];
            if (!col) continue;

            for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                const entry = col[cy];

                const chunkPixelX = (cx - bounds.min.x) * scale;
                const chunkPixelY = (cy - bounds.min.y) * scale;

                const chunkWidth = Math.floor((cx + 1 - bounds.min.x) * scale) - Math.floor((cx - bounds.min.x) * scale);
                const chunkHeight = Math.floor((cy + 1 - bounds.min.y) * scale) - Math.floor((cy - bounds.min.y) * scale);

                const baseX = Math.floor(chunkPixelX);
                const baseY = Math.floor(chunkPixelY);
                // UNDONE: This fixes the gaps but makes the chunks misaligned with the chunk grid and cursor.
                // const baseX = Math.round((cx - bounds.min.x) * tileSizePx);
                // const baseY = Math.round((cy - bounds.min.y) * tileSizePx);

                if (baseX + tileSizePx < 0 || baseY + tileSizePx < 0 || baseX >= frameWidth || baseY >= frameHeight) {
                    continue;
                }

                let src: Uint8ClampedArray | null = null;
                let applyHeightMap = false;
                let isChunk = false;
                let heightMapTintCache: number[] | undefined;

                if (!entry) {
                    src = loadingPendingTile;
                } else if (entry === "loading" || entry === "has_data" /* TEMP: The has_data and loading tiles should be different colors. */) {
                    src = loadingTile;
                } else if (entry === "no_data") {
                    src = noDataTile;
                } else if (entry === "error") {
                    src = errorTile;
                } else {
                    src = entry.imageData.data;
                    isChunk = true;
                    // OPTIMIZE: This needs to cache the height map tint values where they don't have to be recalculated every frame. Maybe it should also store a last modified time of the chunks above and to the left, so when those are updated, it can update the height map tint values.
                    if (heightMapEnabled) {
                        if (HEIGHT_MAP_MODE === "difference") {
                            if (entry.heightMap) {
                                applyHeightMap = true;
                                const heightMapTint: number[] = new Array<number>(256);
                                const minHeight: number = entry.heightRange ? entry.heightRange[0] : 0;
                                const aboveChunk = cachedChunkColorData[cx]?.[cy - 1];
                                const aboveChunkExists = typeof aboveChunk === "object" && !!aboveChunk.heightMap;
                                const aboveChunkMinHeight = aboveChunkExists ? (aboveChunk.heightRange?.[0] ?? 0) : NaN;
                                const leftChunk = cachedChunkColorData[cx - 1]?.[cy];
                                const leftChunkExists = typeof leftChunk === "object" && !!leftChunk.heightMap;
                                const leftChunkMinHeight = leftChunkExists ? (leftChunk.heightRange?.[0] ?? 0) : NaN;
                                for (let x = 0; x < 16; x++) {
                                    for (let z = 0; z < 16; z++) {
                                        const i = offsetTo2DChunkBlockDataIndex({ x, z });
                                        const currentY = entry.heightMap[i]! + minHeight;
                                        const aboveY =
                                            z === 0 ?
                                                aboveChunkExists ? aboveChunk.heightMap![offsetTo2DChunkBlockDataIndex({ x, z: 15 })]! + aboveChunkMinHeight
                                                :   currentY
                                            :   entry.heightMap[offsetTo2DChunkBlockDataIndex({ x, z: z - 1 })]! + minHeight;
                                        const leftY =
                                            x === 0 ?
                                                leftChunkExists ? leftChunk.heightMap![offsetTo2DChunkBlockDataIndex({ x: 15, z })]! + leftChunkMinHeight
                                                :   currentY
                                            :   entry.heightMap[offsetTo2DChunkBlockDataIndex({ x: x - 1, z })]! + minHeight;
                                        const aboveDiff = currentY - aboveY;
                                        const leftDiff = currentY - leftY;
                                        // const slope = aboveDiff + leftDiff;
                                        const slope_unlogged = Math.max(
                                            Math.min(Math.min(aboveDiff, leftDiff) * 1.5, Math.min(aboveDiff, leftDiff) * 0.5),
                                            Math.min(Math.max(Math.max(aboveDiff, leftDiff) * 1.5, Math.max(aboveDiff, leftDiff) * 0.5), aboveDiff + leftDiff)
                                        );
                                        const slope = (Math.log1p(Math.abs(slope_unlogged)) / Math.LN2) * Math.sign(slope_unlogged);
                                        const shade = 1 + slope * HEIGHT_MAP_DIFFERENCE_MODE_STRENGTH;
                                        heightMapTint[i] = Math.max(HEIGHT_MAP_DIFFERENCE_MODE_MIN_TINT, Math.min(HEIGHT_MAP_DIFFERENCE_MODE_MAX_TINT, shade));
                                    }
                                }
                                heightMapTintCache = heightMapTint;
                            }
                        } else if (HEIGHT_MAP_MODE === "normalized") {
                            if (entry.heightMap) {
                                applyHeightMap = true;
                                if (entry.heightRange) {
                                    const heightMapLength: number = entry.heightMap.length;
                                    const heightMapTint: number[] = new Array<number>(heightMapLength);
                                    const minHeight: number = entry.heightRange[0];
                                    const range: number = entry.heightRange[1] - minHeight;
                                    const strength = 0.9;
                                    for (let i = 0; i < heightMapLength; i++) {
                                        heightMapTint[i] =
                                            1 + ((applyHeightMap ? normalizeHeightValue(entry.heightMap[i]!, minHeight, range) : 0.5) - 0.5) * strength;
                                    }
                                    heightMapTintCache = heightMapTint;
                                } else {
                                    const heightMapLength: number = entry.heightMap.length;
                                    const normalizedHeightMap: number[] = new Array<number>(heightMapLength);
                                    const minHeight: number = 0;
                                    const range: number = 256;
                                    const strength = 0.9;
                                    for (let i = 0; i < heightMapLength; i++) {
                                        normalizedHeightMap[i] =
                                            1 + ((applyHeightMap ? normalizeHeightValue(entry.heightMap[i]!, minHeight, range) : 0.5) - 0.5) * strength;
                                    }
                                    heightMapTintCache = normalizedHeightMap;
                                }
                            }
                        }
                    }
                }

                if (!src) continue;

                if (isChunk) {
                    const sw = 16,
                        sh = 16;
                    const xRatio = sw / chunkWidth;
                    const yRatio = sh / chunkHeight;

                    for (let dy = 0; dy < chunkHeight; dy++) {
                        const dstY = baseY + dy;
                        if (dstY < 0 || dstY >= frameHeight) continue;

                        const srcY = Math.floor(dy * yRatio);
                        const rowOffset = dstY * frameWidth * 4;

                        for (let dx = 0; dx < chunkWidth; dx++) {
                            const dstX = baseX + dx;
                            if (dstX < 0 || dstX >= frameWidth) continue;

                            const srcX = Math.floor(dx * xRatio);

                            const sir = srcY * sw + srcX;
                            const si = sir * 4;
                            const di = rowOffset + dstX * 4;

                            const shade = heightMapEnabled ? heightMapTintCache![sir]! : 1;

                            frame[di] = src[si]! * shade;
                            frame[di + 1] = src[si + 1]! * shade;
                            frame[di + 2] = src[si + 2]! * shade;
                            frame[di + 3] = src[si + 3]! * shade;
                        }
                    }
                } else {
                    for (let dy = 0; dy < chunkHeight; dy++) {
                        const dstY = baseY + dy;
                        if (dstY < 0 || dstY >= frameHeight) continue;

                        const rowOffset = dstY * frameWidth * 4;
                        const srcRow = Math.floor((dy / chunkHeight) * tileSizePx) * tileSizePx * 4;

                        for (let dx = 0; dx < chunkWidth; dx++) {
                            const dstX = baseX + dx;
                            if (dstX < 0 || dstX >= frameWidth) continue;

                            const si = srcRow + dx * 4;
                            const di = rowOffset + dstX * 4;

                            frame[di] = src[si]!;
                            frame[di + 1] = src[si + 1]!;
                            frame[di + 2] = src[si + 2]!;
                            frame[di + 3] = src[si + 3]!;
                        }
                    }
                }
            }
        }

        const img = new ImageData(frame, frameWidth, frameHeight);
        ctx.putImageData(img, 0, 0);
    }

    /** @deprecated */
    async function loadChunkImageBitmapsInBounds(bounds: { min: Vector2; max: Vector2 }, scale: number): Promise<void> {
        bounds = { min: { x: Math.floor(bounds.min.x), y: Math.floor(bounds.min.y) }, max: { x: Math.ceil(bounds.max.x), y: Math.ceil(bounds.max.y) } };
        const hasMaxParallelizationLimit: boolean = Number.isFinite(config.views.world.modeSettings["2D"].maxParallelImageBitmapCreations);
        for (let x = bounds.min.x; x < bounds.max.x; x++) {
            for (let y = bounds.min.y; y < bounds.max.y; y++) {
                const chunkColorData: { imageData: ImageData; biomeData: Int32Array } | "loading" | "has_data" | "no_data" | "error" | undefined =
                    cachedChunkColorData[x]?.[y];
                if (!chunkColorData || chunkColorData === "has_data") continue;
                if (chunkColorData === "loading") continue;

                if (cachedChunkImageBitmaps[scale]?.[x]?.[y] === "loading" && !config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation) break;
                if (chunkImageBitmapIsLoadingWithNoParallelization && !config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation) break;
                if (
                    config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation &&
                    hasMaxParallelizationLimit &&
                    (currentParallelLoadingImageBitmaps[scale]?.length ?? 0) >= config.views.world.modeSettings["2D"].maxParallelImageBitmapCreations
                ) {
                    break;
                }

                if (cachedChunkImageBitmaps[scale]?.[x]?.[y]) continue;
                if (
                    config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation &&
                    hasMaxParallelizationLimit &&
                    currentParallelLoadingImageBitmaps[scale]?.includes(`${x},${y}`)
                ) {
                    continue;
                }

                if (!cachedChunkImageBitmaps[scale]) {
                    cachedChunkImageBitmaps[scale] ??= {
                        fallback_error_chunk_image: "loading",
                        // loading_chunk_image: "loading",
                        // no_data_chunk_image: "loading",
                    };
                    if (FALLBACK_ERROR_CHUNK_IMAGE instanceof Blob) {
                        createImageBitmap(FALLBACK_ERROR_CHUNK_IMAGE, {
                            resizeQuality: "pixelated",
                            resizeWidth: scale,
                            resizeHeight: scale,
                        })
                            .then((imageBitmap: ImageBitmap): void => {
                                if (!cachedChunkImageBitmaps[scale]) return;
                                cachedChunkImageBitmaps[scale].fallback_error_chunk_image = imageBitmap;
                            })
                            .catch((error: unknown): void => {
                                console.error("Error converting fallback error chunk image to image bitmap:", error);
                                createImageBitmap(generateErrorImageData(), {
                                    resizeQuality: "pixelated",
                                    resizeWidth: scale,
                                    resizeHeight: scale,
                                }).then((imageBitmap: ImageBitmap): void => {
                                    if (!cachedChunkImageBitmaps[scale]) return;
                                    cachedChunkImageBitmaps[scale].fallback_error_chunk_image = imageBitmap;
                                });
                            });
                    } else {
                        createImageBitmap(generateErrorImageData(), {
                            resizeQuality: "pixelated",
                            resizeWidth: scale,
                            resizeHeight: scale,
                        }).then((imageBitmap: ImageBitmap): void => {
                            if (!cachedChunkImageBitmaps[scale]) return;
                            cachedChunkImageBitmaps[scale].fallback_error_chunk_image = imageBitmap;
                        });

                        // async function generateErrorImageLoop() {
                        //     while (true) {
                        //         const imageBitmap: ImageBitmap = await createImageBitmap(generateErrorImageData(), {
                        //             resizeQuality: "pixelated",
                        //             resizeWidth: scale,
                        //             resizeHeight: scale,
                        //         });
                        //         if (!cachedChunkImageBitmaps[scale]) return;
                        //         cachedChunkImageBitmaps[scale].fallback_error_chunk_image = imageBitmap;
                        //         await new Promise((resolve: (value: never) => void): void => void setTimeout(resolve, 10));
                        //     }
                        // }
                        // generateErrorImageLoop();
                    }
                }
                cachedChunkImageBitmaps[scale][x] ??= {};

                if (chunkColorData === "error" || chunkColorData === "no_data") {
                    cachedChunkImageBitmaps[scale][x]![y] = chunkColorData;
                    continue;
                }

                if (!config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation) chunkImageBitmapIsLoadingWithNoParallelization = true;
                else if (hasMaxParallelizationLimit) (currentParallelLoadingImageBitmaps[scale] ??= []).push(`${x},${y}`);
                cachedChunkImageBitmaps[scale][x]![y] = "loading";

                if (config.views.world.modeSettings["2D"].parallelizeImageBitmapCreation) {
                    createImageBitmap(chunkColorData.imageData, { resizeQuality: "pixelated", resizeWidth: scale, resizeHeight: scale })
                        .then((imageBitmap: ImageBitmap): void => {
                            if (!cachedChunkImageBitmaps[scale]?.[x]?.[y]) return;
                            cachedChunkImageBitmaps[scale][x]![y] = imageBitmap;
                        })
                        .catch((error: unknown): void => {
                            console.error("Error converting chunk image to image bitmap:", error, "Chunk:", { x, y }, "Scale:", scale);
                            if (!cachedChunkImageBitmaps[scale]?.[x]?.[y]) return;
                            cachedChunkImageBitmaps[scale][x]![y] = "error";
                        })
                        .finally((): void => {
                            removeFromLoadingImageBitmapsList: if (currentParallelLoadingImageBitmaps[scale]) {
                                const entryIndex: number = currentParallelLoadingImageBitmaps[scale].indexOf(`${x},${y}`);
                                if (entryIndex === -1) break removeFromLoadingImageBitmapsList;
                                currentParallelLoadingImageBitmaps[scale].splice(entryIndex, 1);
                            }
                        });
                } else {
                    try {
                        const imageBitmap: ImageBitmap = await createImageBitmap(chunkColorData.imageData, {
                            resizeQuality: "pixelated",
                            resizeWidth: scale,
                            resizeHeight: scale,
                        });
                        if (!cachedChunkImageBitmaps[scale]?.[x]?.[y]) return;
                        cachedChunkImageBitmaps[scale][x]![y] = imageBitmap;
                    } catch (e) {
                        console.error("Error converting chunk image to image bitmap:", e, "Chunk:", { x, y }, "Scale:", scale);
                        if (!cachedChunkImageBitmaps[scale]?.[x]?.[y]) return;
                        cachedChunkImageBitmaps[scale][x]![y] = "error";
                    } finally {
                        chunkImageBitmapIsLoadingWithNoParallelization = false;
                    }
                }
            }
        }
    }
    async function loadChunksInBounds(bounds: { min: Vector2; max: Vector2 }): Promise<void> {
        bounds = { min: { x: Math.floor(bounds.min.x), y: Math.floor(bounds.min.y) }, max: { x: Math.ceil(bounds.max.x), y: Math.ceil(bounds.max.y) } };
        const hasMaxParallelizationLimit: boolean = Number.isFinite(config.views.world.modeSettings["2D"].maxParallelLoadingChunks);
        for (let x = bounds.min.x; x < bounds.max.x; x++) {
            cachedChunkColorData[x] ??= {};
            for (let y = bounds.min.y; y < bounds.max.y; y++) {
                if (!cachedChunkColorData[x]) break;

                if (!cachedChunkColorData[x]![y]) {
                    switch (
                        checkChunkForBiomeColorData({
                            x,
                            z: y,
                            dimension: props.dataStorageObject.worldEditor2D.dimension,
                        })
                    ) {
                        case true:
                            cachedChunkColorData[x]![y] = "has_data";
                            break;
                        case false:
                            cachedChunkColorData[x]![y] = "no_data";
                            continue;
                        case null:
                            break;
                    }
                }
                if (cachedChunkColorData[x]![y] === "loading" && !config.views.world.modeSettings["2D"].parallelizeChunkLoading) break;
                if (chunkColorDataIsLoadingWithNoParallelization && !config.views.world.modeSettings["2D"].parallelizeChunkLoading) break;
                if (
                    config.views.world.modeSettings["2D"].parallelizeChunkLoading &&
                    hasMaxParallelizationLimit &&
                    currentParallelLoadingChunks.length >= config.views.world.modeSettings["2D"].maxParallelLoadingChunks
                )
                    continue;

                if (cachedChunkColorData[x]![y] && cachedChunkColorData[x]![y] !== "has_data") continue;
                if (
                    config.views.world.modeSettings["2D"].parallelizeChunkLoading &&
                    hasMaxParallelizationLimit &&
                    currentParallelLoadingChunks.includes(`${x},${y}`)
                )
                    continue;

                if (!config.views.world.modeSettings["2D"].parallelizeChunkLoading) chunkColorDataIsLoadingWithNoParallelization = true;
                else if (hasMaxParallelizationLimit) currentParallelLoadingChunks.push(`${x},${y}`);
                cachedChunkColorData[x]![y] = "loading";

                /**
                 * Loads the color and biome data for this chunk.
                 *
                 * @returns A promise that resolves when the color and biome data is loaded.
                 *
                 * @throws {unknown} If an error occurs.
                 */
                async function loadChunkColorData(): Promise<void> {
                    const biomeColorData: {
                        colorData: Uint8ClampedArray;
                        biomeData: Int32Array;
                        heightMap?: Uint16Array;
                        heightRange?: [min: number, max: number] | null;
                    } | null = await getChunkBiomeColorData({
                        x,
                        z: y,
                        dimension: props.dataStorageObject.worldEditor2D.dimension,
                    });
                    if (!cachedChunkColorData[x]?.[y]) return;
                    if (biomeColorData === null) {
                        cachedChunkColorData[x]![y] = "no_data";
                        return;
                    }
                    cachedChunkColorData[x]![y] = {
                        imageData: new ImageData(biomeColorData.colorData, 16, 16),
                        biomeData: biomeColorData.biomeData,
                        ...("heightMap" in biomeColorData && { heightMap: biomeColorData.heightMap }),
                        ...("heightRange" in biomeColorData && { heightRange: biomeColorData.heightRange }),
                    };
                }

                if (config.views.world.modeSettings["2D"].parallelizeChunkLoading) {
                    loadChunkColorData()
                        .catch((error: unknown): void => {
                            console.error("Error loading chunk color data:", error, "Chunk:", { x, y });
                            if (!cachedChunkColorData[x]?.[y]) return;
                            cachedChunkColorData[x]![y] = "error";
                        })
                        .finally((): void => {
                            removeFromLoadingChunksList: {
                                const entryIndex: number = currentParallelLoadingChunks.indexOf(`${x},${y}`);
                                if (entryIndex === -1) break removeFromLoadingChunksList;
                                currentParallelLoadingChunks.splice(entryIndex, 1);
                            }
                        });
                } else {
                    try {
                        await loadChunkColorData();
                        // const chunkColorData = new Uint8ClampedArray(16 * 16 * 4);
                        // const columnColors: [r: number, g: number, b: number, a: number][] = [
                        //     [255, 0, 0, 255],
                        //     [0, 255, 0, 255],
                        //     [0, 0, 255, 255],
                        //     [255, 255, 0, 255],
                        //     [255, 0, 255, 255],
                        //     [0, 255, 255, 255],
                        //     [255, 255, 255, 255],
                        //     [0, 0, 0, 255],
                        //     [128, 128, 128, 255],
                        //     [192, 192, 192, 255],
                        //     [64, 64, 64, 255],
                        //     [96, 96, 96, 255],
                        //     [32, 32, 32, 255],
                        //     [48, 48, 48, 255],
                        //     [16, 16, 16, 255],
                        //     [24, 24, 24, 255],
                        // ];
                        // for (let x = 0; x < 16; x++) {
                        //     for (let z = 0; z < 16; z++) {
                        //         const index: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                        //         [chunkColorData[index], chunkColorData[index + 1], chunkColorData[index + 2], chunkColorData[index + 3]] = columnColors[x]!;
                        //     }
                        // }
                        // // cachedChunkColorData[x]![y] = chunkColorData;
                        // cachedChunkColorData[x]![y] = new ImageData(chunkColorData, 16, 16);
                    } catch (e) {
                        console.error("Error loading chunk color data:", e, "Chunk:", { x, y });
                        if (!cachedChunkColorData[x]?.[y]) return;
                        cachedChunkColorData[x]![y] = "error";
                    } finally {
                        chunkColorDataIsLoadingWithNoParallelization = false;
                    }
                }
            }
        }
    }
    function reloadMap(reloadStaticDBKeysAndLevelDat: boolean, rerenderMode: "rerenderContents" | "renderFrame"): void {
        lastMapDrawCall = 0;
        cachedChunkColorData = {};
        cachedChunkImageBitmaps = {};
        chunkColorDataIsLoadingWithNoParallelization = false;
        currentParallelLoadingChunks = [];
        chunkImageBitmapIsLoadingWithNoParallelization = false;
        currentParallelLoadingImageBitmaps = [];
        lastMapPositionDetails = undefined;
        mapReset = true;
        if (reloadStaticDBKeysAndLevelDat) {
            levelChunkMetaDataDictionary = undefined;
            loadLevelChunkMetaDataDictionary();
            dimensionNameIdTable = undefined;
            loadDimensionNameIdTable();
            biomeIdsTable = undefined;
            loadBiomeIdsTable();
            unloadLevelDatData();
            loadNeededDataFromLevelDat();
        }
        if (rerenderMode === "rerenderContents") contentsInteractionRef.current?.rerenderContents();
        else if (rerenderMode === "renderFrame") engineRef.current?.render();
    }
    function rerenderMap(): boolean {
        if (!contentsInteractionRef.current) return false;
        contentsInteractionRef.current.rerenderContents();
        return true;
    }
    function renderPortalsOnMap(currentScale: number, unrender = false): boolean {
        if (!engineRef.current) return false;
        if (!engineRef.current.images) return false;
        if (!engineRef.current.isReady) return false;
        engineRef.current.clearLayer(MAP_LAYERS.portalsOverlay);
        if (unrender) return true;
        if (!MAP_ICONS.portalIconImage) return false;
        if (MAP_ICONS.portalIconImage === "loading") return false;
        if (MAP_ICONS.portalIconImage === "error") return false;
        if (portalRecords === "no_data") return true;
        if (typeof portalRecords !== "object") return false;
        if (!portalRecords.value.data?.value.PortalRecords?.value.value) return false;
        const currentDimension: number = dimensionVectorDimensionToInt(props.dataStorageObject.worldEditor2D.dimension);
        const portalsInCurrentDimension = portalRecords.value.data.value.PortalRecords.value.value.filter(
            (portalRecord): boolean => portalRecord.DimId?.value === currentDimension
        );
        const portalImages: import("@canvas-tile-engine/react").ImageItem[] = [];
        for (const portal of portalsInCurrentDimension) {
            if (portal.DimId === undefined) continue;
            if (portal.TpX === undefined) continue;
            if (portal.TpY === undefined) continue;
            if (portal.TpZ === undefined) continue;
            portalImages.push({
                img: MAP_ICONS.portalIconImage,
                x: Math.floor((portal.TpX.value / 16) * currentScale) / currentScale,
                y: Math.floor((portal.TpZ.value / 16) * currentScale) / currentScale,
                size: 30 / currentScale,
            });
        }
        if (portalImages.length === 0) return true;
        engineRef.current.drawImage(portalImages, MAP_LAYERS.portalsOverlay);
        return true;
    }
    interface BaseContextMenuInteraction {
        openContextMenu(anchorPoint: Vector2): void;
        setOpen(isOpen: boolean): void;
        get isOpen(): boolean;
        setAnchorPoint(anchorPoint: Vector2): void;
        get anchorPoint(): Vector2;
    }
    interface DimensionSwitchContextMenuInteraction extends BaseContextMenuInteraction {
        $?: never;
    }
    const dimensionSwitcherContextMenuInteractionRef: RefObject<DimensionSwitchContextMenuInteraction> = useRef<DimensionSwitchContextMenuInteraction>(null);
    function DimensionSwitcherContextMenu({ interactionRef }: { interactionRef: RefObject<DimensionSwitchContextMenuInteraction> }): JSX.Element {
        const [worldEditor2DDimensionSwitcherContextMenu_isOpen, worldEditor2DDimensionSwitcherContextMenu_setOpen] = useState(false);
        const [worldEditor2DDimensionSwitcherContextMenu_anchorPoint, worldEditor2DDimensionSwitcherContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        interactionRef.current = {
            openContextMenu(anchorPoint: Vector2): void {
                worldEditor2DDimensionSwitcherContextMenu_setAnchorPoint(anchorPoint);
                worldEditor2DDimensionSwitcherContextMenu_setOpen(true);
            },
            setOpen(isOpen: boolean): void {
                worldEditor2DDimensionSwitcherContextMenu_setOpen(isOpen);
            },
            get isOpen(): boolean {
                return worldEditor2DDimensionSwitcherContextMenu_isOpen;
            },
            setAnchorPoint(anchorPoint: Vector2): void {
                worldEditor2DDimensionSwitcherContextMenu_setAnchorPoint(anchorPoint);
            },
            get anchorPoint(): Vector2 {
                return worldEditor2DDimensionSwitcherContextMenu_anchorPoint;
            },
        };
        return (
            <ControlledMenu
                anchorPoint={worldEditor2DDimensionSwitcherContextMenu_anchorPoint}
                state={worldEditor2DDimensionSwitcherContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DDimensionSwitcherContextMenu_setOpen(false)}
            >
                {(): JSX.Element => {
                    const dimensionOptions: Record<Dimension | `${string}:${string}`, number> =
                        typeof dimensionNameIdTable !== "object" ?
                            (Object.fromEntries(dimensions.map((dimension: Dimension, i: number) => [dimension, i])) as Record<Dimension, number>)
                        :   getDimensionTypesSync(dimensionNameIdTable);
                    return (
                        <>
                            <MenuHeader>Dimension</MenuHeader>
                            {(Object.entries(dimensionOptions) as [Dimension | `${string}:${string}`, number][])
                                .sort((a: [Dimension | `${string}:${string}`, number], b: [Dimension | `${string}:${string}`, number]): number => a[1] - b[1])
                                .map(
                                    ([dimensionName, dimensionId]: [Dimension | `${string}:${string}`, number]): JSX.Element => (
                                        <MenuItem
                                            type="checkbox"
                                            checked={props.dataStorageObject.worldEditor2D.dimension === intToDimensionVectorDimension(dimensionId)}
                                            onClick={async (): Promise<void> => {
                                                props.dataStorageObject.worldEditor2D.dimension = intToDimensionVectorDimension(dimensionId);
                                                reloadMap(false, "renderFrame");
                                            }}
                                        >
                                            {`${dimensionName} (${formatter.format(dimensionId)})`}
                                        </MenuItem>
                                    )
                                )}
                            {dimensionNameIdTable === "error" ?
                                <MenuItem disabled>Failed to load dimension name ID table, any custom dimensions are not shown.</MenuItem>
                            : dimensionNameIdTable === "loading" ?
                                <MenuItem disabled>The dimension name ID table is still loading, any custom dimensions are not shown.</MenuItem>
                            : dimensionNameIdTable === undefined ?
                                <MenuItem disabled>The dimension name ID table has not started loading, any custom dimensions are not shown.</MenuItem>
                            :   null}
                        </>
                    );
                }}
            </ControlledMenu>
        );
    }
    interface LayerSwitchContextMenuInteraction extends BaseContextMenuInteraction {
        $?: never;
    }
    const layerContextMenuInteractionRef: RefObject<LayerSwitchContextMenuInteraction> = useRef<LayerSwitchContextMenuInteraction>(null);
    function LayerContextMenu({ interactionRef }: { interactionRef: RefObject<LayerSwitchContextMenuInteraction> }): JSX.Element {
        const [worldEditor2DLayerContextMenu_isOpen, worldEditor2DLayerContextMenu_setOpen] = useState(false);
        const [worldEditor2DLayerContextMenu_anchorPoint, worldEditor2DLayerContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        interactionRef.current = {
            openContextMenu(anchorPoint: Vector2): void {
                worldEditor2DLayerContextMenu_setAnchorPoint(anchorPoint);
                worldEditor2DLayerContextMenu_setOpen(true);
            },
            setOpen(isOpen: boolean): void {
                worldEditor2DLayerContextMenu_setOpen(isOpen);
            },
            get isOpen(): boolean {
                return worldEditor2DLayerContextMenu_isOpen;
            },
            setAnchorPoint(anchorPoint: Vector2): void {
                worldEditor2DLayerContextMenu_setAnchorPoint(anchorPoint);
            },
            get anchorPoint(): Vector2 {
                return worldEditor2DLayerContextMenu_anchorPoint;
            },
        };
        return (
            <ControlledMenu
                anchorPoint={worldEditor2DLayerContextMenu_anchorPoint}
                state={worldEditor2DLayerContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DLayerContextMenu_setOpen(false)}
            >
                <MenuHeader>Layer</MenuHeader>
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.layer === "surface"}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.layer = "surface";
                        reloadMap(false, "renderFrame");
                    }}
                >
                    Surface
                </MenuItem>
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.layer === "underground"}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.layer = "underground";
                        reloadMap(false, "renderFrame");
                    }}
                    disabled={props.dataStorageObject.worldEditor2D.dimension !== "overworld"}
                    title={props.dataStorageObject.worldEditor2D.dimension !== "overworld" ? "Underground mode is only available in the Overworld." : ""}
                >
                    Underground (Cave Biomes)
                </MenuItem>
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.layer === "bottom"}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.layer = "bottom";
                        reloadMap(false, "renderFrame");
                    }}
                    disabled={props.dataStorageObject.worldEditor2D.dimension !== "overworld"}
                    title={props.dataStorageObject.worldEditor2D.dimension !== "overworld" ? "Bottom mode is only available in the Overworld." : ""}
                >
                    Bottom (y=-51)
                </MenuItem>
                <MenuItem
                    type="checkbox"
                    checked={typeof props.dataStorageObject.worldEditor2D.layer === "number"}
                    onClick={async (): Promise<void> => {
                        const layer: ShowNumberInputDialogResult = await showNumberInputDialog({
                            optionLabel: "Custom layer: ",
                            optionDefaultValue:
                                typeof props.dataStorageObject.worldEditor2D.layer === "number" ? props.dataStorageObject.worldEditor2D.layer : 0,
                            submitButtonText: "Set layer",
                            optionMinValue: -513,
                            optionMaxValue: 512,
                            optionStep: 1,
                        });
                        if (layer.canceled) return;
                        props.dataStorageObject.worldEditor2D.layer = Math.trunc(layer.value);
                        reloadMap(false, "renderFrame");
                    }}
                >
                    Custom
                    {typeof props.dataStorageObject.worldEditor2D.layer === "number" ?
                        ` (${formatter.format(props.dataStorageObject.worldEditor2D.layer)})`
                    :   ""}
                </MenuItem>
            </ControlledMenu>
        );
    }
    interface SettingsContextMenuInteraction extends BaseContextMenuInteraction {
        $?: never;
    }
    const settingsContextMenuInteractionRef: RefObject<SettingsContextMenuInteraction> = useRef<SettingsContextMenuInteraction>(null);
    function SettingsContextMenu({ interactionRef }: { interactionRef: RefObject<SettingsContextMenuInteraction> }): JSX.Element {
        const [worldEditor2DSettingsContextMenu_isOpen, worldEditor2DSettingsContextMenu_setOpen] = useState(false);
        const [worldEditor2DSettingsContextMenu_anchorPoint, worldEditor2DSettingsContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        interactionRef.current = {
            openContextMenu(anchorPoint: Vector2): void {
                worldEditor2DSettingsContextMenu_setAnchorPoint(anchorPoint);
                worldEditor2DSettingsContextMenu_setOpen(true);
            },
            setOpen(isOpen: boolean): void {
                worldEditor2DSettingsContextMenu_setOpen(isOpen);
            },
            get isOpen(): boolean {
                return worldEditor2DSettingsContextMenu_isOpen;
            },
            setAnchorPoint(anchorPoint: Vector2): void {
                worldEditor2DSettingsContextMenu_setAnchorPoint(anchorPoint);
            },
            get anchorPoint(): Vector2 {
                return worldEditor2DSettingsContextMenu_anchorPoint;
            },
        };
        return (
            <ControlledMenu
                anchorPoint={worldEditor2DSettingsContextMenu_anchorPoint}
                state={worldEditor2DSettingsContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DSettingsContextMenu_setOpen(false)}
            >
                <MenuHeader>Settings</MenuHeader>
                <SubMenu label="Render Type">
                    <MenuItem
                        type="checkbox"
                        checked={props.dataStorageObject.worldEditor2D.renderType === "biomes"}
                        onClick={async (): Promise<void> => {
                            props.dataStorageObject.worldEditor2D.renderType = "biomes";
                            engineRef.current?.render();
                        }}
                    >
                        Biomes
                    </MenuItem>
                    <MenuItem
                        type="checkbox"
                        checked={props.dataStorageObject.worldEditor2D.renderType === "blocks_accurate"}
                        onClick={async (): Promise<void> => {
                            props.dataStorageObject.worldEditor2D.renderType = "blocks_accurate";
                            engineRef.current?.render();
                        }}
                        disabled
                        title="Not implemented yet."
                    >
                        Blocks - Accurate
                    </MenuItem>
                    <MenuItem
                        type="checkbox"
                        checked={props.dataStorageObject.worldEditor2D.renderType === "blocks_map"}
                        onClick={async (): Promise<void> => {
                            props.dataStorageObject.worldEditor2D.renderType = "blocks_map";
                            engineRef.current?.render();
                        }}
                        disabled
                        title="Not implemented yet."
                    >
                        Blocks - Map
                    </MenuItem>
                    <MenuItem
                        type="checkbox"
                        checked={props.dataStorageObject.worldEditor2D.renderType === "heightmap"}
                        onClick={async (): Promise<void> => {
                            props.dataStorageObject.worldEditor2D.renderType = "heightmap";
                            engineRef.current?.render();
                        }}
                        disabled
                        title="Not implemented yet."
                    >
                        Heightmap
                    </MenuItem>
                </SubMenu>
                <MenuDivider />
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.heightmap}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.heightmap = !props.dataStorageObject.worldEditor2D.heightmap;
                        engineRef.current?.render();
                    }}
                >
                    Show Heightmap
                </MenuItem>
                {/* TODO: At some point, this should have an option to have "Show Grid" in "auto" mode, and maybe an option to change the "auto" mode zoom level threshold. */}
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.showGrid === true || props.dataStorageObject.worldEditor2D.showGrid === "auto"}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.showGrid = !props.dataStorageObject.worldEditor2D.showGrid;
                        if (!engineRef.current) return;
                        engineRef.current.clearLayer(1);
                        if (/* props.dataStorageObject.worldEditor2D.showGrid === "auto" ? scale >= 8 : */ props.dataStorageObject.worldEditor2D.showGrid) {
                            engineRef.current.drawGridLines(1, 1, "#1e293b", 1);
                        }
                    }}
                >
                    Show Grid Lines
                </MenuItem>
                <MenuDivider />
                <SubMenu label="Set defaults...">
                    <MenuItem
                        type="checkbox"
                        checked={config.views.world.modeSettings["2D"].showHeightmapDefault}
                        onClick={async (): Promise<void> => {
                            config.views.world.modeSettings["2D"].showHeightmapDefault = !config.views.world.modeSettings["2D"].showHeightmapDefault;
                        }}
                    >
                        Show Heightmap
                    </MenuItem>
                    <MenuItem
                        type="checkbox"
                        checked={config.views.world.modeSettings["2D"].showGridDefault}
                        onClick={async (): Promise<void> => {
                            config.views.world.modeSettings["2D"].showGridDefault = !config.views.world.modeSettings["2D"].showGridDefault;
                        }}
                    >
                        Show Grid Lines
                    </MenuItem>
                    {/* TODO: Add the render type option to here too once at least one other render type is implemented. */}
                </SubMenu>
            </ControlledMenu>
        );
    }
    interface VisibleOverlaysContextMenuInteraction extends BaseContextMenuInteraction {
        $?: never;
    }
    const visibleOverlaysContextMenuInteractionRef: RefObject<VisibleOverlaysContextMenuInteraction> = useRef<VisibleOverlaysContextMenuInteraction>(null);
    function VisibleOverlaysContextMenu({ interactionRef }: { interactionRef: RefObject<VisibleOverlaysContextMenuInteraction> }): JSX.Element {
        const [worldEditor2DVisibleOverlaysContextMenu_isOpen, worldEditor2DVisibleOverlaysContextMenu_setOpen] = useState(false);
        const [worldEditor2DVisibleOverlaysContextMenu_anchorPoint, worldEditor2DVisibleOverlaysContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        interactionRef.current = {
            openContextMenu(anchorPoint: Vector2): void {
                worldEditor2DVisibleOverlaysContextMenu_setAnchorPoint(anchorPoint);
                worldEditor2DVisibleOverlaysContextMenu_setOpen(true);
            },
            setOpen(isOpen: boolean): void {
                worldEditor2DVisibleOverlaysContextMenu_setOpen(isOpen);
            },
            get isOpen(): boolean {
                return worldEditor2DVisibleOverlaysContextMenu_isOpen;
            },
            setAnchorPoint(anchorPoint: Vector2): void {
                worldEditor2DVisibleOverlaysContextMenu_setAnchorPoint(anchorPoint);
            },
            get anchorPoint(): Vector2 {
                return worldEditor2DVisibleOverlaysContextMenu_anchorPoint;
            },
        };
        return (
            <ControlledMenu
                anchorPoint={worldEditor2DVisibleOverlaysContextMenu_anchorPoint}
                state={worldEditor2DVisibleOverlaysContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DVisibleOverlaysContextMenu_setOpen(false)}
            >
                <MenuHeader>Overlays</MenuHeader>
                <MenuItem
                    type="checkbox"
                    checked={props.dataStorageObject.worldEditor2D.dataOverlays.portals}
                    onClick={async (): Promise<void> => {
                        props.dataStorageObject.worldEditor2D.dataOverlays.portals = !props.dataStorageObject.worldEditor2D.dataOverlays.portals;
                        engineRef.current?.render();
                    }}
                >
                    Portals
                </MenuItem>
                {/* TODO: Add a set defaults submenu here. */}
            </ControlledMenu>
        );
    }
    interface ChunkContextMenu_TargetChunkDetails {
        readonly dimension: Dimension | number;
        readonly chunk: VectorXZ;
        readonly rawPosition: Vector2;
        readonly block: VectorXZ;
    }
    interface ChunkSwitchContextMenuInteraction extends BaseContextMenuInteraction {
        targetChunkDetails: ChunkContextMenu_TargetChunkDetails | undefined;
    }
    const chunkContextMenuInteractionRef: RefObject<ChunkSwitchContextMenuInteraction> = useRef<ChunkSwitchContextMenuInteraction>(null);
    function ChunkContextMenu({ interactionRef }: { interactionRef: RefObject<ChunkSwitchContextMenuInteraction> }): JSX.Element {
        const [worldEditor2DChunkContextMenu_isOpen, worldEditor2DChunkContextMenu_setOpen] = useState(false);
        const [worldEditor2DChunkContextMenu_anchorPoint, worldEditor2DChunkContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        const [targetChunkDetails, setTargetChunkDetails] = useState<ChunkContextMenu_TargetChunkDetails | undefined>(undefined);

        interactionRef.current = {
            openContextMenu(anchorPoint: Vector2): void {
                worldEditor2DChunkContextMenu_setAnchorPoint(anchorPoint);
                worldEditor2DChunkContextMenu_setOpen(true);
            },
            setOpen(isOpen: boolean): void {
                worldEditor2DChunkContextMenu_setOpen(isOpen);
            },
            get isOpen(): boolean {
                return worldEditor2DChunkContextMenu_isOpen;
            },
            setAnchorPoint(anchorPoint: Vector2): void {
                worldEditor2DChunkContextMenu_setAnchorPoint(anchorPoint);
            },
            get anchorPoint(): Vector2 {
                return worldEditor2DChunkContextMenu_anchorPoint;
            },
            get targetChunkDetails(): ChunkContextMenu_TargetChunkDetails | undefined {
                return targetChunkDetails;
            },
            set targetChunkDetails(value: ChunkContextMenu_TargetChunkDetails | undefined) {
                setTargetChunkDetails(value);
            },
        };

        if (!targetChunkDetails) {
            return (
                <ControlledMenu
                    anchorPoint={worldEditor2DChunkContextMenu_anchorPoint}
                    state={worldEditor2DChunkContextMenu_isOpen ? "open" : "closed"}
                    direction="right"
                    onClose={(): void => void worldEditor2DChunkContextMenu_setOpen(false)}
                >
                    <MenuItem disabled>No Chunk Selected</MenuItem>
                </ControlledMenu>
            );
        }

        const chunkColorData = cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];

        const height: number | undefined =
            typeof chunkColorData === "object" ? chunkColorData.heightMap?.[offsetTo2DChunkBlockColorDataIndex(targetChunkDetails.block) / 4] : undefined;
        const minHeight: number | undefined = typeof chunkColorData === "object" ? chunkColorData.heightRange?.[0] : undefined;
        const noCachedDBKeys: boolean = props.tab.cachedDBKeys === undefined;
        const existingKeys: ([rawKey: Buffer, contentType: DBChunkLinkedContentType] | [rawKeys: Buffer[], contentType: DBChunkLinkedContentType])[] = [];
        if (props.tab.cachedDBKeys) {
            for (const contentType of DBChunkLinkedContentTypes) {
                switch (contentType) {
                    case "AABBVolumes":
                    case "ActorDigestVersion":
                    case "BiomeState":
                    case "BlendingBiomeHeight":
                    case "BlendingData":
                    case "BlockEntity":
                    case "BorderBlocks":
                    case "Checksums":
                    case "ConversionData":
                    case "Data2D":
                    case "Data2DLegacy":
                    case "Data3D":
                    case "Entity":
                    case "FinalizedState":
                    case "GeneratedPreCavesAndCliffsBlending":
                    case "GenerationSeed":
                    case "HardcodedSpawners":
                    case "LegacyBlockExtraData":
                    case "LegacyTerrain":
                    case "LegacyVersion":
                    case "MetaDataHash":
                    case "PendingTicks":
                    case "RandomTicks":
                    case "Version":
                    case "Digest": {
                        const key: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(
                            { ...targetChunkDetails.chunk, dimension: targetChunkDetails.dimension },
                            contentType
                        );
                        if (props.tab.cachedDBKeys[contentType].some((existingKey: Buffer): boolean => existingKey.equals(key))) {
                            existingKeys.push([key, contentType]);
                        }
                        break;
                    }
                    case "SubChunkPrefix": {
                        const key: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(
                            { ...targetChunkDetails.chunk, dimension: targetChunkDetails.dimension },
                            contentType
                        );
                        const keys: Buffer[] = props.tab.cachedDBKeys[contentType].filter((existingKey: Buffer): boolean =>
                            existingKey.subarray(0, key.length).equals(key)
                        );
                        if (keys.length) existingKeys.push([keys, contentType]);
                        break;
                    }
                    default:
                        console.error(new Error(`Missing handling for chunk key entry content type: ${contentType}`));
                }
            }
        }
        return (
            <ControlledMenu
                anchorPoint={worldEditor2DChunkContextMenu_anchorPoint}
                state={worldEditor2DChunkContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DChunkContextMenu_setOpen(false)}
            >
                <MenuItem
                    title="Copy block coordinates to clipboard"
                    onClick={async (): Promise<void> => {
                        clipboard.writeText(
                            `${targetChunkDetails.block.x} ${
                                height !== undefined ?
                                    minHeight !== undefined ?
                                        `${height - 1 + minHeight}`
                                    :   `${height - 1}`
                                :   "~"
                            } ${targetChunkDetails.block.z}`
                        );
                    }}
                >
                    X: {formatter.format(targetChunkDetails.block.x)} Y:{" "}
                    {height !== undefined ?
                        minHeight !== undefined ?
                            height === 0 ?
                                `void (${formatter.format(height - 1 + minHeight)})`
                            :   `${formatter.format(height - 1 + minHeight)}`
                        : height === 0 ?
                            "void"
                        :   `${formatter.format(height - 1)} (if minY=0)`
                    :   "N/A"}{" "}
                    Z: {formatter.format(targetChunkDetails.block.z)}
                    {/* <img
                        src="resource://images/ui/glyphs/Copy_16x.png"
                        style={{ width: "16px", imageRendering: "pixelated", marginLeft: 2 }}
                        aria-hidden="true"
                    /> */}
                </MenuItem>
                {/* <MenuItem title="Copy biome to clipboard" disabled>
                    Biome:{" "}
                    {
                        // TODO
                    }
                </MenuItem> */}
                <MenuDivider />

                <SubMenu label="Open LevelDB entry...">
                    {existingKeys.map(
                        ([rawKey, contentType]: [rawKey: Buffer | Buffer[], contentType: DBChunkLinkedContentType]): JSX.Element =>
                            rawKey instanceof Array ?
                                <SubMenu label={contentType}>
                                    {rawKey.map((key: Buffer): JSX.Element => {
                                        const displayKey: string = getKeyDisplayName(key);
                                        return (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    props.tab.openTab({
                                                        contentType,
                                                        icon: "auto",
                                                        name: displayKey,
                                                        parentTab: props.tab,
                                                        target: {
                                                            type: "LevelDBEntry",
                                                            key,
                                                        },
                                                    });
                                                }}
                                            >
                                                {displayKey}
                                            </MenuItem>
                                        );
                                    })}
                                </SubMenu>
                            :   <MenuItem
                                    onClick={async (): Promise<void> => {
                                        props.tab.openTab({
                                            contentType,
                                            icon: "auto",
                                            name: getKeyDisplayName(rawKey),
                                            parentTab: props.tab,
                                            target: {
                                                type: "LevelDBEntry",
                                                key: rawKey,
                                            },
                                        });
                                    }}
                                >
                                    {contentType}
                                </MenuItem>
                    )}
                    {existingKeys.length === 0 &&
                        (noCachedDBKeys ?
                            <MenuItem disabled>The DB keys cache has not been loaded yet.</MenuItem>
                        :   <MenuItem disabled>No LevelDB entries found for this chunk.</MenuItem>)}
                </SubMenu>
                <MenuDivider />

                {/* TODO */}
                {/* <MenuHeader>Cave Biomes</MenuHeader>
                <MenuDivider /> */}

                <MenuHeader>Chunk</MenuHeader>
                <MenuItem
                    title="Copy chunk coordinates to clipboard"
                    onClick={async (): Promise<void> => {
                        clipboard.writeText(`${targetChunkDetails.chunk.x} ${targetChunkDetails.chunk.z}`);
                    }}
                >
                    X: {targetChunkDetails.chunk.x} Z: {targetChunkDetails.chunk.z}
                </MenuItem>
                <MenuItem
                    title="Copy chunk boundaries to clipboard"
                    onClick={async (): Promise<void> => {
                        clipboard.writeText(
                            `${targetChunkDetails.chunk.x * 16} ${targetChunkDetails.chunk.z * 16} -> ${targetChunkDetails.chunk.x * 16 + 15} ${targetChunkDetails.chunk.z * 16 + 15}`
                        );
                    }}
                >
                    ({formatter.format(targetChunkDetails.chunk.x * 16)} / {formatter.format(targetChunkDetails.chunk.z * 16)}) -&gt; (
                    {formatter.format(targetChunkDetails.chunk.x * 16 + 15)} / {formatter.format(targetChunkDetails.chunk.z * 16 + 15)})
                </MenuItem>
                <MenuDivider />

                {netherScale === undefined || netherScale === null ?
                    null
                : ["overworld", 0].includes(targetChunkDetails.dimension) ?
                    <>
                        <MenuHeader>Nether</MenuHeader>
                        <MenuItem
                            title="Copy Nether block coordinates to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor((targetChunkDetails.rawPosition.x * 16) / netherScale)} ${Math.floor((targetChunkDetails.rawPosition.y * 16) / netherScale)}`
                                );
                            }}
                        >
                            X: {formatter.format(Math.floor((targetChunkDetails.rawPosition.x * 16) / netherScale))} Z:{" "}
                            {formatter.format(Math.floor((targetChunkDetails.rawPosition.y * 16) / netherScale))}
                        </MenuItem>
                        <MenuItem
                            title="Copy Nether chunk coordinates to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor(targetChunkDetails.rawPosition.x / netherScale)} ${Math.floor(targetChunkDetails.rawPosition.y / netherScale)}`
                                );
                            }}
                        >
                            Chunk: X: {formatter.format(Math.floor(targetChunkDetails.rawPosition.x / netherScale))} Z:{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y / netherScale))}
                        </MenuItem>
                        <MenuItem
                            title="Copy Nether chunk boundaries to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor(targetChunkDetails.rawPosition.x / netherScale) * 16} ${Math.floor(targetChunkDetails.rawPosition.y / netherScale) * 16} -> ${Math.floor(targetChunkDetails.rawPosition.x / netherScale) * 16 + 15} ${Math.floor(targetChunkDetails.rawPosition.y / netherScale) * 16 + 15}`
                                );
                            }}
                        >
                            ({formatter.format(Math.floor(targetChunkDetails.rawPosition.x / netherScale) * 16)} /{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y / netherScale) * 16)}) -&gt; (
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.x / netherScale) * 16 + 15)} /{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y / netherScale) * 16 + 15)})
                        </MenuItem>
                        <MenuItem
                            title={
                                !engineRef.current?.instance ?
                                    "The 2D renderer engine is not ready yet."
                                :   "Brings you to the associated location in the Nether dimension on the map"
                            }
                            onClick={async (): Promise<void> => {
                                if (levelDatLoaded === true && netherScale === undefined) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale was not loaded properly.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (netherScale === undefined) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale has not been loaded yet.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (netherScale === null) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale could not be determined.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (!engineRef.current?.instance) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: `The 2D renderer engine is not ready yet.`,
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                props.dataStorageObject.worldEditor2D.dimension = "nether";
                                reloadMap(false, "renderFrame");
                                engineRef.current.instance.goCoords(
                                    targetChunkDetails.rawPosition.x / netherScale,
                                    targetChunkDetails.rawPosition.y / netherScale,
                                    config.views.world.modeSettings["2D"].mapGoToPositionAnimationDuration
                                );
                            }}
                            disabled={!engineRef.current?.instance}
                        >
                            Go to Nether coordinates
                        </MenuItem>
                        <MenuDivider />
                    </>
                : ["nether", 1].includes(targetChunkDetails.dimension) ?
                    <>
                        <MenuHeader>Overworld</MenuHeader>
                        <MenuItem
                            title="Copy Overworld block coordinates to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor(targetChunkDetails.rawPosition.x * 16 * netherScale)} ${Math.floor(targetChunkDetails.rawPosition.y * 16 * netherScale)}`
                                );
                            }}
                        >
                            X: {formatter.format(Math.floor(targetChunkDetails.rawPosition.x * 16 * netherScale))} Z:{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y * 16 * netherScale))}
                        </MenuItem>
                        <MenuItem
                            title="Copy Overworld chunk coordinates to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor(targetChunkDetails.rawPosition.x * netherScale)} ${Math.floor(targetChunkDetails.rawPosition.y * netherScale)}`
                                );
                            }}
                        >
                            Chunk: X: {formatter.format(Math.floor(targetChunkDetails.rawPosition.x * netherScale))} Z:{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y * netherScale))}
                        </MenuItem>
                        <MenuItem
                            title="Copy Overworld chunk boundaries to clipboard"
                            onClick={async (): Promise<void> => {
                                if (netherScale === undefined || netherScale === null) return;
                                clipboard.writeText(
                                    `${Math.floor(targetChunkDetails.rawPosition.x * netherScale) * 16} ${Math.floor(targetChunkDetails.rawPosition.y * netherScale) * 16} -> ${Math.floor(targetChunkDetails.rawPosition.x * netherScale) * 16 + 15} ${Math.floor(targetChunkDetails.rawPosition.y * netherScale) * 16 + 15}`
                                );
                            }}
                        >
                            ({formatter.format(Math.floor(targetChunkDetails.rawPosition.x * netherScale) * 16)} /{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y * netherScale) * 16)}) -&gt; (
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.x * netherScale) * 16 + 15)} /{" "}
                            {formatter.format(Math.floor(targetChunkDetails.rawPosition.y * netherScale) * 16 + 15)})
                        </MenuItem>
                        <MenuItem
                            title={
                                !engineRef.current?.instance ?
                                    "The 2D renderer engine is not ready yet."
                                :   "Brings you to the associated location in the Overworld dimension on the map"
                            }
                            onClick={async (): Promise<void> => {
                                if (levelDatLoaded === true && netherScale === undefined) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale was not loaded properly.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (netherScale === undefined) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale has not been loaded yet.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (netherScale === null) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: "The nether scale could not be determined.",
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                if (!engineRef.current?.instance) {
                                    dialog.showMessageBox({
                                        type: "error",
                                        title: "Error",
                                        message: `The 2D renderer engine is not ready yet.`,
                                        buttons: ["OK"],
                                        noLink: true,
                                    });
                                    return;
                                }
                                props.dataStorageObject.worldEditor2D.dimension = "overworld";
                                reloadMap(false, "renderFrame");
                                engineRef.current.instance.goCoords(
                                    targetChunkDetails.rawPosition.x * netherScale,
                                    targetChunkDetails.rawPosition.y * netherScale,
                                    config.views.world.modeSettings["2D"].mapGoToPositionAnimationDuration
                                );
                            }}
                            disabled={!engineRef.current?.instance}
                        >
                            Go to Overworld coordinates
                        </MenuItem>
                        <MenuDivider />
                    </>
                :   null}

                <MenuItem
                    title="Reload the data for this chunk"
                    onClick={async (): Promise<void> => {
                        delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                        delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                    }}
                >
                    Reload chunk
                </MenuItem>
                <MenuItem
                    title="Deletes this chunk's associated LevelDB entries"
                    onClick={async (): Promise<void> => {
                        if (!props.tab.db) return;
                        if (config.views.world.modeSettings["2D"].showChunkDeletionWarnings) {
                            const confirmationResult: MessageBoxReturnValue = await dialog.showMessageBox({
                                type: "warning",
                                title: "Deleting Chunk",
                                message: `Are you sure you want to delete this chunk's LevelDB entries?`,
                                detail: "This action cannot be undone.",
                                buttons: ["Proceed", "Cancel"],
                                noLink: true,
                                defaultId: 1,
                                cancelId: 1,
                                checkboxChecked: false,
                                checkboxLabel: "Do not show this message again",
                            });
                            if (confirmationResult.checkboxChecked) config.views.world.modeSettings["2D"].showChunkDeletionWarnings = false;
                            if (confirmationResult.response === 1) return;
                        }
                        for (const [key, contentType] of existingKeys) {
                            if (key instanceof Array) {
                                for (const currentKey of key) {
                                    props.tab.db.delete(currentKey).then((success: boolean): void => {
                                        if (!success) return;
                                        if (contentType === "Data3D" && data3dKeyCount) {
                                            data3dKeySet.delete(currentKey.toString("hex"));
                                            data3dKeyCount = data3dKeySet.size;
                                            delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                            delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                        } else if (contentType === "Data2D" && data2dKeyCount) {
                                            data2dKeySet.delete(currentKey.toString("hex"));
                                            data2dKeyCount = data2dKeySet.size;
                                            delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                            delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                        } else if (contentType === "Data2DLegacy" && data2dLegacyKeyCount) {
                                            data2dLegacyKeySet.delete(currentKey.toString("hex"));
                                            data2dLegacyKeyCount = data2dLegacyKeySet.size;
                                            delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                            delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                        } else if (contentType === "LegacyTerrain" && legacyTerrainKeyCount) {
                                            legacyTerrainKeySet.delete(currentKey.toString("hex"));
                                            legacyTerrainKeyCount = legacyTerrainKeySet.size;
                                            delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                            delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                        }
                                        if (!props.tab.cachedDBKeys) return;
                                        const keyIndex: number = props.tab.cachedDBKeys[contentType].findIndex((dbKey): boolean => dbKey.equals(currentKey));
                                        if (keyIndex === -1) return;
                                        props.tab.cachedDBKeys[contentType].splice(keyIndex, 1);
                                    });
                                }
                                continue;
                            }
                            props.tab.db.delete(key).then((success: boolean): void => {
                                if (!success) return;
                                if (contentType === "Data3D" && data3dKeyCount) {
                                    data3dKeySet.delete(key.toString("hex"));
                                    data3dKeyCount = data3dKeySet.size;
                                    delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                    delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                } else if (contentType === "Data2D" && data2dKeyCount) {
                                    data2dKeySet.delete(key.toString("hex"));
                                    data2dKeyCount = data2dKeySet.size;
                                    delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                    delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                } else if (contentType === "Data2DLegacy" && data2dLegacyKeyCount) {
                                    data2dLegacyKeySet.delete(key.toString("hex"));
                                    data2dLegacyKeyCount = data2dLegacyKeySet.size;
                                    delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                    delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                } else if (contentType === "LegacyTerrain" && legacyTerrainKeyCount) {
                                    legacyTerrainKeySet.delete(key.toString("hex"));
                                    legacyTerrainKeyCount = legacyTerrainKeySet.size;
                                    delete cachedChunkColorData[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                    delete cachedChunkImageBitmaps[targetChunkDetails.chunk.x]?.[targetChunkDetails.chunk.z];
                                }
                                if (!props.tab.cachedDBKeys) return;
                                const keyIndex: number = props.tab.cachedDBKeys[contentType].findIndex((dbKey): boolean => dbKey.equals(key));
                                if (keyIndex === -1) return;
                                props.tab.cachedDBKeys[contentType].splice(keyIndex, 1);
                            });
                        }
                    }}
                    disabled={!existingKeys.length}
                >
                    Delete chunk
                </MenuItem>
            </ControlledMenu>
        );
    }
    const hoverInfoRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    function Contents(): JSX.Element {
        const engine: EngineHandle = useCanvasTileEngine();
        const [forceRerenderLastValue, triggerForceRerender] = useState(false);
        function rerenderContents(): void {
            triggerForceRerender(!forceRerenderLastValue);
        }
        engineRef.current = engine;
        contentsInteractionRef.current = { rerenderContents };

        let portalsRendered: boolean = false;

        function onMapContentsReset(): void {
            mapReset = false;
            const successfullyRerenderedPortals: boolean = renderPortalsOnMap(engine.getScale(), !props.dataStorageObject.worldEditor2D.dataOverlays.portals);
            if (successfullyRerenderedPortals) portalsRendered = props.dataStorageObject.worldEditor2D.dataOverlays.portals;
            else portalsRendered = !props.dataStorageObject.worldEditor2D.dataOverlays.portals;
        }

        return (
            <div style={{ display: "flex", height: "-webkit-fill-available", justifyContent: "center", flexDirection: "column" }} ref={containerRef}>
                <div style={{ position: "relative", top: 0, left: 0, height: "0", zIndex: 1 }}>
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            /* width: "100%", height: "100%", */ overflow: "auto",
                            color: "white",
                            backgroundColor: "rgba(0, 0, 0, 0.5)",
                            whiteSpace: "pre-wrap",
                        }}
                        ref={hoverInfoRef}
                    ></div>
                </div>
                <VisibleOverlaysContextMenu interactionRef={visibleOverlaysContextMenuInteractionRef} />
                <SettingsContextMenu interactionRef={settingsContextMenuInteractionRef} />
                <LayerContextMenu interactionRef={layerContextMenuInteractionRef} />
                <DimensionSwitcherContextMenu interactionRef={dimensionSwitcherContextMenuInteractionRef} />
                <ChunkContextMenu interactionRef={chunkContextMenuInteractionRef} />
                {/* <ControlledMenu
                anchorPoint={worldEditor2DCanvasContextMenu_anchorPoint}
                state={worldEditor2DCanvasContextMenu_isOpen ? "open" : "closed"}
                direction="right"
                onClose={(): void => void worldEditor2DCanvasContextMenu_setOpen(false)}
            >
                <MenuItem
                    onClick={async (): Promise<void> => {
                        const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                            buttonLabel: "Save",
                            defaultPath: path.join(app.getPath("downloads"), `map_${toLong(data.value.mapId.value)}.png`),
                            properties: ["showHiddenFiles", "showOverwriteConfirmation", "treatPackageAsDirectory"],
                            title: "Save Map Image",
                            message: "Select a location to save the map image.",
                            filters: [
                                { name: "PNG (Recommended)", extensions: ["png"] },
                                { name: "JPEG", extensions: ["jpg", "jpeg"] },
                                { name: "WEBP", extensions: ["webp"] },
                            ],
                        });
                        if (result.canceled) return;
                        const mimeType: string | false = mime.lookup(result.filePath);
                        if (!mimeType)
                            return void dialog.showErrorBox("Unsupported Image Type", `Unsupported image type: ${mimeType || path.extname(result.filePath)}`);
                        const image: Blob | null = await new Promise((resolve: BlobCallback): void => canvasRef.current!.toBlob(resolve, mimeType));
                        if (!image) return void dialog.showErrorBox("Failed to Save Image", "An error occurred while saving the image.");
                        if (image.type !== mimeType) return void dialog.showErrorBox("Unsupported Image Type", `Unsupported image type: ${mimeType}`);
                        writeFile(result.filePath, Buffer.from(await image.arrayBuffer()));
                    }}
                >
                    Save Image
                </MenuItem>
                {!props.readonly && (
                    <MenuItem
                        onClick={async (): Promise<void> => {
                            const result: string[] | undefined = dialog.showOpenDialogSync({
                                buttonLabel: "Replace",
                                // TODO: Add support for other image types.
                                filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
                                properties: ["openFile", "treatPackageAsDirectory", "showHiddenFiles"],
                                message: "Select an image to replace this map.",
                                title: "Replace Map Image",
                            });
                            if (!result || !result[0]) return;
                            const image: string = `data:${mime.lookup(result[0].split(".").at(-1)!)};base64,${readFileSync(result[0], "base64")}`;
                            const imageElement = new Image();
                            imageElement.src = image;
                            await new Promise((resolve): void => void (imageElement.onload = resolve));
                            const context: CanvasRenderingContext2D = canvasRef.current!.getContext("2d")!;
                            context.drawImage(imageElement, 0, 0, 128, 128);
                            // TODO: Make this convert the bytes from unsigned bytes to signed bytes.
                            data.value.colors.value = Array.from(context.getImageData(0, 0, 128, 128).data).map((value: number): number => (value << 24) >> 24);
                            markTabAsModified();
                            updateMap();
                        }}
                    >
                        Replace Image
                    </MenuItem>
                )}
            </ControlledMenu>
            {!props.readonly && (
                <ControlledMenu
                    anchorPoint={worldEditor2DAddMarkerMenu_anchorPoint}
                    state={worldEditor2DAddMarkerMenu_isOpen ? "open" : "closed"}
                    direction="right"
                    onClose={(): void => void worldEditor2DAddMarkerMenu_setOpen(false)}
                >
                    {...((): JSX.Element[] => {
                        const menuItems: JSX.Element[] = [];

                        for (let i: number = 0; i < 16; i++) {
                            menuItems.push(
                                <MenuItem onClick={async (): Promise<void> => {}}>
                                    <div
                                        style={{
                                            width: "16px",
                                            height: "16px",
                                            imageRendering: "pixelated",
                                            backgroundImage: "url('resource://images/ui/spritesheets/map_icons.png')",
                                            backgroundPosition: `${(i % 4) * 16}px ${Math.floor(i / 4) * 16}px`,
                                        }}
                                        aria-hidden="true"
                                    />
                                </MenuItem>
                            );
                        }

                        return menuItems;
                    })()}
                </ControlledMenu>
            )} */}
                <CanvasTileEngine
                    engine={engine}
                    renderer={new RendererCanvas() as import("@canvas-tile-engine/core").IRenderer<HTMLDivElement, HTMLImageElement>}
                    config={{
                        scale: props.dataStorageObject.worldEditor2D.zoom,
                        responsive: "preserve-scale",
                        coordinates: { enabled: true },
                        debug: {
                            enabled: true,
                            hud: { enabled: true, coordinates: true, fps: true, scale: true, tilesInView: true, topLeftCoordinates: true },
                        },
                        size: { width: 10000, height: 10000 },
                        backgroundColor: `#${MAP_BACKGROUND_COLOR.map((v: number): string => v.toString(16).padStart(2, "0")).join("")}`,
                        eventHandlers: { drag: true, zoom: true, hover: true, click: true, rightClick: true },
                        // 1 is absurdly laggy, 3 is a little laggy, 4 isn't *too* bad, 8 is good.
                        minScale: config.views.world.modeSettings["2D"].minMapScale,
                        maxScale: config.views.world.modeSettings["2D"].maxMapScale /* 768 */ /* 96 */,
                    }}
                    center={props.dataStorageObject.worldEditor2D.position /* { x: 0, y: 0 } */}
                    onClick={(coords) => {
                        // DEBUG
                        console.debug("Clicked:", coords.snapped, { x: Math.floor(coords.raw.x * 16), y: Math.floor(coords.raw.y * 16) }, coords.raw);
                    }}
                    onRightClick={(coords, _mouse, client) => {
                        // TODO: Make this work on long press too (on mobile and devices with touch screens only), and for Control+Click on macOS if that doesn't already work. Or maybe add a modifier key button for mobile where it is a toggle and when it is on, tapping/clicking opens this context menu.
                        if (!chunkContextMenuInteractionRef.current) return;
                        chunkContextMenuInteractionRef.current.targetChunkDetails = {
                            block: { x: Math.floor(coords.raw.x * 16), z: Math.floor(coords.raw.y * 16) },
                            chunk: { x: coords.snapped.x, z: coords.snapped.y },
                            dimension: props.dataStorageObject.worldEditor2D.dimension,
                            rawPosition: coords.raw,
                        };
                        chunkContextMenuInteractionRef.current.openContextMenu({ x: client.raw.x, y: client.raw.y });
                    }}
                    onHover={(coords) => {
                        if (!hoverInfoRef.current) return;
                        const chunk: Vector2 = { ...coords.snapped };
                        const block: VectorXZ = { x: Math.floor(coords.raw.x * 16), z: Math.floor(coords.raw.y * 16) };
                        const chunkColorData = cachedChunkColorData[chunk.x]?.[chunk.y];
                        biomeDetailsRenderer: if (typeof chunkColorData === "object") {
                            const biomeId: number | undefined = chunkColorData.biomeData[offsetTo2DChunkBlockColorDataIndex(block) / 4];
                            if (biomeId === undefined) break biomeDetailsRenderer;
                            // TODO: Add support for custom biomes.
                            const biomeNamespacedId: string | undefined = getBiomeNamespacedIdFromNumericId(
                                biomeId,
                                typeof biomeIdsTable === "object" ? biomeIdsTable : undefined
                            );
                            const height: number | undefined = chunkColorData.heightMap?.[offsetTo2DChunkBlockColorDataIndex(block) / 4];
                            const minHeight: number | undefined = chunkColorData.heightRange?.[0];
                            hoverInfoRef.current.textContent = `Biome: ${
                                biomeNamespacedId ??
                                (biomeId === -1 ? "placeholder biome"
                                : biomeId === -2 ? "no data"
                                : biomeId < 10000 ? "Unknown"
                                : biomeIdsTable === "error" ? "<BiomeIdsTable Error>"
                                : biomeIdsTable === "loading" ? "<Loading BiomeIdsTable...>"
                                : biomeIdsTable === undefined ? "<ERROR: BiomeIdsTable never started loading>"
                                : "Unknown (custom)")
                            } (${formatter.format(biomeId)})\nHeight: ${
                                height !== undefined ?
                                    minHeight !== undefined ?
                                        height === 0 ?
                                            `void (${formatter.format(height - 1 + minHeight)}) (absolute: ${formatter.format(height)})`
                                        :   `${formatter.format(height - 1 + minHeight)} (absolute: ${formatter.format(height)})`
                                    : height === 0 ? `void (absolute: ${formatter.format(height)})`
                                    : `${formatter.format(height - 1)} (if minY=0) (absolute: ${formatter.format(height)})`
                                :   "N/A"
                            }\nCoordinates: ${formatter.format(block.x)}, ${formatter.format(block.z)}\nChunk: ${formatter.format(chunk.x)}, ${formatter.format(
                                chunk.y
                            )}${
                                (
                                    props.dataStorageObject.worldEditor2D.showCorrespondingNetherOrOverworldCoordinates &&
                                    netherScale !== null &&
                                    ["overworld", "nether", 0, 1].includes(props.dataStorageObject.worldEditor2D.dimension)
                                ) ?
                                    ["overworld", 0].includes(props.dataStorageObject.worldEditor2D.dimension) ?
                                        netherScale === undefined ?
                                            "\nNether Coordinates: Loading...\nNether Chunk: Loading..."
                                        :   `\nNether Coordinates: ${formatter.format(Math.floor((coords.raw.x * 16) / netherScale))}, ${formatter.format(
                                                Math.floor((coords.raw.y * 16) / netherScale)
                                            )}\nNether Chunk: ${formatter.format(Math.floor(coords.raw.x / netherScale))}, ${formatter.format(
                                                Math.floor(coords.raw.y / netherScale)
                                            )}`
                                    : netherScale === undefined ? "\nOverworld Coordinates: Loading...\nOverworld Chunk: Loading..."
                                    : `\nOverworld Coordinates: ${formatter.format(Math.floor(coords.raw.x * 16 * netherScale))}, ${formatter.format(
                                            Math.floor(coords.raw.y * 16 * netherScale)
                                        )}\nOverworld Chunk: ${formatter.format(Math.floor(coords.raw.x * netherScale))}, ${formatter.format(
                                            Math.floor(coords.raw.y * netherScale)
                                        )}`
                                :   ""
                            }`;
                        } else {
                            hoverInfoRef.current.textContent = `Biome: no data\nHeight: N/A\nCoordinates: ${formatter.format(block.x)}, ${formatter.format(block.z)}\nChunk: ${formatter.format(chunk.x)}, ${formatter.format(chunk.y)}${
                                (
                                    props.dataStorageObject.worldEditor2D.showCorrespondingNetherOrOverworldCoordinates &&
                                    netherScale !== null &&
                                    ["overworld", "nether", 0, 1].includes(props.dataStorageObject.worldEditor2D.dimension)
                                ) ?
                                    ["overworld", 0].includes(props.dataStorageObject.worldEditor2D.dimension) ?
                                        netherScale === undefined ?
                                            "\nNether Coordinates: Loading...\nNether Chunk: Loading..."
                                        :   `\nNether Coordinates: ${formatter.format(Math.floor((coords.raw.x * 16) / netherScale))}, ${formatter.format(
                                                Math.floor((coords.raw.y * 16) / netherScale)
                                            )}\nNether Chunk: ${formatter.format(Math.floor(coords.raw.x / netherScale))}, ${formatter.format(
                                                Math.floor(coords.raw.y / netherScale)
                                            )}`
                                    : netherScale === undefined ? "\nOverworld Coordinates: Loading...\nOverworld Chunk: Loading..."
                                    : `\nOverworld Coordinates: ${formatter.format(Math.floor(coords.raw.x * 16 * netherScale))}, ${formatter.format(
                                            Math.floor(coords.raw.y * 16 * netherScale)
                                        )}\nOverworld Chunk: ${formatter.format(Math.floor(coords.raw.x * netherScale))}, ${formatter.format(
                                            Math.floor(coords.raw.y * netherScale)
                                        )}`
                                :   ""
                            }`;
                        }
                    }}
                    style={{
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        backgroundColor: `#${MAP_BACKGROUND_COLOR.map((v: number): string => v.toString(16).padStart(2, "0")).join("")}`,
                    }}
                    onCoordsChange={(coords: import("@canvas-tile-engine/core").Coords): void => {
                        props.dataStorageObject.worldEditor2D.position = { ...coords };
                    }}
                    onZoom={(scale: number): void => {
                        props.dataStorageObject.worldEditor2D.zoom = scale;
                        engine.clearLayer(1);
                        if (props.dataStorageObject.worldEditor2D.showGrid === "auto" ? scale >= 8 : props.dataStorageObject.worldEditor2D.showGrid) {
                            engine.drawGridLines(1, 1, "#1e293b", 1);
                        }
                        if (portalsRendered && props.dataStorageObject.worldEditor2D.dataOverlays.portals) portalsRendered = renderPortalsOnMap(scale);
                    }}
                >
                    <CanvasTileEngine.DrawFunction layer={0}>
                        {(
                            ctx: unknown,
                            coords: import("@canvas-tile-engine/core").Coords,
                            config: Required<import("@canvas-tile-engine/core").CanvasTileEngineConfig>
                        ): void => {
                            if (!(ctx instanceof CanvasRenderingContext2D)) return;
                            if (mapReset) onMapContentsReset();
                            if (!portalsRendered && props.dataStorageObject.worldEditor2D.dataOverlays.portals)
                                portalsRendered = renderPortalsOnMap(config.scale);
                            if (portalsRendered && !props.dataStorageObject.worldEditor2D.dataOverlays.portals)
                                portalsRendered = !renderPortalsOnMap(config.scale, true);
                            const bounds: { min: Vector2; max: Vector2 } = {
                                min: { ...coords },
                                max: { x: coords.x + config.size.width / config.scale, y: coords.y + config.size.height / config.scale },
                            };
                            const blockBounds: { min: VectorXZ; max: VectorXZ } = {
                                min: { x: Math.floor(bounds.min.x * 16), z: Math.floor(bounds.min.y * 16) },
                                max: { x: Math.ceil(bounds.max.x * 16), z: Math.ceil(bounds.max.y * 16) },
                            };
                            drawCachedChunks_v3(ctx, bounds, blockBounds, config.size, config.scale);
                            function areMapPositionDetailsDifferent(a: ComparisonMapPositionDetails, b: ComparisonMapPositionDetails): boolean {
                                if (a.coords.x !== b.coords.x || a.coords.y !== b.coords.y) return true;
                                if (a.scale !== b.scale) return true;
                                if (a.size.width !== b.size.width || a.size.height !== b.size.height) return true;
                                return false;
                            }
                            if (
                                lastMapDrawCall > Date.now() - 5 &&
                                (!lastMapPositionDetails ||
                                    areMapPositionDetailsDifferent(lastMapPositionDetails, { coords, scale: config.scale, size: config.size }) ||
                                    lastMapDrawCall > Date.now() - 10)
                            ) {
                                return;
                            }
                            lastMapDrawCall = Date.now();
                            lastMapPositionDetails = { coords, scale: config.scale, size: config.size };
                            cullCachedOutOfBoundsChunks(bounds);
                            // cullCachedOutOfBoundsImageBitmaps(bounds, config.scale);
                            cullEmptyZoomParallelChunkImageBitmapLists(config.scale);

                            // Wait for the level.dat to finish attempting to load before loading chunk data.
                            if (isOldWorld === undefined && levelDatLoaded === "loading") return;

                            loadChunksInBounds(bounds);
                            // loadChunkImageBitmapsInBounds(bounds, config.scale);

                            // ~DEBUG
                            // if (!cachedChunkColorData[5]?.[6]) {
                            //     cachedChunkColorData[5] ??= {};
                            //     const chunkColorData = new Uint8Array(16 * 16 * 4);
                            //     const columnColors: [r: number, g: number, b: number, a: number][] = [
                            //         [255, 0, 0, 255],
                            //         [0, 255, 0, 255],
                            //         [0, 0, 255, 255],
                            //         [255, 255, 0, 255],
                            //         [255, 0, 255, 255],
                            //         [0, 255, 255, 255],
                            //         [255, 255, 255, 255],
                            //         [0, 0, 0, 255],
                            //         [128, 128, 128, 255],
                            //         [192, 192, 192, 255],
                            //         [64, 64, 64, 255],
                            //         [96, 96, 96, 255],
                            //         [32, 32, 32, 255],
                            //         [48, 48, 48, 255],
                            //         [16, 16, 16, 255],
                            //         [24, 24, 24, 255],
                            //     ];
                            //     for (let x = 0; x < 16; x++) {
                            //         for (let z = 0; z < 16; z++) {
                            //             const index: number = offsetTo2DChunkBlockColorDataIndex({ x, z });
                            //             [chunkColorData[index], chunkColorData[index + 1], chunkColorData[index + 2], chunkColorData[index + 3]] = columnColors[x]!;
                            //         }
                            //     }
                            //     cachedChunkColorData[5][6] = chunkColorData;ctx.putImageData()
                            // }

                            // ctx.fillStyle = "#ff0000";
                            // ctx.fillRect(56, 45, 12, 56);
                            // console.log(ctx, coords, config);
                        }}
                    </CanvasTileEngine.DrawFunction>
                    {(props.dataStorageObject.worldEditor2D.showGrid === "auto" ?
                        props.dataStorageObject.worldEditor2D.zoom >= 8
                    :   props.dataStorageObject.worldEditor2D.showGrid) && <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={1} />}
                </CanvasTileEngine>
                {/* <div style={{ maxHeight: "round(down, 100%, 128px)", display: "flex", justifyContent: "center", aspectRatio: "1 / 1" }}>
                <canvas
                    width={128}
                    height={128}
                    class="map-renderer-canvas piximg"
                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                    ref={canvasRef}
                    onContextMenu={(event: TargetedMouseEvent<HTMLCanvasElement>): void => void onCanvasRightClick(event)}
                />
            </div> */}
            </div>
        );
    }
    return <Contents />;
}
