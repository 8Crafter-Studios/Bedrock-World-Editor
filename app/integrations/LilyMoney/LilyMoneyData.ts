import NBT from "prismarine-nbt";

export const LILYMONEY_PACK_UUID = "9cde84d4-c9d8-499f-8ad4-2cd241cf9c64";
export const LILYMONEY_STORAGE_IDENTIFIER = "lilymoney:money_storage";
export const LILYMONEY_STRUCTURE_PREFIX = "structuretemplate_lilymoney:moneylog_";

import {
    emptyLilyMoneyNameDatabase,
    readLilyMoneyNameDatabase,

    type LilyMoneyNameDatabase,
} from "./LilyMoneyNames";

export type LilyMoneyDynamicPropertyNamespace =
    Record<string, unknown>;

type UnknownRecord =
    LilyMoneyDynamicPropertyNamespace;



import {
    decodeLilyMoneyRecords,
    type LilyMoneyRecord,
    type LilyMoneyRecordDecodeResult,
} from "./LilyMoneyRecords";


export interface LilyMoneyPropertySummary {
    key: string;
    category: string;
    type: string;
    preview: string;
    size: number | null;
}

export interface LilyMoneyStorageSummary {
    source: "sealed" | "active";
    sourceKey: string;

    identifier: string | null;

    shardIndex: number | null;
    recordCount: number | null;
    pageCount: number | null;

    firstRecordId: number | null;
    lastRecordId: number | null;

    firstTime: number | null;
    lastTime: number | null;

    dbFormat: number | null;
    recordFormat: number | null;
    dbKind: string | null;
    worldId: string | null;

    sealed: boolean | null;
    checksum: string | null;

    pageKeys: string[];
    pageCharacters: number;

    isExpectedActiveShard: boolean;

    properties: LilyMoneyPropertySummary[];

    records: LilyMoneyRecord[];

    recordDecodeErrors: string[];
    recordDecodeWarnings: string[];

    idsContinuous: boolean | null;

    checksumActual: string | null;
    checksumValid: boolean | null;

    pendingJobBatchStateRaw: string | null;
}

export interface LilyMoneyDiscoveryResult {
    worldNamespaceFound: boolean;

    worldProperties: LilyMoneyPropertySummary[];

    worldId: string | null;
    loggingEnabled: boolean | null;
    activeOpen: boolean | null;
    activeShardIndex: number | null;
    lastSealedRecordId: number | null;

    nameDatabaseChunkCount: number;

    pendingJobBatchStateFound: boolean;
    recoveryPropertyCount: number;

    structureKeys: string[];
    sealedStorages: LilyMoneyStorageSummary[];

    actorKeysScanned: number;
    activeStorages: LilyMoneyStorageSummary[];

    errors: string[];

    nameDatabase:
        LilyMoneyNameDatabase;
}

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value) && !Buffer.isBuffer(value);
}

function toNumber(value: unknown): number | null {
    if (
        typeof value === "number" &&
        Number.isSafeInteger(value)
    ) {
        return value;
    }

    if (typeof value === "bigint") {
        const result: number =
            Number(value);

        return Number.isSafeInteger(result)
            ? result
            : null;
    }

    if (
        typeof value === "string" &&
        /^-?\d+$/.test(value)
    ) {
        const result: number =
            Number(value);

        return Number.isSafeInteger(result)
            ? result
            : null;
    }

    return null;
}

function toBoolean(value: unknown): boolean | null {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    if (typeof value === "bigint") {
        return value !== 0n;
    }

    return null;
}

function toStringValue(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(
            value,
            (_key: string, item: unknown): unknown => {
                if (typeof item === "bigint") {
                    return `${item.toString()}n`;
                }

                if (Buffer.isBuffer(item)) {
                    return `<Buffer ${item.length} bytes>`;
                }

                return item;
            },
            2
        );
    } catch {
        return String(value);
    }
}

