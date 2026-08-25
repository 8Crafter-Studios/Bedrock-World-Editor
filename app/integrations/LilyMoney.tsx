import type { JSX } from "preact";
import _React, { useEffect, useState } from "preact/compat";


import {
    assembleLilyMoneyDatabase,
    type LilyMoneyDatabase,
} from "./LilyMoneyDatabase";


import type { Integration, IntegrationMenuProps } from ".";
import {
    LILYMONEY_STRUCTURE_PREFIX,
    scanLilyMoneyData,
    detectLilyMoneyData,
    type LilyMoneyDiscoveryResult,
    type LilyMoneyPropertySummary,
    type LilyMoneyStorageSummary,
} from "./LilyMoneyData";

import type {
    LilyMoneyRecord,
} from "./LilyMoneyRecords";

function PropertyTable(props: {
    properties: LilyMoneyPropertySummary[];
}): JSX.Element {
    if (props.properties.length === 0) {
        return <p>No properties found.</p>;
    }

    return (
        <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: "left" }}>Category</th>
                        <th style={{ textAlign: "left" }}>Key</th>
                        <th style={{ textAlign: "left" }}>Type</th>
                        <th style={{ textAlign: "left" }}>Value / Preview</th>
                    </tr>
                </thead>

                <tbody>
                    {props.properties.map(
                        (property: LilyMoneyPropertySummary): JSX.Element => (
                            <tr key={property.key}>
                                <td style={{ verticalAlign: "top", paddingRight: "12px" }}>
                                    {property.category}
                                </td>

                                <td style={{ verticalAlign: "top", paddingRight: "12px" }}>
                                    <code>{property.key}</code>
                                </td>

                                <td style={{ verticalAlign: "top", paddingRight: "12px" }}>
                                    {property.type}
                                </td>

                                <td
                                    style={{
                                        verticalAlign: "top",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    <code>{property.preview}</code>
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>
        </div>
    );
}

function StorageDetails(props: {
    storage: LilyMoneyStorageSummary;
}): JSX.Element {
    const storage: LilyMoneyStorageSummary = props.storage;

    return (
        <details style={{ marginBottom: "10px" }}>
            <summary>
                <strong>
                    {storage.source === "sealed" ? "Sealed" : "ActorPrefix"} shard{" "}
                    {storage.shardIndex ?? "?"}
                </strong>

                {storage.isExpectedActiveShard ? " — EXPECTED ACTIVE SHARD" : ""}
            </summary>

            <div style={{ marginLeft: "18px", marginTop: "8px" }}>
                {/* ------------------------------------------------------ */}
                {/* BASIC SHARD INFORMATION                                */}
                {/* ------------------------------------------------------ */}

                <p>
                    <strong>Source:</strong>{" "}
                    <code>{storage.sourceKey}</code>
                </p>

                <p>
                    <strong>Identifier:</strong>{" "}
                    <code>{storage.identifier ?? "unknown"}</code>
                </p>

                <p>
                    <strong>Shard index:</strong>{" "}
                    {storage.shardIndex ?? "unknown"}
                    <br />

                    <strong>DB format:</strong>{" "}
                    {storage.dbFormat ?? "unknown"}
                    <br />

                    <strong>Record format:</strong>{" "}
                    {storage.recordFormat ?? "unknown"}
                    <br />

                    <strong>DB kind:</strong>{" "}
                    {storage.dbKind ?? "unknown"}
                    <br />

                    <strong>Record count from metadata:</strong>{" "}
                    {storage.recordCount ?? "unknown"}
                    <br />

                    <strong>Record IDs:</strong>{" "}
                    {storage.firstRecordId ?? "?"} →{" "}
                    {storage.lastRecordId ?? "?"}
                    <br />

                    <strong>Pages from metadata:</strong>{" "}
                    {storage.pageCount ?? "unknown"}
                    <br />

                    <strong>Actual page keys found:</strong>{" "}
                    {storage.pageKeys.length}
                    <br />

                    <strong>Total page characters:</strong>{" "}
                    {storage.pageCharacters.toLocaleString()}
                    <br />

                    <strong>Sealed:</strong>{" "}
                    {storage.sealed === null
                        ? "unknown"
                        : String(storage.sealed)}
                    <br />

                    <strong>Stored checksum:</strong>{" "}
                    {storage.checksum ?? "none"}
                    <br />

                    <strong>World ID:</strong>{" "}
                    {storage.worldId ?? "unknown"}
                </p>

                {/* ------------------------------------------------------ */}
                {/* RECORD DECODER HEALTH                                  */}
                {/* ------------------------------------------------------ */}

                <h4>Record Decoder</h4>

                <p>
                    <strong>Decoded records:</strong>{" "}
                    {storage.records.length}
                    <br />

                    <strong>ID continuity:</strong>{" "}
                    {storage.idsContinuous === null
                        ? "not applicable"
                        : storage.idsContinuous
                          ? "VALID"
                          : "BROKEN"}
                    <br />

                    <strong>Checksum expected:</strong>{" "}
                    {storage.checksum ?? "none"}
                    <br />

                    <strong>Checksum calculated:</strong>{" "}
                    {storage.checksumActual ?? "not calculated"}
                    <br />

                    <strong>Checksum status:</strong>{" "}
                    {storage.checksumValid === null
                        ? storage.sealed
                            ? "not available"
                            : "active shard — no sealed checksum yet"
                        : storage.checksumValid
                          ? "VALID"
                          : "INVALID"}
                </p>

                {/* Decoder errors only appear if something is wrong. */}
                {storage.recordDecodeErrors.length > 0 && (
                    <>
                        <h4>Decoder Errors</h4>

                        <ul>
                            {storage.recordDecodeErrors.map(
                                (
                                    error: string,
                                    index: number
                                ): JSX.Element => (
                                    <li key={`${index}-${error}`}>
                                        <code>{error}</code>
                                    </li>
                                )
                            )}
                        </ul>
                    </>
                )}

                {/* Warnings are less serious than errors. */}
                {storage.recordDecodeWarnings.length > 0 && (
                    <>
                        <h4>Decoder Warnings</h4>

                        <ul>
                            {storage.recordDecodeWarnings.map(
                                (
                                    warning: string,
                                    index: number
                                ): JSX.Element => (
                                    <li key={`${index}-${warning}`}>
                                        <code>{warning}</code>
                                    </li>
                                )
                            )}
                        </ul>
                    </>
                )}

                {/* ------------------------------------------------------ */}
                {/* RAW DECODED RECORDS                                    */}
                {/* ------------------------------------------------------ */}

                <details style={{ marginBottom: "10px" }}>
                    <summary>
                        Raw decoded records ({storage.records.length})
                    </summary>

                    <div style={{ marginTop: "8px" }}>
                        <RawRecordTable records={storage.records} />
                    </div>
                </details>

                {/* ------------------------------------------------------ */}
                {/* PAGE INFORMATION                                       */}
                {/* ------------------------------------------------------ */}

                <p>
                    <strong>Page keys:</strong>
                </p>

                {storage.pageKeys.length > 0 ? (
                    <ul>
                        {storage.pageKeys.map(
                            (pageKey: string): JSX.Element => (
                                <li key={pageKey}>
                                    <code>{pageKey}</code>
                                </li>
                            )
                        )}
                    </ul>
                ) : (
                    <p>No record pages found.</p>
                )}

                {/* ------------------------------------------------------ */}
                {/* ALL RAW STORAGE DYNAMIC PROPERTIES                     */}
                {/* ------------------------------------------------------ */}

                <details>
                    <summary>All storage dynamic properties</summary>

                    <div style={{ marginTop: "8px" }}>
                        <PropertyTable properties={storage.properties} />
                    </div>
                </details>
            </div>
        </details>
    );
}


function RawRecordTable(props: {
    records: LilyMoneyRecord[];
}): JSX.Element {
    if (props.records.length === 0) {
        return <p>No decoded records.</p>;
    }

    return (
        <div style={{ overflow: "auto" }}>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                }}
            >
                <thead>
                    <tr>
                        <th style={{ textAlign: "left" }}>
                            ID
                        </th>

                        <th style={{ textAlign: "left" }}>
                            Timestamp
                        </th>

                        <th style={{ textAlign: "left" }}>
                            Event
                        </th>

                        <th style={{ textAlign: "left" }}>
                            Shard
                        </th>

                        <th style={{ textAlign: "left" }}>
                            Payload
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {props.records.map(
                        (
                            record: LilyMoneyRecord
                        ): JSX.Element => (
                            <tr
                                key={`${record.source}-${record.shardIndex}-${record.id}`}
                            >
                                <td
                                    style={{
                                        verticalAlign: "top",
                                        paddingRight: "12px",
                                    }}
                                >
                                    #{record.id}
                                </td>

                                <td
                                    style={{
                                        verticalAlign: "top",
                                        paddingRight: "12px",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {new Date(
                                        record.timestamp
                                    ).toLocaleString()}

                                    <br />

                                    <code>
                                        {record.timestamp}
                                    </code>
                                </td>

                                <td
                                    style={{
                                        verticalAlign: "top",
                                        paddingRight: "12px",
                                    }}
                                >
                                    <strong>
                                        {record.type}
                                    </strong>
                                </td>

                                <td
                                    style={{
                                        verticalAlign: "top",
                                        paddingRight: "12px",
                                    }}
                                >
                                    {record.shardIndex ?? "?"}
                                </td>

                                <td
                                    style={{
                                        verticalAlign: "top",
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    <code>
                                        {JSON.stringify(
                                            record.payload
                                        )}
                                    </code>
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
            </table>
        </div>
    );
}

function DiscoveryResults(props: {
    result: LilyMoneyDiscoveryResult;
}): JSX.Element {
    const result: LilyMoneyDiscoveryResult = props.result;

    const database: LilyMoneyDatabase =
        assembleLilyMoneyDatabase(result);

    const expectedActiveStorages: number = result.activeStorages.filter(
        (storage: LilyMoneyStorageSummary): boolean =>
            storage.isExpectedActiveShard
    ).length;

    return (
        <>
            <h3>Canonical LilyMoney Database</h3>

            <p>
                <strong>Selected shards:</strong>{" "}
                {database.selectedShards.length}
                <br />

                <strong>Sealed shards:</strong>{" "}
                {database.sealedShardCount}
                <br />

                <strong>Active shard:</strong>{" "}
                {database.activeShardFound
                    ? "FOUND"
                    : "not found"}
                <br />

                <strong>Canonical records:</strong>{" "}
                {database.records.length}
                <br />

                <strong>Global record range:</strong>{" "}
                {database.firstRecordId === null
                    ? "none"
                    : `#${database.firstRecordId} → #${database.lastRecordId}`}
                <br />

                <strong>Global ID continuity:</strong>{" "}
                {database.idsContinuous === null
                    ? "not applicable"
                    : database.idsContinuous
                    ? "VALID"
                    : "BROKEN"}
                <br />

                <strong>Shard continuity:</strong>{" "}
                {database.shardIndexesContinuous === null
                    ? "not applicable"
                    : database.shardIndexesContinuous
                    ? "VALID"
                    : "BROKEN"}
                <br />

                <strong>Duplicate record IDs:</strong>{" "}
                {database.duplicateRecordIds.length}
                <br />

                <strong>Missing record ranges:</strong>{" "}
                {database.missingRecordRanges.length}
            </p>

            {database.errors.length > 0 && (
                <>
                    <h4>Database Errors</h4>

                    <ul>
                        {database.errors.map(
                            (error: string): JSX.Element => (
                                <li key={error}>
                                    <code>{error}</code>
                                </li>
                            )
                        )}
                    </ul>
                </>
            )}

            {database.warnings.length > 0 && (
                <>
                    <h4>Database Warnings</h4>

                    <ul>
                        {database.warnings.map(
                            (warning: string): JSX.Element => (
                                <li key={warning}>
                                    <code>{warning}</code>
                                </li>
                            )
                        )}
                    </ul>
                </>
            )}

            <hr />

            <h3>Discovery Summary</h3>

            <p>
                <strong>LilyMoney world namespace:</strong>{" "}
                {result.worldNamespaceFound ? "FOUND" : "NOT FOUND"}
                <br />

                <strong>World ID:</strong>{" "}
                {result.worldId ?? "unknown"}
                <br />

                <strong>Logging:</strong>{" "}
                {result.loggingEnabled === null
                    ? "unknown"
                    : result.loggingEnabled
                      ? "enabled"
                      : "disabled"}
                <br />

                <strong>Active shard marked open:</strong>{" "}
                {result.activeOpen === null
                    ? "unknown"
                    : String(result.activeOpen)}
                <br />

                <strong>Expected active shard:</strong>{" "}
                {result.activeShardIndex ?? "unknown"}
                <br />

                <strong>Last sealed record ID:</strong>{" "}
                {result.lastSealedRecordId ?? "unknown"}
            </p>

            <hr />

            <h3>Data Sources Found</h3>

            <p>
                <strong>World dynamic properties:</strong>{" "}
                {result.worldProperties.length}
                <br />

                <strong>Name Database chunks:</strong>{" "}
                {result.nameDatabaseChunkCount}
                <br />

                <strong>Pending job batch state:</strong>{" "}
                {result.pendingJobBatchStateFound ? "FOUND" : "not present"}
                <br />

                <strong>Recovery-related properties:</strong>{" "}
                {result.recoveryPropertyCount}
                <br />

                <strong>LilyMoney structure keys:</strong>{" "}
                {result.structureKeys.length}
                <br />

                <strong>Valid sealed storage entities:</strong>{" "}
                {result.sealedStorages.length}
                <br />

                <strong>ActorPrefix entries scanned:</strong>{" "}
                {result.actorKeysScanned.toLocaleString()}
                <br />

                <strong>money_storage ActorPrefix candidates:</strong>{" "}
                {result.activeStorages.length}
                <br />

                <strong>ActorPrefix entries matching expected active shard:</strong>{" "}
                {expectedActiveStorages}
            </p>

            <hr />

            <h3>World Dynamic Properties</h3>

            <PropertyTable properties={result.worldProperties} />

            <hr />

            <h3>Sealed Money Log Structures</h3>

            {result.sealedStorages.length > 0 ? (
                result.sealedStorages.map(
                    (storage: LilyMoneyStorageSummary): JSX.Element => (
                        <StorageDetails
                            key={storage.sourceKey}
                            storage={storage}
                        />
                    )
                )
            ) : (
                <p>No valid sealed LilyMoney storage entities were found.</p>
            )}

            <hr />

            <h3>ActorPrefix money_storage Entities</h3>

            <p>
                This intentionally shows every LilyMoney storage actor found,
                including stale ActorPrefix blobs. The one whose shard index matches
                the world metadata is marked as the expected active shard.
            </p>

            {result.activeStorages.length > 0 ? (
                result.activeStorages.map(
                    (storage: LilyMoneyStorageSummary): JSX.Element => (
                        <StorageDetails
                            key={storage.sourceKey}
                            storage={storage}
                        />
                    )
                )
            ) : (
                <p>No LilyMoney money_storage ActorPrefix entries were found.</p>
            )}

            <hr />

            <h3>Scan Problems</h3>

            {result.errors.length === 0 ? (
                <p>No scan errors.</p>
            ) : (
                <ul>
                    {result.errors.map(
                        (error: string, index: number): JSX.Element => (
                            <li key={`${index}-${error}`}>
                                <code>{error}</code>
                            </li>
                        )
                    )}
                </ul>
            )}
        </>
    );
}

const LilyMoney = {
    id: "LilyMoney",
    name: "LilyMoney",
    author: "LilyTheCuteCatgirl",
    description: "LilyMoney economy database integration.",

    async checkIfDetected(tab: TabManagerTab): Promise<boolean> {
        return detectLilyMoneyData(tab);
    },

    integrationMenu(props: IntegrationMenuProps): JSX.Element {
        const [result, setResult] =
            useState<LilyMoneyDiscoveryResult | null>(null);

        const [progress, setProgress] =
            useState<string>("Waiting to scan...");

        const [fatalError, setFatalError] =
            useState<string | null>(null);

        const [scanNumber, setScanNumber] =
            useState<number>(0);

        useEffect((): (() => void) => {
            let cancelled: boolean = false;

            setResult(null);
            setFatalError(null);
            setProgress("Starting LilyMoney scan...");

            scanLilyMoneyData(
                props.tab,
                (message: string): void => {
                    if (!cancelled) {
                        setProgress(message);
                    }
                }
            ).then(
                (scanResult: LilyMoneyDiscoveryResult): void => {
                    if (cancelled) {
                        return;
                    }

                    setResult(scanResult);
                    setProgress("Scan complete.");
                },
                (error: unknown): void => {
                    if (cancelled) {
                        return;
                    }

                    const message: string =
                        error instanceof Error
                            ? error.stack ?? error.message
                            : String(error);

                    setFatalError(message);
                    setProgress("Scan failed.");

                    console.error(
                        "[integration::LilyMoney] Data scan failed:",
                        error
                    );
                }
            );

            return (): void => {
                cancelled = true;
            };
        }, [props.tab, scanNumber]);

        return (
            <div
                style={{
                    padding: "16px",
                    overflow: "auto",
                    height: "100%",
                    boxSizing: "border-box",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        class="genericRoundButton"
                        onClick={(): void => props.closeIntegrationMenu()}
                    >
                        ← Back
                    </button>

                    <button
                        type="button"
                        class="genericRoundButton"
                        onClick={(): void => {
                            setScanNumber(
                                (current: number): number => current + 1
                            );
                        }}
                    >
                        Rescan
                    </button>
                </div>

                <h2>LilyMoney Data Discovery</h2>

                <p>
                    This is a temporary diagnostic view. It discovers LilyMoney
                    persistence data, decodes DB-v1 records, and validates the
                    canonical database.
                </p>

                <p>
                    <strong>Status:</strong> {progress}
                </p>

                {fatalError !== null && (
                    <>
                        <h3>Fatal Scan Error</h3>

                        <pre
                            style={{
                                whiteSpace: "pre-wrap",
                                color: "red",
                            }}
                        >
                            {fatalError}
                        </pre>
                    </>
                )}

                {result !== null && (
                    <DiscoveryResults result={result} />
                )}
            </div>
        );
    },
} satisfies Integration;

export default LilyMoney;