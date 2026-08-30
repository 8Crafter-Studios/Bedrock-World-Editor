import type {
    LilyMoneyRecord,
} from "./LilyMoneyRecords";

import {
    resolveLilyMoneyName,
    type LilyMoneyNameDatabase,
} from "./LilyMoneyNames";

export type LilyMoneyKnownEventType =
    | "PAY"
    | "SHOP_BUY"
    | "SHOP_SELL"
    | "AH_BUY"
    | "BUY_COMMAND"
    | "SELL_COMMAND"
    | "ADD_MONEY"
    | "REMOVE_MONEY"
    | "SET_MONEY"
    | "JOB_REWARD"
    | "PLAYER_JOIN"
    | "PLAYER_LEAVE"
    | "BALANCE_CHECKPOINT"
    | "FULL_BALANCE_CHECKPOINT"
    | "LOGGING_ENABLED"
    | "LOGGING_DISABLED";

export interface LilyMoneyPerson {
    identityId: string;
    rawName: string;
    displayName: string;
    role: string;
}

export interface LilyMoneyEventEffect {
    identityId: string;
    rawName: string;
    displayName: string;
    role: string;

    deltaCents: number | null;
    balanceAfterCents: number | null;

    assignment: boolean;
}

export interface LilyMoneyFullCheckpointRow {
    identityId: string;
    displayName: string;
    balanceCents: number | null;
}

export interface LilyMoneyJobBatchMetadata {
    startedAt: number;
    endedAt: number;
    batchId: string;
}

export interface ParsedLilyMoneyEvent {
    record: LilyMoneyRecord;

    type: string;

    knownType:
        LilyMoneyKnownEventType | null;

    valid: boolean;

    errors: string[];

    people: LilyMoneyPerson[];

    effects:
        LilyMoneyEventEffect[];

    amountCents: number | null;

    quantity: number | null;

    itemId: string | null;
    itemName: string | null;

    jobId: string | null;
    action: string | null;
    sourceId: string | null;

    reason: string | null;

    jobBatch:
        LilyMoneyJobBatchMetadata | null;

    fullCheckpointRows:
        LilyMoneyFullCheckpointRow[];

    declaredFullCheckpointCount:
        number | null;
}

const KNOWN_TYPES =
    new Set<LilyMoneyKnownEventType>([
        "PAY",

        "SHOP_BUY",
        "SHOP_SELL",

        "AH_BUY",

        "BUY_COMMAND",
        "SELL_COMMAND",

        "ADD_MONEY",
        "REMOVE_MONEY",
        "SET_MONEY",

        "JOB_REWARD",

        "PLAYER_JOIN",
        "PLAYER_LEAVE",

        "BALANCE_CHECKPOINT",
        "FULL_BALANCE_CHECKPOINT",

        "LOGGING_ENABLED",
        "LOGGING_DISABLED",
    ]);

function safeInt(
    value: unknown
): number | null {
    if (
        typeof value === "number" &&
        Number.isSafeInteger(value)
    ) {
        return value;
    }

    if (typeof value === "bigint") {
        const converted: number =
            Number(value);

        return Number.isSafeInteger(
            converted
        )
            ? converted
            : null;
    }

    if (
        typeof value === "string" &&
        /^-?\d+$/.test(value)
    ) {
        const converted: number =
            Number(value);

        return Number.isSafeInteger(
            converted
        )
            ? converted
            : null;
    }

    return null;
}

function safeString(
    value: unknown
): string {
    return typeof value === "string"
        ? value
        : "";
}

function makePerson(
    identityValue: unknown,
    nameValue: unknown,
    role: string,
    names: LilyMoneyNameDatabase
): LilyMoneyPerson {
    const identityId: string =
        safeString(
            identityValue
        ).trim();

    const rawName: string =
        safeString(
            nameValue
        ).trim();

    return {
        identityId,
        rawName,

        displayName:
            resolveLilyMoneyName(
                names,
                identityId,
                rawName
            ),

        role,
    };
}

