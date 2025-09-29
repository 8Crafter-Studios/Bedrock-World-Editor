import json5 from "json5";
import * as THREE from "three";
import { fetchTextSync } from "../../src/utils/connectionUtils";
import type { NBTSchemas } from "mcbe-leveldb";

// TO-DO: Make this load from resource packs on the world as well.
const terrainTextureJSON = json5.parse(
    fetchTextSync("resource://mc/textures/terrain_texture.json", "utf-8")!
) as typeof import("../../resources/mc/textures/terrain_texture.json");
const blocksJSON = json5.parse(fetchTextSync("resource://mc/blocks.json", "utf-8")!) as typeof import("../../resources/mc/blocks.json");
const lightingGlobalJSON = json5.parse(
    fetchTextSync("resource://mc/lighting/global.json", "utf-8")!
) as typeof import("../../resources/mc/lighting/global.json");

//#region blocksJSON overrides

terrainTextureJSON.texture_data.grass_top.textures = ["textures/blocks/grass_carried"];
terrainTextureJSON.texture_data.grass_side.textures = ["textures/blocks/grass_side_carried"];

//#endregion

export type BlockFace = (typeof blockFaces)[number];
export const blockFaces = ["east", "west", "up", "down", "north", "south"] as const;

const blockIDAliases = {
    "minecraft:grass_block": "grass",
} as const satisfies { [key: `${string}:${string}`]: keyof typeof blocksJSON };

export type BlockMaterialType =
    | "alpha_test"
    | "alpha_test_single_sided"
    | "blend"
    | "double_sided"
    | "opaque"
    | "alpha_test_to_opaque"
    | "alpha_test_single_sided_to_opaque"
    | "blend_to_opaque";

export type MaterialType = THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;

export type GeometryID = "minecraft:geometry.invisible" | "minecraft:geometry.full_block" | "minecraft:geometry.cross_texture";

export const blockShapeToGeometry = {
    Invisible: "minecraft:geometry.invisible",
    Block: "minecraft:geometry.full_block",
    Cross: "minecraft:geometry.cross_texture",
} as const satisfies Record<string, GeometryID>;

export type BlockShape = keyof typeof blockShapeToGeometry;

const textureLoader = new THREE.TextureLoader();

const defaultMaterialKind: typeof THREE.MeshLambertMaterial | typeof THREE.MeshBasicMaterial = THREE.MeshLambertMaterial;

class GeometryLoader {
    private static geometryInstances: Map<LooseAutocomplete<GeometryID>, THREE.BufferGeometry> = new Map();

    public static init() {
        // TO-DO: PLACEHOLDER
        const geometryTypes: Record<LooseAutocomplete<GeometryID>, THREE.BufferGeometry> = {
            "minecraft:geometry.full_block": new THREE.BoxGeometry(),
            "minecraft:geometry.cross_texture": new THREE.PlaneGeometry(),
            "minecraft:geometry.invisible": new THREE.BufferGeometry(),
        };

        for (const [geometryID, geometry] of Object.entries(geometryTypes)) {
            this.geometryInstances.set(geometryID, geometry);
        }
    }

    public static getGeometry(geometryID: LooseAutocomplete<GeometryID | BlockShape>): THREE.BufferGeometry {
        if (geometryID in blockShapeToGeometry) geometryID = blockShapeToGeometry[geometryID as BlockShape];
        if (!this.geometryInstances.has(geometryID)) {
            console.warn(`Geometry ${geometryID} not found`);
            this.geometryInstances.set(geometryID, new THREE.BufferGeometry());
        }
        return this.geometryInstances.get(geometryID)!;
    }
}

GeometryLoader.init();

const wireframeMode = false;

function loadTexture(path: string) {
    // TODO: make async
    const texture = textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = true;
    return texture;
}

