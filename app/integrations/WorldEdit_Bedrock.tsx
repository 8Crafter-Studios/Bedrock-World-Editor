import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef } from "preact/compat";
import { entryContentTypeToFormatMap, generateChunkKeyFromIndices, toLong, type Dimension, type NBTSchemas } from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import {
    INTEGRATION_BUTTON_LINK_ALLOWED_UNPROMPTED_PROTOCOLS,
    INTEGRATION_BUTTON_LINK_WEBSITE_PROTOCOLS,
    type Integration,
    type IntegrationMenuProps,
} from ".";
import { preloadedIcons } from "../app";
import { app, clipboard, dialog, shell } from "@electron/remote";
import { parse } from "path";

type LegacyScoreboardSetBiomeData = [
    `wedit:biome,minecraft:${Dimension},${number}_${number}_${number}`,
    {
        biomes: number[];
        palette: number[];
    },
];

interface Action_Command_setbiome_Legacy_TargetedChunkCountData {
    total: number;
    valid: number;
    invalid: number;
    errorTypes: {
        data3dKeyNotFound: number;
        data3dMissingBiomeDataAtIndex: number;
    };
}

/**
 *
 * @param tab The tab to get the targeted chunk count from.
 * @param signal The signal to abort the operation if needed.
 * @returns The number of targeted chunks.
 *
 * @throws {TypeError} If the tab type is invalid.
 * @throws {Error} If the database is not open.
 * @throws {Error} If the scoreboard data is not found.
 * @throws {Error} If the scoreboard objectives are not found.
 * @throws {Error} If the GAMETEST_DB objective is not found.
 * @throws {AbortError | DOMException} If the signal is aborted.
 * @throws {unknown} If an error occurs.
 */
async function action_command_setbiome_legacy_getTargetedChunkCount(
    tab: TabManagerTab,
    signal?: AbortSignal
): Promise<Action_Command_setbiome_Legacy_TargetedChunkCountData> {
    if (tab.type !== "world" && tab.type !== "leveldb") throw new TypeError("Invalid tab type.");
    if (!tab.db) throw new Error("Database is not open.");
    await tab.awaitDBOpen;
    signal?.throwIfAborted();
    if (!tab.db?.isOpen()) throw new Error("Database is not open.");
    const data = await tab.db.get("scoreboard");
    signal?.throwIfAborted();
    if (!data) throw new Error("Scoreboard data not found.");
    const parsedData = await NBT.parse(data);
    signal?.throwIfAborted();
    const scoreboard: NBTSchemas.NBTSchemaTypes.Scoreboard = parsedData.parsed as unknown as NBTSchemas.NBTSchemaTypes.Scoreboard;
    if (!scoreboard?.value?.Objectives?.value?.value) throw new Error("Scoreboard objectives not found.");
    const gametestDBObjective = scoreboard.value.Objectives.value.value.find((o) => o.Name.value === "GAMETEST_DB");
    if (!gametestDBObjective) throw new Error("GAMETEST_DB objective not found.");
    const scoreboardIds = new Set<bigint>(gametestDBObjective.Scores.value.value.map((s) => toLong(s.ScoreboardId.value)));
    const targetedChunkCountData: Action_Command_setbiome_Legacy_TargetedChunkCountData = {
        total: 0,
        valid: 0,
        invalid: 0,
        errorTypes: {
            data3dKeyNotFound: 0,
            data3dMissingBiomeDataAtIndex: 0,
        },
    };
    for (const entry of [...scoreboard.value.Entries.value.value]) {
        if (scoreboardIds.has(toLong(entry.ScoreboardId.value))) {
            if (!entry.FakePlayerName?.value) continue;
            let commandData: LegacyScoreboardSetBiomeData;
            try {
                commandData = JSON.parse(JSON.parse(`"${entry.FakePlayerName.value}"`)) as LegacyScoreboardSetBiomeData;
            } catch (e) {
                console.error(
                    "[integration::WorldEdit_Bedrock::__INTERNAL__::action_command_setbiome_legacy_getTargetedChunkCount] Invalid setbiome command data for entry:",
                    entry,
                    "error:",
                    e
                );
                continue;
            }
            if (!commandData[0].startsWith("wedit:biome,")) continue;
            targetedChunkCountData.total++;
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
                },
                "Data3D"
            );
            const rawData3d = await tab.db.get(data3dKey);
            if (!rawData3d) {
                targetedChunkCountData.errorTypes.data3dKeyNotFound++;
                continue;
            }
            // TODO: Make this dynamic determine the index offset so it works with worlds with custom height limits.
            const data3dValue: NBTSchemas.NBTSchemaTypes.Data3D = entryContentTypeToFormatMap.Data3D.parse(rawData3d);
            const biome = data3dValue.value.biomes.value.value[y - MIN_SUBCHUNK_INDEX];
            if (!biome) {
                targetedChunkCountData.errorTypes.data3dMissingBiomeDataAtIndex++;
                continue;
            }
            targetedChunkCountData.valid++;
        }
    }
    targetedChunkCountData.invalid = targetedChunkCountData.total - targetedChunkCountData.valid;
    return targetedChunkCountData;
}