function makeEffect(
    person: LilyMoneyPerson,
    deltaCents: number | null,
    balanceAfterCents:
        number | null,
    assignment: boolean = false
): LilyMoneyEventEffect {
    return {
        ...person,

        deltaCents,
        balanceAfterCents,

        assignment,
    };
}

export function isKnownLilyMoneyEventType(
    type: string
): type is LilyMoneyKnownEventType {
    return KNOWN_TYPES.has(
        type as LilyMoneyKnownEventType
    );
}

export function parseLilyMoneyEvent(
    record: LilyMoneyRecord,
    names: LilyMoneyNameDatabase
): ParsedLilyMoneyEvent {
    const errors: string[] = [];

    const people:
        LilyMoneyPerson[] = [];

    const effects:
        LilyMoneyEventEffect[] = [];

    const fullCheckpointRows:
        LilyMoneyFullCheckpointRow[] =
            [];

    let amountCents:
        number | null = null;

    let quantity:
        number | null = null;

    let itemId:
        string | null = null;

    let itemName:
        string | null = null;

    let jobId:
        string | null = null;

    let action:
        string | null = null;

    let sourceId:
        string | null = null;

    let reason:
        string | null = null;

    let jobBatch:
        LilyMoneyJobBatchMetadata |
        null = null;

    let declaredFullCheckpointCount:
        number | null = null;

    const knownType:
        LilyMoneyKnownEventType |
        null =
            isKnownLilyMoneyEventType(
                record.type
            )
                ? record.type
                : null;

    if (knownType === null) {
        errors.push(
            `Unknown event type ${record.type}.`
        );
    }

    if (
        !Array.isArray(
            record.payload
        )
    ) {
        errors.push(
            "Payload is not an array."
        );

        return {
            record,

            type: record.type,
            knownType,

            valid: false,
            errors,

            people,
            effects,

            amountCents,
            quantity,

            itemId,
            itemName,

            jobId,
            action,
            sourceId,

            reason,
            jobBatch,

            fullCheckpointRows,

            declaredFullCheckpointCount,
        };
    }

    const p: unknown[] =
        record.payload;

    const requireInt = (
        index: number,
        label: string
    ): number | null => {
        const value:
            number | null =
                safeInt(
                    p[index]
                );

        if (value === null) {
            errors.push(
                `${label} at payload[${index}] is not a safe integer.`
            );
        }

        return value;
    };

    const nullableInt = (
        index: number,
        label: string
    ): number | null => {
        if (
            p[index] === null ||
            p[index] === undefined
        ) {
            return null;
        }

        return requireInt(
            index,
            label
        );
    };

    const requireString = (
        index: number,
        label: string
    ): string => {
        const value: string =
            safeString(
                p[index]
            );

        if (
            typeof p[index] !==
            "string"
        ) {
            errors.push(
                `${label} at payload[${index}] is not a string.`
            );
        }

        return value;
    };

    const person = (
        idIndex: number,
        nameIndex: number,
        role: string
    ): LilyMoneyPerson => {
        const result:
            LilyMoneyPerson =
                makePerson(
                    p[idIndex],
                    p[nameIndex],
                    role,
                    names
                );

        people.push(result);

        return result;
    };

    switch (knownType) {
        case "PAY": {
            const sender =
                person(
                    0,
                    1,
                    "sender"
                );

            const recipient =
                person(
                    2,
                    3,
                    "recipient"
                );

            amountCents =
                requireInt(
                    4,
                    "Payment amount"
                );

            const senderAfter =
                requireInt(
                    5,
                    "Sender balance after"
                );

            const recipientAfter =
                requireInt(
                    6,
                    "Recipient balance after"
                );

            if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        sender,
                        -amountCents,
                        senderAfter
                    )
                );

                effects.push(
                    makeEffect(
                        recipient,
                        amountCents,
                        recipientAfter
                    )
                );
            }

            break;
        }

        case "SHOP_BUY":
        case "SHOP_SELL": {
            const player =
                person(
                    0,
                    1,
                    knownType ===
                        "SHOP_BUY"
                        ? "buyer"
                        : "seller"
                );

            itemId =
                requireString(
                    2,
                    "Item ID"
                );

            itemName =
                requireString(
                    3,
                    "Item name"
                );

            quantity =
                requireInt(
                    4,
                    "Quantity"
                );

            amountCents =
                requireInt(
                    5,
                    "Amount"
                );

            const after =
                requireInt(
                    6,
                    "Balance after"
                );

            if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        player,

                        knownType ===
                            "SHOP_BUY"
                            ? -amountCents
                            : amountCents,

                        after
                    )
                );
            }

            break;
        }

        case "AH_BUY": {
            const buyer =
                person(
                    0,
                    1,
                    "buyer"
                );

            const seller =
                person(
                    2,
                    3,
                    "seller"
                );

            itemId =
                requireString(
                    4,
                    "Item ID"
                );

            itemName =
                requireString(
                    5,
                    "Item name"
                );

            quantity =
                requireInt(
                    6,
                    "Quantity"
                );

            amountCents =
                requireInt(
                    7,
                    "Amount"
                );

            const buyerAfter =
                requireInt(
                    8,
                    "Buyer balance after"
                );

            const sellerAfter =
                nullableInt(
                    9,
                    "Seller balance after"
                );

            if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        buyer,
                        -amountCents,
                        buyerAfter
                    )
                );

                effects.push(
                    makeEffect(
                        seller,
                        amountCents,
                        sellerAfter
                    )
                );
            }

            break;
        }

        case "BUY_COMMAND":
        case "SELL_COMMAND": {
            person(
                0,
                1,
                "actor"
            );

            const target =
                person(
                    2,
                    3,
                    "target"
                );

            itemId =
                requireString(
                    4,
                    "Item ID"
                );

            quantity =
                requireInt(
                    5,
                    "Quantity"
                );

            amountCents =
                requireInt(
                    6,
                    "Amount"
                );

            const after =
                requireInt(
                    7,
                    "Target balance after"
                );

            if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        target,

                        knownType ===
                            "BUY_COMMAND"
                            ? -amountCents
                            : amountCents,

                        after
                    )
                );
            }

            break;
        }

        case "ADD_MONEY":
        case "REMOVE_MONEY":
        case "SET_MONEY": {
            person(
                0,
                1,
                "actor"
            );

            const target =
                person(
                    2,
                    3,
                    "target"
                );

            amountCents =
                requireInt(
                    4,

                    knownType ===
                        "SET_MONEY"
                        ? "Set amount"
                        : "Amount"
                );

            const after =
                requireInt(
                    5,
                    "Target balance after"
                );

            if (
                knownType ===
                "SET_MONEY"
            ) {
                effects.push(
                    makeEffect(
                        target,
                        null,
                        after,
                        true
                    )
                );
            } else if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        target,

                        knownType ===
                            "ADD_MONEY"
                            ? amountCents
                            : -amountCents,

                        after
                    )
                );
            }

            break;
        }

        case "JOB_REWARD": {
            const worker =
                person(
                    0,
                    1,
                    "worker"
                );

            jobId =
                requireString(
                    2,
                    "Job ID"
                );

            action =
                requireString(
                    3,
                    "Action"
                );

            sourceId =
                requireString(
                    4,
                    "Source ID"
                );

            quantity =
                requireInt(
                    5,
                    "Quantity"
                );

            amountCents =
                requireInt(
                    6,
                    "Amount"
                );

            const after =
                requireInt(
                    7,
                    "Balance after"
                );

            if (
                amountCents !== null
            ) {
                effects.push(
                    makeEffect(
                        worker,
                        amountCents,
                        after
                    )
                );
            }

            // Newer DB-v1 batched
            // JOB_REWARD metadata.
            if (p.length >= 11) {
                const startedAt =
                    requireInt(
                        8,
                        "Batch start"
                    );

                const endedAt =
                    requireInt(
                        9,
                        "Batch end"
                    );

                const batchId =
                    requireString(
                        10,
                        "Batch ID"
                    );

                if (
                    startedAt !== null &&
                    endedAt !== null &&
                    batchId
                ) {
                    jobBatch = {
                        startedAt,
                        endedAt,
                        batchId,
                    };
                }
            } else if (
                p.length > 8
            ) {
                errors.push(
                    "JOB_REWARD contains a partial batch-metadata suffix; expected fields 8-10 together."
                );
            }

            break;
        }

        case "PLAYER_JOIN":
        case "PLAYER_LEAVE": {
            const playerRef =
                person(
                    0,
                    1,
                    "session"
                );

            const balance =
                nullableInt(
                    2,
                    "Session balance"
                );

            effects.push(
                makeEffect(
                    playerRef,
                    null,
                    balance
                )
            );

            break;
        }

        case "BALANCE_CHECKPOINT": {
            const playerRef =
                person(
                    0,
                    1,
                    "checkpoint"
                );

            const balance =
                nullableInt(
                    2,
                    "Checkpoint balance"
                );

            reason =
                requireString(
                    3,
                    "Checkpoint reason"
                );

            effects.push(
                makeEffect(
                    playerRef,
                    null,
                    balance
                )
            );

            break;
        }

        case "FULL_BALANCE_CHECKPOINT": {
            reason =
                requireString(
                    0,
                    "Checkpoint reason"
                );

            declaredFullCheckpointCount =
                requireInt(
                    1,
                    "Checkpoint row count"
                );

            const rows: unknown =
                p[2];

            if (
                !Array.isArray(rows)
            ) {
                errors.push(
                    "Full checkpoint rows at payload[2] are not an array."
                );

                break;
            }

            if (
                declaredFullCheckpointCount !==
                    null &&
                declaredFullCheckpointCount !==
                    rows.length
            ) {
                errors.push(
                    `Full checkpoint declares ${declaredFullCheckpointCount} rows but contains ${rows.length}.`
                );
            }

            for (
                let index: number = 0;
                index < rows.length;
                index++
            ) {
                const row: unknown =
                    rows[index];

                if (
                    !Array.isArray(row) ||
                    row.length < 2
                ) {
                    errors.push(
                        `Full checkpoint row ${index} is invalid.`
                    );

                    continue;
                }

                const identityId:
                    string =
                        safeString(
                            row[0]
                        ).trim();

                const balance:
                    number | null =
                        row[1] === null
                            ? null
                            : safeInt(
                                  row[1]
                              );

                if (!identityId) {
                    errors.push(
                        `Full checkpoint row ${index} has no identity ID.`
                    );
                }

                if (
                    row[1] !== null &&
                    balance === null
                ) {
                    errors.push(
                        `Full checkpoint row ${index} balance is not a safe integer or null.`
                    );
                }

                const displayName =
                    resolveLilyMoneyName(
                        names,
                        identityId,
                        ""
                    );

                fullCheckpointRows.push({
                    identityId,
                    displayName,
                    balanceCents:
                        balance,
                });

                const checkpointPerson:
                    LilyMoneyPerson = {
                        identityId,
                        rawName: "",
                        displayName,
                        role:
                            "checkpoint",
                    };

                people.push(
                    checkpointPerson
                );

                effects.push(
                    makeEffect(
                        checkpointPerson,
                        null,
                        balance
                    )
                );
            }

            break;
        }

        case "LOGGING_ENABLED":
        case "LOGGING_DISABLED": {
            person(
                0,
                1,
                "actor"
            );

            break;
        }

        case null:
            break;
    }

    return {
        record,

        type: record.type,
        knownType,

        valid:
            errors.length === 0,

        errors,

        people,
        effects,

        amountCents,
        quantity,

        itemId,
        itemName,

        jobId,
        action,
        sourceId,

        reason,

        jobBatch,

        fullCheckpointRows,

        declaredFullCheckpointCount,
    };
}