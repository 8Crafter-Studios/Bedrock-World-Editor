export interface LilyMoneyRecord {
    id: number;
    timestamp: number;
    type: string;
    payload: unknown;

    shardIndex: number | null;
    source: "sealed" | "active";
    sourceKey: string;

    lineNumber: number;
}

export interface LilyMoneyRecordDecodeResult {
    records: LilyMoneyRecord[];

    errors: string[];
    warnings: string[];

    recordCountExpected: number | null;
    recordCountDecoded: number;

    firstRecordIdExpected: number | null;
    lastRecordIdExpected: number | null;

    pageCountExpected: number | null;
    pageCountFound: number;

    idsContinuous: boolean | null;

    checksumExpected: string | null;
    checksumActual: string | null;
    checksumValid: boolean | null;
}

type UnknownRecord = Record<string, unknown>;

export function lilyMoneyInteger(value: unknown): number | null {
    if (
        typeof value === "number" &&
        Number.isSafeInteger(value)
    ) {
        return value;
    }

    if (typeof value === "bigint") {
        const numberValue: number = Number(value);

        return Number.isSafeInteger(numberValue)
            ? numberValue
            : null;
    }

    // Some LilyMoney timestamps are intentionally stored as strings.
    if (
        typeof value === "string" &&
        /^-?\d+$/.test(value)
    ) {
        const numberValue: number = Number(value);

        return Number.isSafeInteger(numberValue)
            ? numberValue
            : null;
    }

    return null;
}

/**
 * Exact implementation used by LilyMoney's JavaScript logger.
 *
 * IMPORTANT:
 * This hashes JavaScript UTF-16 code units using charCodeAt().
 * Do not replace this with UTF-8 byte hashing.
 */
export function lilyMoneyFNV1a32(
    strings: string[]
): string {
    let hash: number = 0x811c9dc5;

    for (const text of strings) {
        for (let index: number = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index);

            hash = Math.imul(
                hash,
                0x01000193
            );
        }
    }

    return (hash >>> 0)
        .toString(16)
        .padStart(8, "0");
}

function pageIndexFromKey(key: string): number {
    const match: RegExpMatchArray | null =
        key.match(/^lilymoney:page_(\d+)$/);

    return match
        ? Number(match[1])
        : Number.MAX_SAFE_INTEGER;
}

