import type { JSX, RefObject } from "preact";
import _React, { render, useEffect, useRef } from "preact/compat";
import { LoadingScreenContents } from "../app";
import Notice from "../components/Notice";

/**
 * Props for the {@link RepairForcedWorldCorruptionTab} component.
 */
export interface RepairForcedWorldCorruptionTabProps {
    tab: TabManagerTab;
}

/**
 * The repair forced world corruption tab.
 *
 * Upon being rendered, this tab will attempt to repair the forced world corruption, and will display the result.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function RepairForcedWorldCorruptionTab(props: RepairForcedWorldCorruptionTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The repair forced world corruption sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): void => {
        async function repairForcedWorldCorruption(): Promise<void> {
            if (!props.tab.db!.isOpen()) await props.tab.awaitDBOpen;
            if (!props.tab.cachedDBKeys) await props.tab.awaitCachedDBKeys;
            // const tempElement: HTMLDivElement = document.createElement("div");
            if (props.tab.cachedDBKeys!.ForcedWorldCorruption.length === 0) {
                if (!containerRef.current) return;
                render(null, containerRef.current);
                render(<LoadingScreenContents message="Nothing to repair." />, containerRef.current /* tempElement */);
            } else {
                for (const key of props.tab.cachedDBKeys!.ForcedWorldCorruption) {
                    await props.tab.db!.delete(key);
                }
                props.tab.cachedDBKeys!.ForcedWorldCorruption.length = 0;
                props.tab.setLevelDBIsModified();
                const repairForcedWorldCorruptionButton: HTMLElement | null = document.querySelector(
                    '.sidebar_button[data-path-id="repair-forced-world-corruption"]'
                );
                if (repairForcedWorldCorruptionButton) repairForcedWorldCorruptionButton.hidden = !props.tab.cachedDBKeys?.ForcedWorldCorruption?.length;
                if (!containerRef.current) return;
                render(null, containerRef.current);
                render(
                    <div style="flex: 1; overflow: auto; min-width: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div>Forced world corruption has been repaired.</div>
                    </div>,
                    containerRef.current /* tempElement */
                );
            }
            // if (!containerRef.current) return;
            // containerRef.current.replaceChildren(...tempElement.children);
            $("#left_sidebar sidebar_botton[data-path-id=repair-forced-world-corruption]").remove();
        }
        repairForcedWorldCorruption().catch((reason: unknown): void => {
            console.error(reason);
            if (!containerRef.current) return;
            render(null, containerRef.current);
            render(
                <>
                    <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
                        <Notice
                            title="Error"
                            subtitle="An error occured while repairing the forced world corruption."
                            detail={null}
                            image="generic_error"
                            style={{ height: "auto" }}
                        />
                        <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>
                            {reason instanceof Error ?
                                `${reason.stack ?? reason.toString()}${
                                    reason.cause !== undefined ?
                                        // TODO: This does not work properly if the cause is an error, make this and all other places that add caused by use the same function which can recusively stringify it (to a point, so as to avoid infinite loops). Also make areas that don't show caused by show it too.
                                        `\nCaused by: ${String(
                                            ((): unknown => {
                                                try {
                                                    return typeof reason.cause === "object" ? JSON.stringify(reason.cause) : reason.cause;
                                                } catch {
                                                    return reason.cause;
                                                }
                                            })()
                                        )}`
                                    :   ""
                                }`
                            :   String(
                                    (function formatUnknownErrorValue(): unknown {
                                        try {
                                            return typeof reason === "object" ? JSON.stringify(reason) : reason;
                                        } catch {
                                            return reason;
                                        }
                                    })()
                                )
                            }
                        </div>
                    </div>
                </>,
                containerRef.current
            );
        });
    });
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;">
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                <LoadingScreenContents message="Repairing forced world corruption..." />
            </div>
        </div>
    );
}
