import type { JSX, RefObject } from "preact";
import { useEffect, useRef } from "preact/compat";

/**
 * The props for the {@link FunTab} component.
 */
export interface FunTabProps {
    tab: TabManagerTab;
}

/**
 * The fun tab.
 *
 * This tab has miscellaneous options for messing with the world.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function FunTab(props: FunTabProps): JSX.SpecificElement<"div"> {
    const forceCorruptWorldButtonRef: RefObject<HTMLButtonElement> = useRef<HTMLButtonElement>(null);
    const forceCorruptWorldButtonInitiallyDisabled: boolean = !props.tab.cachedDBKeys || props.tab.cachedDBKeys.ForcedWorldCorruption.length > 0;
    useEffect((): void => {
        if (forceCorruptWorldButtonInitiallyDisabled) {
            void props.tab.awaitCachedDBKeys?.then((): void => {
                if (props.tab.cachedDBKeys?.ForcedWorldCorruption.length === 0) {
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
                    // TODO
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
                        const keyBuffer: Buffer = Buffer.from("DedicatedServerForcedCorruption");
                        await props.tab.db.put(keyBuffer, "true");
                        if (!props.tab.cachedDBKeys.ForcedWorldCorruption.some((key) => key.equals(keyBuffer))) {
                            props.tab.cachedDBKeys.ForcedWorldCorruption.push(keyBuffer);
                        }
                        props.tab.setLevelDBIsModified();
                        const repairForcedWorldCorruptionButton: HTMLElement | null = document.querySelector(
                            '.sidebar_button[data-path-id="repair-forced-world-corruption"]'
                        );
                        if (repairForcedWorldCorruptionButton) {
                            repairForcedWorldCorruptionButton.hidden = !props.tab.cachedDBKeys?.ForcedWorldCorruption?.length;
                        }
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