export function decodeLilyMoneyRecords(
    namespace: UnknownRecord,
    context: {
        source: "sealed" | "active";
        sourceKey: string;
        shardIndex: number | null;
    }
): LilyMoneyRecordDecodeResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const records: LilyMoneyRecord[] = [];

    const dbFormat: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:db_format"]
        );

    const recordFormat: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:record_format"]
        );

    if (dbFormat !== 1) {
        errors.push(
            `Unsupported LilyMoney DB format: ${String(dbFormat)}.`
        );
    }

    if (recordFormat !== 1) {
        errors.push(
            `Unsupported LilyMoney record format: ${String(recordFormat)}.`
        );
    }

    const recordCountExpected: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:record_count"]
        );

    const firstRecordIdExpected: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:first_record_id"]
        );

    const lastRecordIdExpected: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:last_record_id"]
        );

    const pageCountExpected: number | null =
        lilyMoneyInteger(
            namespace["lilymoney:page_count"]
        );

    const pageKeys: string[] =
        Object.keys(namespace)
            .filter(
                (key: string): boolean =>
                    /^lilymoney:page_\d+$/.test(key)
            )
            .sort(
                (a: string, b: string): number =>
                    pageIndexFromKey(a) -
                    pageIndexFromKey(b)
            );

    const pageCountFound: number =
        pageKeys.length;

    if (
        pageCountExpected !== null &&
        pageCountFound !== pageCountExpected
    ) {
        errors.push(
            `Page count mismatch: metadata says ${pageCountExpected}, found ${pageCountFound}.`
        );
    }

    const pages: string[] = [];

    if (pageCountExpected !== null) {
        for (
            let index: number = 0;
            index < pageCountExpected;
            index++
        ) {
            const key: string =
                `lilymoney:page_${index}`;

            const value: unknown =
                namespace[key];

            if (typeof value !== "string") {
                errors.push(
                    `Missing or non-string record page ${index}.`
                );

                continue;
            }

            pages.push(value);
        }
    } else {
        for (const key of pageKeys) {
            const value: unknown =
                namespace[key];

            if (typeof value === "string") {
                pages.push(value);
            }
        }
    }

    const checksumExpected: string | null =
        typeof namespace["lilymoney:checksum_fnv1a32"] === "string"
            ? namespace["lilymoney:checksum_fnv1a32"] as string
            : null;

    let checksumActual: string | null = null;
    let checksumValid: boolean | null = null;

    if (
        pageCountExpected === null ||
        pages.length === pageCountExpected
    ) {
        checksumActual =
            lilyMoneyFNV1a32(pages);

        if (checksumExpected !== null) {
            checksumValid =
                checksumActual === checksumExpected;

            if (!checksumValid) {
                errors.push(
                    `Checksum mismatch: expected ${checksumExpected}, got ${checksumActual}.`
                );
            }
        }
    }

    const joined: string =
        pages.join("");

    if (
        joined.length > 0 &&
        !joined.endsWith("\n")
    ) {
        warnings.push(
            "Final record is not newline-terminated."
        );
    }

    const lines: string[] =
        joined.split("\n");

    // LilyMoney normally ends every record with "\\n".
    // Ignore that final empty split entry.
    if (
        lines.length > 0 &&
        lines[lines.length - 1] === ""
    ) {
        lines.pop();
    }

    for (
        let lineIndex: number = 0;
        lineIndex < lines.length;
        lineIndex++
    ) {
        const line: string =
            lines[lineIndex]!;

        if (line.length === 0) {
            warnings.push(
                `Empty record line at line ${lineIndex + 1}.`
            );

            continue;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(line);
        } catch (error) {
            errors.push(
                `Invalid JSON at line ${lineIndex + 1}: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            );

            continue;
        }

        if (
            !Array.isArray(parsed) ||
            parsed.length !== 4
        ) {
            errors.push(
                `Record line ${lineIndex + 1} is not a DB-v1 [id, timestamp, type, payload] record.`
            );

            continue;
        }

        const id: number | null =
            lilyMoneyInteger(parsed[0]);

        const timestamp: number | null =
            lilyMoneyInteger(parsed[1]);

        const type: unknown =
            parsed[2];

        if (id === null || id < 0) {
            errors.push(
                `Invalid record ID at line ${lineIndex + 1}.`
            );

            continue;
        }

        if (timestamp === null || timestamp < 0) {
            errors.push(
                `Invalid timestamp at line ${lineIndex + 1}.`
            );

            continue;
        }

        if (typeof type !== "string") {
            errors.push(
                `Invalid event type at line ${lineIndex + 1}.`
            );

            continue;
        }

        records.push({
            id,
            timestamp,
            type,
            payload: parsed[3],

            shardIndex:
                context.shardIndex,

            source:
                context.source,

            sourceKey:
                context.sourceKey,

            lineNumber:
                lineIndex + 1,
        });
    }

    if (
        recordCountExpected !== null &&
        records.length !== recordCountExpected
    ) {
        errors.push(
            `Record count mismatch: metadata says ${recordCountExpected}, decoded ${records.length}.`
        );
    }

    if (records.length > 0) {
        const firstDecoded: number =
            records[0]!.id;

        const lastDecoded: number =
            records[records.length - 1]!.id;

        if (
            firstRecordIdExpected !== null &&
            firstDecoded !== firstRecordIdExpected
        ) {
            errors.push(
                `First record ID mismatch: metadata says ${firstRecordIdExpected}, decoded ${firstDecoded}.`
            );
        }

        if (
            lastRecordIdExpected !== null &&
            lastDecoded !== lastRecordIdExpected
        ) {
            errors.push(
                `Last record ID mismatch: metadata says ${lastRecordIdExpected}, decoded ${lastDecoded}.`
            );
        }
    } else if (
        recordCountExpected !== null &&
        recordCountExpected > 0
    ) {
        errors.push(
            "Shard metadata says records exist, but none could be decoded."
        );
    }

    let idsContinuous: boolean | null =
        records.length > 0
            ? true
            : null;

    for (
        let index: number = 1;
        index < records.length;
        index++
    ) {
        const previous: LilyMoneyRecord =
            records[index - 1]!;

        const current: LilyMoneyRecord =
            records[index]!;

        if (current.id !== previous.id + 1) {
            idsContinuous = false;

            errors.push(
                `Record ID discontinuity: #${previous.id} is followed by #${current.id}.`
            );
        }
    }

    return {
        records,

        errors,
        warnings,

        recordCountExpected,
        recordCountDecoded:
            records.length,

        firstRecordIdExpected,
        lastRecordIdExpected,

        pageCountExpected,
        pageCountFound,

        idsContinuous,

        checksumExpected,
        checksumActual,
        checksumValid,
    };
}