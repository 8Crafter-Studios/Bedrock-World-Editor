import * as THREE from "three";

// import audioManager from "./audio/AudioManager";
import { BlockID } from "./Block";
import { RenderGeometry } from "./Block/Block";
import { BlockFactory } from "./Block/BlockFactory";
import { DataStore } from "./DataStore";
import type { Remote } from "comlink";
import { endpointSymbol } from "vite-plugin-comlink/symbol";
import { chunkBlockIndexToOffset, offsetToChunkBlockIndex, type Dimension, type NBTSchemas, type Vector3 } from "mcbe-leveldb";
import { BlockType, BlockTypeFactory } from "../BlockUtils";
import type { LevelDB } from "@8crafter/leveldb-zlib";
import { testForObjectExtension } from "../../../src/utils/miscUtils";

const geometry = new THREE.BoxGeometry();
const crossGeometry = new THREE.PlaneGeometry();

export type InstanceData = {
    readonly block: NBTSchemas.NBTSchemaTypes.Block;
    instanceIds: number[]; // reference to mesh instanceId
};

export type WorldParams = {
    // seed: number;
    // terrain: {
    //     scale: number;
    //     magnitude: number;
    //     offset: number;
    // };
    // surface: {
    //     offset: number;
    //     magnitude: number;
    // };
    // bedrock: {
    //     offset: number;
    //     magnitude: number;
    // };
    // trees: {
    //     frequency: number;
    //     trunkHeight: {
    //         min: number;
    //         max: number;
    //     };
    //     canopy: {
    //         size: {
    //             min: number;
    //             max: number;
    //         };
    //     };
    // };
    // grass: {
    //     frequency: number;
    //     patchSize: number;
    // };
    // flowers: {
    //     frequency: number;
    // };
    leveldb: LevelDB;
    dimension: Dimension;
};

export type WorldSize = {
    width: number;
    height: number;
};

export class WorldChunk extends THREE.Group {
    data: {
        data: NBTSchemas.NBTSchemaTypes.SubChunkPrefix;
        offset: Vector3;
        instancesIndices: InstanceData[];
    }[] = [];
    params: WorldParams;
    // size: WorldSize;
    loaded: boolean;
    dataStore: DataStore;
    wireframeMode: boolean = false;
    blockTypeFactory: BlockTypeFactory = new BlockTypeFactory();

    constructor(/* size: WorldSize, */ params: WorldParams, dataStore: DataStore, wireframeMode = false) {
        super();
        // this.size = size;
        this.params = params;
        this.dataStore = dataStore;
        this.loaded = false;
        this.wireframeMode = wireframeMode;
    }

    async generate(): Promise<void> {
        // const start = performance.now();

        const messageChannel = new MessageChannel();
        messageChannel.port1.addEventListener("message", async (event: MessageEvent<{ key: Buffer }>): Promise<void> => {
            // console.log(`Received request for data for key ${event.data.key}.`);
            messageChannel.port1.postMessage({ key: event.data.key, data: await this.params.leveldb.get(event.data.key) });
        });

        const messageChannelPortID = `${Date.now()}_${Math.floor(Math.random() * 1000000)}_${this.position.x}_${this.position.z}_${this.params.dimension}`;

        messageChannel.port1.start();

        workerInstance[endpointSymbol].postMessage({ type: "registerMessagePortID", id: messageChannelPortID, port: messageChannel.port2 }, [
            messageChannel.port2,
        ]);

        // console.log(`Sent message to register message port with ID ${messageChannelPortID}.`);

        const data: {
            data: NBTSchemas.NBTSchemaTypes.SubChunkPrefix;
            offset: Vector3;
        }[] = await workerInstance.generateChunk(/* this.size, this.params,  */ messageChannelPortID, {
            x: Math.floor(this.position.x / 16),
            z: Math.floor(this.position.z / 16),
            dimension: this.params.dimension,
        });

        requestIdleCallback(
            (): void => {
                // this.initializeTerrain(data);
                // this.loadPlayerChanges();
                this.generateMeshes(data);
                this.loaded = true;

                // console.log(`Loaded chunk in ${performance.now() - start}ms`);
            },
            { timeout: 1000 }
        );
    }

