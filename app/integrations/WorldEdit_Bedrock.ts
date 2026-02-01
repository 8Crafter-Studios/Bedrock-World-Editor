import { entryContentTypeToFormatMap, generateChunkKeyFromIndices, toLong, type Dimension, type NBTSchemas } from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import type { Integration } from ".";

type SetBiomeData = [
    `wedit:biome,minecraft:${Dimension},${number}_${number}_${number}`,
    {
        biomes: number[];
        palette: number[];
    },
];

const MIN_SUBCHUNK_INDEX = -4;

export default {
    id: "WorldEdit_Bedrock",
    name: "WorldEdit Bedrock",
    author: "SIsilicon",
    description: "A port of the original WorldEdit mod for Minecraft: Java Edition.",
    links: {
        Documentation: { url: "https://worldedit-be-docs.readthedocs.io/en/stable/" },
        Discord: { url: "https://discord.gg/Tb7FW9TB4s" },
        GitHub: { url: "https://github.com/SIsilicon/WorldEdit-BE" },
        ModBay: { url: "https://modbay.org/mods/629-worldedit-be.html" },
        CurseForge: { url: "https://www.curseforge.com/minecraft-bedrock/scripts/worldedit-be-addon" },
        MCPEDL: { url: "https://mcpedl.com/worldedit-be-addon/" },
    },
    autoApplyActions: [
        {
            id: "command_setbiome_legacy",
            name: "setbiome Command (Legacy Scoreboard Values)",
            description: "WorldEdit_Bedrock",
            waitToCheckUntilWorldLoaded: false,
            async checkIfApplicable(tab: TabManagerTab): Promise<boolean> {
                if (tab.type !== "world" && tab.type !== "leveldb") return false;
                if (!tab.db) return false;
                await tab.awaitDBOpen;
                if (!tab.db?.isOpen()) throw new Error("Database is not open.");
                const data = await tab.db.get("scoreboard");
                if (!data) return false;
                const parsedData = await NBT.parse(data);
                const scoreboard: NBTSchemas.NBTSchemaTypes.Scoreboard = parsedData.parsed as unknown as NBTSchemas.NBTSchemaTypes.Scoreboard;
                if (!scoreboard?.value?.Objectives?.value?.value) return false;
                const gametestDBObjective = scoreboard.value.Objectives.value.value.find((o) => o.Name.value === "GAMETEST_DB");
                if (!gametestDBObjective) return false;
                const scoreboardIds = new Set<bigint>(gametestDBObjective.Scores.value.value.map((s) => toLong(s.ScoreboardId.value)));
                for (const entry of scoreboard.value.Entries.value.value) {
                    if (scoreboardIds.has(toLong(entry.ScoreboardId.value))) {
                        if (!entry.FakePlayerName?.value) continue;
                        let commandData: SetBiomeData;
                        try {
                            commandData = JSON.parse(JSON.parse(`"${entry.FakePlayerName.value}"`)) as SetBiomeData;
                        } catch (e) {
                            console.error(
                                "[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::checkIfApplicable] Invalid setbiome command data for entry:",
                                entry,
                                "error:",
                                e
                            );
                            continue;
                        }
                        if (!commandData[0].startsWith("wedit:biome,")) continue;
                        return true;
                    }
                }
                return false;
            },
            async apply(tab: TabManagerTab): Promise<void> {
                if (tab.type !== "world" && tab.type !== "leveldb") return;
                if (!tab.db) return;
                await tab.awaitDBOpen;
                if (!tab.db?.isOpen()) throw new Error("Database is not open.");
                const data = await tab.db.get("scoreboard");
                if (!data) throw new Error("Scoreboard data not found.");
                const parsedData = await NBT.parse(data);
                const scoreboard: NBTSchemas.NBTSchemaTypes.Scoreboard = parsedData.parsed as unknown as NBTSchemas.NBTSchemaTypes.Scoreboard;
                if (!scoreboard?.value?.Objectives?.value?.value) throw new Error("Scoreboard objectives not found.");
                const gametestDBObjective = scoreboard.value.Objectives.value.value.find((o) => o.Name.value === "GAMETEST_DB");
                if (!gametestDBObjective) throw new Error("GAMETEST_DB objective not found.");
                const scoreboardIds = new Set<bigint>(gametestDBObjective.Scores.value.value.map((s) => toLong(s.ScoreboardId.value)));
                let scoreboardModified = false;
                for (const entry of scoreboard.value.Entries.value.value) {
                    if (scoreboardIds.has(toLong(entry.ScoreboardId.value))) {
                        if (!entry.FakePlayerName?.value) continue;
                        let commandData: SetBiomeData;
                        try {
                            commandData = JSON.parse(JSON.parse(`"${entry.FakePlayerName.value}"`)) as SetBiomeData;
                        } catch (e) {
                            console.error(
                                "[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Invalid setbiome command data for entry:",
                                entry,
                                "error:",
                                e
                            );
                            continue;
                        }
                        if (!commandData[0].startsWith("wedit:biome,")) continue;
                        const [, dimension, coordinates] = commandData[0].split(",") as [
                            id: "wedit:biome",
                            dimension: `minecraft:${Dimension}`,
                            coordinates: `${number}_${number}_${number}`,
                        ];
                        const [x, y, z] = coordinates.split("_").map(Number) as [x: number, y: number, z: number];
                        const data3dKey: Buffer<ArrayBuffer> = generateChunkKeyFromIndices(
                            {
                                dimension: dimension.split(":")[1] as Dimension,
                                x,
                                z,
                                // TODO: Check if the coordinates are block or chunk coordinates.
                                // x: x >> 4,
                                // z: z >> 4,
                            },
                            "Data3D"
                        );
                        const rawData3d = await tab.db.get(data3dKey);
                        if (!rawData3d) {
                            console.warn(
                                "[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Skipping setbiome command entry. Data3D key not found for entry:",
                                entry
                            );
                            continue;
                        }
                        // TODO: Make this dynamic determine the index offset so it works with worlds with custom height limits.
                        const data3dValue: NBTSchemas.NBTSchemaTypes.Data3D = entryContentTypeToFormatMap.Data3D.parse(rawData3d);
                        const biome = data3dValue.value.biomes.value.value[y - MIN_SUBCHUNK_INDEX];
                        if (!biome) {
                            console.warn(
                                `[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Skipping setbiome command entry. Data3D for entry is missing biome data at index ${y - MIN_SUBCHUNK_INDEX} (subchunk index: ${y}). entry:`,
                                entry
                            );
                            continue;
                        }
                        const paletteMapping = new Map<number, number>();
                        for (let i = 0; i < commandData[1].palette.length; i++) {
                            const biomeId: number | undefined = commandData[1].palette[i];
                            if (biomeId === undefined) continue;
                            const existingInstanceIndex: number = biome.palette.value.value.indexOf(biomeId);
                            if (existingInstanceIndex !== -1) {
                                paletteMapping.set(i, existingInstanceIndex);
                                continue;
                            }
                            paletteMapping.set(i, biome.palette.value.value.push(biomeId) - 1);
                        }
                        for (let i = 0; i < biome.values.value.value.length; i++) {
                            const paletteIndex: number | undefined = commandData[1].biomes[i];
                            if (!paletteIndex) continue; // This skipping 0 is intentional.
                            const resolvedPaletteIndex: number | undefined = paletteMapping.get(paletteIndex - 1);
                            if (resolvedPaletteIndex === undefined) {
                                console.warn(
                                    `[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Skipping setbiome command entry block index. The paletteMapping has no mapping for index ${paletteIndex}. entry:`,
                                    entry,
                                    "block index:",
                                    i,
                                    "paletteMapping:",
                                    paletteMapping
                                );
                                continue;
                            }
                            biome.values.value.value[i] = resolvedPaletteIndex;
                        }
                        const valueSet = new Set<number>(biome.values.value.value);
                        const cleanupMapping = new Map<number, number>();
                        let currentPaletteIndexOffset = 0;
                        for (let i = 0; i < biome.palette.value.value.length; i++) {
                            const biomeId: number | undefined = biome.palette.value.value[i + currentPaletteIndexOffset];
                            if (biomeId === undefined) continue;
                            if (valueSet.has(i)) continue;
                            biome.palette.value.value.splice(i + currentPaletteIndexOffset, 1);
                            currentPaletteIndexOffset--;
                            cleanupMapping.set(i, i + currentPaletteIndexOffset);
                        }
                        for (let i = 0; i < biome.values.value.value.length; i++) {
                            const paletteIndex: number | undefined = biome.values.value.value[i];
                            if (paletteIndex === undefined) continue;
                            const resolvedPaletteIndex: number = cleanupMapping.get(paletteIndex) ?? paletteIndex;
                            biome.values.value.value[i] = resolvedPaletteIndex;
                        }
                        await tab.db.put(data3dKey, entryContentTypeToFormatMap.Data3D.serialize(data3dValue));
                        tab.setLevelDBIsModified(true);
                        scoreboardModifications: {
                            const entryIndex: number = scoreboard.value.Entries.value.value.indexOf(entry);
                            if (entryIndex === -1) break scoreboardModifications;
                            scoreboardModified = true;
                            scoreboard.value.Entries.value.value.splice(entryIndex, 1);
                        }
                    }
                }
                if (scoreboardModified) {
                    // HACK: Look into why the scoreboard type is not assignable to the NBT.NBT type.
                    await tab.db.put("scoreboard", NBT.writeUncompressed({ name: "", ...scoreboard } as unknown as NBT.NBT, "little"));
                }
                // TODO
            },
        },
    ],
} satisfies Integration;
