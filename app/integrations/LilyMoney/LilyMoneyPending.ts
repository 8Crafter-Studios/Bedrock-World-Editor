import type { LilyMoneyRecord } from "./LilyMoneyRecords";

import { resolveLilyMoneyName, type LilyMoneyNameDatabase } from "./LilyMoneyNames";

export interface LilyMoneyPendingReward {
    batchId: string;

    jobId: string;
    action: string;
    sourceId: string;

    quantity: number;
    amountCents: number;

    startedAt: number;
    updatedAt: number;

    alreadyCanonical: boolean;
}

export interface LilyMoneyPendingPlayer {
    identityId: string;

    rawName: string;
    displayName: string;

    windowStartedAt: number;

    baseBalanceCents: number;
    finalBalanceCents: number;

    lastUpdatedAt: number;

    rewards: LilyMoneyPendingReward[];

    totalStateAmountCents: number;

    provisionalAmountCents: number;

    provisionalRewardCount: number;
}

export interface LilyMoneyPendingState {
    present: boolean;
    valid: boolean;

    version: number | null;

    players: LilyMoneyPendingPlayer[];

    errors: string[];
    warnings: string[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeInt(value: unknown): number | null {
    if (typeof value === "number" && Number.isSafeInteger(value)) {
        return value;
    }

    if (typeof value === "bigint") {
        const converted: number = Number(value);

        return Number.isSafeInteger(converted) ? converted : null;
    }

    if (typeof value === "string" && /^-?\d+$/.test(value)) {
        const converted: number = Number(value);

        return Number.isSafeInteger(converted) ? converted : null;
    }

    return null;
}

function canonicalJobBatchIds(records: LilyMoneyRecord[]): Set<string> {
    const result: Set<string> = new Set();

    for (const record of records) {
        if (record.type !== "JOB_REWARD" || !Array.isArray(record.payload)) {
            continue;
        }

        const batchId: unknown = record.payload[10];

        if (typeof batchId === "string" && batchId.length > 0) {
            result.add(batchId);
        }
    }

    return result;
}

export function parseLilyMoneyPendingJobState(raw: string | null, canonicalRecords: LilyMoneyRecord[], names: LilyMoneyNameDatabase): LilyMoneyPendingState {
    if (raw === null || raw === "") {
        return {
            present: false,
            valid: true,

            version: null,

            players: [],

            errors: [],
            warnings: [],
        };
    }

    const errors: string[] = [];

    const warnings: string[] = [];

    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return {
            present: true,
            valid: false,

            version: null,

            players: [],

            errors: [`Pending JOB state contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`],

            warnings: [],
        };
    }

    if (!isRecord(parsed)) {
        return {
            present: true,
            valid: false,

            version: null,

            players: [],

            errors: ["Pending JOB state root is not an object."],

            warnings: [],
        };
    }

    const version: number | null = safeInt(parsed.version);

    if (version !== 1) {
        errors.push(`Unsupported pending JOB state version: ${String(version)}.`);
    }

    if (!Array.isArray(parsed.players)) {
        errors.push("Pending JOB state players field is not an array.");
    }

    const canonicalIds: Set<string> = canonicalJobBatchIds(canonicalRecords);

    const players: LilyMoneyPendingPlayer[] = [];

    if (Array.isArray(parsed.players)) {
        for (let playerIndex = 0; playerIndex < parsed.players.length; playerIndex++) {
            const row: unknown = parsed.players[playerIndex];

            if (!isRecord(row)) {
                errors.push(`Pending JOB player ${playerIndex} is not an object.`);

                continue;
            }

            const identityId: string = typeof row.identityId === "string" ? row.identityId : "";

            const rawName: string = typeof row.name === "string" ? row.name : "";

            const windowStartedAt = safeInt(row.windowStartedAt);

            const baseBalance = safeInt(row.baseBalance);

            const finalBalance = safeInt(row.finalBalance);

            const lastUpdatedAt = safeInt(row.lastUpdatedAt);

            if (!identityId) {
                errors.push(`Pending JOB player ${playerIndex} has no identity ID.`);
            }

            if (windowStartedAt === null) {
                errors.push(`Pending JOB player ${playerIndex} has invalid windowStartedAt.`);
            }

            if (baseBalance === null) {
                errors.push(`Pending JOB player ${playerIndex} has invalid baseBalance.`);
            }

            if (finalBalance === null) {
                errors.push(`Pending JOB player ${playerIndex} has invalid finalBalance.`);
            }

            if (lastUpdatedAt === null) {
                errors.push(`Pending JOB player ${playerIndex} has invalid lastUpdatedAt.`);
            }

            if (!Array.isArray(row.rewards)) {
                errors.push(`Pending JOB player ${playerIndex} rewards is not an array.`);

                continue;
            }

            const rewards: LilyMoneyPendingReward[] = [];

            let totalStateAmountCents = 0;

            let provisionalAmountCents = 0;

            let provisionalRewardCount = 0;

            for (let rewardIndex = 0; rewardIndex < row.rewards.length; rewardIndex++) {
                const reward: unknown = row.rewards[rewardIndex];

                if (!isRecord(reward)) {
                    errors.push(`Pending JOB reward ${playerIndex}:${rewardIndex} is not an object.`);

                    continue;
                }

                const batchId = typeof reward.batchId === "string" ? reward.batchId : "";

                const jobId = typeof reward.jobId === "string" ? reward.jobId : "";

                const action = typeof reward.kind === "string" ? reward.kind : "";

                const sourceId = typeof reward.sourceId === "string" ? reward.sourceId : "";

                const quantity = safeInt(reward.quantity);

                const amountCents = safeInt(reward.amountCents);

                const startedAt = safeInt(reward.startedAt);

                const updatedAt = safeInt(reward.updatedAt);

                if (
                    !batchId ||
                    !jobId ||
                    !action ||
                    !sourceId ||
                    quantity === null ||
                    quantity <= 0 ||
                    amountCents === null ||
                    startedAt === null ||
                    updatedAt === null
                ) {
                    errors.push(`Pending JOB reward ${playerIndex}:${rewardIndex} contains invalid fields.`);

                    continue;
                }

                const alreadyCanonical: boolean = canonicalIds.has(batchId);

                totalStateAmountCents += amountCents;

                if (alreadyCanonical) {
                    warnings.push(`Pending batch ${batchId} already exists in canonical history; it will not be counted as provisional.`);
                } else {
                    provisionalAmountCents += amountCents;

                    provisionalRewardCount++;
                }

                rewards.push({
                    batchId,

                    jobId,
                    action,
                    sourceId,

                    quantity,
                    amountCents,

                    startedAt,
                    updatedAt,

                    alreadyCanonical,
                });
            }

            if (baseBalance !== null && finalBalance !== null) {
                const computedFinal = baseBalance + totalStateAmountCents;

                if (computedFinal !== finalBalance) {
                    errors.push(
                        `Pending JOB player ${identityId || playerIndex} balance chain mismatch: base ${baseBalance} + rewards ${totalStateAmountCents} = ${computedFinal}, stored final is ${finalBalance}.`
                    );
                }
            }

            if (identityId && windowStartedAt !== null && baseBalance !== null && finalBalance !== null && lastUpdatedAt !== null) {
                players.push({
                    identityId,

                    rawName,

                    displayName: resolveLilyMoneyName(names, identityId, rawName),

                    windowStartedAt,

                    baseBalanceCents: baseBalance,

                    finalBalanceCents: finalBalance,

                    lastUpdatedAt,

                    rewards,

                    totalStateAmountCents,

                    provisionalAmountCents,

                    provisionalRewardCount,
                });
            }
        }
    }

    return {
        present: true,

        valid: errors.length === 0,

        version,

        players,

        errors,
        warnings,
    };
}
