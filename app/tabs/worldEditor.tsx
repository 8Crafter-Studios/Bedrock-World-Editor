import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useRef } from "preact/compat";
import { LoadingScreenContents } from "../app";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import { initWorldEditor2DDataStorageObjectProps, WorldEditor2D, type WorldEditor2DDataStorageObject } from "../components/WorldEditor2D";
import Notice from "../components/Notice";
import UnderConstruction from "../components/UnderConstruction";

/**
 * Props for the {@link WorldEditorTab} component.
 */
export interface WorldEditorTabProps {
    tab: TabManagerTab;
}

/**
 * The data storage object for the {@link WorldEditorTab}.
 */
export interface WorldEditorDataStorageObject extends WorldEditor2DDataStorageObject {
    viewMode: "3D" | "2D" | "block" | "search";
}

/**
 * The world editor tab.
 *
 * This tab currently contains a 2D world map, but in the future will have a 3D view, a mode that allows you to enter the coordinates and dimension of a block
 * to manage all data at that block location, and a mode to search the entire world for blocks and possibly other things.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function WorldEditorTab(props: WorldEditorTabProps): JSX.SpecificElement<"div"> {
    if (props.tab.type !== "world" && props.tab.type !== "leveldb") {
        return (
            <Notice
                title="Unsupported Tab Type"
                subtitle={`The world map is not supported for tabs of type ${String(props.tab.type)}.`}
                detail={null}
                image="nothing_to_see"
            />
        );
    }
    const asyncMode: boolean = !props.tab.db?.isOpen();
    props.tab.currentState.worldTab ??= initWorldEditor2DDataStorageObjectProps({
        viewMode: "2D",
    });
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const viewOptionsRefs = {
        viewOptionsContainer: useRef<HTMLDivElement>(null),
        viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
    };
    const widgetRegistryRef: RefObject<EditorWidgetOverlayBarWidgetRegistry> = useRef<EditorWidgetOverlayBarWidgetRegistry>(null);
    let levelDBOpenFailure: boolean = false;
    async function checkForLevelDBOpenFailure(): Promise<void> {
        levelDBOpenFailure = !props.tab.db?.isOpen() && !((await props.tab.awaitDBOpen) ?? true);
        reloadContents();
    }
    void checkForLevelDBOpenFailure();
    function LevelDBOpenFailureNotice(): JSX.Element {
        if (props.tab.errorDueToEncryptedLevelDB) {
            return (
                <Notice
                    title="Encrypted LevelDB"
                    subtitle="The LevelDB is encrypted. The app cannot open encrypted LevelDBs."
                    detail="If this world is from a marketplace template, that would cause the LevelDB to be encrypted."
                    image="access_denied"
                />
            );
        }
        return (
            <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: start;">
                <Notice
                    title="LevelDB Error"
                    subtitle="An error has occurred while opening the LevelDB."
                    detail={null}
                    image="generic_error"
                    style={{ height: "auto" }}
                />
                <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>
                    {props.tab.errorOnDBOpen instanceof Error ?
                        `${props.tab.errorOnDBOpen.stack ?? props.tab.errorOnDBOpen.toString()}${
                            props.tab.errorOnDBOpen.cause !== undefined ?
                                `\nCaused by: ${String(
                                    ((): unknown => {
                                        try {
                                            return typeof props.tab.errorOnDBOpen.cause === "object" ?
                                                    JSON.stringify(props.tab.errorOnDBOpen.cause)
                                                :   props.tab.errorOnDBOpen.cause;
                                        } catch {
                                            return props.tab.errorOnDBOpen.cause;
                                        }
                                    })()
                                )}`
                            :   ""
                        }`
                    :   String(
                            (function formatUnknownErrorValue(): unknown {
                                try {
                                    return typeof props.tab.errorOnDBOpen === "object" ? JSON.stringify(props.tab.errorOnDBOpen) : props.tab.errorOnDBOpen;
                                } catch {
                                    return props.tab.errorOnDBOpen;
                                }
                            })()
                        )
                    }
                </div>
            </div>
        );
    }
    function reloadContents(): void {
        if (!props.tab.currentState.worldTab) return;
        if (!containerRef.current) return;
        // fakeAssertIsValidOptionsType(props.tab.currentState.worldTab);
        // const tempElement: HTMLDivElement = document.createElement("div");
        if (levelDBOpenFailure) {
            render(null, containerRef.current);
            render(<LevelDBOpenFailureNotice />, containerRef.current);
            return;
        }
        // if (dataLoadFailureNoticeReasonExists && !props.tab.currentState.worldTab) {
        //     render(null, containerRef.current);
        //     render(<DataLoadFailureNotice reason={dataLoadFailureNoticeReason} />, containerRef.current);
        //     return;
        // }
        render(<Contents props={props} options={props.tab.currentState.worldTab} />, containerRef.current /* tempElement */);
        // containerRef.current.replaceChildren(...tempElement.children);
    }
    function Contents(props: { props: WorldEditorTabProps; options: WorldEditorDataStorageObject }): JSX.Element {
        switch (props.options.viewMode) {
            case "2D":
                return <WorldEditor2D dataStorageObject={props.options} tab={props.props.tab} overlayBarRegistry={widgetRegistryRef.current ?? undefined} />;
            case "3D":
            case "block":
            case "search":
                return (
                    <UnderConstruction
                        subtitle="This view mode is under construction."
                        detail={`This view mode is still a work in progress: ${String(props.options.viewMode)}`}
                    />
                );
            default:
                return <span style="color: red;">Unsupported view mode: {String(props.options.viewMode)}</span>;
        }
    }
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
            <EditorWidgetOverlayBar widgetRegistryRef={widgetRegistryRef} barContainerRef={viewOptionsRefs.viewOptionsContainer}>
                <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                    <button
                        type="button"
                        class={props.tab.currentState.worldTab.viewMode === "3D" ? "selected" : ""}
                        onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (!props.tab.currentState.worldTab) return;
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.worldTab.viewMode = "3D";
                            reloadContents();
                        }}
                        disabled
                    >
                        3D
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.worldTab.viewMode === "2D" ? "selected" : ""}
                        onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (!props.tab.currentState.worldTab) return;
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.worldTab.viewMode = "2D";
                            reloadContents();
                        }}
                    >
                        2D
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.worldTab.viewMode === "block" ? "selected" : ""}
                        onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (!props.tab.currentState.worldTab) return;
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.worldTab.viewMode = "block";
                            reloadContents();
                        }}
                        disabled
                    >
                        Block
                    </button>
                    <button
                        type="button"
                        class={props.tab.currentState.worldTab.viewMode === "search" ? "selected" : ""}
                        onClick={(event: TargetedMouseEvent<HTMLButtonElement>): void => {
                            if (!props.tab.currentState.worldTab) return;
                            if (event.currentTarget.classList.contains("selected")) return;
                            $(event.currentTarget).siblings("button").removeClass("selected");
                            $(event.currentTarget).addClass("selected");
                            props.tab.currentState.worldTab.viewMode = "search";
                            reloadContents();
                        }}
                        disabled
                    >
                        Search
                    </button>
                </div>
            </EditorWidgetOverlayBar>
            <div style="flex: 1; overflow: auto;" ref={containerRef}>
                {asyncMode || !props.tab.currentState.worldTab ?
                    <LoadingScreenContents />
                :   <Contents props={props} options={props.tab.currentState.worldTab} />}
            </div>
        </div>
    );
}
