import type { JSX } from "preact";
import _React, { useEffect } from "preact/compat";
import { setActivePage } from "../app";

export interface LeftSidebarProps {
    tab: TabManagerTab;
}

export default function LeftSidebar(props: LeftSidebarProps): JSX.SpecificElement<"ul"> {
    function tabManagerSubTabToSubTabID(tab: TabManagerSubTab | TabManagerTabGenericSubTabID | null): TabManagerTabGenericSubTabID | null {
        if (typeof tab === "string") return tab;
        if (tab === null) return null;
        switch (tab.contentType) {
            case "ActorPrefix":
                return "entities";
            case "BlockEntity":
                return "block-entities";
            case "DynamicProperties":
                return "dynamic-properties";
            case "LevelDat":
                return "world-settings";
            case "Map":
                return "maps";
            case "PendingTicks":
            case "RandomTicks":
                return "ticks";
            case "Player":
            case "PlayerClient":
                return "players";
            case "Portals":
                return "portals";
            case "SchedulerWT":
                return "schedulerwt";
            case "Scoreboard":
                return "scoreboards";
            case "StructureTemplate":
                return "structures";
            case "SubChunkPrefix":
                return "world";
            case "TickingArea":
                return "ticking-areas";
            case "AABBVolumes":
            case "ActorDigestVersion":
            case "AutonomousEntities":
            case "FlatWorldLayers":
            default:
                return "view-files";
        }
    }
    useEffect((): (() => void) => {
        $(`#left_sidebar .sidebar_button[data-path-id=${tabManagerSubTabToSubTabID(props.tab.selectedTab)}]`).addClass("active");
        function onSubTabSwitch({ previousTab, newTab }: TabManagerTabSwitchTabEvent): void {
            $(`#left_sidebar .sidebar_button[data-path-id=${tabManagerSubTabToSubTabID(previousTab)}]`).removeClass("active");
            $(`#left_sidebar .sidebar_button[data-path-id=${tabManagerSubTabToSubTabID(newTab)}]`).addClass("active");
        }
        props.tab.on("switchTab", onSubTabSwitch);
        $("#left_sidebar .sidebar_button").on("click", (event: JQuery.ClickEvent<HTMLElement, undefined, HTMLElement, HTMLElement>): void => {
            props.tab.switchTab(event.currentTarget.dataset.pathId as TabManagerTabGenericSubTabID);
        });
        return (): void => {
            props.tab.off("switchTab", onSubTabSwitch);
        };
    }, []);
    interface Tab {
        icon: string;
        id: TabManagerTabGenericSubTabID;
        name: string;
        resolution: number;
        /**
         * @todo
         */
        submenu?: JSX.Element | undefined;
    }
    const tabs: Tab[] = (
        [
            props.tab.type === "world" && {
                icon: "resource://images/ui/glyphs/settings_glyph_color_2x.png",
                id: "world-settings",
                name: "World Settings",
                resolution: 15,
            },
            props.tab.type === "world" && { icon: "resource://images/ui/glyphs/Add-Ons_Side-Nav_Icon_24x24.png", id: "packs", name: "Packs", resolution: 12 },
            { icon: "resource://images/ui/glyphs/FriendsIcon.png", id: "players", name: "Players", resolution: 15 },
            { icon: "resource://images/ui/glyphs/icon_panda.png", id: "entities", name: "Entities", resolution: 16 },
            { icon: "resource://images/ui/glyphs/structure_block.png", id: "structures", name: "Structures", resolution: 16 },
            { icon: "resource://images/ui/glyphs/world_glyph_color.png", id: "world", name: "World", resolution: 17 },
            { icon: "resource://images/ui/glyphs/icon_map.png", id: "maps", name: "Maps", resolution: 16 },
            { icon: "resource://images/ui/glyphs/Data-Empty.png", id: "dynamic-properties", name: "Dynamic Properties", resolution: 12 },
            { icon: "resource://images/ui/glyphs/icon_best3.png", id: "scoreboards", name: "Scoreboards", resolution: 12 },
            { icon: "resource://images/ui/glyphs/village_plains.png", id: "villages", name: "Villages", resolution: 8 },
            { icon: "resource://images/ui/glyphs/realmPortalSmall.png", id: "portals", name: "Portals", resolution: 10 },
            { icon: "resource://images/ui/glyphs/timer.png", id: "ticks", name: "Ticks", resolution: 11 },
            { icon: "resource://images/ui/glyphs/timer.png", id: "ticking-areas", name: "Ticking Areas", resolution: 11 },
            { icon: "resource://images/ui/glyphs/Slash-Command.png", id: "schedulerwt", name: "SchedulerWT", resolution: 12 },
            { icon: "resource://images/ui/glyphs/Folder-Closed.png", id: "view-files", name: "View Files", resolution: 12 },
            // { icon: "resource://images/ui/glyphs/magnifyingGlass.png", id: "search", name: "Search", resolution: 12 },
            (props.tab.cachedDBKeys?.ForcedWorldCorruption?.length ?? 0) > 0 && {
                icon: "resource://images/ui/glyphs/anvil-hammer.png",
                id: "repair-forced-world-corruption",
                name: "Repair Forced World Corruption",
                resolution: 16,
            },
        ] as const satisfies (Tab | false | undefined)[]
    ).filter((tab: Tab | false | undefined): tab is Tab => !!tab) as Tab[];
    return (
        <div style="display: flex; flex-direction: column; height: 100%; width: 200px;" id="left_sidebar">
            {tabs.map(
                (tab: Tab): JSX.SpecificElement<"div"> => (
                    <div
                        class="sidebar_button nsel"
                        data-path-id={tab.id}
                        // onMouseDown={(event: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                        //     if (event.currentTarget.hasAttribute("disabled")) return;
                        //     SoundEffects.popB();
                        // }}
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
    );
}