function getPropertyCategory(key: string): string {
    if (/^lilymoney:page_\d+$/.test(key)) {
        return "Record Page";
    }

    if (/^lilynames:nameDataBase(?:\d+)?$/.test(key) || key === "lilynames:nameDataBaseCount") {
        return "Name Database";
    }

    if (key === "lilymoney:job_batch_state_v1") {
        return "Pending Job Batches";
    }

    if (
        key.startsWith("lilymoney:moneylog_death_recovery") ||
        key.startsWith("lilymoney:moneylog_dead_entity_quarantine")
    ) {
        return "Recovery";
    }

    if (
        key === "lilymoney:world_id" ||
        key === "lilymoney:transaction_logging" ||
        key === "lilymoney:moneylog_active_open_v1" ||
        key === "lilymoney:moneylog_active_shard_v1" ||
        key === "lilymoney:moneylog_last_sealed_record_v1"
    ) {
        return "Database State";
    }

    if (
        key === "lilymoney:db_format" ||
        key === "lilymoney:record_format" ||
        key === "lilymoney:db_kind" ||
        key === "lilymoney:db_world_id" ||
        key === "lilymoney:shard_index" ||
        key === "lilymoney:record_count" ||
        key === "lilymoney:page_count" ||
        key === "lilymoney:first_record_id" ||
        key === "lilymoney:last_record_id" ||
        key === "lilymoney:first_time" ||
        key === "lilymoney:last_time" ||
        key === "lilymoney:sealed" ||
        key === "lilymoney:sealed_at" ||
        key === "lilymoney:checksum_fnv1a32" ||
        key === "lilymoney:target_bytes"
    ) {
        return "Shard Metadata";
    }

    if (key.startsWith("lilymoney:")) {
        return "Other LilyMoney Data";
    }

    return "Other";
}

function getPropertySummary(key: string, value: unknown): LilyMoneyPropertySummary {
    let type: string = typeof value;
    let preview: string;
    let size: number | null = null;

    if (value === null) {
        type = "null";
        preview = "null";
    } else if (typeof value === "string") {
        type = "string";
        size = value.length;

        if (/^lilymoney:page_\d+$/.test(key)) {
            preview = `<record page: ${value.length.toLocaleString()} characters>`;
        } else {
            const shortened: string =
                value.length > 180
                    ? `${value.slice(0, 180)}…`
                    : value;

            preview = JSON.stringify(shortened);

            if (value.length > 180) {
                preview += ` (${value.length.toLocaleString()} characters total)`;
            }
        }
    } else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        preview = String(value);
    } else if (Buffer.isBuffer(value)) {
        type = "Buffer";
        size = value.length;
        preview = `<Buffer ${value.length.toLocaleString()} bytes>`;
    } else {
        type = Array.isArray(value) ? "array" : "object";

        const json: string = safeJsonStringify(value);
        preview =
            json.length > 500
                ? `${json.slice(0, 500)}…`
                : json;
    }

    return {
        key,
        category: getPropertyCategory(key),
        type,
        preview,
        size,
    };
}

function summarizeProperties(namespace: UnknownRecord): LilyMoneyPropertySummary[] {
    return Object.entries(namespace)
        .sort(([a]: [string, unknown], [b]: [string, unknown]): number => a.localeCompare(b))
        .map(([key, value]: [string, unknown]): LilyMoneyPropertySummary => {
            return getPropertySummary(key, value);
        });
}

function getPackNamespace(entityOrWorld: UnknownRecord): UnknownRecord | null {
    const dynamicProperties: unknown = entityOrWorld.DynamicProperties;

    if (!isRecord(dynamicProperties)) {
        return null;
    }

    const namespace: unknown = dynamicProperties[LILYMONEY_PACK_UUID];

    return isRecord(namespace) ? namespace : null;
}

async function parseNbtToPlain(data: Buffer): Promise<unknown> {
    const parsed = await NBT.parse(data);
    return NBT.simplify(parsed.parsed);
}

function sortPageKeys(keys: string[]): string[] {
    return [...keys].sort((a: string, b: string): number => {
        const aNumber: number = Number(a.slice(a.lastIndexOf("_") + 1));
        const bNumber: number = Number(b.slice(b.lastIndexOf("_") + 1));

        return aNumber - bNumber;
    });
}