function getMeshForBlock(block: Omit<BlockType, "material">, options: BlockTypeCreationOptions = {}): THREE.InstancedMesh {
    let materialOptions:
        | THREE.MeshLambertMaterialParameters
        | THREE.MeshBasicMaterialParameters
        | (THREE.MeshLambertMaterialParameters | THREE.MeshBasicMaterialParameters)[];
    let material: MaterialType | MaterialType[];
    switch (block.geometryType) {
        case "minecraft:geometry.invisible":
            materialOptions = { visible: false };
            break;
        case "minecraft:geometry.full_block":
            materialOptions = blockFaces.map((face) => ({ map: loadTexture(block.createTexture(face)) }));
            break;
        case "minecraft:geometry.cross_texture":
            materialOptions = { map: loadTexture(block.createTexture("*")) };
            break;
        default:
            materialOptions = { map: loadTexture(block.createTexture("*")) };
    }
    // for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
    //     materialOption.cull
    // }
    switch (block.materialType) {
        case "alpha_test":
        // TO-DO: Make this separate so it becomes opque at a distance.
        case "alpha_test_to_opaque":
            for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
                materialOption.alphaTest = 0.5;
                materialOption.side = THREE.DoubleSide;
            }
            break;
        case "alpha_test_single_sided":
        // TO-DO: Make this separate so it becomes opque at a distance.
        case "alpha_test_single_sided_to_opaque":
            for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
                materialOption.alphaTest = 0.5;
                materialOption.side = THREE.FrontSide;
            }
            break;
        case "blend":
        // TO-DO: Make this separate so it becomes opque at a distance.
        case "blend_to_opaque":
            for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
                materialOption.blending = THREE.NormalBlending;
                materialOption.side = THREE.FrontSide;
            }
            break;
        case "double_sided":
            for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
                materialOption.blending = THREE.NormalBlending;
                materialOption.side = THREE.DoubleSide;
            }
            break;
        case "opaque":
            for (const materialOption of Array.isArray(materialOptions) ? materialOptions : [materialOptions]) {
                materialOption.alphaMap = new THREE.DataTexture(new Uint8Array([255, 255, 255]), 1, 1, THREE.RGBFormat);
                materialOption.blending = THREE.NoBlending;
                materialOption.side = THREE.FrontSide;
            }
            break;
        default:
            console.warn(`Unknown material type ${block.materialType}`);
    }
    material = Array.isArray(materialOptions)
        ? materialOptions.map(
              (materialOption: THREE.MeshLambertMaterialParameters | THREE.MeshBasicMaterialParameters): THREE.MeshLambertMaterial | THREE.MeshBasicMaterial =>
                  new defaultMaterialKind(materialOption)
          )
        : new defaultMaterialKind(materialOptions);
    const mesh = new THREE.InstancedMesh(
        GeometryLoader.getGeometry(block.geometryType),
        wireframeMode ? new THREE.MeshBasicMaterial({ wireframe: true }) : material,
        options.maxMeshInstances ?? 4096
    );
    mesh.name = block.typeID;
    mesh.count = 0;
    mesh.castShadow = block.castShadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    return mesh;
}