/**
 * @todo This should be determined using the `LevelChunkMetaDataDictionary`.
 */
const MIN_SUBCHUNK_INDEX = -4;

const thisIntegration = {
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
            description:
                "Applies biome changes from the setbiome command from when the WorldEdit Bedrock add-on saved the biome change data to the scoreboard.",
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
                        let commandData: LegacyScoreboardSetBiomeData;
                        try {
                            commandData = JSON.parse(JSON.parse(`"${entry.FakePlayerName.value}"`)) as LegacyScoreboardSetBiomeData;
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
                for (const entry of [...scoreboard.value.Entries.value.value]) {
                    if (scoreboardIds.has(toLong(entry.ScoreboardId.value))) {
                        if (!entry.FakePlayerName?.value) continue;
                        let commandData: LegacyScoreboardSetBiomeData;
                        try {
                            commandData = JSON.parse(JSON.parse(`"${entry.FakePlayerName.value}"`)) as LegacyScoreboardSetBiomeData;
                        } catch (e) {
                            console.error(
                                "[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Invalid setbiome command data for entry:",
                                entry,
                                "error:",
                                e
                            );
                            continue;
                        }
                        if (!commandData[0].startsWith("wedit:biome,")) {
                            // DEBUG: In production this should just continute without a console error.
                            console.error(
                                "[integration::WorldEdit_Bedrock::autoApplyActions::command_setbiome_legacy::apply] Invalid ID for setbiome command data for entry:",
                                entry,
                                'expected commandData[0] to start with "wedit:biome,"',
                                "commandData:",
                                commandData
                            );
                            continue;
                        }
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
                            const scoreboardId: bigint = toLong(entry.ScoreboardId.value);
                            const objectiveEntryIndex: number = gametestDBObjective.Scores.value.value.findIndex(
                                (s) => toLong(s.ScoreboardId.value) === scoreboardId
                            );
                            if (objectiveEntryIndex === -1) break scoreboardModifications;
                            gametestDBObjective.Scores.value.value.splice(objectiveEntryIndex, 1);
                        }
                    }
                }
                if (scoreboardModified) {
                    // HACK: Look into why the scoreboard type is not assignable to the NBT.NBT type.
                    // TSC: The ` as unknown as NBT.NBT` is temporary until it is figured out what is wrong with the type.
                    await tab.db.put("scoreboard", NBT.writeUncompressed({ name: "", ...scoreboard } as unknown as NBT.NBT, "little"));
                }
                // TODO
            },
        },
    ],
    async checkIfDetected(tab: TabManagerTab): Promise<boolean> {
        if (tab.type !== "world" && tab.type !== "leveldb") return false;
        if (!tab.db) return false;
        await tab.awaitDBOpen;
        if (!tab.db?.isOpen()) throw new Error("Database is not open.");
        dynamicPropertiesUUIDCheck: {
            const data = await tab.db.get("DynamicProperties");
            if (!data) break dynamicPropertiesUUIDCheck;
            let parsedData: { parsed: NBT.NBT; type: NBT.NBTFormat; metadata: NBT.Metadata };
            try {
                parsedData = await NBT.parse(data);
            } catch (e) {
                console.error(
                    "[integration::WorldEdit_Bedrock::checkIfDetected::dynamicPropertiesUUIDCheck] Failed to parse DynamicProperties NBT data. error:",
                    e
                );
                break dynamicPropertiesUUIDCheck;
            }
            const dynamicProperties: NBTSchemas.NBTSchemaTypes.DynamicProperties = parsedData.parsed as NBTSchemas.NBTSchemaTypes.DynamicProperties;
            const UUIDs = ["3cdb2ddf-662e-4f8f-a0a1-1293b91ccb2f"] as const;
            for (const UUID of UUIDs) {
                if (UUID in dynamicProperties.value) {
                    return true;
                }
            }
        }
        worldBehaviorPacksUUIDCheck: {
            break worldBehaviorPacksUUIDCheck; // TEMP
        }
        worldBehaviorPacksHistoryUUIDCheck: {
            break worldBehaviorPacksHistoryUUIDCheck; // TEMP
        }
        scoreboardCheck: {
            break scoreboardCheck; // TEMP
        }
        // TODO
        return false;
    },
    integrationMenu(this: unknown, props: IntegrationMenuProps): JSX.Element {
        if (props.tab.type !== "world" && props.tab.type !== "leveldb")
            return (
                <center>
                    <h2>ERROR: This integration menu does not support the {JSON.stringify(props.tab.type)} tab type.</h2>
                </center>
            );
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
                                                        shell.openExternal(url);
                                                        break;
                                                    case 1:
                                                        clipboard.writeText(url);
                                                        break;
                                                }
                                                return;
                                            }
                                            shell.openExternal(url);
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
        function NoApplicableActions(): JSX.Element {
            return (
                <center>
                    <h2>This integration has no applicable actions for this tab.</h2>
                </center>
            );
        }
        function ActionMenu_Command_setbiome_Legacy({
            targetedChunkCountData,
        }: {
            targetedChunkCountData: Action_Command_setbiome_Legacy_TargetedChunkCountData;
        }): JSX.Element {
            // TODO: Make this show more info about the biome changes, as seen in issue #17: https://github.com/8Crafter-Studios/Bedrock-World-Editor/issues/17
            const abortController: AbortController | null = currentAbortController;
            return (
                <>
                    <div style={{marginLeft: "1em"}}>
                        <h2>Biome Changes (Legacy)</h2>
                        <div style={{marginLeft: "1em"}}>
                            {(!!targetedChunkCountData.valid || !targetedChunkCountData.invalid) && (
                                <p>{targetedChunkCountData.valid} chunk(s) with pending biome changes</p>
                            )}
                            {!!targetedChunkCountData.invalid && (
                                <>
                                    <p>{targetedChunkCountData.invalid} chunk(s) with unapplicable pending biome changes</p>
                                    <ul>
                                        {...Object.entries(targetedChunkCountData.errorTypes).map(
                                            ([errorType, count]: [string, number]): false | JSX.Element =>
                                                !!count && (
                                                    <li>
                                                        {count} chunk(s) unapplicable due to an error of type {errorType}
                                                    </li>
                                                )
                                        )}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="genericRoundButton"
                        onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
                            if (!tablesContainerRef.current) return;
                            if (
                                dialog.showMessageBoxSync(getCurrentWindow(), {
                                    type: "info",
                                    title: "Bedrock World Editor",
                                    message: `This will apply the changes to ${targetedChunkCountData.total} chunk(s). Continue?`,
                                    buttons: ["Yes", "No"],
                                    noLink: true,
                                })
                            )
                                return;
                            event.currentTarget.blur();
                            event.currentTarget.disabled = true;
                            event.currentTarget.textContent = "Applying Changes...";
                            const action_command_setbiome_legacy = thisIntegration.autoApplyActions.find((a) => a.id === "command_setbiome_legacy")!;
                            await action_command_setbiome_legacy.apply(props.tab);
                            abortController?.signal.throwIfAborted();
                            {
                                const applicableActionsIndex: number = applicableActions.indexOf("command_setbiome_legacy");
                                if (applicableActionsIndex !== -1) applicableActions.splice(applicableActionsIndex, 1);
                            }
                            if (!loadingActions.includes("command_setbiome_legacy")) loadingActions.push("command_setbiome_legacy");
                            updateTablesContents();
                            action_command_setbiome_legacy.checkIfApplicable(props.tab).then(async (result: boolean): Promise<void> => {
                                abortController?.signal.throwIfAborted();
                                if (result) {
                                    applicableActions.push("command_setbiome_legacy");
                                    actionData.command_setbiome_legacy.targetedChunkCountData = await action_command_setbiome_legacy_getTargetedChunkCount(
                                        props.tab,
                                        abortController?.signal
                                    );
                                }
                                {
                                    const loadingActionsIndex: number = loadingActions.indexOf("command_setbiome_legacy");
                                    if (loadingActionsIndex !== -1) {
                                        loadingActions.splice(loadingActionsIndex, 1);
                                        if (!result && loadingActions.length === 0) updateTablesContents();
                                    }
                                    if (result) updateTablesContents();
                                }
                            });
                        }}
                    >
                        Apply Changes
                    </button>
                </>
            );
        }
        type ApplicableAction = "command_setbiome_legacy";
        const applicableActions: ApplicableAction[] = [];
        const loadingActions: ApplicableAction[] = ["command_setbiome_legacy"];
        const actionData = {
            command_setbiome_legacy: {
                targetedChunkCountData: undefined as Action_Command_setbiome_Legacy_TargetedChunkCountData | undefined,
            },
        } satisfies Partial<Record<ApplicableAction, Record<PropertyKey, unknown>>>;
        function updateTablesContents(): void {
            if (!tablesContainerRef.current) return;
            if (applicableActions.length === 0) {
                if (loadingActions.length === 0) {
                    render(null, tablesContainerRef.current);
                    render(<NoApplicableActions />, tablesContainerRef.current);
                    return;
                }
                return;
            }
            render(null, tablesContainerRef.current);
            render(
                <>
                    {...[
                        applicableActions.includes("command_setbiome_legacy") && (
                            <ActionMenu_Command_setbiome_Legacy targetedChunkCountData={actionData.command_setbiome_legacy.targetedChunkCountData} />
                        ),
                    ]
                        .filter(Boolean as unknown as (v: false | JSX.Element) => v is JSX.Element)
                        .flatMap((v: JSX.Element, i: number): JSX.Element | JSX.Element[] => (i === 0 ? v : [<hr />, v]))}
                </>,
                tablesContainerRef.current
            );
        }
        let currentAbortController: AbortController | null = null;
        useEffect((): (() => void) => {
            const abortController = (currentAbortController = new AbortController());
            applicableActions.length = 0;
            loadingActions.length = 0;
            loadingActions.push("command_setbiome_legacy");
            command_setbiome_legacy: {
                const action_command_setbiome_legacy = thisIntegration.autoApplyActions?.find((a) => a.id === "command_setbiome_legacy");
                if (!action_command_setbiome_legacy) {
                    const loadingActionsIndex: number = loadingActions.indexOf("command_setbiome_legacy");
                    if (loadingActionsIndex !== -1) loadingActions.splice(loadingActionsIndex, 1);
                    break command_setbiome_legacy;
                }
                action_command_setbiome_legacy.checkIfApplicable(props.tab).then(async (result: boolean): Promise<void> => {
                    abortController.signal.throwIfAborted();
                    if (result) {
                        applicableActions.push("command_setbiome_legacy");
                        actionData.command_setbiome_legacy.targetedChunkCountData = await action_command_setbiome_legacy_getTargetedChunkCount(
                            props.tab,
                            abortController.signal
                        );
                    }
                    {
                        const loadingActionsIndex: number = loadingActions.indexOf("command_setbiome_legacy");
                        if (loadingActionsIndex !== -1) {
                            loadingActions.splice(loadingActionsIndex, 1);
                            if (!result && loadingActions.length === 0) updateTablesContents();
                        }
                        if (result) updateTablesContents();
                    }
                });
            }
            return (): void => abortController.abort("Effect cleanup");
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
                            <img src={preloadedIcons.back} style={{ width: "15px", imageRendering: "pixelated" }} aria-hidden="true" />
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
                <div style="display: flex; flex-direction: column;">
                    <IntegrationLinks />
                </div>
                <div style="display: flex; flex-direction: column;" ref={tablesContainerRef}>
                    Loading integration actions...
                </div>
            </>
        );
    },
} satisfies Integration;

export default thisIntegration;