    // /**
    //  * Initializes the terrain data
    //  */
    // initializeTerrain(
    //     data: {
    //         data: NBTSchemas.NBTSchemaTypes.SubChunkPrefix;
    //         offset: Vector3;
    //     }[]
    // ) {
    //     const blockTypeF
    //     this.data = [];

    //     for (let x = 0; x < 16; x++) {
    //         const slice: InstanceData[][] = [];
    //         for (let y = -512; y < 512; y++) {
    //             const row: InstanceData[] = [];
    //             for (let z = 0; z < 16; z++) {
    //                 const subChunk = data.find((chunk) => chunk.offset.y === Math.floor(y / 16));
    //                 row.push({
    //                     block: subChunk ? data.find [x]![y]![z]! : BlockTyp,
    //                     instanceIds: [],
    //                 });
    //             }
    //             slice.push(row);
    //         }
    //         this.data.push(slice);
    //     }
    // }

    // /**
    //  * Loads player changes from the data store
    //  */
    // loadPlayerChanges() {
    //     for (let x = 0; x < this.size.width; x++) {
    //         for (let y = 0; y < this.size.height; y++) {
    //             for (let z = 0; z < this.size.width; z++) {
    //                 // Overwrite with value in data store if it exists
    //                 if (this.dataStore.contains(this.position.x, this.position.z, x, y, z)) {
    //                     const blockId = this.dataStore.get(this.position.x, this.position.z, x, y, z)!;
    //                     // console.log(`Overwriting block at ${x}, ${y}, ${z} to ${blockId}`);
    //                     this.setBlockId(x, y, z, blockId);
    //                 }
    //             }
    //         }
    //     }
    // }

    generateMeshes(chunks: { data: NBTSchemas.NBTSchemaTypes.SubChunkPrefix; offset: Vector3 }[]): void {
        this.clear();

        const subChunkSize: Vector3 = { x: 16, y: 16, z: 16 };

        for (const subChunk of chunks) {
            const blockTypeFactory = new BlockTypeFactory();
            // const maxCount = this.size.width * this.size.width * this.size.height;

            // Create lookup table where key is palette index
            const blocks: Partial<Record<number, BlockType>> = {};
            // const blockIDValues = Object.values(BlockID).filter((value) => typeof value === "number") as BlockID[];

            for (const [key, blockDetails] of Object.entries(subChunk.data.value.layers.value.value[0]!.palette.value)) {
                // const block = BlockFactory.getBlock(blockId);
                // TO-DO: Add support for block states.
                const block: BlockType = blockTypeFactory.get(blockDetails.value.name.value, {
                    maxMeshInstances: 16 * 16 * 64,
                });
                // const blockGeometry = block.geometry;

                // const mesh = new THREE.InstancedMesh(
                //     blockGeometry === RenderGeometry.Cube ? geometry : crossGeometry,
                //     this.wireframeMode ? new THREE.MeshBasicMaterial({ wireframe: true }) : block.material,
                //     maxCount
                // );

                // mesh.name = block.constructor.name;
                // mesh.count = 0;
                // mesh.castShadow = !block.canPassThrough;
                // mesh.receiveShadow = true;
                // mesh.matrixAutoUpdate = false;
                blocks[Number(key)] = block;
            }

            for (let x = 0; x < subChunkSize.x; x++) {
                for (let y = 0; y < subChunkSize.y; y++) {
                    for (let z = 0; z < subChunkSize.z; z++) {
                        const block = subChunk.data.value.layers.value.value[0]!.block_indices.value.value[offsetToChunkBlockIndex({ x, y, z })];
                        if (block === undefined) continue;
                        const blockType = blocks[block];
                        if (!blockType) continue;

                        if (blockType.typeID === "minecraft:air") {
                            continue;
                        }

                        const mesh = blockType.mesh;

                        if (!mesh) {
                            continue;
                        }

                        const actualChunkY: number = subChunk.offset.y + y;

                        if (block && !this.isBlockObscured(x, actualChunkY, z)/*  && !this.isBorderBlock(x, actualChunkY, z) */) {
                            if (blockType.geometryType === "minecraft:geometry.full_block") {
                                const instanceId = mesh.count++;
                                this.setBlockInstanceIds(x, actualChunkY, z, [instanceId]);

                                const matrix = new THREE.Matrix4();
                                matrix.setPosition(x + 0.5, actualChunkY + 0.5, z + 0.5);
                                mesh.setMatrixAt(instanceId, matrix);
                            } else if (blockType.geometryType == "minecraft:geometry.cross_texture") {
                                const instanceId1 = mesh.count++;
                                const instanceId2 = mesh.count++;
                                this.setBlockInstanceIds(x, actualChunkY, z, [instanceId1, instanceId2]);

                                const matrix1 = new THREE.Matrix4();
                                matrix1.makeRotationY(Math.PI / 4);
                                matrix1.setPosition(x + 0.5, actualChunkY + 0.5, z + 0.5);
                                mesh.setMatrixAt(instanceId1, matrix1);

                                const matrix2 = new THREE.Matrix4();
                                matrix2.makeRotationY(-Math.PI / 4);
                                matrix2.setPosition(x + 0.5, actualChunkY + 0.5, z + 0.5);
                                mesh.setMatrixAt(instanceId2, matrix2);
                            }
                        }
                    }
                }
            }

            // Add meshes to group
            for (const block of Object.values(blocks)) {
                if (block?.mesh) {
                    this.add(block.mesh);
                }
            }
        }
    }

