import { type JSX, type RefObject } from "preact";
import _React, { render, useEffect, useRef } from "preact/compat";
import { checkIsURIOrPath } from "../../src/utils/pathUtils";
const mime = require("mime-types") as typeof import("mime-types");
import { readFileSync } from "node:fs";
import type { Vector2 } from "mcbe-leveldb";
import { dialog } from "@electron/remote";
import { get } from "jquery";
import type { MessageBoxReturnValue } from "electron";

export default function TabBar(): JSX.Element {
    const tabContainerRef: RefObject<HTMLUListElement> = useRef(null);
    const popupRef: RefObject<HTMLDivElement> = useRef(null);
    useEffect((): (() => void) => {
        function update(): void {
            if (tabContainerRef.current === null) return;
            const element: HTMLUListElement = document.createElement("ul");
            render(<RenderTabs />, element);
            tabContainerRef.current.replaceChildren(...element.children);
        }
        function hideAddTabPopup(event: MouseEvent): void {
            if (popupRef.current === null || popupRef.current.contains(event.target as Node)) return;
            $("#add-tab-popup-menu").hide();
        }
        tabManager.on("openTab", update);
        tabManager.on("closeTab", update);
        tabManager.on("switchTab", update);
        tabManager.on("reorderTabs", update);
        window.addEventListener("mousedown", hideAddTabPopup);
        return (): void => {
            tabManager.off("openTab", update);
            tabManager.off("closeTab", update);
            tabManager.off("switchTab", update);
            tabManager.off("reorderTabs", update);
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
                    tabManager.switchTab(null);
                },
            },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "NBT File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "JSON File", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", name: "Raw File", resolution: 12 },
        ] as const satisfies (PopupTab | false | undefined)[]
    ).filter((tab: PopupTab | false | undefined): tab is PopupTab => !!tab) as PopupTab[];
    interface TabProps {
        tab: TabManagerTab;
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
            if (containerRef.current === null || clonedElement === null) return tabManager.openTabs.indexOf(props.tab);
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
                if (newTabIndex > tabManager.openTabs.indexOf(props.tab)) newTabIndex--;
                if (newTabIndex !== tabManager.openTabs.indexOf(props.tab)) {
                    tabManager.moveTab(props.tab, newTabIndex);
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
                (containerRef.current.parentElement!.children[newTabIndex] as HTMLLIElement).style?.opacity === "0"
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
            console.log(newTabIndex);
        }
        function onModificationStatusChanged(event: TabManagerTabModificationStatusChangedEvent): void {
            if (event.tab === props.tab) {
                if (!unsavedBulletPointRef.current) return;
                unsavedBulletPointRef.current.style.display = event.isModified ? "" : "none";
            }
        }
        useEffect((): (() => void) => {
            props.tab.on("modificationStatusChanged", onModificationStatusChanged);
            return (): void => {
                props.tab.off("modificationStatusChanged", onModificationStatusChanged);
            };
        });
        return (
            <li class={props.tab === tabManager.selectedTab ? "active" : ""} ref={containerRef}>
                <a
                    title={props.tab.name}
                    onMouseDown={(event): void => {
                        if (!containerRef.current || event.currentTarget.querySelector(".closebtn")?.contains(event.target as Node)) return;
                        dragging = true;
                        cursorOffset = { x: event.offsetX, y: event.offsetY };
                        absoluteCursorOffset = { x: event.clientX, y: event.clientY };
                        document.addEventListener("mousemove", onMouseMove);
                        document.addEventListener("mouseup", onMouseUp);
                    }}
                    onClick={(): void => void (!draggingInitiated && tabManager.switchTab(props.tab))}
                >
                    <div>
                        <img
                            aria-hidden="true"
                            src={
                                props.tab.icon
                                    ? checkIsURIOrPath(props.tab.icon) === "URI"
                                        ? props.tab.icon
                                        : `data:${mime.lookup(props.tab.icon)};base64,${readFileSync(props.tab.icon, "base64")}`
                                    : props.tab.type === "world"
                                    ? "resource://images/ui/misc/CreateNewWorld.png"
                                    : undefined
                            }
                            style="max-width: 16px; max-height: 16px; margin-right: 0.5em;"
                        />
                    </div>
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
                    <div style={{ display: props.tab.isModified() ? undefined : "none" }} ref={unsavedBulletPointRef}>
                        •
                    </div>
                    <img
                        title="Close"
                        src="resource://images/ui/glyphs/Close.png"
                        style="margin-left: 0.5em; width: 10px; height: 10px; vertical-align: middle;"
                        class="closebtn"
                        onClick={async (event: JSX.TargetedMouseEvent<HTMLImageElement>): Promise<void> => {
                            if (props.tab.isModified()) {
                                const result: MessageBoxReturnValue = await dialog.showMessageBox(getCurrentWindow(), {
                                    type: "warning",
                                    title: "Unsaved Changes",
                                    message: `Do you want to save the changes you made to ${props.tab.name}?`,
                                    detail: "Your changes will be lost if you don't save them.",
                                    buttons: ["Save", "Don't Save", "Cancel"],
                                    noLink: true,
                                    defaultId: 0,
                                    cancelId: 2,
                                });
                                switch (result.response) {
                                    case 0:
                                        await props.tab.save();
                                        await props.tab.close();
                                        break;
                                    case 1:
                                        await props.tab.close();
                                        break;
                                    case 2:
                                        break;
                                }
                            } else {
                                props.tab.close();
                                event.stopPropagation();
                            }
                        }}
                    />
                </a>
            </li>
        );
    }
    function RenderTabs(): JSX.Element {
        return (
            <>
                {...tabManager.openTabs.map((tab: TabManagerTab): JSX.SpecificElement<"li"> => <Tab tab={tab} />)}
                <li style="float: right;" data-immovable>
                    <a
                        style="padding: 10px;"
                        onClick={(): void => {
                            $("#add-tab-popup-menu").css("left", window.innerWidth - 200);
                            $("#add-tab-popup-menu").css("top", 44);
                            $("#add-tab-popup-menu").toggle();
                        }}
                    >
                        <img aria-hidden="true" src="resource://images/ui/glyphs/icon-plus.png" />
                    </a>
                </li>
            </>
        );
    }
    return (
        <>
            <ul class="horizontal-nav full-sized-nav tab-bar" id="tab-bar" style="overflow-x: auto; overflow-y: visible; flex-shrink: 0;" ref={tabContainerRef}>
                <RenderTabs />
            </ul>
            <div id="add-tab-popup-menu" style="display: none; background-color: #13383f; color: white; width: 200px; position: fixed;" ref={popupRef}>
                <div style="display: flex; flex-direction: column; height: 100%; width: 200px;">
                    {popupTabs.map(
                        (tab: PopupTab): JSX.SpecificElement<"div"> => (
                            <div
                                class="sidebar_button nsel"
                                onMouseDown={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                                    if (event.currentTarget.hasAttribute("disabled")) return;
                                    SoundEffects.popB();
                                }}
                                onClick={tab.onClick}
                            >
                                <div style="display: inline-block; vertical-align: middle; width: 36px; height: 36px;">
                                    <img
                                        aria-hidden="true"
                                        src={tab.icon}
                                        class="nsel ndrg"
                                        style={`display: inline-block; vertical-align: middle; width: auto; height: ${36 - (36 % tab.resolution)}px; margin: ${
                                            (36 % tab.resolution) / 2
                                        }px 0;`}
                                    />
                                </div>
                                {tab.name}
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
}
