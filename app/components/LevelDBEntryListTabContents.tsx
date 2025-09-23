// @ts-nocheck This file is not ready for use yet, it should be ignored for now.
// @eslint-ignore

export interface LevelDBEntryListTabContentsProps<T extends { [key: string]: object }, K extends { [key: string]: object }> {
    keys: T;
    keyMaps: K;
    getTabContentsRows(data: {
        /**
         * The tab manager tab.
         */
        tab: TabManagerTab;
        keys: T;
        keyMaps: K;
        dynamicProperties?: NBT.NBT | undefined;
        /**
         * The mode of the tab.
         */
        mode: ConfigConstants.views.Players.PlayersTabSectionMode;
    }): Promise<JSX.Element[]>;
}

export default function LevelDBEntryListTabContents(props: LevelDBEntryListTabContentsProps) {}

export interface ParseSearchQueryFiltersOptions {
    keywords: string[];
    operators: string[];
}

export function parseSearchQueryFilters() {}