    setBlock(x: number, y: number, z: number, blockType: BlockType): void {
        if (this.inBounds(x, y, z)) {
            let subChunk = this.data[Math.floor(y / 16)];
            if (!subChunk) {
                subChunk = this.data[Math.floor(y / 16)] = {
                    data: {
                        type: "compound",
                        value: {
                            layerCount: { ...this.data[0]!.data.value.layerCount },
                            layers: {
                                type: "list",
                                value: {
                                    type: "compound",
                                    value: this.data[0]!.data.value.layers.value.value.map(
                                        () =>
                                            ({
                                                block_indices: {
                                                    type: "list",
                                                    value: {
                                                        type: "int",
                                                        value: new Array(4096).fill(0),
                                                    },
                                                },
                                                palette: {
                                                    type: "compound",
                                                    value: {
                                                        0: {
                                                            type: "compound",
                                                            value: {
                                                                name: {
                                                                    type: "string",
                                                                    value: "minecraft:air",
                                                                },
                                                                states: {
                                                                    type: "compound",
                                                                    value: {},
                                                                },
                                                                version: this.data[0]!.data.value.layers.value.value[0]!.palette.value[0]!.value.version,
                                                            },
                                                        },
                                                    },
                                                },
                                                storageVersion: this.data[0]!.data.value.layers.value.value[0]!.storageVersion,
                                            } as const satisfies NBTSchemas.NBTSchemaTypes.SubChunkPrefixLayer["value"])
                                    ),
                                },
                            },
                            version: this.data[0]!.data.value.version,
                            subChunkIndex: {
                                type: "byte",
                                value: Math.floor(y / 16),
                            },
                        },
                    },
                    offset: {
                        ...this.data[0]!.offset,
                        y: Math.floor(y / 16) * 16,
                    },
                    instancesIndices: Array<InstanceData>(4096).map((_v, i) => ({
                        get block(): NBTSchemas.NBTSchemaTypes.Block {
                            return subChunk!.data.value.layers.value.value[0]!.palette.value[
                                subChunk!.data.value.layers.value.value[0]!.block_indices.value.value![i]!
                            ]!;
                        },
                        instanceIds: [],
                    })),
                };
            }
            if (
                !Object.values(subChunk.data.value.layers.value.value[0]!.palette.value).some(
                    (p) => p.value.name.value === blockType.typeID && testForObjectExtension(p.value.states.value, blockType.states.value)
                )
            ) {
                const nextIndex: number =
                    Object.keys(subChunk.data.value.layers.value.value[0]!.palette.value).reduce((value: number, key: string): number => {
                        if (Number(key) > value) {
                            return Number(key);
                        }
                        return value;
                    }, 0) + 1;
                subChunk.data.value.layers.value.value[0]!.palette.value[nextIndex] = {
                    type: "compound",
                    value: {
                        name: {
                            type: "string",
                            value: blockType.typeID,
                        },
                        states: {
                            type: "compound",
                            value: blockType.states.value,
                        },
                        version: this.data[0]!.data.value.layers.value.value[0]!.palette.value[0]!.value.version,
                    },
                };
            }
            subChunk.data.value.layers.value.value[0]!.block_indices.value.value![offsetToChunkBlockIndex({ x, y: y - Math.floor(y / 16) * 16, z })]! = Number(
                Object.entries(subChunk.data.value.layers.value.value[0]!.palette.value).find(
                    ([_k, p]) => p.value.name.value === blockType.typeID && testForObjectExtension(p.value.states.value, blockType.states.value)
                )![0]
            );
        }
    }

