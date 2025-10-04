import type { JSX, RefObject } from "preact";
import _React, { render, useEffect, useRef } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import { entryContentTypeToFormatMap, getKeyDisplayName } from "mcbe-leveldb";
import NBT from "prismarine-nbt";
import { readFileSync } from "node:fs";
import path from "node:path";
import { LoadingScreenContents } from "../app";
import SNBTEditor from "../components/SNBTEditor";
import PrismarineNBTEditor from "../components/PrismarineNBTEditor";

export interface RepairForcedWorldCorruptionTabProps {
    tab: TabManagerTab;
}

export default function RepairForcedWorldCorruptionTab(props: RepairForcedWorldCorruptionTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The repair forced world corruption sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): void => {
        async function repairForcedWorldCorruption(): Promise<void> {
            props.tab.db!.isOpen() || (await props.tab.awaitDBOpen);
            props.tab.cachedDBKeys || props.tab.awaitCachedDBKeys;
            // const tempElement: HTMLDivElement = document.createElement("div");
            if (props.tab.cachedDBKeys!.ForcedWorldCorruption.length === 0) {
                if (!containerRef.current) return;
                render(null, containerRef.current);
                render(<LoadingScreenContents message="Nothing to repair." />, containerRef.current /* tempElement */);
            } else {
                for (const key of props.tab.cachedDBKeys!.ForcedWorldCorruption) {
                    await props.tab.db!.delete(key);
                }
                props.tab.setLevelDBIsModified();
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
        repairForcedWorldCorruption();
    });
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;">
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                <LoadingScreenContents message="Repairing forced world corruption..." />
            </div>
        </div>
    );
}
