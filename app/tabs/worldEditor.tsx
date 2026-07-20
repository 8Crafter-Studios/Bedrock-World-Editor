import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useRef } from "preact/compat";
import TreeEditor from "../components/TreeEditor";
import { entryContentTypeToFormatMap, type EntryContentTypeFormatData } from "mcbe-leveldb";
import { LoadingScreenContents } from "../app";
import SNBTEditor from "../components/SNBTEditor";
import PrismarineNBTEditor from "../components/PrismarineNBTEditor";
import EditorWidgetOverlayBar, { type EditorWidgetOverlayBarWidgetRegistry } from "../components/EditorWidgetOverlayBar";
import { initWorldEditor2DDataStorageObjectProps, WorldEditor2D, type WorldEditor2DDataStorageObject } from "../components/WorldEditor2D";
import BinaryHexEditor, { initHexEditorDataStorageObjectProps, type HexEditorDataStorageObject } from "../components/BinaryHexEditor";
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
    props.tab.currentState.worldTab ??= initWorldEditor2DDataStorageObjectProps({
        viewMode: "2D",
    });
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const viewOptionsRefs = {
        viewOptionsContainer: useRef<HTMLDivElement>(null),
        viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
    };
    const widgetRegistryRef: RefObject<EditorWidgetOverlayBarWidgetRegistry> = useRef<EditorWidgetOverlayBarWidgetRegistry>(null);
    let dataLoadFailureNoticeReasonExists: boolean = false;
    let dataLoadFailureNoticeReason: any = null;
    let levelDBOpenFailure: boolean = false;
    function LevelDBOpenFailureNotice(): JSX.Element {
        if (props.tab.errorDueToEncryptedLevelDB)
            return (
                <Notice
                    title="Encrypted LevelDB"
                    subtitle="The LevelDB is encrypted. The app cannot open encrypted LevelDBs."
                    detail="If this world is from a marketplace template, that would cause the LevelDB to be encrypted."
                    image="access_denied"
                />
            );
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
                        `${props.tab.errorOnDBOpen.stack !== undefined ? props.tab.errorOnDBOpen.stack : props.tab.errorOnDBOpen.toString()}${
                            props.tab.errorOnDBOpen.cause !== undefined ?
                                `\nCaused by: ${((): unknown => {
                                    try {
                                        return typeof props.tab.errorOnDBOpen.cause === "object" ?
                                                JSON.stringify(props.tab.errorOnDBOpen.cause)
                                            :   props.tab.errorOnDBOpen.cause;
                                    } catch {
                                        return props.tab.errorOnDBOpen.cause;
                                    }
                                })()}`
                            :   ""
                        }`
                    :   String(
                            (function (): unknown {
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
    // function DataLoadFailureNotice({ reason }: { reason: any }): JSX.SpecificElement<"div"> {
    //     return (
    //         <div style="display: flex; width: -webkit-fill-available; height: -webkit-fill-available; overflow: auto; flex: 1; flex-direction: column; align-items: center; justify-content: center;">
    //             <Notice
    //                 title="Failed to Load Data"
    //                 subtitle={null}
    //                 detail="An error occured while loading the data, it may be corrupted or invalid. Try loading the data in raw mode instead by using the button below."
    //                 image="generic_error"
    //                 style={{ height: "auto" }}
    //             />
    //             <button
    //                 type="button"
    //                 title="Reopens the editor in raw mode, allowing you to edit unparseable data as binary data in the hex editor."
    //                 class="genericRoundButton"
    //                 onClick={async (event: TargetedMouseEvent<HTMLButtonElement>): Promise<void> => {
    //                     if (!props.tab) throw new ReferenceError("props.tab is undefined.");
    //                     event.preventDefault();
    //                     if (event.currentTarget.disabled) return;
    //                     event.currentTarget.blur();
    //                     event.currentTarget.disabled = true;
    //                     try {
    //                         await props.tab.loadData(true);
    //                         props.tab.rawMode = true;
    //                         fakeAssertIsValidOptionsType(props.tab.currentState.worldTab);
    //                         props.tab.currentState.worldTab.viewMode = "raw";
    //                         if (props.tab.selectedTab !== props.tab) return;
    //                         props.tab.emit("reloadCurrentSubTab");
    //                     } finally {
    //                         event.currentTarget.disabled = false;
    //                     }
    //                 }}
    //             >
    //                 Load Data in Raw Mode
    //             </button>
    //             <div style={{ color: "red", fontFamily: "monospace", whiteSpace: "pre" }}>
    //                 {reason instanceof Error ?
    //                     reason.stack?.startsWith(reason.toString()) ?
    //                         reason.stack
    //                     :   reason.toString() + reason.stack
    //                 :   reason}
    //             </div>
    //         </div>
    //     );
    // }
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
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
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
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
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
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
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
                        onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
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
                {!props.tab.currentState.worldTab ?
                    <LoadingScreenContents />
                :   <Contents props={props} options={props.tab.currentState.worldTab} />}
            </div>
        </div>
    );
}