    /**
     * Gets the block data at (x, y, z) for this chunk
     */
    getBlock(x: number, y: number, z: number): InstanceData | null {
        if (this.inBounds(x, y, z) && this.data.length > 0) {
            let subChunk = this.data[Math.floor(y / 16)];
            if (!subChunk) {
                subChunk = this.data[Math.floor(y / 16)] = {
                    data: {
                        type: "compound",
                        value: {
                            layerCount: { ...this.data[0]!.data.value.layerCount },
                            layers: {
                                type: "list",
                                value: {
                                    type: "compound",
                                    value: this.data[0]!.data.value.layers.value.value.map(
                                        () =>
                                            ({
                                                block_indices: {
                                                    type: "list",
                                                    value: {
                                                        type: "int",
                                                        value: new Array(4096).fill(0),
                                                    },
                                                },
                                                palette: {
                                                    type: "compound",
                                                    value: {
                                                        0: {
                                                            type: "compound",
                                                            value: {
                                                                name: {
                                                                    type: "string",
                                                                    value: "minecraft:air",
                                                                },
                                                                states: {
                                                                    type: "compound",
                                                                    value: {},
                                                                },
                                                                version: this.data[0]!.data.value.layers.value.value[0]!.palette.value[0]!.value.version,
                                                            },
                                                        },
                                                    },
                                                },
                                                storageVersion: this.data[0]!.data.value.layers.value.value[0]!.storageVersion,
                                            } as const satisfies NBTSchemas.NBTSchemaTypes.SubChunkPrefixLayer["value"])
                                    ),
                                },
                            },
                            version: this.data[0]!.data.value.version,
                            subChunkIndex: {
                                type: "byte",
                                value: Math.floor(y / 16),
                            },
                        },
                    },
                    offset: {
                        ...this.data[0]!.offset,
                        y: Math.floor(y / 16) * 16,
                    },
                    instancesIndices: Array<InstanceData>(4096).map((_v, i) => ({
                        get block(): NBTSchemas.NBTSchemaTypes.Block {
                            return subChunk!.data.value.layers.value.value[0]!.palette.value[
                                subChunk!.data.value.layers.value.value[0]!.block_indices.value.value![i]!
                            ]!;
                        },
                        instanceIds: [],
                    })),
                };
            }
            return subChunk.instancesIndices![offsetToChunkBlockIndex({ x, y: y - Math.floor(y / 16) * 16, z })]!;
        } else {
            return null;
        }
    }

    /**
     * Adds a new block at (x, y, z) for this chunk
     */
    addBlock(x: number, y: number, z: number, blockType: BlockType) {
        // Safety check that we aren't adding a block for one that already exists
        if (this.getBlock(x, y, z)?.block.value.name.value === "minecraft:air") {
            this.setBlock(x, y, z, blockType);
            this.addBlockInstance(x, y, z);
            this.dataStore.set(this.position.x, this.position.z, x, y, z, blockType);
        }
    }

    /**
     * Removes the block at (x, y, z)
     */
    removeBlock(x: number, y: number, z: number) {
        // console.log(`Removing block at ${x}, ${y}, ${z}`);
        const block = this.getBlock(x, y, z);
        if (block && block.block.value.name.value !== "minecraft:air") {
            // this.playBlockSound(block.block);
            this.deleteBlockInstance(x, y, z);
            this.setBlock(x, y, z, this.blockTypeFactory.get("minecraft:air"));
            this.dataStore.set(this.position.x, this.position.z, x, y, z, this.blockTypeFactory.get("minecraft:air"));
        }
    }

