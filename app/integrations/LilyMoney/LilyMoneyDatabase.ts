import type { LilyMoneyDiscoveryResult, LilyMoneyStorageSummary } from "./LilyMoneyData";

import type { LilyMoneyRecord } from "./LilyMoneyRecords";

export interface LilyMoneyDatabase {
    records: LilyMoneyRecord[];

    selectedShards: LilyMoneyStorageSummary[];

    sealedShardCount: number;
    activeShardFound: boolean;

    firstRecordId: number | null;
    lastRecordId: number | null;

    idsContinuous: boolean | null;
    shardIndexesContinuous: boolean | null;

    duplicateRecordIds: number[];
    missingRecordRanges: Array<{
        after: number;
        before: number;
    }>;

    errors: string[];
    warnings: string[];
}

export function assembleLilyMoneyDatabase(discovery: LilyMoneyDiscoveryResult): LilyMoneyDatabase {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ---------------------------------------------------------------------
    // Select sealed shards
    // ---------------------------------------------------------------------

    const sealedByShard: Map<number, LilyMoneyStorageSummary> = new Map();

    for (const storage of discovery.sealedStorages) {
        if (storage.shardIndex === null) {
            errors.push(`Sealed storage ${storage.sourceKey} has no shard index.`);

            continue;
        }

        if (storage.sealed !== true) {
            warnings.push(`Structure ${storage.sourceKey} contains a storage entity that is not marked sealed.`);
        }

        if (discovery.worldId !== null && storage.worldId !== null && storage.worldId !== discovery.worldId) {
            errors.push(`Shard ${storage.shardIndex} belongs to world ${storage.worldId}, expected ${discovery.worldId}.`);

            continue;
        }

        const previous = sealedByShard.get(storage.shardIndex);

        if (previous) {
            errors.push(`Multiple sealed structures claim shard ${storage.shardIndex}: ${previous.sourceKey} and ${storage.sourceKey}.`);

            continue;
        }

        sealedByShard.set(storage.shardIndex, storage);
    }

    // ---------------------------------------------------------------------
    // Select active shard
    // ---------------------------------------------------------------------

    const expectedActiveCandidates = discovery.activeStorages.filter((storage: LilyMoneyStorageSummary): boolean => storage.isExpectedActiveShard);

    let activeStorage: LilyMoneyStorageSummary | null = null;

    if (expectedActiveCandidates.length === 1) {
        activeStorage = expectedActiveCandidates[0]!;
    } else if (expectedActiveCandidates.length > 1) {
        errors.push(`Found ${expectedActiveCandidates.length} ActorPrefix storage entities claiming to be the expected active shard.`);
    } else if (discovery.activeOpen === true) {
        errors.push(
            `World metadata says active shard ${String(discovery.activeShardIndex)} is open, but no matching money_storage ActorPrefix entity was found.`
        );
    }

    if (activeStorage !== null && discovery.worldId !== null && activeStorage.worldId !== null && activeStorage.worldId !== discovery.worldId) {
        errors.push(`Active shard belongs to world ${activeStorage.worldId}, expected ${discovery.worldId}.`);

        activeStorage = null;
    }

    // ---------------------------------------------------------------------
    // Build selected shard list
    // ---------------------------------------------------------------------

    const selectedShards: LilyMoneyStorageSummary[] = [...sealedByShard.values()];

    if (activeStorage !== null) {
        if (activeStorage.shardIndex !== null && sealedByShard.has(activeStorage.shardIndex)) {
            errors.push(`Shard ${activeStorage.shardIndex} exists as both sealed history and the expected active shard.`);
        } else {
            selectedShards.push(activeStorage);
        }
    }

    selectedShards.sort((a: LilyMoneyStorageSummary, b: LilyMoneyStorageSummary): number => {
        return (a.shardIndex ?? Number.MAX_SAFE_INTEGER) - (b.shardIndex ?? Number.MAX_SAFE_INTEGER);
    });

    // ---------------------------------------------------------------------
    // Validate shard continuity
    // ---------------------------------------------------------------------

    let shardIndexesContinuous: boolean | null = selectedShards.length > 0 ? true : null;

    for (let index = 1; index < selectedShards.length; index++) {
        const previous = selectedShards[index - 1]!.shardIndex;

        const current = selectedShards[index]!.shardIndex;

        if (previous === null || current === null) {
            shardIndexesContinuous = false;
            continue;
        }

        if (current !== previous + 1) {
            shardIndexesContinuous = false;

            errors.push(`Shard discontinuity: shard ${previous} is followed by shard ${current}.`);
        }
    }

    // ---------------------------------------------------------------------
    // Collect canonical records.
    //
    // IMPORTANT:
    // DO NOT SORT THESE BY TIMESTAMP.
    //
    // LilyMoney's global record ID is the canonical ordering.
    // ---------------------------------------------------------------------

    const records: LilyMoneyRecord[] = [];

    for (const shard of selectedShards) {
        if (shard.recordDecodeErrors.length > 0) {
            for (const error of shard.recordDecodeErrors) {
                errors.push(`Shard ${String(shard.shardIndex)}: ${error}`);
            }
        }

        for (const warning of shard.recordDecodeWarnings) {
            warnings.push(`Shard ${String(shard.shardIndex)}: ${warning}`);
        }

        records.push(...shard.records);
    }

    // ---------------------------------------------------------------------
    // Validate global record IDs
    // ---------------------------------------------------------------------

    const duplicateRecordIds: number[] = [];

    const missingRecordRanges: Array<{
        after: number;
        before: number;
    }> = [];

    const seenIds: Set<number> = new Set();

    for (const record of records) {
        if (seenIds.has(record.id)) {
            duplicateRecordIds.push(record.id);
        } else {
            seenIds.add(record.id);
        }
    }

    let idsContinuous: boolean | null = records.length > 0 ? true : null;

    for (let index = 1; index < records.length; index++) {
        const previous = records[index - 1]!;

        const current = records[index]!;

        if (current.id === previous.id) {
            idsContinuous = false;
            continue;
        }

        if (current.id !== previous.id + 1) {
            idsContinuous = false;

            missingRecordRanges.push({
                after: previous.id,
                before: current.id,
            });

            errors.push(`Global record discontinuity: #${previous.id} is followed by #${current.id}.`);
        }
    }

    if (duplicateRecordIds.length > 0) {
        const uniqueDuplicates = [...new Set(duplicateRecordIds)];

        errors.push(`Duplicate global record IDs found: ${uniqueDuplicates.join(", ")}.`);
    }

    const firstRecordId = records.length > 0 ? records[0]!.id : null;

    const lastRecordId = records.length > 0 ? records[records.length - 1]!.id : null;

    return {
        records,

        selectedShards,

        sealedShardCount: sealedByShard.size,

        activeShardFound: activeStorage !== null,

        firstRecordId,
        lastRecordId,

        idsContinuous,
        shardIndexesContinuous,

        duplicateRecordIds: [...new Set(duplicateRecordIds)],

        missingRecordRanges,

        errors,
        warnings,
    };
}
