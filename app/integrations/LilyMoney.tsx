import type { JSX } from "preact";
import _React, { useEffect, useState } from "preact/compat";

import type { Integration, IntegrationMenuProps } from ".";
import {
    detectLilyMoneyData,
    scanLilyMoneyData,
    type LilyMoneyDiscoveryResult,
} from "./LilyMoney/LilyMoneyData";
import LilyMoneyWorkspace from "./LilyMoney/LilyMoneyWorkspace";

const LilyMoney = {
    id: "LilyMoney",
    name: "LilyMoney",
    author: "LilyTheCuteCatgirl",
    description: "LilyMoney economy database integration.",

    async checkIfDetected(tab: TabManagerTab): Promise<boolean> {
        return detectLilyMoneyData(tab);
    },

    integrationMenu(props: IntegrationMenuProps): JSX.Element {
        const [result, setResult] = useState<LilyMoneyDiscoveryResult | null>(null);
        const [progress, setProgress] = useState<string>("Waiting to scan...");
        const [fatalError, setFatalError] = useState<string | null>(null);
        const [scanNumber, setScanNumber] = useState<number>(0);

        useEffect((): (() => void) => {
            let cancelled: boolean = false;

            setFatalError(null);
            setProgress("Starting LilyMoney scan...");

            scanLilyMoneyData(
                props.tab,
                (message: string): void => {
                    if (!cancelled) setProgress(message);
                }
            ).then(
                (scanResult: LilyMoneyDiscoveryResult): void => {
                    if (cancelled) return;

                    setResult(scanResult);
                    setProgress("Scan complete");
                },
                (error: unknown): void => {
                    if (cancelled) return;

                    const message: string =
                        error instanceof Error
                            ? error.stack ?? error.message
                            : String(error);

                    setFatalError(message);
                    setProgress("Scan failed");

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

        if (fatalError !== null && result === null) {
            return (
                <div
                    style={{
                        height: "100%",
                        boxSizing: "border-box",
                        overflow: "auto",
                        padding: "20px",
                    }}
                >
                    <button
                        type="button"
                        class="genericRoundButton"
                        onClick={(): void => props.closeIntegrationMenu()}
                    >
                        ← Back
                    </button>

                    <h2>LilyMoney</h2>
                    <h3>Database scan failed</h3>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {fatalError}
                    </pre>

                    <button
                        type="button"
                        class="genericRoundButton"
                        onClick={(): void =>
                            setScanNumber((current: number): number => current + 1)
                        }
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        if (result === null) {
            return (
                <div
                    style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxSizing: "border-box",
                        padding: "24px",
                    }}
                >
                    <div style={{ textAlign: "center", maxWidth: "520px" }}>
                        <div style={{ fontSize: "28px", fontWeight: 760 }}>LilyMoney</div>
                        <div style={{ opacity: 0.7, marginTop: "7px" }}>{progress}</div>
                    </div>
                </div>
            );
        }

        return (
            <LilyMoneyWorkspace
                result={result}
                progress={progress}
                onBack={(): void => props.closeIntegrationMenu()}
                onRescan={(): void =>
                    setScanNumber((current: number): number => current + 1)
                }
            />
        );
    },
} satisfies Integration;

export default LilyMoney;