    async playBlockSound(blockId: BlockID) {
        // switch (blockId) {
        //     case BlockID.Grass:
        //     case BlockID.Dirt:
        //     case BlockID.Leaves:
        //     case BlockID.TallGrass:
        //     case BlockID.FlowerDandelion:
        //     case BlockID.FlowerRose:
        //         audioManager.play("dig.grass");
        //         break;
        //     case BlockID.OakLog:
        //         audioManager.play("dig.wood");
        //         break;
        //     default:
        //         audioManager.play("dig.stone");
        //         break;
        // }
    }

    /**
     * Creates a new instance for the block at (x, y, z)
     */
    addBlockInstance(x: number, y: number, z: number) {
        const block = this.getBlock(x, y, z);

        // If the block is not air and doesn't have an instance id, create a new instance
        if (block && block.block.value.name.value !== "minecraft:air" && block.instanceIds.length === 0) {
            const blockClass = this.blockTypeFactory.get(block.block.value.name.value);
            const mesh = this.children.find((instanceMesh) => instanceMesh.name === blockClass.constructor.name) as THREE.InstancedMesh;

            if (mesh) {
                // this.playBlockSound(block.block);
                if (blockClass.geometryType === "minecraft:geometry.full_block") {
                    const instanceId = mesh.count++;
                    this.setBlockInstanceIds(x, y, z, [instanceId]);

                    // Update the appropriate instanced mesh and re-compute the bounding sphere so raycasting works
                    const matrix = new THREE.Matrix4();
                    matrix.setPosition(x + 0.5, y + 0.5, z + 0.5);
                    mesh.setMatrixAt(instanceId, matrix);
                    mesh.instanceMatrix.needsUpdate = true;
                    mesh.computeBoundingSphere();
                } else if (blockClass.geometryType === "minecraft:geometry.cross_texture") {
                    const instanceId1 = mesh.count++;
                    const instanceId2 = mesh.count++;
                    this.setBlockInstanceIds(x, y, z, [instanceId1, instanceId2]);

                    const matrix1 = new THREE.Matrix4();
                    matrix1.makeRotationY(Math.PI / 4);
                    matrix1.setPosition(x + 0.5, y + 0.5, z + 0.5);
                    mesh.setMatrixAt(instanceId1, matrix1);

                    const matrix2 = new THREE.Matrix4();
                    matrix2.makeRotationY(-Math.PI / 4);
                    matrix2.setPosition(x + 0.5, y + 0.5, z + 0.5);
                    mesh.setMatrixAt(instanceId2, matrix2);

                    mesh.instanceMatrix.needsUpdate = true;
                    mesh.computeBoundingSphere();
                }
            }
        }
    }

    /**
     * Removes the mesh instance associated with `block` by swapping it with the last instance and decrementing instance count
     */
    deleteBlockInstance(x: number, y: number, z: number) {
        const block = this.getBlock(x, y, z);

        if (block?.block.value.name.value === "minecraft:air" || !block?.instanceIds.length) {
            return;
        }

        // Get the mesh of the block
        const mesh = this.children.find((instanceMesh) => instanceMesh.name === block.block.value.name.value) as THREE.InstancedMesh;

        // We can't remove instances directly, so we need to swap each with the last instance and decrement count by 1
        block.instanceIds.forEach((instanceId) => {
            const lastMatrix = new THREE.Matrix4();
            mesh.getMatrixAt(mesh.count - 1, lastMatrix);

            // Also need to get block coords of instance to update instance id of the block
            const lastBlockCoords = new THREE.Vector3();
            lastBlockCoords.setFromMatrixPosition(lastMatrix);
            this.setBlockInstanceIds(Math.floor(lastBlockCoords.x), Math.floor(lastBlockCoords.y), Math.floor(lastBlockCoords.z), [instanceId]);

            // Swap transformation matrices
            mesh.setMatrixAt(instanceId, lastMatrix);

            // Decrement instance count
            mesh.count--;

            // Notify the instanced mesh we updated the instance matrix
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        });

        this.setBlockInstanceIds(x, y, z, []);
    }