function summarizeStorage(
    source: "sealed" | "active",
    sourceKey: string,
    entity: UnknownRecord,
    expectedActiveShardIndex: number | null
): LilyMoneyStorageSummary {
    const identifier: string | null =
        typeof entity.identifier === "string"
            ? entity.identifier
            : null;

    const namespace: UnknownRecord = getPackNamespace(entity) ?? {};

    const pageKeys: string[] = sortPageKeys(
        Object.keys(namespace).filter((key: string): boolean => {
            return /^lilymoney:page_\d+$/.test(key);
        })
    );

    let pageCharacters: number = 0;

    for (const pageKey of pageKeys) {
        const value: unknown = namespace[pageKey];

        if (typeof value === "string") {
            pageCharacters += value.length;
        }
    }

    const shardIndex: number | null = toNumber(namespace["lilymoney:shard_index"]);

    const decoded: LilyMoneyRecordDecodeResult =
        decodeLilyMoneyRecords(
            namespace,
            {
                source,
                sourceKey,
                shardIndex,
            }
        );

    return {
        source,
        sourceKey,

        identifier,

        shardIndex,
        recordCount: toNumber(namespace["lilymoney:record_count"]),
        pageCount: toNumber(namespace["lilymoney:page_count"]),

        firstRecordId: toNumber(namespace["lilymoney:first_record_id"]),
        lastRecordId: toNumber(namespace["lilymoney:last_record_id"]),

        firstTime: toNumber(namespace["lilymoney:first_time"]),
        lastTime: toNumber(namespace["lilymoney:last_time"]),

        dbFormat: toNumber(namespace["lilymoney:db_format"]),
        recordFormat: toNumber(namespace["lilymoney:record_format"]),
        dbKind: toStringValue(namespace["lilymoney:db_kind"]),
        worldId:
            toStringValue(namespace["lilymoney:db_world_id"]) ??
            toStringValue(namespace["lilymoney:world_id"]),

        sealed: toBoolean(namespace["lilymoney:sealed"]),
        checksum: toStringValue(namespace["lilymoney:checksum_fnv1a32"]),

        pageKeys,
        pageCharacters,

        isExpectedActiveShard:
            source === "active" &&
            expectedActiveShardIndex !== null &&
            shardIndex === expectedActiveShardIndex,

        properties: summarizeProperties(namespace),

        records:
            decoded.records,

        recordDecodeErrors:
            decoded.errors,

        recordDecodeWarnings:
            decoded.warnings,

        idsContinuous:
            decoded.idsContinuous,

        checksumActual:
            decoded.checksumActual,

        checksumValid:
            decoded.checksumValid,

        pendingJobBatchStateRaw:
            typeof namespace[
                "lilymoney:job_batch_state_v1"
            ] === "string"
                ? namespace[
                    "lilymoney:job_batch_state_v1"
                ] as string
                : null,
    };
}



export async function detectLilyMoneyData(
    tab: TabManagerTab
): Promise<boolean> {
    if (tab.type !== "world" && tab.type !== "leveldb") {
        return false;
    }

    if (!tab.db) {
        return false;
    }

    await tab.awaitDBOpen;

    if (!tab.db?.isOpen()) {
        return false;
    }

    // -------------------------------------------------------------
    // 1. Check LilyMoney's world DynamicProperties first.
    // -------------------------------------------------------------

    try {
        const dynamicPropertiesData: Buffer | null =
            await tab.db.get("DynamicProperties");

        if (dynamicPropertiesData) {
            const plain: unknown =
                await parseNbtToPlain(dynamicPropertiesData);

            if (isRecord(plain)) {
                const namespace: unknown =
                    plain[LILYMONEY_PACK_UUID];

                if (isRecord(namespace)) {
                    const hasLilyMoneyProperty: boolean =
                        Object.keys(namespace).some(
                            (key: string): boolean =>
                                key.startsWith("lilymoney:")
                        );

                    if (hasLilyMoneyProperty) {
                        return true;
                    }
                }
            }
        }
    } catch (error) {
        console.warn(
            "[integration::LilyMoney] Could not inspect DynamicProperties during detection:",
            error
        );
    }

    // -------------------------------------------------------------
    // 2. Fall back to sealed LilyMoney structures.
    // -------------------------------------------------------------

    await tab.awaitCachedDBKeys;

    if (!tab.cachedDBKeys) {
        return false;
    }

    return tab.cachedDBKeys.StructureTemplate.some(
        (key: Buffer): boolean =>
            key
                .toString()
                .startsWith(LILYMONEY_STRUCTURE_PREFIX)
    );
}


