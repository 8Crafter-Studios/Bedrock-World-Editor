import type { JSX } from "preact";
import React from "preact/compat";
import GenericNBTEditorTab from "./genericNBTEditor";

export interface FunTabProps {
    tab: TabManagerTab;
}

export default function FunTab(props: FunTabProps): JSX.SpecificElement<"center"> {
    const forceCorruptWorldButtonRef: React.RefObject<HTMLButtonElement> = React.useRef<HTMLButtonElement>(null);
    let forceCorruptWorldButtonInitiallyDisabled: boolean = !props.tab.cachedDBKeys || props.tab.cachedDBKeys.ForcedWorldCorruption.length > 0;
    React.useEffect((): void => {
        if (forceCorruptWorldButtonInitiallyDisabled) {
            props.tab.awaitCachedDBKeys?.then((): void => {
                if (props.tab.cachedDBKeys && props.tab.cachedDBKeys.ForcedWorldCorruption.length === 0) {
                    if (!forceCorruptWorldButtonRef.current) return;
                    forceCorruptWorldButtonRef.current.disabled = false;
                }
            });
        }
    });
    return (
        <div style={{ display: "grid" }}>
            <button
                type="button"
                title="This feature will be added in a future update."
                class="funTabButton"
                onClick={(): void => {
                    // TO-DO
                }}
                disabled
            >
                Replace Biomes With Checkerboard Biome Pattern
            </button>
            <button
                type="button"
                class="funTabButton"
                onClick={async (): Promise<void> => {
                    if (!forceCorruptWorldButtonRef.current) return;
                    if (!props.tab.cachedDBKeys) return;
                    if (props.tab.cachedDBKeys.ForcedWorldCorruption.length > 0) return;
                    if (!props.tab.db) return;
                    forceCorruptWorldButtonRef.current.disabled = true;
                    try {
                        await props.tab.db.put("DedicatedServerForcedCorruption", "true");
                        props.tab.setLevelDBIsModified(true);
                    } catch (e) {
                        console.error(e);
                    }
                }}
                disabled={forceCorruptWorldButtonInitiallyDisabled}
                ref={forceCorruptWorldButtonRef}
            >
                Force Corrupt World (the same as the <code>/corruptworld</code> command in the dev builds of Bedrock Edition)
            </button>
        </div>
    );
}