export class BlockType {
    public typeID: LooseAutocomplete<`minecraft:${keyof typeof blocksJSON}`>;
    // TO-DO: PLACEHOLDER
    public states: NBTSchemas.NBTSchemaTypes.Block["value"]["states"] = {
        type: "compound",
        value: {},
    };
    /**
     * The material type of the block.
     *
     * @todo Currently it only uses `opaque`, so add support for detecting the material.
     */
    public materialType: BlockMaterialType = "opaque";
    public mesh: THREE.InstancedMesh;
    public geometryType: GeometryID = "minecraft:geometry.full_block";
    public transparent: boolean = false;
    public castShadow: boolean = true;
    public hasCollision: boolean = true;
    // TO-DO: Swap this to use MER images for PBR instead.
    public pointLightSource?: {
        color: number;
        intensity: number;
        distance: number;
        decay: number;
    };
    public constructor(typeID: LooseAutocomplete<`${"minecraft:" | ""}${keyof typeof blocksJSON}`>, options: BlockTypeCreationOptions = {}) {
        this.typeID = typeID.includes(":") ? typeID : `minecraft:${typeID}`;
        this.typeID = this.typeID in blockIDAliases ? blockIDAliases[this.typeID as keyof typeof blockIDAliases] : this.typeID;
        if (this.typeID === "minecraft:air") {
            this.materialType = "alpha_test";
            this.transparent = true;
            this.castShadow = false;
            this.hasCollision = false;
            this.geometryType = "minecraft:geometry.invisible";
        }
        if (this.typeID in lightingGlobalJSON.point_lights.colors) {
            this.pointLightSource = {
                color: Number.parseInt(lightingGlobalJSON.point_lights.colors[this.typeID as keyof typeof lightingGlobalJSON.point_lights.colors].slice(1), 16),
                intensity: 15,
                distance: 10,
                decay: 1,
            };
        }
        this.mesh = getMeshForBlock(this);
    }
    public createTexture(type: LooseAutocomplete<BlockFace>): string {
        const blockTextureData =
            blocksJSON[this.typeID as Exclude<keyof typeof blocksJSON, "format_version">] ??
            blocksJSON[this.typeID.replace(/^minecraft:/, "") as Exclude<keyof typeof blocksJSON, "format_version">];
        if (!blockTextureData) {
            console.warn(`No texture data for block type: ${this.typeID}`);
            return "resource-image://mc/textures/blocks/missing_tile.png";
        }
        if (!("textures" in blockTextureData)) return "resource-image://mc/textures/misc/missing_texture.png";
        const terrainTextureForFace: keyof typeof terrainTextureJSON.texture_data | undefined =
            typeof blockTextureData.textures === "string"
                ? (blockTextureData.textures as keyof typeof terrainTextureJSON.texture_data)
                : type in blockTextureData.textures
                ? (blockTextureData.textures[type as keyof typeof blockTextureData.textures] as keyof typeof terrainTextureJSON.texture_data)
                : !(["up", "down"] as string[]).includes(type) && "side" in blockTextureData.textures
                ? (blockTextureData.textures.side as keyof typeof terrainTextureJSON.texture_data)
                : type === "up" && "up" in blockTextureData.textures
                ? (blockTextureData.textures.up as keyof typeof terrainTextureJSON.texture_data)
                : type === "down" && "down" in blockTextureData.textures
                ? (blockTextureData.textures.down as keyof typeof terrainTextureJSON.texture_data)
                : undefined;
        if (!terrainTextureForFace) return "resource-image://mc/textures/misc/missing_texture.png";
        const texture = terrainTextureJSON.texture_data[terrainTextureForFace];
        if (typeof texture.textures === "string") return `resource-image://mc/${texture.textures}`;
        if (Array.isArray(texture.textures) && typeof texture.textures[0] === "string") return `resource-image://mc/${texture.textures[0]}`;
        if (Array.isArray(texture.textures)) {
            const firstTexture = texture.textures[0]!;
            if (typeof firstTexture === "string") return `resource-image://mc/${firstTexture}`;
            return `resource-image://mc/${firstTexture.path}`;
        }
        return `resource-image://mc/${texture.textures.path}`;
    }
}

export interface BlockTypeCreationOptions {
    /**
     * The maximum number of instances of this block type that can be rendered at once.
     *
     * @default 4096
     */
    maxMeshInstances?: number;
}

export class BlockTypeFactory {
    private blockTypeInstances: Map<LooseAutocomplete<`minecraft:${keyof typeof blocksJSON}`>, BlockType> = new Map();
    public constructor() {}
    // TO-DO: Add support for block states.
    public get(typeID: LooseAutocomplete<`${"minecraft:" | ""}${keyof typeof blocksJSON}`>, options: BlockTypeCreationOptions = {}): BlockType {
        if (!typeID.includes(":")) typeID = `minecraft:${typeID}`;
        if (this.blockTypeInstances.has(typeID)) return this.blockTypeInstances.get(typeID)!;
        this.blockTypeInstances.set(typeID, new BlockType(typeID, options));
        return this.blockTypeInstances.get(typeID)!;
    }
}