export async function scanLilyMoneyData(
    tab: TabManagerTab,
    onProgress?: (message: string) => void
): Promise<LilyMoneyDiscoveryResult> {
    if (tab.type !== "world" && tab.type !== "leveldb") {
        throw new TypeError("LilyMoney only supports world and LevelDB tabs.");
    }

    if (!tab.db) {
        throw new Error("This tab has no LevelDB.");
    }

    onProgress?.("Opening LevelDB...");

    await tab.awaitDBOpen;

    if (!tab.db?.isOpen()) {
        throw new Error("LevelDB is not open.");
    }

    onProgress?.("Reading LevelDB keys...");

    await tab.awaitCachedDBKeys;

    if (!tab.cachedDBKeys) {
        throw new Error("Bedrock World Editor did not provide cached LevelDB keys.");
    }

    const errors: string[] = [];

    // ---------------------------------------------------------------------
    // World DynamicProperties
    // ---------------------------------------------------------------------

    onProgress?.("Reading LilyMoney world dynamic properties...");

    let worldNamespace: UnknownRecord | null = null;

    const dynamicPropertiesData: Buffer | null = await tab.db.get("DynamicProperties");

    if (dynamicPropertiesData) {
        try {
            const plain: unknown = await parseNbtToPlain(dynamicPropertiesData);

            if (isRecord(plain)) {
                const possibleNamespace: unknown = plain[LILYMONEY_PACK_UUID];

                if (isRecord(possibleNamespace)) {
                    worldNamespace = possibleNamespace;
                }
            }
        } catch (error) {
            errors.push(
                `Could not parse world DynamicProperties: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    } else {
        errors.push("World DynamicProperties LevelDB entry was not found.");
    }

    const worldProperties: LilyMoneyPropertySummary[] =
        worldNamespace !== null
            ? summarizeProperties(worldNamespace)
            : [];

    const nameDatabase: LilyMoneyNameDatabase =
        worldNamespace !== null
            ? readLilyMoneyNameDatabase(worldNamespace)
            : emptyLilyMoneyNameDatabase();

    const worldId: string | null =
        worldNamespace !== null
            ? toStringValue(worldNamespace["lilymoney:world_id"])
            : null;

    let loggingEnabled: boolean | null = null;

    if (worldNamespace !== null) {
        if ("lilymoney:transaction_logging" in worldNamespace) {
            loggingEnabled = toBoolean(worldNamespace["lilymoney:transaction_logging"]);
        } else {
            // LilyMoney's default is logging enabled when the property
            // has never been explicitly stored.
            loggingEnabled = true;
        }
    }

    const activeOpen: boolean | null =
        worldNamespace !== null
            ? toBoolean(worldNamespace["lilymoney:moneylog_active_open_v1"])
            : null;

    const activeShardIndex: number | null =
        worldNamespace !== null
            ? toNumber(worldNamespace["lilymoney:moneylog_active_shard_v1"])
            : null;

    const lastSealedRecordId: number | null =
        worldNamespace !== null
            ? toNumber(worldNamespace["lilymoney:moneylog_last_sealed_record_v1"])
            : null;

    const nameDatabaseChunkCount: number =
        nameDatabase.chunkCountRead;

    let pendingJobBatchStateFound: boolean = false;

    

    const recoveryPropertyCount: number =
        worldNamespace !== null
            ? Object.keys(worldNamespace).filter((key: string): boolean => {
                  return (
                      key.startsWith("lilymoney:moneylog_death_recovery") ||
                      key.startsWith("lilymoney:moneylog_dead_entity_quarantine")
                  );
              }).length
            : 0;

    // ---------------------------------------------------------------------
    // Sealed structures
    // ---------------------------------------------------------------------

    const structureKeys: Buffer[] = tab.cachedDBKeys.StructureTemplate.filter(
        (key: Buffer): boolean => {
            return key.toString().startsWith(LILYMONEY_STRUCTURE_PREFIX);
        }
    );

    const sealedStorages: LilyMoneyStorageSummary[] = [];

    for (let index: number = 0; index < structureKeys.length; index++) {
        const key: Buffer = structureKeys[index]!;
        const keyText: string = key.toString();

        onProgress?.(
            `Reading sealed LilyMoney structure ${index + 1}/${structureKeys.length}: ${keyText}`
        );

        try {
            const data: Buffer | null = await tab.db.get(key);

            if (!data) {
                errors.push(`Structure key exists but contains no data: ${keyText}`);
                continue;
            }

            const plain: unknown = await parseNbtToPlain(data);

            if (!isRecord(plain)) {
                errors.push(`Structure root is not a compound: ${keyText}`);
                continue;
            }

            const structure: unknown = plain.structure;

            if (!isRecord(structure)) {
                errors.push(`Structure compound missing: ${keyText}`);
                continue;
            }

            const entities: unknown = structure.entities;

            if (!Array.isArray(entities)) {
                errors.push(`Structure entity list missing: ${keyText}`);
                continue;
            }

            const storageEntity: UnknownRecord | undefined = entities.find(
                (entity: unknown): entity is UnknownRecord => {
                    return (
                        isRecord(entity) &&
                        entity.identifier === LILYMONEY_STORAGE_IDENTIFIER
                    );
                }
            );

            if (!storageEntity) {
                errors.push(
                    `No ${LILYMONEY_STORAGE_IDENTIFIER} entity found inside ${keyText}`
                );
                continue;
            }

            sealedStorages.push(
                summarizeStorage(
                    "sealed",
                    keyText,
                    storageEntity,
                    activeShardIndex
                )
            );
        } catch (error) {
            errors.push(
                `Could not read ${keyText}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    // ---------------------------------------------------------------------
    // Active / stale ActorPrefix storage entities
    // ---------------------------------------------------------------------

    const actorKeys: Buffer[] = tab.cachedDBKeys.ActorPrefix;
    const activeStorages: LilyMoneyStorageSummary[] = [];

    const storageIdentifierBytes: Buffer = Buffer.from(
        LILYMONEY_STORAGE_IDENTIFIER,
        "utf8"
    );

    for (let index: number = 0; index < actorKeys.length; index++) {
        if (index % 100 === 0 || index === actorKeys.length - 1) {
            onProgress?.(
                `Scanning entities ${Math.min(index + 1, actorKeys.length)}/${actorKeys.length}...`
            );
        }

        const key: Buffer = actorKeys[index]!;

        try {
            const data: Buffer | null = await tab.db.get(key);

            if (!data) {
                continue;
            }

            // Cheap first-pass check. This avoids NBT-parsing every entity
            // in the entire world.
            if (!data.includes(storageIdentifierBytes)) {
                continue;
            }

            const plain: unknown = await parseNbtToPlain(data);

            if (!isRecord(plain)) {
                continue;
            }

            if (plain.identifier !== LILYMONEY_STORAGE_IDENTIFIER) {
                continue;
            }

            activeStorages.push(
                summarizeStorage(
                    "active",
                    key.toString("hex"),
                    plain,
                    activeShardIndex
                )
            );
        } catch (error) {
            errors.push(
                `Could not inspect ActorPrefix ${key.toString("hex")}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    pendingJobBatchStateFound =
        activeStorages.some(
            (storage: LilyMoneyStorageSummary): boolean =>
                storage.pendingJobBatchStateRaw !== null
        );


    onProgress?.("LilyMoney data scan complete.");

    return {
        worldNamespaceFound: worldNamespace !== null,

        worldProperties,

        worldId,
        loggingEnabled,
        activeOpen,
        activeShardIndex,
        lastSealedRecordId,

        nameDatabaseChunkCount,

        pendingJobBatchStateFound,
        recoveryPropertyCount,

        structureKeys: structureKeys.map((key: Buffer): string => key.toString()),
        sealedStorages,

        actorKeysScanned: actorKeys.length,
        activeStorages,

        errors,

        nameDatabase,
    };
}