    /**
     * Sets the block instance data at (x, y, z) for this chunk
     */
    setBlockInstanceIds(x: number, y: number, z: number, instanceIds: number[]): void {
        if (this.inBounds(x, y, z) && this.data.length > 0) {
            let subChunk = this.data[Math.floor(y / 16)];
            if (!subChunk) {
                subChunk = this.data[Math.floor(y / 16)] = {
                    data: {
                        type: "compound",
                        value: {
                            layerCount: { ...this.data[0]!.data.value.layerCount },
                            layers: {
                                type: "list",
                                value: {
                                    type: "compound",
                                    value: this.data[0]!.data.value.layers.value.value.map(
                                        () =>
                                            ({
                                                block_indices: {
                                                    type: "list",
                                                    value: {
                                                        type: "int",
                                                        value: new Array(4096).fill(0),
                                                    },
                                                },
                                                palette: {
                                                    type: "compound",
                                                    value: {
                                                        0: {
                                                            type: "compound",
                                                            value: {
                                                                name: {
                                                                    type: "string",
                                                                    value: "minecraft:air",
                                                                },
                                                                states: {
                                                                    type: "compound",
                                                                    value: {},
                                                                },
                                                                version: this.data[0]!.data.value.layers.value.value[0]!.palette.value[0]!.value.version,
                                                            },
                                                        },
                                                    },
                                                },
                                                storageVersion: this.data[0]!.data.value.layers.value.value[0]!.storageVersion,
                                            } as const satisfies NBTSchemas.NBTSchemaTypes.SubChunkPrefixLayer["value"])
                                    ),
                                },
                            },
                            version: this.data[0]!.data.value.version,
                            subChunkIndex: {
                                type: "byte",
                                value: Math.floor(y / 16),
                            },
                        },
                    },
                    offset: {
                        ...this.data[0]!.offset,
                        y: Math.floor(y / 16) * 16,
                    },
                    instancesIndices: Array<InstanceData>(4096).map((_v, i) => ({
                        get block(): NBTSchemas.NBTSchemaTypes.Block {
                            return subChunk!.data.value.layers.value.value[0]!.palette.value[
                                subChunk!.data.value.layers.value.value[0]!.block_indices.value.value![i]!
                            ]!;
                        },
                        instanceIds: [],
                    })),
                };
            }
            subChunk.instancesIndices[offsetToChunkBlockIndex({ x, y: y - Math.floor(y / 16) * 16, z })]!.instanceIds = instanceIds;
        }
    }

    /**
     * Checks if the given coordinates are within the world bounds
     */
    inBounds(x: number, y: number, z: number): boolean {
        // return x >= 0 && x < this.size.width && y >= 0 && y < this.size.height && z >= 0 && z < this.size.width;
        return x >= 0 && x < 16 && y >= -512 && y < 512 && z >= 0 && z < 16;
    }

    isBlockObscured(x: number, y: number, z: number): boolean {
        const up = this.getBlock(x, y + 1, z);
        const down = this.getBlock(x, y - 1, z);
        const left = this.getBlock(x - 1, y, z);
        const right = this.getBlock(x + 1, y, z);
        const front = this.getBlock(x, y, z + 1);
        const back = this.getBlock(x, y, z - 1);

        const getBlockClass = (blockType: NBTSchemas.NBTSchemaTypes.Block) => this.blockTypeFactory.get(blockType.value.name.value);

        // If any of the block's sides are exposed, it's not obscured
        if (
            !up ||
            !down ||
            !left ||
            !right ||
            !front ||
            !back ||
            getBlockClass(up.block).transparent ||
            getBlockClass(down.block).transparent ||
            getBlockClass(left.block).transparent ||
            getBlockClass(right.block).transparent ||
            getBlockClass(front.block).transparent ||
            getBlockClass(back.block).transparent
        ) {
            return false;
        }

        return true;
    }

    isBorderBlock(x: number, y: number, z: number): boolean {
        const up = this.getBlock(x, y + 1, z);
        const upBlockClass = up ? this.blockTypeFactory.get(up.block.value.name.value) : null;
        if (upBlockClass?.hasCollision) {
            return false;
        }

        return x === 0 || x === 15 || y === 0 || y - Math.floor(y / 16) * 16 === 15 || z === 0 || z === 15;
    }

    disposeChildren() {
        this.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
            }
        });
        this.clear();
    }
}

export const workerInstance: {
    readonly [endpointSymbol]: Worker;
} & Remote<typeof import("./chunkWorker")> = new ComlinkWorker<typeof import("./chunkWorker")>(new URL("./chunkWorker", import.meta.url), {
    type: "classic",
});

