export interface LilyMoneyNameEntry {
    identityId: string;
    name: string;
}

export interface LilyMoneyNameDatabase {
    entries: LilyMoneyNameEntry[];
    byIdentity: Record<string, string>;

    chunkCountExpected: number | null;
    chunkCountRead: number;
    legacySingleChunk: boolean;

    errors: string[];
    warnings: string[];
}

type UnknownRecord = Record<string, unknown>;

const NAME_DATABASE_PROPERTY = "lilynames:nameDataBase";

const NAME_DATABASE_COUNT_PROPERTY = "lilynames:nameDataBaseCount";

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toSafeInteger(value: unknown): number | null {
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

function chunkKey(index: number): string {
    return index === 1 ? NAME_DATABASE_PROPERTY : `${NAME_DATABASE_PROPERTY}${index}`;
}

function parseChunk(value: unknown, key: string, errors: string[]): UnknownRecord | null {
    if (typeof value !== "string" || value.length === 0) {
        errors.push(`${key} is missing or is not a JSON string.`);

        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);

        if (!isRecord(parsed)) {
            errors.push(`${key} does not contain a JSON object.`);

            return null;
        }

        return parsed;
    } catch (error) {
        errors.push(`${key} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`);

        return null;
    }
}

export function emptyLilyMoneyNameDatabase(): LilyMoneyNameDatabase {
    return {
        entries: [],
        byIdentity: {},

        chunkCountExpected: null,
        chunkCountRead: 0,
        legacySingleChunk: false,

        errors: [],
        warnings: [],
    };
}

export function readLilyMoneyNameDatabase(namespace: UnknownRecord): LilyMoneyNameDatabase {
    const errors: string[] = [];
    const warnings: string[] = [];

    const merged: Record<string, string> = {};

    const rawCount: number | null = toSafeInteger(namespace[NAME_DATABASE_COUNT_PROPERTY]);

    const chunkCountExpected: number | null = rawCount !== null && rawCount >= 1 ? rawCount : null;

    const legacySingleChunk: boolean = chunkCountExpected === null;

    let chunkCountRead: number = 0;

    const mergeChunk = (chunk: UnknownRecord, key: string): void => {
        chunkCountRead++;

        for (const [rawIdentity, rawName] of Object.entries(chunk)) {
            const identityId: string = String(rawIdentity).trim();

            if (!identityId) {
                warnings.push(`${key} contains an empty identity ID.`);

                continue;
            }

            if (typeof rawName !== "string" || rawName.length === 0) {
                warnings.push(`${key} has a non-string/empty name for identity ${identityId}.`);

                continue;
            }

            if (identityId in merged && merged[identityId] !== rawName) {
                warnings.push(`Identity ${identityId} appears more than once with different names; later chunk value wins.`);
            }

            merged[identityId] = rawName;
        }
    };

    if (chunkCountExpected === null) {
        // Backwards compatibility with
        // LilyMoney's old single-property DB.
        const single: UnknownRecord | null = parseChunk(namespace[NAME_DATABASE_PROPERTY], NAME_DATABASE_PROPERTY, errors);

        if (single) {
            mergeChunk(single, NAME_DATABASE_PROPERTY);
        }
    } else {
        for (let index: number = 1; index <= chunkCountExpected; index++) {
            const key: string = chunkKey(index);

            const chunk: UnknownRecord | null = parseChunk(namespace[key], key, errors);

            if (chunk) {
                mergeChunk(chunk, key);
            }
        }
    }

    const entries: LilyMoneyNameEntry[] = Object.entries(merged)
        .map(
            ([identityId, name]): LilyMoneyNameEntry => ({
                identityId,
                name,
            })
        )
        .sort((a: LilyMoneyNameEntry, b: LilyMoneyNameEntry): number =>
            a.identityId.localeCompare(b.identityId, undefined, {
                numeric: true,
            })
        );

    return {
        entries,
        byIdentity: merged,

        chunkCountExpected,
        chunkCountRead,
        legacySingleChunk,

        errors,
        warnings,
    };
}

export function resolveLilyMoneyName(names: LilyMoneyNameDatabase, identityId: string, fallbackName: string = ""): string {
    return names.byIdentity[identityId] || fallbackName || (identityId ? `Identity ${identityId}` : "Unknown");
}
