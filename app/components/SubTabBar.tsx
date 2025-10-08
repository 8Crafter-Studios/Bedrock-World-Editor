import { type JSX, type RefObject } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import { checkIsURIOrPath } from "../../src/utils/pathUtils";
const mime = require("mime-types") as typeof import("mime-types");
import { readFileSync } from "node:fs";
import type { Vector2 } from "mcbe-leveldb";
import { ControlledMenu, MenuDivider, MenuItem } from "@szhsin/react-menu";

export interface SubTabBarProps {
    tab: TabManagerTab;
}

export default function SubTabBar(props: SubTabBarProps): JSX.Element {
    const tab = props.tab;
    const tabContainerRef: RefObject<HTMLUListElement> = useRef(null);
    const popupRef: RefObject<HTMLDivElement> = useRef(null);
    let triggerUpdate: (() => void) | null = null;
    useEffect((): (() => void) => {
        function update(): void {
            if (tabContainerRef.current === null) return;
            const element: HTMLUListElement = document.createElement("ul");
            render(<RenderTabs />, element);
            render(null, tabContainerRef.current);
            tabContainerRef.current.replaceChildren(...element.children);
        }
        triggerUpdate = update;
        function hideAddTabPopup(event: MouseEvent): void {
            if (popupRef.current === null || popupRef.current.contains(event.target as Node)) return;
            $("#add-tab-popup-menu").hide();
        }
        tab.on("openTab", update);
        tab.on("closeTab", update);
        tab.on("switchTab", update);
        tab.on("reorderTabs", update);
        window.addEventListener("mousedown", hideAddTabPopup);
        return (): void => {
            tab.off("openTab", update);
            tab.off("closeTab", update);
            tab.off("switchTab", update);
            tab.off("reorderTabs", update);
            window.removeEventListener("mousedown", hideAddTabPopup);
        };
    }, []);
    interface PopupTab {
        icon: string;
        name: string;
        resolution: number;
        onClick?(event: JSX.TargetedMouseEvent<HTMLDivElement>): void;
    }
    const popupTabs: PopupTab[] = (
        [
            {
                icon: "resource://images/ui/glyphs/world_glyph_color.png",
                name: "World",
                resolution: 17,
                onClick(event) {
                    tab.switchTab(null);
                },
            },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "NBT File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "JSON File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "Raw File", resolution: 12 },
        ] as const satisfies (PopupTab | false | undefined)[]
    ).filter((tab: PopupTab | false | undefined): tab is PopupTab => !!tab) as PopupTab[];
    interface TabProps {
        tab: TabManagerSubTab;
    }
    function Tab(props: TabProps): JSX.SpecificElement<"li"> {
        const containerRef: RefObject<HTMLLIElement> = useRef(null);
        const unsavedBulletPointRef: RefObject<HTMLDivElement> = useRef(null);
        let dragging: boolean = false;
        let draggingInitiated: boolean = false;
        let cursorOffset: Vector2 = { x: 0, y: 0 };
        let absoluteCursorOffset: Vector2 = { x: 0, y: 0 };
        let clonedElement: HTMLLIElement | null = null;
        function getNewTabIndex(): number {
            if (containerRef.current === null || clonedElement === null) return tab.openTabs.indexOf(props.tab);
            let index: number = 0;
            const elementRect: DOMRect = clonedElement?.getBoundingClientRect();
            for (const tab of containerRef.current!.parentElement!.children) {
                if (tab.hasAttribute("data-immovable")) continue;
                const rect: DOMRect = tab.getBoundingClientRect();
                if (rect.left + rect.width / 2 < elementRect.left) index++;
                else break;
            }
            return index;
        }
        function onMouseUp(event: MouseEvent): void {
            dragging = false;
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("mousemove", onMouseMove);
            if (containerRef.current === null) return;
            if (draggingInitiated) {
                event.preventDefault();
                event.stopPropagation();
                draggingInitiated = false;
                document.documentElement.style.pointerEvents = "";
                document.documentElement.style.cursor = "";
            }
            if (clonedElement) {
                let newTabIndex: number = getNewTabIndex();
                if (newTabIndex > tab.openTabs.indexOf(props.tab)) newTabIndex--;
                if (newTabIndex !== tab.openTabs.indexOf(props.tab)) {
                    tab.moveTab(props.tab, newTabIndex);
                }
                clonedElement.style.transition = "top 0.2s ease-out, left 0.2s ease-out";
                const x: number = containerRef.current.offsetLeft;
                const y: number = containerRef.current.offsetTop;
                clonedElement.style.left = `${x}px`;
                clonedElement.style.top = `${y}px`;
                setTimeout((): void => {
                    if (!containerRef.current || !clonedElement) return;
                    clonedElement.remove();
                    clonedElement = null;
                    // containerRef.current.style.opacity = "";
                }, 200);
            }
            $(containerRef.current.parentElement!)
                .find<HTMLLIElement>(".left-highlight, .right-highlight")
                .removeClass("left-highlight")
                .removeClass("right-highlight");
            return;
        }
        function onMouseMove(event: MouseEvent): void {
            if (!containerRef.current || !dragging) {
                dragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                return;
            }
            if (!draggingInitiated && Math.abs(event.clientX - absoluteCursorOffset.x) ** 2 + Math.abs(event.clientY - absoluteCursorOffset.y) ** 2 > 100) {
                draggingInitiated = true;
                clonedElement = containerRef.current.cloneNode(true) as HTMLLIElement;
                clonedElement.style.transition = "none";
                clonedElement.style.position = "absolute";
                clonedElement.style.zIndex = "100";
                clonedElement.style.opacity = "0.5";
                clonedElement.setAttribute("inert", "true");
                containerRef.current.parentElement?.appendChild(clonedElement);
                // containerRef.current.style.opacity = "0";
                document.documentElement.style.pointerEvents = "none";
                document.documentElement.style.cursor = "grabbing";
            } else if (!draggingInitiated) {
                return;
            } else if (!clonedElement) return;
            event.preventDefault();
            event.stopPropagation();
            const x: number = event.clientX - cursorOffset.x;
            const y: number = event.clientY - cursorOffset.y;
            clonedElement.style.left = `${x}px`;
            clonedElement.style.top = `${y}px`;
            const newTabIndex: number = getNewTabIndex();
            if (
                !containerRef.current.parentElement!.children[newTabIndex] ||
                containerRef.current.parentElement!.children[newTabIndex]?.hasAttribute("data-immovable") ||
                (containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement).style?.opacity === "0" ||
                (containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement).inert
            ) {
                const elem: HTMLLIElement = containerRef.current.parentElement!.children[newTabIndex - 1] as HTMLLIElement;
                if (!elem) return;
                elem.classList.add("right-highlight");
                $(containerRef.current.parentElement!).find<HTMLLIElement>(".left-highlight").removeClass("left-highlight");
                $(containerRef.current.parentElement!)
                    .find<HTMLLIElement>(".right-highlight")
                    .filter((_index: number, element: HTMLLIElement): boolean => element !== elem)
                    .removeClass("right-highlight");
            } else {
                const elem: HTMLLIElement = containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement;
                elem.classList.add("left-highlight");
                $(containerRef.current.parentElement!).find<HTMLLIElement>(".right-highlight").removeClass("right-highlight");
                $(containerRef.current.parentElement!)
                    .find<HTMLLIElement>(".left-highlight")
                    .filter((_index: number, element: HTMLLIElement): boolean => element !== elem)
                    .removeClass("left-highlight");
            }
            // console.log(newTabIndex);
        }
        function onModificationStatusChanged(event: TabManagerSubTabModificationStatusChangedEvent): void {
            if (event.tab === props.tab) {
                if (!unsavedBulletPointRef.current) return;
                unsavedBulletPointRef.current.style.display = event.isModified ? "" : "none";
            }
        }
        useEffect((): (() => void) => {
            props.tab.parentTab.on("subTabModificationStatusChanged", onModificationStatusChanged);
            return (): void => {
                props.tab.parentTab.off("subTabModificationStatusChanged", onModificationStatusChanged);
            };
        });
        const [tabContextMenu_isOpen, tabContextMenu_setOpen] = useState(false);
        const [tabContextMenu_anchorPoint, tabContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
        function onTabRightClick(event: JSX.TargetedMouseEvent<HTMLLIElement>): void {
            event.preventDefault();
            event.stopPropagation();
            const clickPosition: { x: number; y: number } = {
                x: event.clientX,
                y: event.clientY,
            };
            // console.log(clickPosition);

            tabContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
            tabContextMenu_setOpen(true);
        }
        return (
            <>
                <li
                    class={props.tab === tab.selectedTab ? "active" : ""}
                    onAuxClick={(event: JSX.TargetedMouseEvent<HTMLLIElement>): void => void (event.button === 2 && onTabRightClick(event))}
                    ref={containerRef}
                >
                    <ControlledMenu
                        anchorPoint={tabContextMenu_anchorPoint}
                        state={tabContextMenu_isOpen ? "open" : "closed"}
                        direction="right"
                        onClose={(): void => void tabContextMenu_setOpen(false)}
                    >
                        {props.tab.isModified() ? (
                            <>
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        await props.tab.save();
                                    }}
                                >
                                    Save Tab
                                </MenuItem>
                                <MenuItem
                                    onClick={async (): Promise<void> => {
                                        await props.tab.save();
                                        props.tab.close();
                                    }}
                                >
                                    Save & Close Tab
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        props.tab.close();
                                    }}
                                >
                                    Close Tab Without Saving
                                </MenuItem>
                                <MenuItem
                                    onClick={(): void => {
                                        props.tab.currentState.scrollTop = 0;
                                        delete props.tab.currentState.options.dataStorageObject;
                                        props.tab.activeChanges = [];
                                        props.tab.hasUnsavedChanges = false;
                                        props.tab.loadData();
                                    }}
                                >
                                    Reset Tab
                                </MenuItem>
                            </>
                        ) : (
                            <MenuItem
                                onClick={(): void => {
                                    props.tab.close();
                                }}
                            >
                                Close Tab
                            </MenuItem>
                        )}
                        <MenuDivider />
                        {props.tab.isPinned ? (
                            <MenuItem
                                onClick={(): void => {
                                    props.tab.isPinned = false;
                                    triggerUpdate?.();
                                }}
                            >
                                Unpin Tab
                            </MenuItem>
                        ) : (
                            <MenuItem
                                onClick={(): void => {
                                    props.tab.isPinned = true;
                                    triggerUpdate?.();
                                }}
                            >
                                Pin Tab
                            </MenuItem>
                        )}
                    </ControlledMenu>
                    <a
                        title={props.tab.name}
                        onMouseDown={(event: JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
                            if (
                                !containerRef.current ||
                                event.currentTarget.querySelector(".closebtn")?.contains(event.target as Node) ||
                                event.currentTarget.querySelector(".unpinbtn")?.contains(event.target as Node)
                            )
                                return;
                            dragging = true;
                            cursorOffset = { x: event.offsetX, y: event.offsetY };
                            absoluteCursorOffset = { x: event.clientX, y: event.clientY };
                            document.addEventListener("mousemove", onMouseMove);
                            document.addEventListener("mouseup", onMouseUp);
                        }}
                        onClick={(): void => void (!draggingInitiated && tab.switchTab(props.tab))}
                    >
                        {props.tab.icon && (
                            <div>
                                <img
                                    aria-hidden="true"
                                    src={
                                        checkIsURIOrPath(props.tab.icon) === "URI"
                                            ? props.tab.icon
                                            : `data:${mime.lookup(props.tab.icon)};base64,${readFileSync(props.tab.icon, "base64")}`
                                    }
                                    style="max-width: 16px; max-height: 16px; margin-right: 0.5em;"
                                />
                            </div>
                        )}
                        {props.tab.name.length > 30
                            ? props.tab.name.slice(0, 30 - Math.min(10, Math.max(0, props.tab.name.length - 45))) +
                              "..." +
                              props.tab.name.slice(30 + Math.max(0, props.tab.name.length - 40))
                            : props.tab.name}
                        {props.tab.readonly && (
                            <img
                                aria-hidden="true"
                                src="resource://images/ui/glyphs/Lock-Locked.png"
                                style="margin-left: 0.5em; width: 18px; height: 18px; vertical-align: middle;"
                            />
                        )}
                        <div
                            style={{
                                display: props.tab.isModified() ? undefined : "none",
                                marginLeft: "0.25em",
                                marginRight: "-0.125em",
                                fontSize: "2em",
                                lineHeight: "0.5em",
                            }}
                            ref={unsavedBulletPointRef}
                        >
                            •
                        </div>
                        {props.tab.isPinned ? (
                            <img
                                title="Unpin"
                                src="resource://images/ui/glyphs/Pin.png"
                                style="margin-left: 0.5em; width: 18px; height: 18px; vertical-align: middle;"
                                class="unpinbtn"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                                    event.stopPropagation();
                                    props.tab.isPinned = false;
                                    triggerUpdate?.();
                                }}
                            />
                        ) : (
                            <img
                                title="Close (Shift to Close Without Saving)"
                                src="resource://images/ui/glyphs/Close.png"
                                style="margin-left: 0.5em; width: 10px; height: 10px; vertical-align: middle;"
                                class="closebtn"
                                onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                                    event.stopPropagation();
                                    if (!event.shiftKey && props.tab.isModified()) await props.tab.save();
                                    props.tab.close();
                                }}
                            />
                        )}
                    </a>
                </li>
            </>
        );
    }
    function RenderTabs(): JSX.Element {
        return <>{...tab.openTabs.map((tab: TabManagerSubTab): JSX.SpecificElement<"li"> => <Tab tab={tab} />)}</>;
    }
    return (
        <>
            <ul
                class="horizontal-nav full-sized-nav tab-bar sub-tab-bar"
                id="sub-tab-bar"
                style="overflow-x: auto; overflow-y: visible; flex-shrink: 0;"
                ref={tabContainerRef}
            >
                <RenderTabs />
            </ul>
        </>
    );
}
