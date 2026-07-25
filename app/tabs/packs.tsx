// TODO: Add the loading screen for when the LevelDB hasn't opened yet, and the error screen for when the LevelDB fails to open or is encrypted.
import { app, clipboard, dialog } from "@electron/remote";
import { ControlledMenu, MenuItem, SubMenu, type ClickEvent as ContextMenu_ClickEvent } from "@szhsin/react-menu";
import type { SaveDialogReturnValue } from "electron";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JSX, RefObject, TargetedMouseEvent } from "preact";
import _React, { render, useEffect, useRef, useState } from "preact/compat";
import semver from "semver";
import type { ManifestJSONSchema } from "../../src/schemaTypes/manifest.json.schema";
import { createObservable, testForObjectExtension, type Observable } from "../../src/utils/miscUtils";
import { LoadingScreenContents } from "../app";
import Notice from "../components/Notice";
import { PageNavigation } from "../components/PageNavigation";
import json5 from "json5";
const mime = require("mime-types") as typeof import("mime-types");

/**
 * Props for the {@link PacksTab} component.
 */
export interface PacksTabProps {
    tab: TabManagerTab;
}

/**
 * The packs tab.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function PacksTab(props: PacksTabProps): JSX.SpecificElement<"div"> {
    if (!props.tab.db) return <div>The packs sub-tab is not supported for this tab, there is no associated LevelDB.</div>;
    const containerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
    const abortController: AbortController = new AbortController();
    useEffect((): (() => void) => {
        return (): void => {
            abortController.abort(new DOMException("Tab switched.", "AbortError"));
        };
    });
    getPacksTabContents(props.tab, abortController.signal).then(
        async (element: JSX.Element): Promise<void> => {
            if (!containerRef.current) return;
            render(null, containerRef.current);
            render(element, containerRef.current);
        },
        (reason: any): void => {
            if (reason instanceof DOMException && reason.name === "AbortError" && reason.message === "Tab switched.") return;
            if (containerRef.current) {
                const errorElement: HTMLDivElement = document.createElement("div");
                errorElement.style.color = "red";
                errorElement.style.fontFamily = "monospace";
                errorElement.style.whiteSpace = "pre";
                errorElement.textContent =
                    reason instanceof Error ?
                        reason.stack?.startsWith(reason.toString()) ?
                            reason.stack
                        :   reason.toString() + reason.stack
                    :   reason;
                render(null, containerRef.current);
                containerRef.current.replaceChildren("Failed to load data:", errorElement);
            }
            console.error(reason);
        }
    );
    const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    return (
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;" ref={containerRef}>
            <LoadingScreenContents messageContainerRef={loadingScreenMessageContainerRef} />
        </div>
    );
}

/**
 * The schema for the `world_resource_packs.json` and `world_behavior_packs.json` files.
 */
type WorldXPacksJSONSchema = {
    /**
     * The UUID of the pack to include.
     */
    pack_id?: string;
    /**
     * The version of the pack.
     */
    version?: string | [major: number, minor: number, patch: number];
    /**
     * The currently active subpack.
     *
     * This is not present unless the pack has subpacks.
     */
    subpack?: string;
    [k: string]: unknown;
}[];

/**
 * The schema for the `world_resource_pack_history.json` and `world_behavior_pack_history.json` files.
 */
type WorldXPackHistoryJSONSchema = {
    /**
     * The list of packs in the history.
     */
    packs: {
        /**
         * Whether the pack can be redownloaded from the marketplace.
         *
         * This is true for all marketplace packs and false for non-marketplace packs.
         */
        can_be_redownloaded?: boolean;
        /**
         * The number of subpacks in the pack.
         *
         * This is not present unless the pack has subpacks.
         */
        subpacks_count?: number;
        /**
         * The name of the pack to include.
         *
         * Can be a string or an object with localized strings for one or more locales.
         */
        name?: string | { [locale in LooseAutocomplete<"en_US">]?: string };
        /**
         * The UUID of the pack to include.
         */
        uuid?: string;
        /**
         * The version of the pack.
         */
        version?: string | [major: number, minor: number, patch: number];
        [k: string]: unknown;
    }[];
};

interface XPacksFolderPack {
    folderPath: string;
    manifest: ManifestJSONSchema;
    hasPackIcon: boolean;
    nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
}

// IDEA: Make this read from both the numbered user folder path and and Shared one for GDK Minecraft world folders.
async function getPacksData(
    tab: TabManagerTab,
    signal: AbortSignal
): Promise<{
    worldResourcePacks: WorldXPacksJSONSchema | undefined;
    worldBehaviorPacks: WorldXPacksJSONSchema | undefined;
    worldResourcePackHistory: WorldXPackHistoryJSONSchema | undefined;
    worldBehaviorPackHistory: WorldXPackHistoryJSONSchema | undefined;
    worldResourcePacksFolderPacks: XPacksFolderPack[];
    worldBehaviorPacksFolderPacks: XPacksFolderPack[];
    localResourcePacksFolderPacks: XPacksFolderPack[];
    localBehaviorPacksFolderPacks: XPacksFolderPack[];
    developmentResourcePacksFolderPacks: XPacksFolderPack[];
    developmentBehaviorPacksFolderPacks: XPacksFolderPack[];
}> {
    let worldResourcePacks: WorldXPacksJSONSchema | undefined;
    loadWorldResourcePacks: {
        const worldResourcePacksPath: string = path.join(tab.tempPath ?? tab.path, "world_resource_packs.json");
        if (!existsSync(worldResourcePacksPath)) break loadWorldResourcePacks;
        worldResourcePacks = await readFile(worldResourcePacksPath, "utf8")
            .then((data: string): WorldXPacksJSONSchema | undefined => json5.parse(data) as WorldXPacksJSONSchema)
            .catch((e: any): undefined => (console.error("Error loading world_resource_packs.json:", e, "filePath:", worldResourcePacksPath), undefined));
    }
    signal.throwIfAborted();
    let worldBehaviorPacks: WorldXPacksJSONSchema | undefined;
    loadWorldBehaviorPacks: {
        const worldBehaviorPacksPath: string = path.join(tab.tempPath ?? tab.path, "world_behavior_packs.json");
        if (!existsSync(worldBehaviorPacksPath)) break loadWorldBehaviorPacks;
        worldBehaviorPacks = await readFile(worldBehaviorPacksPath, "utf8")
            .then((data: string): WorldXPacksJSONSchema | undefined => json5.parse(data) as WorldXPacksJSONSchema)
            .catch((e: any): undefined => (console.error("Error loading world_behavior_packs.json:", e, "filePath:", worldBehaviorPacksPath), undefined));
    }
    signal.throwIfAborted();
    let worldResourcePackHistory: WorldXPackHistoryJSONSchema | undefined;
    loadWorldResourcePackHistory: {
        const worldResourcePackHistoryPath: string = path.join(tab.tempPath ?? tab.path, "world_resource_pack_history.json");
        if (!existsSync(worldResourcePackHistoryPath)) break loadWorldResourcePackHistory;
        worldResourcePackHistory = await readFile(worldResourcePackHistoryPath, "utf8")
            .then((data: string): WorldXPackHistoryJSONSchema | undefined => json5.parse(data) as WorldXPackHistoryJSONSchema)
            .catch(
                (e: any): undefined => (
                    console.error("Error loading world_resource_pack_history.json:", e, "filePath:", worldResourcePackHistoryPath),
                    undefined
                )
            );
    }
    signal.throwIfAborted();
    let worldBehaviorPackHistory: WorldXPackHistoryJSONSchema | undefined;
    loadWorldBehaviorPackHistory: {
        const worldBehaviorPackHistoryPath: string = path.join(tab.tempPath ?? tab.path, "world_behavior_pack_history.json");
        if (!existsSync(worldBehaviorPackHistoryPath)) break loadWorldBehaviorPackHistory;
        worldBehaviorPackHistory = await readFile(worldBehaviorPackHistoryPath, "utf8")
            .then((data: string): WorldXPackHistoryJSONSchema | undefined => json5.parse(data) as WorldXPackHistoryJSONSchema)
            .catch(
                (e: any): undefined => (
                    console.error("Error loading world_behavior_pack_history.json:", e, "filePath:", worldBehaviorPackHistoryPath),
                    undefined
                )
            );
    }
    signal.throwIfAborted();

    let worldResourcePacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadWorldResourcePacksFolderPacks: {
        // TEMP: Once the app no longer copies the behavior_packs and resource_packs folders into the temp folder, this should be only tab.path and not use tab.tempPath.
        const worldResourcePacksFolderPath: string = path.join(tab.tempPath ?? tab.path, "resource_packs");
        if (!existsSync(worldResourcePacksFolderPath)) break loadWorldResourcePacksFolderPacks;
        for (const folder of await readdir(worldResourcePacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(worldResourcePacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(await readFile(path.join(worldResourcePacksFolderPath, folder, "manifest.json"), "utf8"));
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(worldResourcePacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(worldResourcePacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(path.join(worldResourcePacksFolderPath, folder, "texts", langFile), "utf8");
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                worldResourcePacksFolderPacks.push({
                    folderPath: path.join(worldResourcePacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(worldResourcePacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();
    let worldBehaviorPacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadWorldBehaviorPacksFolderPacks: {
        // TEMP: Once the app no longer copies the behavior_packs and resource_packs folders into the temp folder, this should be only tab.path and not use tab.tempPath.
        const worldBehaviorPacksFolderPath: string = path.join(tab.tempPath ?? tab.path, "behavior_packs");
        if (!existsSync(worldBehaviorPacksFolderPath)) break loadWorldBehaviorPacksFolderPacks;
        for (const folder of await readdir(worldBehaviorPacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(worldBehaviorPacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(await readFile(path.join(worldBehaviorPacksFolderPath, folder, "manifest.json"), "utf8"));
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(worldBehaviorPacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(worldBehaviorPacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(path.join(worldBehaviorPacksFolderPath, folder, "texts", langFile), "utf8");
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                worldBehaviorPacksFolderPacks.push({
                    folderPath: path.join(worldBehaviorPacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(worldBehaviorPacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();

    let localResourcePacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadLocalResourcePacksFolderPacks: {
        if (!tab.isNonIsolatedWorld) break loadLocalResourcePacksFolderPacks;
        let localResourcePacksFolderPath: string = path.join(tab.path, "../../", "resource_packs");
        if (!existsSync(localResourcePacksFolderPath)) {
            try {
                const d2: string = path.dirname(path.dirname(tab.path));
                if (path.basename(d2) !== "com.mojang") break loadLocalResourcePacksFolderPacks;
                const d3: string = path.dirname(d2);
                if (path.basename(d3) !== "games") break loadLocalResourcePacksFolderPacks;
                const d4: string = path.dirname(d3);
                if (!/^\d+$/.test(path.basename(d4))) break loadLocalResourcePacksFolderPacks;
                const d5: string = path.dirname(d4);
                if (path.basename(d5) !== "Users") break loadLocalResourcePacksFolderPacks;
                localResourcePacksFolderPath = path.join(d5, "Shared/games/com.mojang/resource_packs");
                if (!existsSync(localResourcePacksFolderPath)) break loadLocalResourcePacksFolderPacks;
            } catch (e) {
                console.error("Error while checking if this is a GDK Minecraft world folder:", e, tab.path);
                break loadLocalResourcePacksFolderPacks;
            }
        }
        for (const folder of await readdir(localResourcePacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(localResourcePacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(await readFile(path.join(localResourcePacksFolderPath, folder, "manifest.json"), "utf8"));
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(localResourcePacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(localResourcePacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(path.join(localResourcePacksFolderPath, folder, "texts", langFile), "utf8");
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                localResourcePacksFolderPacks.push({
                    folderPath: path.join(localResourcePacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(localResourcePacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();
    let localBehaviorPacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadLocalBehaviorPacksFolderPacks: {
        if (!tab.isNonIsolatedWorld) break loadLocalBehaviorPacksFolderPacks;
        let localBehaviorPacksFolderPath: string = path.join(tab.path, "../../", "behavior_packs");
        if (!existsSync(localBehaviorPacksFolderPath)) {
            try {
                const d2: string = path.dirname(path.dirname(tab.path));
                if (path.basename(d2) !== "com.mojang") break loadLocalBehaviorPacksFolderPacks;
                const d3: string = path.dirname(d2);
                if (path.basename(d3) !== "games") break loadLocalBehaviorPacksFolderPacks;
                const d4: string = path.dirname(d3);
                if (!/^\d+$/.test(path.basename(d4))) break loadLocalBehaviorPacksFolderPacks;
                const d5: string = path.dirname(d4);
                if (path.basename(d5) !== "Users") break loadLocalBehaviorPacksFolderPacks;
                localBehaviorPacksFolderPath = path.join(d5, "Shared/games/com.mojang/behavior_packs");
                if (!existsSync(localBehaviorPacksFolderPath)) break loadLocalBehaviorPacksFolderPacks;
            } catch (e) {
                console.error("Error while checking if this is a GDK Minecraft world folder:", e, tab.path);
                break loadLocalBehaviorPacksFolderPacks;
            }
        }
        for (const folder of await readdir(localBehaviorPacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(localBehaviorPacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(await readFile(path.join(localBehaviorPacksFolderPath, folder, "manifest.json"), "utf8"));
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(localBehaviorPacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(localBehaviorPacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(path.join(localBehaviorPacksFolderPath, folder, "texts", langFile), "utf8");
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                localBehaviorPacksFolderPacks.push({
                    folderPath: path.join(localBehaviorPacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(localBehaviorPacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();

    let developmentResourcePacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadDevelopmentResourcePacksFolderPacks: {
        if (!tab.isNonIsolatedWorld) break loadDevelopmentResourcePacksFolderPacks;
        let developmentResourcePacksFolderPath: string = path.join(tab.path, "../../", "development_resource_packs");
        if (!existsSync(developmentResourcePacksFolderPath)) {
            try {
                const d2: string = path.dirname(path.dirname(tab.path));
                if (path.basename(d2) !== "com.mojang") break loadDevelopmentResourcePacksFolderPacks;
                const d3: string = path.dirname(d2);
                if (path.basename(d3) !== "games") break loadDevelopmentResourcePacksFolderPacks;
                const d4: string = path.dirname(d3);
                if (!/^\d+$/.test(path.basename(d4))) break loadDevelopmentResourcePacksFolderPacks;
                const d5: string = path.dirname(d4);
                if (path.basename(d5) !== "Users") break loadDevelopmentResourcePacksFolderPacks;
                developmentResourcePacksFolderPath = path.join(d5, "Shared/games/com.mojang/development_resource_packs");
                if (!existsSync(developmentResourcePacksFolderPath)) break loadDevelopmentResourcePacksFolderPacks;
            } catch (e) {
                console.error("Error while checking if this is a GDK Minecraft world folder:", e, tab.path);
                break loadDevelopmentResourcePacksFolderPacks;
            }
        }
        for (const folder of await readdir(developmentResourcePacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(developmentResourcePacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(
                    await readFile(path.join(developmentResourcePacksFolderPath, folder, "manifest.json"), "utf8")
                );
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(developmentResourcePacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(developmentResourcePacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(
                                    path.join(developmentResourcePacksFolderPath, folder, "texts", langFile),
                                    "utf8"
                                );
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                developmentResourcePacksFolderPacks.push({
                    folderPath: path.join(developmentResourcePacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(developmentResourcePacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();
    let developmentBehaviorPacksFolderPacks: {
        folderPath: string;
        manifest: ManifestJSONSchema;
        hasPackIcon: boolean;
        nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
        descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null;
    }[] = [];
    loadDevelopmentBehaviorPacksFolderPacks: {
        if (!tab.isNonIsolatedWorld) break loadDevelopmentBehaviorPacksFolderPacks;
        let developmentBehaviorPacksFolderPath: string = path.join(tab.path, "../../", "development_behavior_packs");
        if (!existsSync(developmentBehaviorPacksFolderPath)) {
            try {
                const d2: string = path.dirname(path.dirname(tab.path));
                if (path.basename(d2) !== "com.mojang") break loadDevelopmentBehaviorPacksFolderPacks;
                const d3: string = path.dirname(d2);
                if (path.basename(d3) !== "games") break loadDevelopmentBehaviorPacksFolderPacks;
                const d4: string = path.dirname(d3);
                if (!/^\d+$/.test(path.basename(d4))) break loadDevelopmentBehaviorPacksFolderPacks;
                const d5: string = path.dirname(d4);
                if (path.basename(d5) !== "Users") break loadDevelopmentBehaviorPacksFolderPacks;
                developmentBehaviorPacksFolderPath = path.join(d5, "Shared/games/com.mojang/development_behavior_packs");
                if (!existsSync(developmentBehaviorPacksFolderPath)) break loadDevelopmentBehaviorPacksFolderPacks;
            } catch (e) {
                console.error("Error while checking if this is a GDK Minecraft world folder:", e, tab.path);
                break loadDevelopmentBehaviorPacksFolderPacks;
            }
        }
        for (const folder of await readdir(developmentBehaviorPacksFolderPath)) {
            signal.throwIfAborted();
            try {
                if (!existsSync(path.join(developmentBehaviorPacksFolderPath, folder, "manifest.json"))) continue;
                const manifest: ManifestJSONSchema = json5.parse(
                    await readFile(path.join(developmentBehaviorPacksFolderPath, folder, "manifest.json"), "utf8")
                );
                signal.throwIfAborted();
                let nameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                let descriptionLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | null = null;
                findLocales: if (manifest.header.name === "pack.name" || manifest.header.description === "pack.description") {
                    if (!existsSync(path.join(developmentBehaviorPacksFolderPath, folder, "texts"))) break findLocales;
                    if (manifest.header.name === "pack.name") nameLocales = {};
                    if (manifest.header.description === "pack.description") descriptionLocales = {};
                    try {
                        for (const langFile of await readdir(path.join(developmentBehaviorPacksFolderPath, folder, "texts"))) {
                            signal.throwIfAborted();
                            if (!langFile.endsWith(".lang")) continue;
                            try {
                                const langFileContents: string = await readFile(
                                    path.join(developmentBehaviorPacksFolderPath, folder, "texts", langFile),
                                    "utf8"
                                );
                                signal.throwIfAborted();
                                let packNameFound: boolean = !nameLocales;
                                let packDescriptionFound: boolean = !descriptionLocales;
                                for (const entry of langFileContents.split("\n")) {
                                    if (packNameFound && packDescriptionFound) break;
                                    const entryParts: string[] = entry.split("=");
                                    if (entryParts.length < 2) continue;
                                    const key: string = entryParts[0]!;
                                    const value: string = entryParts.slice(1).join("=");
                                    if (nameLocales && key === "pack.name") {
                                        packNameFound = true;
                                        nameLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                    if (descriptionLocales && key === "pack.description") {
                                        packDescriptionFound = true;
                                        descriptionLocales![langFile.slice(0, -5)] = value;
                                        continue;
                                    }
                                }
                            } catch {}
                        }
                    } catch {}
                }
                signal.throwIfAborted();
                developmentBehaviorPacksFolderPacks.push({
                    folderPath: path.join(developmentBehaviorPacksFolderPath, folder),
                    manifest,
                    hasPackIcon: existsSync(path.join(developmentBehaviorPacksFolderPath, folder, "pack_icon.png")),
                    nameLocales,
                    descriptionLocales,
                });
            } catch {}
        }
    }
    signal.throwIfAborted();

    return {
        worldResourcePacks,
        worldBehaviorPacks,
        worldResourcePackHistory,
        worldBehaviorPackHistory,
        worldResourcePacksFolderPacks,
        worldBehaviorPacksFolderPacks,
        localResourcePacksFolderPacks,
        localBehaviorPacksFolderPacks,
        developmentResourcePacksFolderPacks,
        developmentBehaviorPacksFolderPacks,
    };
}

// IDEA: Maybe add another mode that should local and development packs, or separate modes for each. To allow for enabling the packs from there.
// IDEA: Add a button to select an mcpack or mcaddon file and have the app add it into the world files and apply the pack.
function getPacksDataEntries({
    worldResourcePacks,
    worldBehaviorPacks,
    worldResourcePackHistory,
    worldBehaviorPackHistory,
    worldResourcePacksFolderPacks,
    worldBehaviorPacksFolderPacks,
    localResourcePacksFolderPacks,
    localBehaviorPacksFolderPacks,
    developmentResourcePacksFolderPacks,
    developmentBehaviorPacksFolderPacks,
}: Awaited<ReturnType<typeof getPacksData>>): {
    entries_active_resourcePacks: PackEntry[];
    entries_active_behaviorPacks: PackEntry[];
    entries_inactive_resourcePacks: PackEntry[];
    entries_inactive_behaviorPacks: PackEntry[];
} {
    // Pack priority is: world > development > local
    let entries_active_resourcePacks: PackEntry[] =
        worldResourcePacks?.map((pack: WorldXPacksJSONSchema[number]): PackEntry => {
            const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                !pack.pack_id || !pack.version ?
                    null
                :   (worldResourcePackHistory?.packs.find(
                        (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                            entry.uuid === pack.pack_id &&
                            !!entry.version &&
                            semver
                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                    ) ?? null);
            const matchingWorldPack: XPacksFolderPack | undefined = worldResourcePacksFolderPacks.find(
                (v: XPacksFolderPack): boolean =>
                    v.manifest.header.uuid === pack.pack_id &&
                    !!pack.version &&
                    semver
                        .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                        ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
            );
            const matchingDevelopmentPack: XPacksFolderPack | undefined =
                matchingWorldPack ? undefined : (
                    developmentResourcePacksFolderPacks.find(
                        (v: XPacksFolderPack): boolean =>
                            v.manifest.header.uuid === pack.pack_id &&
                            !!pack.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                    )
                );
            const matchingLocalPack: XPacksFolderPack | undefined =
                matchingDevelopmentPack ? undefined : (
                    localResourcePacksFolderPacks.find(
                        (v: XPacksFolderPack): boolean =>
                            v.manifest.header.uuid === pack.pack_id &&
                            !!pack.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                    )
                );

            return {
                pack_icon:
                    matchingWorldPack ?
                        matchingWorldPack.hasPackIcon ?
                            path.join(matchingWorldPack.folderPath, "pack_icon.png")
                        :   null
                    : matchingDevelopmentPack ?
                        matchingDevelopmentPack.hasPackIcon ?
                            path.join(matchingDevelopmentPack.folderPath, "pack_icon.png")
                        :   null
                    : matchingLocalPack ?
                        matchingLocalPack.hasPackIcon ?
                            path.join(matchingLocalPack.folderPath, "pack_icon.png")
                        :   null
                    :   null,
                pack_id: pack.pack_id,
                version: pack.version,
                packDetails:
                    matchingWorldPack ? { ...matchingWorldPack, storageLocation: "world" }
                    : matchingDevelopmentPack ? { ...matchingDevelopmentPack, storageLocation: "development" }
                    : matchingLocalPack ? { ...matchingLocalPack, storageLocation: "local" }
                    : null,
                historyEntry,
                locations: {
                    folder:
                        matchingWorldPack ? "world"
                        : matchingDevelopmentPack ? "development"
                        : matchingLocalPack ? "local"
                        : undefined,
                    worldXPacks: true,
                    worldXPackHistory: !!historyEntry,
                },
                packName:
                    (
                        (matchingWorldPack ? matchingWorldPack.nameLocales
                        : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                        : matchingLocalPack ? matchingLocalPack.nameLocales
                        : undefined) &&
                        (matchingWorldPack?.manifest.header.name ??
                            matchingDevelopmentPack?.manifest.header.name ??
                            matchingLocalPack?.manifest.header.name) === "pack.name"
                    ) ?
                        // If the pack's name uses localization, and the localization object is available, pass undefined so that is used instead.
                        undefined
                    :   (matchingWorldPack?.manifest.header.name ??
                        matchingDevelopmentPack?.manifest.header.name ??
                        matchingLocalPack?.manifest.header.name ??
                        // If the history entry's name is localized, the name is provided via packNameLocales instead.
                        (typeof historyEntry?.name === "string" ? historyEntry.name : undefined)),
                packNameLocales:
                    (matchingWorldPack ? matchingWorldPack.nameLocales
                    : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                    : matchingLocalPack ? matchingLocalPack.nameLocales
                    : undefined) ?? (typeof historyEntry?.name === "object" ? historyEntry.name : undefined),
            };
        }) ?? [];

    let entries_active_behaviorPacks: PackEntry[] =
        worldBehaviorPacks?.map((pack: WorldXPacksJSONSchema[number]): PackEntry => {
            const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                !pack.pack_id || !pack.version ?
                    null
                :   (worldBehaviorPackHistory?.packs.find(
                        (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                            entry.uuid === pack.pack_id &&
                            !!entry.version &&
                            semver
                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                    ) ?? null);
            const matchingWorldPack: XPacksFolderPack | undefined = worldBehaviorPacksFolderPacks.find(
                (v: XPacksFolderPack): boolean =>
                    v.manifest.header.uuid === pack.pack_id &&
                    !!pack.version &&
                    semver
                        .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                        ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
            );
            const matchingDevelopmentPack: XPacksFolderPack | undefined =
                matchingWorldPack ? undefined : (
                    developmentBehaviorPacksFolderPacks.find(
                        (v: XPacksFolderPack): boolean =>
                            v.manifest.header.uuid === pack.pack_id &&
                            !!pack.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                    )
                );
            const matchingLocalPack: XPacksFolderPack | undefined =
                matchingDevelopmentPack ? undefined : (
                    localBehaviorPacksFolderPacks.find(
                        (v: XPacksFolderPack): boolean =>
                            v.manifest.header.uuid === pack.pack_id &&
                            !!pack.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                    )
                );

            return {
                pack_icon:
                    matchingWorldPack ?
                        matchingWorldPack.hasPackIcon ?
                            path.join(matchingWorldPack.folderPath, "pack_icon.png")
                        :   null
                    : matchingDevelopmentPack ?
                        matchingDevelopmentPack.hasPackIcon ?
                            path.join(matchingDevelopmentPack.folderPath, "pack_icon.png")
                        :   null
                    : matchingLocalPack ?
                        matchingLocalPack.hasPackIcon ?
                            path.join(matchingLocalPack.folderPath, "pack_icon.png")
                        :   null
                    :   null,
                pack_id: pack.pack_id,
                version: pack.version,
                packDetails:
                    matchingWorldPack ? { ...matchingWorldPack, storageLocation: "world" }
                    : matchingDevelopmentPack ? { ...matchingDevelopmentPack, storageLocation: "development" }
                    : matchingLocalPack ? { ...matchingLocalPack, storageLocation: "local" }
                    : null,
                historyEntry,
                locations: {
                    folder:
                        matchingWorldPack ? "world"
                        : matchingDevelopmentPack ? "development"
                        : matchingLocalPack ? "local"
                        : undefined,
                    worldXPacks: true,
                    worldXPackHistory: !!historyEntry,
                },
                packName:
                    (
                        (matchingWorldPack ? matchingWorldPack.nameLocales
                        : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                        : matchingLocalPack ? matchingLocalPack.nameLocales
                        : undefined) &&
                        (matchingWorldPack?.manifest.header.name ??
                            matchingDevelopmentPack?.manifest.header.name ??
                            matchingLocalPack?.manifest.header.name) === "pack.name"
                    ) ?
                        // If the pack's name uses localization, and the localization object is available, pass undefined so that is used instead.
                        undefined
                    :   (matchingWorldPack?.manifest.header.name ??
                        matchingDevelopmentPack?.manifest.header.name ??
                        matchingLocalPack?.manifest.header.name ??
                        // If the history entry's name is localized, the name is provided via packNameLocales instead.
                        (typeof historyEntry?.name === "string" ? historyEntry.name : undefined)),
                packNameLocales:
                    (matchingWorldPack ? matchingWorldPack.nameLocales
                    : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                    : matchingLocalPack ? matchingLocalPack.nameLocales
                    : undefined) ?? (typeof historyEntry?.name === "object" ? historyEntry.name : undefined),
            };
        }) ?? [];

    let entries_inactive_resourcePacks: PackEntry[] = [
        ...(worldResourcePackHistory?.packs
            .filter(
                (v) =>
                    !worldResourcePacks?.some(
                        (rp) =>
                            rp.pack_id === v.uuid &&
                            (typeof rp.version === "string" ? rp.version === v.version : rp.version?.every((vv, i) => vv === v.version?.[i]))
                    )
            )
            .map((pack: WorldXPackHistoryJSONSchema["packs"][number]): PackEntry => {
                const matchingWorldPack: XPacksFolderPack | undefined = worldResourcePacksFolderPacks.find(
                    (v: XPacksFolderPack): boolean =>
                        v.manifest.header.uuid === pack.pack_id &&
                        !!pack.version &&
                        semver
                            .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                            ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                );
                const matchingDevelopmentPack: XPacksFolderPack | undefined =
                    matchingWorldPack ? undefined : (
                        developmentResourcePacksFolderPacks.find(
                            (v: XPacksFolderPack): boolean =>
                                v.manifest.header.uuid === pack.pack_id &&
                                !!pack.version &&
                                semver
                                    .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                    ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                        )
                    );
                const matchingLocalPack: XPacksFolderPack | undefined =
                    matchingDevelopmentPack ? undefined : (
                        localResourcePacksFolderPacks.find(
                            (v: XPacksFolderPack): boolean =>
                                v.manifest.header.uuid === pack.pack_id &&
                                !!pack.version &&
                                semver
                                    .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                    ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                        )
                    );

                return {
                    pack_icon:
                        matchingWorldPack ?
                            matchingWorldPack.hasPackIcon ?
                                path.join(matchingWorldPack.folderPath, "pack_icon.png")
                            :   null
                        : matchingDevelopmentPack ?
                            matchingDevelopmentPack.hasPackIcon ?
                                path.join(matchingDevelopmentPack.folderPath, "pack_icon.png")
                            :   null
                        : matchingLocalPack ?
                            matchingLocalPack.hasPackIcon ?
                                path.join(matchingLocalPack.folderPath, "pack_icon.png")
                            :   null
                        :   null,
                    pack_id: pack.uuid,
                    version: pack.version,
                    packDetails:
                        matchingWorldPack ? { ...matchingWorldPack, storageLocation: "world" }
                        : matchingDevelopmentPack ? { ...matchingDevelopmentPack, storageLocation: "development" }
                        : matchingLocalPack ? { ...matchingLocalPack, storageLocation: "local" }
                        : null,
                    historyEntry: pack,
                    locations: {
                        folder:
                            matchingWorldPack ? "world"
                            : matchingDevelopmentPack ? "development"
                            : matchingLocalPack ? "local"
                            : undefined,
                        worldXPacks: false,
                        worldXPackHistory: true,
                    },
                    packName:
                        (
                            (matchingWorldPack ? matchingWorldPack.nameLocales
                            : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                            : matchingLocalPack ? matchingLocalPack.nameLocales
                            : undefined) &&
                            (matchingWorldPack?.manifest.header.name ??
                                matchingDevelopmentPack?.manifest.header.name ??
                                matchingLocalPack?.manifest.header.name) === "pack.name"
                        ) ?
                            // If the pack's name uses localization, and the localization object is available, pass undefined so that is used instead.
                            undefined
                        :   (matchingWorldPack?.manifest.header.name ??
                            matchingDevelopmentPack?.manifest.header.name ??
                            matchingLocalPack?.manifest.header.name ??
                            // If the history entry's name is localized, the name is provided via packNameLocales instead.
                            (typeof pack?.name === "string" ? pack.name : undefined)),
                    packNameLocales:
                        (matchingWorldPack ? matchingWorldPack.nameLocales
                        : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                        : matchingLocalPack ? matchingLocalPack.nameLocales
                        : undefined) ?? (typeof pack?.name === "object" ? pack.name : undefined),
                };
            }) ?? []),
        ...worldResourcePacksFolderPacks
            .filter(
                (v: XPacksFolderPack): boolean =>
                    !worldResourcePackHistory?.packs.some(
                        (rp) =>
                            rp.uuid === v.manifest.header.uuid &&
                            rp.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof rp.version === "string" ? rp.version : rp.version.join(".")) === 0
                    ) &&
                    !worldResourcePacks?.some(
                        (rp) =>
                            rp.pack_id === v.manifest.header.uuid &&
                            rp.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof rp.version === "string" ? rp.version : rp.version.join(".")) === 0
                    )
            )
            .map((pack: (typeof worldResourcePacksFolderPacks)[number]): PackEntry => {
                return {
                    pack_icon: pack.hasPackIcon ? path.join(pack.folderPath, "pack_icon.png") : null,
                    pack_id: pack.manifest.header.uuid,
                    version: pack.manifest.header.version,
                    packDetails: {
                        ...pack,
                        storageLocation: "world",
                    },
                    historyEntry: null,
                    locations: {
                        folder: "world",
                        worldXPacks: false,
                        worldXPackHistory: false,
                    },
                    packName: pack.nameLocales && pack.manifest.header.name === "pack.name" ? undefined : pack.manifest.header.name,
                    packNameLocales: pack.nameLocales ?? undefined,
                };
            }),
    ];

    let entries_inactive_behaviorPacks: PackEntry[] = [
        ...(worldBehaviorPackHistory?.packs
            .filter(
                (v) =>
                    !worldBehaviorPacks?.some(
                        (rp) =>
                            rp.pack_id === v.uuid &&
                            (typeof rp.version === "string" ? rp.version === v.version : rp.version?.every((vv, i) => vv === v.version?.[i]))
                    )
            )
            .map((pack: WorldXPackHistoryJSONSchema["packs"][number]): PackEntry => {
                const matchingWorldPack: XPacksFolderPack | undefined = worldBehaviorPacksFolderPacks.find(
                    (v: XPacksFolderPack): boolean =>
                        v.manifest.header.uuid === pack.pack_id &&
                        !!pack.version &&
                        semver
                            .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                            ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                );
                const matchingDevelopmentPack: XPacksFolderPack | undefined =
                    matchingWorldPack ? undefined : (
                        developmentBehaviorPacksFolderPacks.find(
                            (v: XPacksFolderPack): boolean =>
                                v.manifest.header.uuid === pack.pack_id &&
                                !!pack.version &&
                                semver
                                    .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                    ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                        )
                    );
                const matchingLocalPack: XPacksFolderPack | undefined =
                    matchingDevelopmentPack ? undefined : (
                        localBehaviorPacksFolderPacks.find(
                            (v: XPacksFolderPack): boolean =>
                                v.manifest.header.uuid === pack.pack_id &&
                                !!pack.version &&
                                semver
                                    .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                    ?.compareMain(typeof pack.version === "string" ? pack.version : pack.version.join(".")) === 0
                        )
                    );

                return {
                    pack_icon:
                        matchingWorldPack ?
                            matchingWorldPack.hasPackIcon ?
                                path.join(matchingWorldPack.folderPath, "pack_icon.png")
                            :   null
                        : matchingDevelopmentPack ?
                            matchingDevelopmentPack.hasPackIcon ?
                                path.join(matchingDevelopmentPack.folderPath, "pack_icon.png")
                            :   null
                        : matchingLocalPack ?
                            matchingLocalPack.hasPackIcon ?
                                path.join(matchingLocalPack.folderPath, "pack_icon.png")
                            :   null
                        :   null,
                    pack_id: pack.uuid,
                    version: pack.version,
                    packDetails:
                        matchingWorldPack ? { ...matchingWorldPack, storageLocation: "world" }
                        : matchingDevelopmentPack ? { ...matchingDevelopmentPack, storageLocation: "development" }
                        : matchingLocalPack ? { ...matchingLocalPack, storageLocation: "local" }
                        : null,
                    historyEntry: pack,
                    locations: {
                        folder:
                            matchingWorldPack ? "world"
                            : matchingDevelopmentPack ? "development"
                            : matchingLocalPack ? "local"
                            : undefined,
                        worldXPacks: false,
                        worldXPackHistory: true,
                    },
                    packName:
                        (
                            (matchingWorldPack ? matchingWorldPack.nameLocales
                            : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                            : matchingLocalPack ? matchingLocalPack.nameLocales
                            : undefined) &&
                            (matchingWorldPack?.manifest.header.name ??
                                matchingDevelopmentPack?.manifest.header.name ??
                                matchingLocalPack?.manifest.header.name) === "pack.name"
                        ) ?
                            // If the pack's name uses localization, and the localization object is available, pass undefined so that is used instead.
                            undefined
                        :   (matchingWorldPack?.manifest.header.name ??
                            matchingDevelopmentPack?.manifest.header.name ??
                            matchingLocalPack?.manifest.header.name ??
                            // If the history entry's name is localized, the name is provided via packNameLocales instead.
                            (typeof pack?.name === "string" ? pack.name : undefined)),
                    packNameLocales:
                        (matchingWorldPack ? matchingWorldPack.nameLocales
                        : matchingDevelopmentPack ? matchingDevelopmentPack.nameLocales
                        : matchingLocalPack ? matchingLocalPack.nameLocales
                        : undefined) ?? (typeof pack?.name === "object" ? pack.name : undefined),
                };
            }) ?? []),
        ...worldBehaviorPacksFolderPacks
            .filter(
                (v: XPacksFolderPack): boolean =>
                    !worldBehaviorPackHistory?.packs.some(
                        (rp) =>
                            rp.uuid === v.manifest.header.uuid &&
                            rp.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof rp.version === "string" ? rp.version : rp.version.join(".")) === 0
                    ) &&
                    !worldBehaviorPacks?.some(
                        (rp) =>
                            rp.pack_id === v.manifest.header.uuid &&
                            rp.version &&
                            semver
                                .parse(typeof v.manifest.header.version === "string" ? v.manifest.header.version : v.manifest.header.version.join("."))
                                ?.compareMain(typeof rp.version === "string" ? rp.version : rp.version.join(".")) === 0
                    )
            )
            .map((pack: (typeof worldBehaviorPacksFolderPacks)[number]): PackEntry => {
                return {
                    pack_icon: pack.hasPackIcon ? path.join(pack.folderPath, "pack_icon.png") : null,
                    pack_id: pack.manifest.header.uuid,
                    version: pack.manifest.header.version,
                    packDetails: {
                        ...pack,
                        storageLocation: "world",
                    },
                    historyEntry: null,
                    locations: {
                        folder: "world",
                        worldXPacks: false,
                        worldXPackHistory: false,
                    },
                    packName: pack.nameLocales && pack.manifest.header.name === "pack.name" ? undefined : pack.manifest.header.name,
                    packNameLocales: pack.nameLocales ?? undefined,
                };
            }),
    ];

    return {
        entries_active_resourcePacks,
        entries_active_behaviorPacks,
        entries_inactive_resourcePacks,
        entries_inactive_behaviorPacks,
    };
}

// TODO: Implement actual usage of the abort signal.
async function getPacksTabContents(tab: TabManagerTab, signal: AbortSignal): Promise<JSX.Element> {
    let {
        worldResourcePacks,
        worldBehaviorPacks,
        worldResourcePackHistory,
        worldBehaviorPackHistory,
        worldResourcePacksFolderPacks,
        worldBehaviorPacksFolderPacks,
        localResourcePacksFolderPacks,
        localBehaviorPacksFolderPacks,
        developmentResourcePacksFolderPacks,
        developmentBehaviorPacksFolderPacks,
    } = await getPacksData(tab, signal);

    // REVIEW: Maybe this tab doesn't need to have async mode.
    let asyncMode: boolean =
        "__FORCE_ASYNC_KEY_MODE__" in window ? !!window["__FORCE_ASYNC_KEY_MODE__"]
        : config.useAsyncModeInEntryViews === "auto" ?
            (worldResourcePacks?.length ?? 0) +
                (worldBehaviorPacks?.length ?? 0) +
                (worldResourcePackHistory?.packs.length ?? 0) +
                (worldBehaviorPackHistory?.packs.length ?? 0) >
            20 // TODO: This should be configurable.
        :   config.useAsyncModeInEntryViews;

    let { entries_active_resourcePacks, entries_active_behaviorPacks, entries_inactive_resourcePacks, entries_inactive_behaviorPacks } = getPacksDataEntries({
        worldResourcePacks,
        worldBehaviorPacks,
        worldResourcePackHistory,
        worldBehaviorPackHistory,
        worldResourcePacksFolderPacks,
        worldBehaviorPacksFolderPacks,
        localResourcePacksFolderPacks,
        localBehaviorPacksFolderPacks,
        developmentResourcePacksFolderPacks,
        developmentBehaviorPacksFolderPacks,
    });

    let mode: ConfigConstants.views.Packs.PacksTabMode = config.views.packs.mode;
    let currentUpdateTablesContentsFunction: ((reloadData: boolean) => Promise<void>) | null = null;
    let emptyTablesContents: JSX.Element[][] =
        asyncMode ?
            [[]]
        :   await Promise.all(
                ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map(
                    async (sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                        await getPacksTabContentsRows({
                            tab,
                            worldResourcePacks: worldResourcePacks ?? null,
                            worldBehaviorPacks: worldBehaviorPacks ?? null,
                            worldResourcePackHistory: worldResourcePackHistory ?? null,
                            worldBehaviorPackHistory: worldBehaviorPackHistory ?? null,
                            entries:
                                mode === "active" ?
                                    sectionID === "resourcePacks" ?
                                        entries_active_resourcePacks
                                    :   entries_active_behaviorPacks
                                : sectionID === "resourcePacks" ? entries_inactive_resourcePacks
                                : entries_inactive_behaviorPacks,
                            mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Packs.PacksTabSectionMode,
                            get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                                return currentUpdateTablesContentsFunction;
                            },
                        })
                )
            );
    let tablesContents: JSX.Element[][] = emptyTablesContents;
    function Contents(): JSX.Element {
        const tablesContainerRef: RefObject<HTMLTableElement> = useRef<HTMLTableElement>(null);
        const loadingScreenMessageContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
        const searchRefs = {
            searchAreaContainer: useRef<HTMLDivElement>(null),
            searchTextBox: useRef<HTMLInputElement>(null),
            searchTextBoxErrorPopup: useRef<HTMLDivElement>(null),
            searchButton: useRef<HTMLButtonElement>(null),
            helpButton: useRef<HTMLButtonElement>(null),
        };
        const viewOptionsRefs = {
            viewOptionsContainer: useRef<HTMLDivElement>(null),
            viewOptionsTabbedSelector: useRef<HTMLDivElement>(null),
        };
        async function getTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<JSX.Element[]> {
            const sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number] =
                ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode][sectionIndex]!;
            // TODO: Implement async mode here.
            return await getPacksTabContentsRows({
                tab,
                worldResourcePacks: worldResourcePacks ?? null,
                worldBehaviorPacks: worldBehaviorPacks ?? null,
                worldResourcePackHistory: worldResourcePackHistory ?? null,
                worldBehaviorPackHistory: worldBehaviorPackHistory ?? null,
                mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Packs.PacksTabSectionMode,
                entries: (mode === "active" ?
                    sectionID === "resourcePacks" ?
                        entries_active_resourcePacks
                    :   entries_active_behaviorPacks
                : sectionID === "resourcePacks" ? entries_inactive_resourcePacks
                : entries_inactive_behaviorPacks
                ).slice(start, end),
                get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                    return currentUpdateTablesContentsFunction;
                },
            });
        }
        async function loadTablesContentsInRange(sectionIndex: number, start: number, end: number): Promise<void> {
            if (!asyncMode) return;
            // const sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number] =
            //     ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode][sectionIndex]!;
            tablesContents = [...tablesContents];
            tablesContents[sectionIndex] = [...emptyTablesContents[sectionIndex]!];
            tablesContents[sectionIndex].splice(start, end - start, ...(await getTablesContentsInRange(sectionIndex, start, end)));
        }
        function getSectionEntryCounts(): number[] {
            return ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map(
                (sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number]): number => {
                    switch (sectionID) {
                        case "resourcePacks":
                            return mode === "active" ?
                                    (worldResourcePacks?.length ?? 0)
                                :   (worldResourcePackHistory?.packs.filter(
                                        (v) =>
                                            !worldResourcePacks?.some(
                                                (rp) =>
                                                    rp.pack_id === v.uuid &&
                                                    (typeof rp.version === "string" ?
                                                        rp.version === v.version
                                                    :   rp.version?.every((vv, i) => vv === v.version?.[i]))
                                            )
                                    ).length ?? 0);
                        case "behaviorPacks":
                            return mode === "active" ?
                                    (worldBehaviorPacks?.length ?? 0)
                                :   (worldBehaviorPackHistory?.packs.filter(
                                        (v) =>
                                            !worldBehaviorPacks?.some(
                                                (rp) =>
                                                    rp.pack_id === v.uuid &&
                                                    (typeof rp.version === "string" ?
                                                        rp.version === v.version
                                                    :   rp.version?.every((vv, i) => vv === v.version?.[i]))
                                            )
                                    ).length ?? 0);
                    }
                }
            );
        }
        function TablesContents(): JSX.Element {
            let localTablesContents: Observable<JSX.Element[][]> = createObservable(
                ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map((): [] => [])
            );
            if (asyncMode) {
                Promise.all(
                    ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map(
                        async (
                            _sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number],
                            index: number
                        ): Promise<JSX.Element[]> => getTablesContentsInRange(index, 0, 20)
                    )
                ).then((tablesContents: JSX.Element[][]): void => {
                    localTablesContents.set(tablesContents);
                });
            }
            return (
                <>
                    {...ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map(
                        (sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number], index: number): JSX.Element => {
                            function Test1(): JSX.Element {
                                const bodyRef: RefObject<HTMLTableSectionElement> = useRef<HTMLTableSectionElement>(null);
                                localTablesContents.observe((tablesContents: JSX.Element[][]): void => {
                                    if (!asyncMode || !bodyRef.current) return;
                                    let tempElement: HTMLDivElement = document.createElement("div");
                                    render(<>{...tablesContents[index]!}</>, tempElement);
                                    bodyRef.current.replaceChildren(...tempElement.children);
                                });
                                // const [columnHeadersContextMenu_isOpen, columnHeadersContextMenu_setOpen] = useState(false);
                                // const [columnHeadersContextMenu_anchorPoint, columnHeadersContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                const headerName = ConfigConstants.views.Packs.packsTabModeSectionHeaderNames[mode][index];
                                const sectionMode: ConfigConstants.views.Packs.PacksTabSectionMode = (
                                    sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Packs.PacksTabSectionMode;
                                return (
                                    <>
                                        {/* TO-DO: Add in this context menu once the bug with it is fixed. https://github.com/szhsin/react-menu/issues/1591 */}
                                        {/* <ControlledMenu
                                            anchorPoint={columnHeadersContextMenu_anchorPoint}
                                            state={columnHeadersContextMenu_isOpen ? "open" : "closed"}
                                            direction="right"
                                            onClose={(): void => void columnHeadersContextMenu_setOpen(false)}
                                        >
                                            <MenuItem>Cut</MenuItem>
                                            <MenuItem>Copy</MenuItem>
                                            <MenuItem>Paste</MenuItem>
                                        </ControlledMenu> */}
                                        <table class="nsel" style="flex: 1; overflow: auto; margin: 5px;">
                                            <thead>
                                                {headerName && (
                                                    <tr>
                                                        <th colSpan={ConfigConstants.views.Packs.packsTabModeToColumnIDs[sectionMode].length}>{headerName}</th>
                                                    </tr>
                                                )}
                                                <tr
                                                /* onContextMenu={(event: JSX.TargetedMouseEvent<HTMLTableRowElement>): void => {
                                                        if (typeof document.hasFocus === "function" && !document.hasFocus()) return;

                                                        event.preventDefault();
                                                        columnHeadersContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                        columnHeadersContextMenu_setOpen(true);
                                                    }} */
                                                >
                                                    {...config.views.packs.modeSettings[mode].sections[sectionID].columns.map(
                                                        (
                                                            columnID: (typeof ConfigConstants.views.Packs.packsTabModeToColumnIDs)[typeof sectionMode][number]
                                                        ): JSX.SpecificElement<"th"> => {
                                                            const displayName = ConfigConstants.views.Packs.columnIDToDisplayName[columnID];
                                                            return (
                                                                <th>
                                                                    {typeof displayName === "string" ?
                                                                        displayName
                                                                    :   (displayName as { headerLabel: string }).headerLabel}
                                                                </th>
                                                            );
                                                        }
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody ref={bodyRef}>
                                                {...asyncMode ? localTablesContents.get()[index]! : tablesContents[index]!.slice(0, 20)}
                                            </tbody>
                                            <tfoot>
                                                <tr class="table-footer-row-page-navigation">
                                                    <td colSpan={ConfigConstants.views.Packs.packsTabModeToColumnIDs[sectionMode].length}>
                                                        <PageNavigation
                                                            totalPages={Math.ceil(getSectionEntryCounts()[index]! / 20)}
                                                            onPageChange={async (page: number): Promise<void> => {
                                                                if (!bodyRef.current) return;
                                                                if (asyncMode) {
                                                                    localTablesContents.get()[index] = await getTablesContentsInRange(
                                                                        index,
                                                                        (page - 1) * 20,
                                                                        page * 20
                                                                    );
                                                                }
                                                                // let tempElement: HTMLDivElement = document.createElement("div");
                                                                render(null, bodyRef.current);
                                                                render(
                                                                    <>
                                                                        {...asyncMode ?
                                                                            localTablesContents.get()[index]!
                                                                        :   tablesContents[index]!.slice((page - 1) * 20, page * 20)}
                                                                    </>,
                                                                    bodyRef.current /* tempElement */
                                                                );
                                                                // bodyRef.current.replaceChildren(...tempElement.children);
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </>
                                );
                            }
                            return <Test1 />;
                        }
                    )}
                </>
            );
        }
        async function updateTablesContents(reloadData: boolean): Promise<void> {
            if (!tablesContainerRef.current) return;
            if (reloadData) {
                mode = config.views.packs.mode;
                worldResourcePacks = undefined;
                worldBehaviorPacks = undefined;
                worldResourcePackHistory = undefined;
                worldBehaviorPackHistory = undefined;
                worldResourcePacksFolderPacks = [];
                worldBehaviorPacksFolderPacks = [];
                entries_active_resourcePacks = [];
                entries_active_behaviorPacks = [];
                entries_inactive_resourcePacks = [];
                entries_inactive_behaviorPacks = [];

                ({
                    worldResourcePacks,
                    worldBehaviorPacks,
                    worldResourcePackHistory,
                    worldBehaviorPackHistory,
                    worldResourcePacksFolderPacks,
                    worldBehaviorPacksFolderPacks,
                    localResourcePacksFolderPacks,
                    localBehaviorPacksFolderPacks,
                    developmentResourcePacksFolderPacks,
                    developmentBehaviorPacksFolderPacks,
                } = await getPacksData(tab, signal));

                ({ entries_active_resourcePacks, entries_active_behaviorPacks, entries_inactive_resourcePacks, entries_inactive_behaviorPacks } =
                    getPacksDataEntries({
                        worldResourcePacks,
                        worldBehaviorPacks,
                        worldResourcePackHistory,
                        worldBehaviorPackHistory,
                        worldResourcePacksFolderPacks,
                        worldBehaviorPacksFolderPacks,
                        localResourcePacksFolderPacks,
                        localBehaviorPacksFolderPacks,
                        developmentResourcePacksFolderPacks,
                        developmentBehaviorPacksFolderPacks,
                    }));

                if (asyncMode) {
                    // TODO
                } else {
                    emptyTablesContents = await Promise.all(
                        ConfigConstants.views.Packs.packsTabModeToSectionIDs[mode].map(
                            async (sectionID: (typeof ConfigConstants.views.Packs.packsTabModeToSectionIDs)[typeof mode][number]): Promise<JSX.Element[]> =>
                                await getPacksTabContentsRows({
                                    tab,
                                    worldResourcePacks: worldResourcePacks ?? null,
                                    worldBehaviorPacks: worldBehaviorPacks ?? null,
                                    worldResourcePackHistory: worldResourcePackHistory ?? null,
                                    worldBehaviorPackHistory: worldBehaviorPackHistory ?? null,
                                    entries:
                                        mode === "active" ?
                                            sectionID === "resourcePacks" ?
                                                entries_active_resourcePacks
                                            :   entries_active_behaviorPacks
                                        : sectionID === "resourcePacks" ? entries_inactive_resourcePacks
                                        : entries_inactive_behaviorPacks,
                                    mode: (sectionID === null ? mode : `${mode}_${sectionID}`) as ConfigConstants.views.Packs.PacksTabSectionMode,
                                    get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null {
                                        return currentUpdateTablesContentsFunction;
                                    },
                                })
                        )
                    );
                    tablesContents = emptyTablesContents;
                }
            }
            const tempElement: HTMLDivElement = document.createElement("div");
            render(<TablesContents />, tempElement);
            tablesContainerRef.current.replaceChildren(...tempElement.children);
        }
        currentUpdateTablesContentsFunction = updateTablesContents;
        useEffect((): (() => void) => {
            function onModeChanged(): void {
                updateTablesContents(true);
            }
            function onActiveModeColumnsChanged(): void {
                if (mode !== "active") return;
                updateTablesContents(false);
            }
            function onInactiveModeColumnsChanged(): void {
                if (mode !== "inactive") return;
                updateTablesContents(false);
            }
            config.on("settingChanged:views.packs.mode", onModeChanged);
            config.on("settingChanged:views.packs.modeSettings.active.sections.resourcePacks.columns", onActiveModeColumnsChanged);
            config.on("settingChanged:views.packs.modeSettings.active.sections.behaviorPacks.columns", onActiveModeColumnsChanged);
            config.on("settingChanged:views.packs.modeSettings.inactive.sections.resourcePacks.columns", onInactiveModeColumnsChanged);
            config.on("settingChanged:views.packs.modeSettings.inactive.sections.behaviorPacks.columns", onInactiveModeColumnsChanged);
            return (): void => {
                config.off("settingChanged:views.packs.mode", onModeChanged);
                config.off("settingChanged:views.packs.modeSettings.active.sections.resourcePacks.columns", onActiveModeColumnsChanged);
                config.off("settingChanged:views.packs.modeSettings.active.sections.behaviorPacks.columns", onActiveModeColumnsChanged);
                config.off("settingChanged:views.packs.modeSettings.inactive.sections.resourcePacks.columns", onInactiveModeColumnsChanged);
                config.off("settingChanged:views.packs.modeSettings.inactive.sections.behaviorPacks.columns", onInactiveModeColumnsChanged);
            };
        });
        return (
            <>
                <div
                    class="widget-overlay-bar widget-overlay-bar-transparent"
                    style="display: flex; flex-direction: row;"
                    ref={viewOptionsRefs.viewOptionsContainer}
                >
                    <div class="widget-overlay tabbed-selector" ref={viewOptionsRefs.viewOptionsTabbedSelector}>
                        <button
                            type="button"
                            class={mode === "active" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.packs.mode = "active";
                            }}
                        >
                            Active
                        </button>
                        <button
                            type="button"
                            class={mode === "inactive" ? "selected" : ""}
                            onClick={(event: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                                if (event.currentTarget.classList.contains("selected")) return;
                                $(event.currentTarget).siblings("button").removeClass("selected");
                                $(event.currentTarget).addClass("selected");
                                config.views.packs.mode = "inactive";
                            }}
                        >
                            Inactive
                        </button>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column;" ref={tablesContainerRef}>
                    <TablesContents />
                </div>
            </>
        );
    }
    return <Contents />;
}

type CopyContextMenuItemValue =
    | {
          /**
           * The value to copy when the context menu item is selected.
           *
           * If not provided, the context menu item cannot be clicked and only the items in the submenu can be clicked.
           */
          value: string;
          /**
           * Additional value format options to show in a submenu for the user to copy.
           */
          formatOptions?: undefined;
      }
    | {
          /**
           * The value to copy when the context menu item is selected.
           *
           * If not provided, the context menu item cannot be clicked and only the items in the submenu can be clicked.
           */
          value?: string | undefined;
          /**
           * Additional value format options to show in a submenu for the user to copy.
           */
          formatOptions: {
              /**
               * The option label.
               */
              label: string;
              /**
               * The value to copy when the option is selected.
               */
              value: string;
          }[];
      };

interface FoundPackDetails extends XPacksFolderPack {
    storageLocation: "world" | "local" | "development";
}

interface PackEntry {
    pack_id?: string | undefined;
    version?: string | [major: number, minor: number, patch: number] | undefined;
    /**
     * @todo This is not used yet.
     */
    pack_icon: string | null;
    packDetails: FoundPackDetails | null;
    historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null;
    locations: {
        folder: FoundPackDetails["storageLocation"] | undefined;
        worldXPacks: boolean;
        worldXPackHistory: boolean;
    };
    /**
     * @todo This is not used yet.
     */
    packName: string | undefined;
    /**
     * @todo This is not used yet.
     */
    packNameLocales: Partial<Record<LooseAutocomplete<LocaleID>, string>> | undefined;
}

// TODO: This should also show packs that are in the world files but not in the world_resource_packs.json, world_behavior_packs.json, world_resource_pack_history.json, or world_behavior_pack_history.json files.
// IDEA: Add an option to open the folder of a resource or behavior pack in file explorer.

async function getPacksTabContentsRows(data: {
    /**
     * The tab manager tab.
     */
    tab: TabManagerTab;
    worldResourcePacks: WorldXPacksJSONSchema | null;
    worldBehaviorPacks: WorldXPacksJSONSchema | null;
    worldResourcePackHistory: WorldXPackHistoryJSONSchema | null;
    worldBehaviorPackHistory: WorldXPackHistoryJSONSchema | null;
    entries: PackEntry[];
    /**
     * The mode of the tab.
     */
    mode: ConfigConstants.views.Packs.PacksTabSectionMode;
    get updateTablesContents(): ((reloadData: boolean) => Promise<void>) | null;
}): Promise<JSX.Element[]> {
    // const columns = config
    switch (data.mode) {
        case "active_resourcePacks": {
            const columns = config.views.packs.modeSettings.active.sections.resourcePacks.columns;
            return await Promise.all(
                data.entries?.map(async (pack: PackEntry): Promise<JSX.Element> => {
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                    //     pack.historyEntry ??
                    //     (!pack.pack_id ? null : (
                    //         (data.worldResourcePackHistory?.packs.find(
                    //             (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                    //                 entry.uuid === pack.pack_id &&
                    //                 !!entry.version &&
                    //                 semver.satisfies(
                    //                     typeof pack.version === "string" ? pack.version : pack.version!.join("."),
                    //                     typeof entry.version === "string" ? entry.version : entry.version.join("."),
                    //                     { includePrerelease: false }
                    //                 )
                    //         ) ?? null)
                    //     ));
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // let foundPack: FoundPackDetails | null = pack.packDetails ?? null;
                    // findPack: try {
                    //     if (pack.packDetails !== undefined) break findPack;
                    //     if (!pack.pack_id) break findPack;
                    //     if (!pack.version) break findPack;
                    //     worldResourcePacks: {
                    //         const resourcePacksFolder: string = path.join(data.tab.path, "resource_packs");
                    //         if (!existsSync(path.join(data.tab.path, "resource_packs"))) break worldResourcePacks;
                    //         for (const packFolder of await readdir(resourcePacksFolder)) {
                    //             try {
                    //                 const manifestPath: string = path.join(resourcePacksFolder, packFolder, "manifest.json");
                    //                 if (!existsSync(manifestPath)) continue;
                    //                 const manifest: ManifestJSONSchema = json5.parse(await readFile(manifestPath, "utf-8"));
                    //                 if (manifest.header.uuid !== pack.pack_id) continue;
                    //                 if (
                    //                     !semver.satisfies(
                    //                         typeof manifest.header.version === "string" ? manifest.header.version : manifest.header.version.join("."),
                    //                         typeof pack.version === "string" ? pack.version : pack.version.join("."),
                    //                         { includePrerelease: false }
                    //                     )
                    //                 ) {
                    //                     continue;
                    //                 }
                    //                 pack.packDetails = { storageLocation: "world", folderPath: path.join(resourcePacksFolder, packFolder), manifest };
                    //                 break findPack;
                    //             } catch {}
                    //         }
                    //     }
                    // } catch (e) {
                    //     console.error("Error while searching for pack manifest.json:", e);
                    // }

                    let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                    function Row(): JSX.Element {
                        // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                        const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                        const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                        function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            event.preventDefault();
                            event.stopPropagation();
                            const clickPosition: { x: number; y: number } = {
                                x: event.clientX,
                                y: event.clientY,
                            };
                            // console.log(clickPosition);

                            copyContextMenuItemValue = null;
                            valueCopyContextItemConfiguration: if (rowRef.current && event.target !== null && event.target instanceof Element) {
                                const containerCell: HTMLTableCellElement | null = event.target.closest("td");
                                if (containerCell?.parentElement !== rowRef.current) break valueCopyContextItemConfiguration;
                                if (containerCell.dataset.copyData === undefined) break valueCopyContextItemConfiguration;
                                copyContextMenuItemValue = JSON.parse(containerCell.dataset.copyData) as CopyContextMenuItemValue;
                            }

                            entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                            entryContextMenu_setOpen(true);
                        }
                        function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            return;
                        }
                        const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
                        try {
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                try {
                                                    const worldResourcePacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldResourcePacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex === -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldResourcePacksJSON.splice(packIndex, 1);
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"),
                                                        JSON.stringify(worldResourcePacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_resource_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while deactivating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while deactivating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Deactivate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                            <MenuItem
                                                onClick={async (_event: ContextMenu_ClickEvent): Promise<void> => {
                                                    // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                                    // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                                    // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                                    if (!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined) return;
                                                    clipboard.writeText(copyContextMenuItemValue.value);
                                                    // copyContextMenuItemValue = null;
                                                }}
                                                disabled={!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined}
                                            >
                                                Copy Cell Value
                                            </MenuItem>
                                        :   null}
                                        {!!copyContextMenuItemValue?.formatOptions && (
                                            <SubMenu label="Copy Cell Value as...">
                                                {...copyContextMenuItemValue.formatOptions.map(
                                                    (formatOption: NonNullable<CopyContextMenuItemValue["formatOptions"]>[number]): JSX.Element => (
                                                        <MenuItem
                                                            onClick={(_event: ContextMenu_ClickEvent): void => {
                                                                clipboard.writeText(formatOption.value);
                                                                copyContextMenuItemValue = null;
                                                            }}
                                                        >
                                                            {formatOption.label}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </SubMenu>
                                        )}
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onContextMenu={onEntryRightClick}
                                        ref={rowRef}
                                    >
                                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                            switch (column) {
                                                case "UUID": {
                                                    if (pack.pack_id === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = pack.pack_id;
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Version": {
                                                    if (pack.version === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = typeof pack.version === "string" ? pack.version : pack.version.join(".");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Dependencies": {
                                                    if (pack.packDetails === null) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    if (pack.packDetails.manifest.dependencies === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const formattedDependenciesList: string = pack.packDetails.manifest.dependencies
                                                        .map((dependency) => {
                                                            if ("uuid" in dependency && dependency.uuid !== undefined) {
                                                                return `${dependency.uuid}@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                            }
                                                            if ("module_name" in dependency && dependency.module_name !== undefined) {
                                                                return `${dependency.module_name}@${typeof dependency.version === "string" ? dependency.version : (dependency.version as number[] | undefined)?.join(".")}`;
                                                            }
                                                            return `?@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                        })
                                                        .join("\n");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "JSON", value: JSON.stringify(pack.packDetails.manifest.dependencies) },
                                                                    { label: "Formatted", value: formattedDependenciesList },
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            <span
                                                                title={formattedDependenciesList}
                                                                style="color: color-mix(in lab, var(--text-color) 50%, var(--table-bg-color)); cursor: help;"
                                                            >
                                                                {pack.packDetails.manifest.dependencies.length} dependencies
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                case "StorageLocation": {
                                                    if (pack.packDetails === null) {
                                                        if (pack.historyEntry) {
                                                            if (pack.historyEntry?.can_be_redownloaded) {
                                                                return (
                                                                    <td
                                                                        data-copy-data={JSON.stringify({
                                                                            formatOptions: [
                                                                                { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                            ],
                                                                        } satisfies CopyContextMenuItemValue)}
                                                                    >
                                                                        marketplace
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td
                                                                    data-copy-data={JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)}
                                                                >
                                                                    <span style="color: yellow;">history only</span>
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            title={pack.packDetails.folderPath}
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "Storage Location Type", value: pack.packDetails.storageLocation },
                                                                    { label: "Folder Path", value: pack.packDetails.folderPath },
                                                                    ...(pack.historyEntry ?
                                                                        [{ label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) }]
                                                                    :   []),
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {pack.packDetails.storageLocation}
                                                            {pack.historyEntry ?
                                                                pack.historyEntry?.can_be_redownloaded ?
                                                                    " & marketplace"
                                                                :   " & history"
                                                            :   " only"}
                                                        </td>
                                                    );
                                                }
                                                case "Name": {
                                                    if (
                                                        pack.historyEntry === null &&
                                                        pack.packDetails === null &&
                                                        pack.packName === undefined &&
                                                        pack.packNameLocales === undefined
                                                    ) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValueRaw: string | { [locale in LooseAutocomplete<"en_US">]?: string } | undefined =
                                                        pack.packNameLocales ?? pack.packName;
                                                    if (cellValueRaw === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string | undefined =
                                                        typeof cellValueRaw === "string" ? cellValueRaw : (
                                                            (cellValueRaw[config.locale] ??
                                                            cellValueRaw[findBestLocale(Object.keys(cellValueRaw)) ?? undefined!] ??
                                                            Object.values(cellValueRaw)[0] ??
                                                            pack.packName)
                                                        );
                                                    if (cellValue === undefined) {
                                                        return (
                                                            <td>
                                                                <span title="No localized name found for pack name that uses localization." style="color: red;">
                                                                    null
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            data-copy-data={
                                                                typeof cellValueRaw === "string" ?
                                                                    JSON.stringify({
                                                                        value: cellValue,
                                                                    } satisfies CopyContextMenuItemValue)
                                                                :   JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "Localized", value: cellValue },
                                                                            { label: "Raw", value: JSON.stringify(cellValueRaw) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)
                                                            }
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Icon": {
                                                    function PackIconElement(): JSX.Element {
                                                        const [packIconContextMenu_isOpen, packIconContextMenu_setOpen] = useState(false);
                                                        const [packIconContextMenu_anchorPoint, packIconContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                                        function onPackIconRightClick(event: JSX.TargetedMouseEvent<HTMLImageElement>): void {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            const clickPosition: { x: number; y: number } = {
                                                                x: event.clientX,
                                                                y: event.clientY,
                                                            };
                                                            // console.log(clickPosition);

                                                            packIconContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                            packIconContextMenu_setOpen(true);
                                                        }
                                                        return (
                                                            <td style={{ width: "128px" }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        height: "-webkit-fill-available",
                                                                        justifyContent: "center",
                                                                        flexDirection: "column",
                                                                    }}
                                                                >
                                                                    {pack.packDetails ?
                                                                        pack.pack_icon ?
                                                                            <>
                                                                                <ControlledMenu
                                                                                    anchorPoint={packIconContextMenu_anchorPoint}
                                                                                    state={packIconContextMenu_isOpen ? "open" : "closed"}
                                                                                    direction="right"
                                                                                    onClose={(): void => void packIconContextMenu_setOpen(false)}
                                                                                >
                                                                                    <MenuItem
                                                                                        onClick={async (): Promise<void> => {
                                                                                            if (!pack.packDetails) return;
                                                                                            const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                                                                                                buttonLabel: "Save",
                                                                                                defaultPath: path.join(
                                                                                                    app.getPath("downloads"),
                                                                                                    `pack_icon_${pack.pack_id}_${typeof pack.version === "string" ? pack.version : pack.version?.join(".")}.png`
                                                                                                ),
                                                                                                properties: [
                                                                                                    "showHiddenFiles",
                                                                                                    "showOverwriteConfirmation",
                                                                                                    "treatPackageAsDirectory",
                                                                                                ],
                                                                                                title: "Save Pack Icon",
                                                                                                message: "Select a location to save the pack icon.",
                                                                                                filters: [{ name: "PNG", extensions: ["png"] }],
                                                                                            });
                                                                                            if (result.canceled) return;
                                                                                            const mimeType: string | false = mime.lookup(result.filePath);
                                                                                            if (!mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType || path.extname(result.filePath)}`
                                                                                                );
                                                                                            const image: Buffer | null = await readFile(pack.pack_icon!);
                                                                                            if (!image)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Failed to Save Image",
                                                                                                    "An error occurred while saving the image."
                                                                                                );
                                                                                            if ("image/png" !== mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType}`
                                                                                                );
                                                                                            await writeFile(result.filePath, image);
                                                                                        }}
                                                                                    >
                                                                                        Save Image
                                                                                    </MenuItem>
                                                                                </ControlledMenu>
                                                                                <div
                                                                                    style={{
                                                                                        maxHeight: "round(down, 100%, 128px)",
                                                                                        display: "flex",
                                                                                        justifyContent: "center",
                                                                                        aspectRatio: "1 / 1",
                                                                                    }}
                                                                                >
                                                                                    <img
                                                                                        width={128}
                                                                                        height={128}
                                                                                        src={pack.pack_icon}
                                                                                        class="packs-tab-pack-icon-image piximg"
                                                                                        style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                        onContextMenu={(event: TargetedMouseEvent<HTMLImageElement>): void =>
                                                                                            void onPackIconRightClick(event)
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        :   <div
                                                                                style={{
                                                                                    maxHeight: "round(down, 100%, 128px)",
                                                                                    display: "flex",
                                                                                    justifyContent: "center",
                                                                                    aspectRatio: "1 / 1",
                                                                                }}
                                                                            >
                                                                                <img
                                                                                    width={128}
                                                                                    height={128}
                                                                                    src="resource://images/ui/misc/missing_texture.png"
                                                                                    class="packs-tab-pack-icon-image piximg"
                                                                                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                />
                                                                            </div>

                                                                    :   <div
                                                                            style={{
                                                                                maxHeight: "round(down, 100%, 128px)",
                                                                                display: "flex",
                                                                                justifyContent: "center",
                                                                                aspectRatio: "1 / 1",
                                                                            }}
                                                                        >
                                                                            <img
                                                                                width={128}
                                                                                height={128}
                                                                                src="resource://images/ui/misc/missing_pack_icon.png"
                                                                                class="packs-tab-pack-icon-image piximg"
                                                                                style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                            />
                                                                        </div>
                                                                    }
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <PackIconElement />;
                                                }
                                            }
                                        })}
                                    </tr>
                                </>
                            );
                        } catch (e) {
                            console.error(e);
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                try {
                                                    const worldResourcePacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldResourcePacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex === -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldResourcePacksJSON.splice(packIndex, 1);
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"),
                                                        JSON.stringify(worldResourcePacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_resource_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while deactivating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while deactivating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Deactivate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        <MenuItem disabled>Copy Cell Value</MenuItem>
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                    >
                                        <td style={{ color: "red" }}>{String(e)}</td>
                                    </tr>
                                </>
                            );
                        }
                    }
                    return <Row />;
                }) ?? []
            );
        }
        case "active_behaviorPacks": {
            const columns = config.views.packs.modeSettings.active.sections.behaviorPacks.columns;
            return await Promise.all(
                data.entries?.map(async (pack: PackEntry): Promise<JSX.Element> => {
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                    //     pack.historyEntry ??
                    //     (!pack.pack_id ? null : (
                    //         (data.worldBehaviorPackHistory?.packs.find(
                    //             (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                    //                 entry.uuid === pack.pack_id &&
                    //                 !!entry.version &&
                    //                 semver.satisfies(
                    //                     typeof pack.version === "string" ? pack.version : pack.version!.join("."),
                    //                     typeof entry.version === "string" ? entry.version : entry.version.join("."),
                    //                     { includePrerelease: false }
                    //                 )
                    //         ) ?? null)
                    //     ));
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // let foundPack: FoundPackDetails | null = pack.packDetails ?? null;
                    // findPack: try {
                    //     if (pack.packDetails !== undefined) break findPack;
                    //     if (!pack.pack_id) break findPack;
                    //     if (!pack.version) break findPack;
                    //     worldBehaviorPacks: {
                    //         const behaviorPacksFolder: string = path.join(data.tab.path, "behavior_packs");
                    //         if (!existsSync(path.join(data.tab.path, "behavior_packs"))) break worldBehaviorPacks;
                    //         for (const packFolder of await readdir(behaviorPacksFolder)) {
                    //             try {
                    //                 const manifestPath: string = path.join(behaviorPacksFolder, packFolder, "manifest.json");
                    //                 if (!existsSync(manifestPath)) continue;
                    //                 const manifest: ManifestJSONSchema = json5.parse(await readFile(manifestPath, "utf-8"));
                    //                 if (manifest.header.uuid !== pack.pack_id) continue;
                    //                 if (
                    //                     !semver.satisfies(
                    //                         typeof manifest.header.version === "string" ? manifest.header.version : manifest.header.version.join("."),
                    //                         typeof pack.version === "string" ? pack.version : pack.version.join("."),
                    //                         { includePrerelease: false }
                    //                     )
                    //                 ) {
                    //                     continue;
                    //                 }
                    //                 pack.packDetails = { storageLocation: "world", folderPath: path.join(behaviorPacksFolder, packFolder), manifest };
                    //                 break findPack;
                    //             } catch {}
                    //         }
                    //     }
                    // } catch (e) {
                    //     console.error("Error while searching for pack manifest.json:", e);
                    // }

                    let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                    function Row(): JSX.Element {
                        // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                        const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                        const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                        function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            event.preventDefault();
                            event.stopPropagation();
                            const clickPosition: { x: number; y: number } = {
                                x: event.clientX,
                                y: event.clientY,
                            };
                            // console.log(clickPosition);

                            copyContextMenuItemValue = null;
                            valueCopyContextItemConfiguration: if (rowRef.current && event.target !== null && event.target instanceof Element) {
                                const containerCell: HTMLTableCellElement | null = event.target.closest("td");
                                if (containerCell?.parentElement !== rowRef.current) break valueCopyContextItemConfiguration;
                                if (containerCell.dataset.copyData === undefined) break valueCopyContextItemConfiguration;
                                copyContextMenuItemValue = JSON.parse(containerCell.dataset.copyData) as CopyContextMenuItemValue;
                            }

                            entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                            entryContextMenu_setOpen(true);
                        }
                        function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            return;
                        }
                        const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
                        try {
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                try {
                                                    const worldBehaviorPacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldBehaviorPacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex === -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldBehaviorPacksJSON.splice(packIndex, 1);
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"),
                                                        JSON.stringify(worldBehaviorPacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_behavior_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while deactivating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while deactivating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Deactivate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                            <MenuItem
                                                onClick={async (_event: ContextMenu_ClickEvent): Promise<void> => {
                                                    // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                                    // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                                    // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                                    if (!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined) return;
                                                    clipboard.writeText(copyContextMenuItemValue.value);
                                                    // copyContextMenuItemValue = null;
                                                }}
                                                disabled={!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined}
                                            >
                                                Copy Cell Value
                                            </MenuItem>
                                        :   null}
                                        {!!copyContextMenuItemValue?.formatOptions && (
                                            <SubMenu label="Copy Cell Value as...">
                                                {...copyContextMenuItemValue.formatOptions.map(
                                                    (formatOption: NonNullable<CopyContextMenuItemValue["formatOptions"]>[number]): JSX.Element => (
                                                        <MenuItem
                                                            onClick={(_event: ContextMenu_ClickEvent): void => {
                                                                clipboard.writeText(formatOption.value);
                                                                copyContextMenuItemValue = null;
                                                            }}
                                                        >
                                                            {formatOption.label}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </SubMenu>
                                        )}
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onContextMenu={onEntryRightClick}
                                        ref={rowRef}
                                    >
                                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                            switch (column) {
                                                case "UUID": {
                                                    if (pack.pack_id === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = pack.pack_id;
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Version": {
                                                    if (pack.version === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = typeof pack.version === "string" ? pack.version : pack.version.join(".");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Dependencies": {
                                                    if (pack.packDetails === null) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    if (pack.packDetails.manifest.dependencies === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const formattedDependenciesList: string = pack.packDetails.manifest.dependencies
                                                        .map((dependency) => {
                                                            if ("uuid" in dependency && dependency.uuid !== undefined) {
                                                                return `${dependency.uuid}@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                            }
                                                            if ("module_name" in dependency && dependency.module_name !== undefined) {
                                                                return `${dependency.module_name}@${typeof dependency.version === "string" ? dependency.version : (dependency.version as number[] | undefined)?.join(".")}`;
                                                            }
                                                            return `?@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                        })
                                                        .join("\n");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "JSON", value: JSON.stringify(pack.packDetails.manifest.dependencies) },
                                                                    { label: "Formatted", value: formattedDependenciesList },
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            <span
                                                                title={formattedDependenciesList}
                                                                style="color: color-mix(in lab, var(--text-color) 50%, var(--table-bg-color)); cursor: help;"
                                                            >
                                                                {pack.packDetails.manifest.dependencies.length} dependencies
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                case "StorageLocation": {
                                                    if (pack.packDetails === null) {
                                                        if (pack.historyEntry) {
                                                            if (pack.historyEntry?.can_be_redownloaded) {
                                                                return (
                                                                    <td
                                                                        data-copy-data={JSON.stringify({
                                                                            formatOptions: [
                                                                                { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                            ],
                                                                        } satisfies CopyContextMenuItemValue)}
                                                                    >
                                                                        marketplace
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td
                                                                    data-copy-data={JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)}
                                                                >
                                                                    <span style="color: yellow;">history only</span>
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            title={pack.packDetails.folderPath}
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "Storage Location Type", value: pack.packDetails.storageLocation },
                                                                    { label: "Folder Path", value: pack.packDetails.folderPath },
                                                                    ...(pack.historyEntry ?
                                                                        [{ label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) }]
                                                                    :   []),
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {pack.packDetails.storageLocation}
                                                            {pack.historyEntry ?
                                                                pack.historyEntry?.can_be_redownloaded ?
                                                                    " & marketplace"
                                                                :   " & history"
                                                            :   " only"}
                                                        </td>
                                                    );
                                                }
                                                case "Name": {
                                                    if (
                                                        pack.historyEntry === null &&
                                                        pack.packDetails === null &&
                                                        pack.packName === undefined &&
                                                        pack.packNameLocales === undefined
                                                    ) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValueRaw: string | { [locale in LooseAutocomplete<"en_US">]?: string } | undefined =
                                                        pack.packNameLocales ?? pack.packName;
                                                    if (cellValueRaw === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string | undefined =
                                                        typeof cellValueRaw === "string" ? cellValueRaw : (
                                                            (cellValueRaw[config.locale] ??
                                                            cellValueRaw[findBestLocale(Object.keys(cellValueRaw)) ?? undefined!] ??
                                                            Object.values(cellValueRaw)[0] ??
                                                            pack.packName)
                                                        );
                                                    if (cellValue === undefined) {
                                                        return (
                                                            <td>
                                                                <span title="No localized name found for pack name that uses localization." style="color: red;">
                                                                    null
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            data-copy-data={
                                                                typeof cellValueRaw === "string" ?
                                                                    JSON.stringify({
                                                                        value: cellValue,
                                                                    } satisfies CopyContextMenuItemValue)
                                                                :   JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "Localized", value: cellValue },
                                                                            { label: "Raw", value: JSON.stringify(cellValueRaw) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)
                                                            }
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Icon": {
                                                    function PackIconElement(): JSX.Element {
                                                        const [packIconContextMenu_isOpen, packIconContextMenu_setOpen] = useState(false);
                                                        const [packIconContextMenu_anchorPoint, packIconContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                                        function onPackIconRightClick(event: JSX.TargetedMouseEvent<HTMLImageElement>): void {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            const clickPosition: { x: number; y: number } = {
                                                                x: event.clientX,
                                                                y: event.clientY,
                                                            };
                                                            // console.log(clickPosition);

                                                            packIconContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                            packIconContextMenu_setOpen(true);
                                                        }
                                                        return (
                                                            <td style={{ width: "128px" }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        height: "-webkit-fill-available",
                                                                        justifyContent: "center",
                                                                        flexDirection: "column",
                                                                    }}
                                                                >
                                                                    {pack.packDetails ?
                                                                        pack.pack_icon ?
                                                                            <>
                                                                                <ControlledMenu
                                                                                    anchorPoint={packIconContextMenu_anchorPoint}
                                                                                    state={packIconContextMenu_isOpen ? "open" : "closed"}
                                                                                    direction="right"
                                                                                    onClose={(): void => void packIconContextMenu_setOpen(false)}
                                                                                >
                                                                                    <MenuItem
                                                                                        onClick={async (): Promise<void> => {
                                                                                            if (!pack.packDetails) return;
                                                                                            const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                                                                                                buttonLabel: "Save",
                                                                                                defaultPath: path.join(
                                                                                                    app.getPath("downloads"),
                                                                                                    `pack_icon_${pack.pack_id}_${typeof pack.version === "string" ? pack.version : pack.version?.join(".")}.png`
                                                                                                ),
                                                                                                properties: [
                                                                                                    "showHiddenFiles",
                                                                                                    "showOverwriteConfirmation",
                                                                                                    "treatPackageAsDirectory",
                                                                                                ],
                                                                                                title: "Save Pack Icon",
                                                                                                message: "Select a location to save the pack icon.",
                                                                                                filters: [{ name: "PNG", extensions: ["png"] }],
                                                                                            });
                                                                                            if (result.canceled) return;
                                                                                            const mimeType: string | false = mime.lookup(result.filePath);
                                                                                            if (!mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType || path.extname(result.filePath)}`
                                                                                                );
                                                                                            const image: Buffer | null = await readFile(pack.pack_icon!);
                                                                                            if (!image)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Failed to Save Image",
                                                                                                    "An error occurred while saving the image."
                                                                                                );
                                                                                            if ("image/png" !== mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType}`
                                                                                                );
                                                                                            await writeFile(result.filePath, image);
                                                                                        }}
                                                                                    >
                                                                                        Save Image
                                                                                    </MenuItem>
                                                                                </ControlledMenu>
                                                                                <div
                                                                                    style={{
                                                                                        maxHeight: "round(down, 100%, 128px)",
                                                                                        display: "flex",
                                                                                        justifyContent: "center",
                                                                                        aspectRatio: "1 / 1",
                                                                                    }}
                                                                                >
                                                                                    <img
                                                                                        width={128}
                                                                                        height={128}
                                                                                        src={pack.pack_icon}
                                                                                        class="packs-tab-pack-icon-image piximg"
                                                                                        style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                        onContextMenu={(event: TargetedMouseEvent<HTMLImageElement>): void =>
                                                                                            void onPackIconRightClick(event)
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        :   <div
                                                                                style={{
                                                                                    maxHeight: "round(down, 100%, 128px)",
                                                                                    display: "flex",
                                                                                    justifyContent: "center",
                                                                                    aspectRatio: "1 / 1",
                                                                                }}
                                                                            >
                                                                                <img
                                                                                    width={128}
                                                                                    height={128}
                                                                                    src="resource://images/ui/misc/missing_texture.png"
                                                                                    class="packs-tab-pack-icon-image piximg"
                                                                                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                />
                                                                            </div>

                                                                    :   <div
                                                                            style={{
                                                                                maxHeight: "round(down, 100%, 128px)",
                                                                                display: "flex",
                                                                                justifyContent: "center",
                                                                                aspectRatio: "1 / 1",
                                                                            }}
                                                                        >
                                                                            <img
                                                                                width={128}
                                                                                height={128}
                                                                                src="resource://images/ui/misc/missing_pack_icon.png"
                                                                                class="packs-tab-pack-icon-image piximg"
                                                                                style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                            />
                                                                        </div>
                                                                    }
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <PackIconElement />;
                                                }
                                            }
                                        })}
                                    </tr>
                                </>
                            );
                        } catch (e) {
                            console.error(e);
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                try {
                                                    const worldBehaviorPacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldBehaviorPacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex === -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldBehaviorPacksJSON.splice(packIndex, 1);
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"),
                                                        JSON.stringify(worldBehaviorPacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_behavior_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while deactivating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while deactivating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Deactivate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        <MenuItem disabled>Copy Cell Value</MenuItem>
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                    >
                                        <td style={{ color: "red" }}>{String(e)}</td>
                                    </tr>
                                </>
                            );
                        }
                    }
                    return <Row />;
                }) ?? []
            );
        }
        case "inactive_resourcePacks": {
            const columns = config.views.packs.modeSettings.inactive.sections.resourcePacks.columns;
            return await Promise.all(
                data.entries?.map(async (pack: PackEntry): Promise<JSX.Element> => {
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                    //     pack.historyEntry ??
                    //     (!pack.pack_id ? null : (
                    //         (data.worldResourcePackHistory?.packs.find(
                    //             (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                    //                 entry.uuid === pack.pack_id &&
                    //                 !!entry.version &&
                    //                 semver.satisfies(
                    //                     typeof pack.version === "string" ? pack.version : pack.version!.join("."),
                    //                     typeof entry.version === "string" ? entry.version : entry.version.join("."),
                    //                     { includePrerelease: false }
                    //                 )
                    //         ) ?? null)
                    //     ));
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // let foundPack: FoundPackDetails | null = pack.packDetails ?? null;
                    // findPack: try {
                    //     if (pack.packDetails !== undefined) break findPack;
                    //     if (!pack.pack_id) break findPack;
                    //     if (!pack.version) break findPack;
                    //     worldResourcePacks: {
                    //         const resourcePacksFolder: string = path.join(data.tab.path, "resource_packs");
                    //         if (!existsSync(path.join(data.tab.path, "resource_packs"))) break worldResourcePacks;
                    //         for (const packFolder of await readdir(resourcePacksFolder)) {
                    //             try {
                    //                 const manifestPath: string = path.join(resourcePacksFolder, packFolder, "manifest.json");
                    //                 if (!existsSync(manifestPath)) continue;
                    //                 const manifest: ManifestJSONSchema = json5.parse(await readFile(manifestPath, "utf-8"));
                    //                 if (manifest.header.uuid !== pack.pack_id) continue;
                    //                 if (
                    //                     !semver.satisfies(
                    //                         typeof manifest.header.version === "string" ? manifest.header.version : manifest.header.version.join("."),
                    //                         typeof pack.version === "string" ? pack.version : pack.version.join("."),
                    //                         { includePrerelease: false }
                    //                     )
                    //                 ) {
                    //                     continue;
                    //                 }
                    //                 pack.packDetails = { storageLocation: "world", folderPath: path.join(resourcePacksFolder, packFolder), manifest };
                    //                 break findPack;
                    //             } catch {}
                    //         }
                    //     }
                    // } catch (e) {
                    //     console.error("Error while searching for pack manifest.json:", e);
                    // }

                    let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                    function Row(): JSX.Element {
                        // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                        const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                        const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                        function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            event.preventDefault();
                            event.stopPropagation();
                            const clickPosition: { x: number; y: number } = {
                                x: event.clientX,
                                y: event.clientY,
                            };
                            // console.log(clickPosition);

                            copyContextMenuItemValue = null;
                            valueCopyContextItemConfiguration: if (rowRef.current && event.target !== null && event.target instanceof Element) {
                                const containerCell: HTMLTableCellElement | null = event.target.closest("td");
                                if (containerCell?.parentElement !== rowRef.current) break valueCopyContextItemConfiguration;
                                if (containerCell.dataset.copyData === undefined) break valueCopyContextItemConfiguration;
                                copyContextMenuItemValue = JSON.parse(containerCell.dataset.copyData) as CopyContextMenuItemValue;
                            }

                            entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                            entryContextMenu_setOpen(true);
                        }
                        function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            return;
                        }
                        const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
                        try {
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                if (!pack.pack_id) return;
                                                if (!pack.version) return;
                                                try {
                                                    const worldResourcePacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldResourcePacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex !== -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldResourcePacksJSON.push({
                                                        pack_id: pack.pack_id,
                                                        version: pack.version,
                                                    });
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"),
                                                        JSON.stringify(worldResourcePacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_resource_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while activating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while activating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Activate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                            <MenuItem
                                                onClick={async (_event: ContextMenu_ClickEvent): Promise<void> => {
                                                    // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                                    // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                                    // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                                    if (!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined) return;
                                                    clipboard.writeText(copyContextMenuItemValue.value);
                                                    // copyContextMenuItemValue = null;
                                                }}
                                                disabled={!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined}
                                            >
                                                Copy Cell Value
                                            </MenuItem>
                                        :   null}
                                        {!!copyContextMenuItemValue?.formatOptions && (
                                            <SubMenu label="Copy Cell Value as...">
                                                {...copyContextMenuItemValue.formatOptions.map(
                                                    (formatOption: NonNullable<CopyContextMenuItemValue["formatOptions"]>[number]): JSX.Element => (
                                                        <MenuItem
                                                            onClick={(_event: ContextMenu_ClickEvent): void => {
                                                                clipboard.writeText(formatOption.value);
                                                                copyContextMenuItemValue = null;
                                                            }}
                                                        >
                                                            {formatOption.label}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </SubMenu>
                                        )}
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onContextMenu={onEntryRightClick}
                                        ref={rowRef}
                                    >
                                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                            switch (column) {
                                                case "UUID": {
                                                    if (pack.pack_id === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = pack.pack_id;
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Version": {
                                                    if (pack.version === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = typeof pack.version === "string" ? pack.version : pack.version.join(".");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Dependencies": {
                                                    if (pack.packDetails === null) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    if (pack.packDetails.manifest.dependencies === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const formattedDependenciesList: string = pack.packDetails.manifest.dependencies
                                                        .map((dependency) => {
                                                            if ("uuid" in dependency && dependency.uuid !== undefined) {
                                                                return `${dependency.uuid}@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                            }
                                                            if ("module_name" in dependency && dependency.module_name !== undefined) {
                                                                return `${dependency.module_name}@${typeof dependency.version === "string" ? dependency.version : (dependency.version as number[] | undefined)?.join(".")}`;
                                                            }
                                                            return `?@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                        })
                                                        .join("\n");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "JSON", value: JSON.stringify(pack.packDetails.manifest.dependencies) },
                                                                    { label: "Formatted", value: formattedDependenciesList },
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            <span
                                                                title={formattedDependenciesList}
                                                                style="color: color-mix(in lab, var(--text-color) 50%, var(--table-bg-color)); cursor: help;"
                                                            >
                                                                {pack.packDetails.manifest.dependencies.length} dependencies
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                case "StorageLocation": {
                                                    if (pack.packDetails === null && pack.locations?.folder === undefined) {
                                                        if (pack.historyEntry) {
                                                            if (pack.historyEntry?.can_be_redownloaded) {
                                                                return (
                                                                    <td
                                                                        data-copy-data={JSON.stringify({
                                                                            formatOptions: [
                                                                                { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                            ],
                                                                        } satisfies CopyContextMenuItemValue)}
                                                                    >
                                                                        marketplace
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td
                                                                    data-copy-data={JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)}
                                                                >
                                                                    <span style="color: yellow;">history only</span>
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            title={pack.packDetails?.folderPath}
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    {
                                                                        label: "Storage Location Type",
                                                                        value: pack.packDetails?.storageLocation ?? pack.locations?.folder!,
                                                                    },
                                                                    ...(pack.packDetails !== null ?
                                                                        [{ label: "Folder Path", value: pack.packDetails.folderPath }]
                                                                    :   []),
                                                                    ...(pack.historyEntry ?
                                                                        [{ label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) }]
                                                                    :   []),
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {pack.packDetails?.storageLocation ?? pack.locations?.folder!}
                                                            {pack.historyEntry ?
                                                                pack.historyEntry?.can_be_redownloaded ?
                                                                    " & marketplace"
                                                                :   " & history"
                                                            :   " only"}
                                                        </td>
                                                    );
                                                }
                                                case "Name": {
                                                    if (
                                                        pack.historyEntry === null &&
                                                        pack.packDetails === null &&
                                                        pack.packName === undefined &&
                                                        pack.packNameLocales === undefined
                                                    ) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValueRaw: string | { [locale in LooseAutocomplete<"en_US">]?: string } | undefined =
                                                        pack.packNameLocales ?? pack.packName;
                                                    if (cellValueRaw === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string | undefined =
                                                        typeof cellValueRaw === "string" ? cellValueRaw : (
                                                            (cellValueRaw[config.locale] ??
                                                            cellValueRaw[findBestLocale(Object.keys(cellValueRaw)) ?? undefined!] ??
                                                            Object.values(cellValueRaw)[0] ??
                                                            pack.packName)
                                                        );
                                                    if (cellValue === undefined) {
                                                        return (
                                                            <td>
                                                                <span title="No localized name found for pack name that uses localization." style="color: red;">
                                                                    null
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            data-copy-data={
                                                                typeof cellValueRaw === "string" ?
                                                                    JSON.stringify({
                                                                        value: cellValue,
                                                                    } satisfies CopyContextMenuItemValue)
                                                                :   JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "Localized", value: cellValue },
                                                                            { label: "Raw", value: JSON.stringify(cellValueRaw) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)
                                                            }
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Icon": {
                                                    function PackIconElement(): JSX.Element {
                                                        const [packIconContextMenu_isOpen, packIconContextMenu_setOpen] = useState(false);
                                                        const [packIconContextMenu_anchorPoint, packIconContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                                        function onPackIconRightClick(event: JSX.TargetedMouseEvent<HTMLImageElement>): void {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            const clickPosition: { x: number; y: number } = {
                                                                x: event.clientX,
                                                                y: event.clientY,
                                                            };
                                                            // console.log(clickPosition);

                                                            packIconContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                            packIconContextMenu_setOpen(true);
                                                        }
                                                        return (
                                                            <td style={{ width: "128px" }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        height: "-webkit-fill-available",
                                                                        justifyContent: "center",
                                                                        flexDirection: "column",
                                                                    }}
                                                                >
                                                                    {pack.packDetails ?
                                                                        pack.pack_icon ?
                                                                            <>
                                                                                <ControlledMenu
                                                                                    anchorPoint={packIconContextMenu_anchorPoint}
                                                                                    state={packIconContextMenu_isOpen ? "open" : "closed"}
                                                                                    direction="right"
                                                                                    onClose={(): void => void packIconContextMenu_setOpen(false)}
                                                                                >
                                                                                    <MenuItem
                                                                                        onClick={async (): Promise<void> => {
                                                                                            if (!pack.packDetails) return;
                                                                                            const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                                                                                                buttonLabel: "Save",
                                                                                                defaultPath: path.join(
                                                                                                    app.getPath("downloads"),
                                                                                                    `pack_icon_${pack.pack_id}_${typeof pack.version === "string" ? pack.version : pack.version?.join(".")}.png`
                                                                                                ),
                                                                                                properties: [
                                                                                                    "showHiddenFiles",
                                                                                                    "showOverwriteConfirmation",
                                                                                                    "treatPackageAsDirectory",
                                                                                                ],
                                                                                                title: "Save Pack Icon",
                                                                                                message: "Select a location to save the pack icon.",
                                                                                                filters: [{ name: "PNG", extensions: ["png"] }],
                                                                                            });
                                                                                            if (result.canceled) return;
                                                                                            const mimeType: string | false = mime.lookup(result.filePath);
                                                                                            if (!mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType || path.extname(result.filePath)}`
                                                                                                );
                                                                                            const image: Buffer | null = await readFile(pack.pack_icon!);
                                                                                            if (!image)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Failed to Save Image",
                                                                                                    "An error occurred while saving the image."
                                                                                                );
                                                                                            if ("image/png" !== mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType}`
                                                                                                );
                                                                                            await writeFile(result.filePath, image);
                                                                                        }}
                                                                                    >
                                                                                        Save Image
                                                                                    </MenuItem>
                                                                                </ControlledMenu>
                                                                                <div
                                                                                    style={{
                                                                                        maxHeight: "round(down, 100%, 128px)",
                                                                                        display: "flex",
                                                                                        justifyContent: "center",
                                                                                        aspectRatio: "1 / 1",
                                                                                    }}
                                                                                >
                                                                                    <img
                                                                                        width={128}
                                                                                        height={128}
                                                                                        src={pack.pack_icon}
                                                                                        class="packs-tab-pack-icon-image piximg"
                                                                                        style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                        onContextMenu={(event: TargetedMouseEvent<HTMLImageElement>): void =>
                                                                                            void onPackIconRightClick(event)
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        :   <div
                                                                                style={{
                                                                                    maxHeight: "round(down, 100%, 128px)",
                                                                                    display: "flex",
                                                                                    justifyContent: "center",
                                                                                    aspectRatio: "1 / 1",
                                                                                }}
                                                                            >
                                                                                <img
                                                                                    width={128}
                                                                                    height={128}
                                                                                    src="resource://images/ui/misc/missing_texture.png"
                                                                                    class="packs-tab-pack-icon-image piximg"
                                                                                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                />
                                                                            </div>

                                                                    :   <div
                                                                            style={{
                                                                                maxHeight: "round(down, 100%, 128px)",
                                                                                display: "flex",
                                                                                justifyContent: "center",
                                                                                aspectRatio: "1 / 1",
                                                                            }}
                                                                        >
                                                                            <img
                                                                                width={128}
                                                                                height={128}
                                                                                src="resource://images/ui/misc/missing_pack_icon.png"
                                                                                class="packs-tab-pack-icon-image piximg"
                                                                                style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                            />
                                                                        </div>
                                                                    }
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <PackIconElement />;
                                                }
                                            }
                                        })}
                                    </tr>
                                </>
                            );
                        } catch (e) {
                            console.error(e);
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                if (!pack.pack_id) return;
                                                if (!pack.version) return;
                                                try {
                                                    const worldResourcePacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldResourcePacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex !== -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldResourcePacksJSON.push({
                                                        pack_id: pack.pack_id,
                                                        version: pack.version,
                                                    });
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_resource_packs.json"),
                                                        JSON.stringify(worldResourcePacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_resource_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while activating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while activating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Activate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldResourcePackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldResourcePackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldResourcePackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_resource_pack_history.json"),
                                                            JSON.stringify(worldResourcePackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_resource_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        <MenuItem disabled>Copy Cell Value</MenuItem>
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                    >
                                        <td style={{ color: "red" }}>{String(e)}</td>
                                    </tr>
                                </>
                            );
                        }
                    }
                    return <Row />;
                }) ?? []
            );
        }
        case "inactive_behaviorPacks": {
            const columns = config.views.packs.modeSettings.inactive.sections.behaviorPacks.columns;
            return await Promise.all(
                data.entries?.map(async (pack: PackEntry): Promise<JSX.Element> => {
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // const historyEntry: WorldXPackHistoryJSONSchema["packs"][number] | null =
                    //     pack.historyEntry ??
                    //     (!pack.pack_id ? null : (
                    //         (data.worldBehaviorPackHistory?.packs.find(
                    //             (entry: WorldXPackHistoryJSONSchema["packs"][number]): boolean =>
                    //                 entry.uuid === pack.pack_id &&
                    //                 !!entry.version &&
                    //                 semver.satisfies(
                    //                     typeof pack.version === "string" ? pack.version : pack.version!.join("."),
                    //                     typeof entry.version === "string" ? entry.version : entry.version.join("."),
                    //                     { includePrerelease: false }
                    //                 )
                    //         ) ?? null)
                    //     ));
                    // REMOVE: This should be removed once the logic to get it outside of this function is fully tested. Once this is removed, the "Loading..." messages in the table cells should be reimplemented.
                    // let foundPack: FoundPackDetails | null = pack.packDetails ?? null;
                    // findPack: try {
                    //     if (pack.packDetails !== undefined) break findPack;
                    //     if (!pack.pack_id) break findPack;
                    //     if (!pack.version) break findPack;
                    //     worldBehaviorPacks: {
                    //         const behaviorPacksFolder: string = path.join(data.tab.path, "behavior_packs");
                    //         if (!existsSync(path.join(data.tab.path, "behavior_packs"))) break worldBehaviorPacks;
                    //         for (const packFolder of await readdir(behaviorPacksFolder)) {
                    //             try {
                    //                 const manifestPath: string = path.join(behaviorPacksFolder, packFolder, "manifest.json");
                    //                 if (!existsSync(manifestPath)) continue;
                    //                 const manifest: ManifestJSONSchema = json5.parse(await readFile(manifestPath, "utf-8"));
                    //                 if (manifest.header.uuid !== pack.pack_id) continue;
                    //                 if (
                    //                     !semver.satisfies(
                    //                         typeof manifest.header.version === "string" ? manifest.header.version : manifest.header.version.join("."),
                    //                         typeof pack.version === "string" ? pack.version : pack.version.join("."),
                    //                         { includePrerelease: false }
                    //                     )
                    //                 ) {
                    //                     continue;
                    //                 }
                    //                 pack.packDetails = { storageLocation: "world", folderPath: path.join(behaviorPacksFolder, packFolder), manifest };
                    //                 break findPack;
                    //             } catch {}
                    //         }
                    //     }
                    // } catch (e) {
                    //     console.error("Error while searching for pack manifest.json:", e);
                    // }

                    let copyContextMenuItemValue: CopyContextMenuItemValue | null = null as CopyContextMenuItemValue | null;
                    function Row(): JSX.Element {
                        // IDEA: Add a confirmation dialog here before deleting the entry, and make it able to be disabled in the config. This should be done for all other tabs as well.
                        const [entryContextMenu_isOpen, entryContextMenu_setOpen] = useState(false);
                        const [entryContextMenu_anchorPoint, entryContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                        function onEntryRightClick(event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            event.preventDefault();
                            event.stopPropagation();
                            const clickPosition: { x: number; y: number } = {
                                x: event.clientX,
                                y: event.clientY,
                            };
                            // console.log(clickPosition);

                            copyContextMenuItemValue = null;
                            valueCopyContextItemConfiguration: if (rowRef.current && event.target !== null && event.target instanceof Element) {
                                const containerCell: HTMLTableCellElement | null = event.target.closest("td");
                                if (containerCell?.parentElement !== rowRef.current) break valueCopyContextItemConfiguration;
                                if (containerCell.dataset.copyData === undefined) break valueCopyContextItemConfiguration;
                                copyContextMenuItemValue = JSON.parse(containerCell.dataset.copyData) as CopyContextMenuItemValue;
                            }

                            entryContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                            entryContextMenu_setOpen(true);
                        }
                        function onEntryMiddleClick(_event: TargetedMouseEvent<HTMLTableRowElement>): void {
                            return;
                        }
                        const rowRef: RefObject<HTMLTableRowElement> = useRef<HTMLTableRowElement>(null);
                        try {
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                if (!pack.pack_id) return;
                                                if (!pack.version) return;
                                                try {
                                                    const worldBehaviorPacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldBehaviorPacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex !== -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldBehaviorPacksJSON.push({
                                                        pack_id: pack.pack_id,
                                                        version: pack.version,
                                                    });
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"),
                                                        JSON.stringify(worldBehaviorPacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_behavior_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while activating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while activating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Activate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        {!copyContextMenuItemValue || copyContextMenuItemValue.value !== undefined || !copyContextMenuItemValue.formatOptions ?
                                            <MenuItem
                                                onClick={async (_event: ContextMenu_ClickEvent): Promise<void> => {
                                                    // if (!(event.syntheticEvent.currentTarget instanceof HTMLLIElement)) return;
                                                    // event.syntheticEvent.currentTarget.ariaDisabled = "true";
                                                    // event.syntheticEvent.currentTarget.classList.add("szh-menu__item--disabled");
                                                    if (!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined) return;
                                                    clipboard.writeText(copyContextMenuItemValue.value);
                                                    // copyContextMenuItemValue = null;
                                                }}
                                                disabled={!copyContextMenuItemValue || copyContextMenuItemValue.value === undefined}
                                            >
                                                Copy Cell Value
                                            </MenuItem>
                                        :   null}
                                        {!!copyContextMenuItemValue?.formatOptions && (
                                            <SubMenu label="Copy Cell Value as...">
                                                {...copyContextMenuItemValue.formatOptions.map(
                                                    (formatOption: NonNullable<CopyContextMenuItemValue["formatOptions"]>[number]): JSX.Element => (
                                                        <MenuItem
                                                            onClick={(_event: ContextMenu_ClickEvent): void => {
                                                                clipboard.writeText(formatOption.value);
                                                                copyContextMenuItemValue = null;
                                                            }}
                                                        >
                                                            {formatOption.label}
                                                        </MenuItem>
                                                    )
                                                )}
                                            </SubMenu>
                                        )}
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onContextMenu={onEntryRightClick}
                                        ref={rowRef}
                                    >
                                        {columns.map((column: (typeof columns)[number]): JSX.Element => {
                                            switch (column) {
                                                case "UUID": {
                                                    if (pack.pack_id === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = pack.pack_id;
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Version": {
                                                    if (pack.version === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string = typeof pack.version === "string" ? pack.version : pack.version.join(".");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                value: cellValue,
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Dependencies": {
                                                    if (pack.packDetails === null) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    if (pack.packDetails.manifest.dependencies === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const formattedDependenciesList: string = pack.packDetails.manifest.dependencies
                                                        .map((dependency) => {
                                                            if ("uuid" in dependency && dependency.uuid !== undefined) {
                                                                return `${dependency.uuid}@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                            }
                                                            if ("module_name" in dependency && dependency.module_name !== undefined) {
                                                                return `${dependency.module_name}@${typeof dependency.version === "string" ? dependency.version : (dependency.version as number[] | undefined)?.join(".")}`;
                                                            }
                                                            return `?@${typeof dependency.version === "string" ? dependency.version : dependency.version?.join(".")}`;
                                                        })
                                                        .join("\n");
                                                    return (
                                                        <td
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    { label: "JSON", value: JSON.stringify(pack.packDetails.manifest.dependencies) },
                                                                    { label: "Formatted", value: formattedDependenciesList },
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            <span
                                                                title={formattedDependenciesList}
                                                                style="color: color-mix(in lab, var(--text-color) 50%, var(--table-bg-color)); cursor: help;"
                                                            >
                                                                {pack.packDetails.manifest.dependencies.length} dependencies
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                case "StorageLocation": {
                                                    if (pack.packDetails === null && pack.locations?.folder === undefined) {
                                                        if (pack.historyEntry) {
                                                            if (pack.historyEntry?.can_be_redownloaded) {
                                                                return (
                                                                    <td
                                                                        data-copy-data={JSON.stringify({
                                                                            formatOptions: [
                                                                                { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                            ],
                                                                        } satisfies CopyContextMenuItemValue)}
                                                                    >
                                                                        marketplace
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td
                                                                    data-copy-data={JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)}
                                                                >
                                                                    <span style="color: yellow;">history only</span>
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            title={pack.packDetails?.folderPath}
                                                            data-copy-data={JSON.stringify({
                                                                formatOptions: [
                                                                    {
                                                                        label: "Storage Location Type",
                                                                        value: pack.packDetails?.storageLocation ?? pack.locations?.folder!,
                                                                    },
                                                                    ...(pack.packDetails !== null ?
                                                                        [{ label: "Folder Path", value: pack.packDetails.folderPath }]
                                                                    :   []),
                                                                    ...(pack.historyEntry ?
                                                                        [{ label: "History Entry JSON", value: JSON.stringify(pack.historyEntry) }]
                                                                    :   []),
                                                                ],
                                                            } satisfies CopyContextMenuItemValue)}
                                                        >
                                                            {pack.packDetails?.storageLocation ?? pack.locations?.folder!}
                                                            {pack.historyEntry ?
                                                                pack.historyEntry?.can_be_redownloaded ?
                                                                    " & marketplace"
                                                                :   " & history"
                                                            :   " only"}
                                                        </td>
                                                    );
                                                }
                                                case "Name": {
                                                    if (
                                                        pack.historyEntry === null &&
                                                        pack.packDetails === null &&
                                                        pack.packName === undefined &&
                                                        pack.packNameLocales === undefined
                                                    ) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">N/A</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValueRaw: string | { [locale in LooseAutocomplete<"en_US">]?: string } | undefined =
                                                        pack.packNameLocales ?? pack.packName;
                                                    if (cellValueRaw === undefined) {
                                                        return (
                                                            <td>
                                                                <span style="color: red;">null</span>
                                                            </td>
                                                        );
                                                    }
                                                    const cellValue: string | undefined =
                                                        typeof cellValueRaw === "string" ? cellValueRaw : (
                                                            (cellValueRaw[config.locale] ??
                                                            cellValueRaw[findBestLocale(Object.keys(cellValueRaw)) ?? undefined!] ??
                                                            Object.values(cellValueRaw)[0] ??
                                                            pack.packName)
                                                        );
                                                    if (cellValue === undefined) {
                                                        return (
                                                            <td>
                                                                <span title="No localized name found for pack name that uses localization." style="color: red;">
                                                                    null
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td
                                                            data-copy-data={
                                                                typeof cellValueRaw === "string" ?
                                                                    JSON.stringify({
                                                                        value: cellValue,
                                                                    } satisfies CopyContextMenuItemValue)
                                                                :   JSON.stringify({
                                                                        formatOptions: [
                                                                            { label: "Localized", value: cellValue },
                                                                            { label: "Raw", value: JSON.stringify(cellValueRaw) },
                                                                        ],
                                                                    } satisfies CopyContextMenuItemValue)
                                                            }
                                                        >
                                                            {cellValue}
                                                        </td>
                                                    );
                                                }
                                                case "Icon": {
                                                    function PackIconElement(): JSX.Element {
                                                        const [packIconContextMenu_isOpen, packIconContextMenu_setOpen] = useState(false);
                                                        const [packIconContextMenu_anchorPoint, packIconContextMenu_setAnchorPoint] = useState({ x: 0, y: 0 });
                                                        function onPackIconRightClick(event: JSX.TargetedMouseEvent<HTMLImageElement>): void {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            const clickPosition: { x: number; y: number } = {
                                                                x: event.clientX,
                                                                y: event.clientY,
                                                            };
                                                            // console.log(clickPosition);

                                                            packIconContextMenu_setAnchorPoint({ x: event.clientX, y: event.clientY });
                                                            packIconContextMenu_setOpen(true);
                                                        }
                                                        return (
                                                            <td style={{ width: "128px" }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        height: "-webkit-fill-available",
                                                                        justifyContent: "center",
                                                                        flexDirection: "column",
                                                                    }}
                                                                >
                                                                    {pack.packDetails ?
                                                                        pack.pack_icon ?
                                                                            <>
                                                                                <ControlledMenu
                                                                                    anchorPoint={packIconContextMenu_anchorPoint}
                                                                                    state={packIconContextMenu_isOpen ? "open" : "closed"}
                                                                                    direction="right"
                                                                                    onClose={(): void => void packIconContextMenu_setOpen(false)}
                                                                                >
                                                                                    <MenuItem
                                                                                        onClick={async (): Promise<void> => {
                                                                                            if (!pack.packDetails) return;
                                                                                            const result: SaveDialogReturnValue = await dialog.showSaveDialog({
                                                                                                buttonLabel: "Save",
                                                                                                defaultPath: path.join(
                                                                                                    app.getPath("downloads"),
                                                                                                    `pack_icon_${pack.pack_id}_${typeof pack.version === "string" ? pack.version : pack.version?.join(".")}.png`
                                                                                                ),
                                                                                                properties: [
                                                                                                    "showHiddenFiles",
                                                                                                    "showOverwriteConfirmation",
                                                                                                    "treatPackageAsDirectory",
                                                                                                ],
                                                                                                title: "Save Pack Icon",
                                                                                                message: "Select a location to save the pack icon.",
                                                                                                filters: [{ name: "PNG", extensions: ["png"] }],
                                                                                            });
                                                                                            if (result.canceled) return;
                                                                                            const mimeType: string | false = mime.lookup(result.filePath);
                                                                                            if (!mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType || path.extname(result.filePath)}`
                                                                                                );
                                                                                            const image: Buffer | null = await readFile(pack.pack_icon!);
                                                                                            if (!image)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Failed to Save Image",
                                                                                                    "An error occurred while saving the image."
                                                                                                );
                                                                                            if ("image/png" !== mimeType)
                                                                                                return void dialog.showErrorBox(
                                                                                                    "Unsupported Image Type",
                                                                                                    `Unsupported image type: ${mimeType}`
                                                                                                );
                                                                                            await writeFile(result.filePath, image);
                                                                                        }}
                                                                                    >
                                                                                        Save Image
                                                                                    </MenuItem>
                                                                                </ControlledMenu>
                                                                                <div
                                                                                    style={{
                                                                                        maxHeight: "round(down, 100%, 128px)",
                                                                                        display: "flex",
                                                                                        justifyContent: "center",
                                                                                        aspectRatio: "1 / 1",
                                                                                    }}
                                                                                >
                                                                                    <img
                                                                                        width={128}
                                                                                        height={128}
                                                                                        src={pack.pack_icon}
                                                                                        class="packs-tab-pack-icon-image piximg"
                                                                                        style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                        onContextMenu={(event: TargetedMouseEvent<HTMLImageElement>): void =>
                                                                                            void onPackIconRightClick(event)
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </>
                                                                        :   <div
                                                                                style={{
                                                                                    maxHeight: "round(down, 100%, 128px)",
                                                                                    display: "flex",
                                                                                    justifyContent: "center",
                                                                                    aspectRatio: "1 / 1",
                                                                                }}
                                                                            >
                                                                                <img
                                                                                    width={128}
                                                                                    height={128}
                                                                                    src="resource://images/ui/misc/missing_texture.png"
                                                                                    class="packs-tab-pack-icon-image piximg"
                                                                                    style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                                />
                                                                            </div>

                                                                    :   <div
                                                                            style={{
                                                                                maxHeight: "round(down, 100%, 128px)",
                                                                                display: "flex",
                                                                                justifyContent: "center",
                                                                                aspectRatio: "1 / 1",
                                                                            }}
                                                                        >
                                                                            <img
                                                                                width={128}
                                                                                height={128}
                                                                                src="resource://images/ui/misc/missing_pack_icon.png"
                                                                                class="packs-tab-pack-icon-image piximg"
                                                                                style="max-width: round(down, 100%, 128px); max-height: round(down, 100%, 128px);"
                                                                            />
                                                                        </div>
                                                                    }
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <PackIconElement />;
                                                }
                                            }
                                        })}
                                    </tr>
                                </>
                            );
                        } catch (e) {
                            console.error(e);
                            return (
                                <>
                                    <ControlledMenu
                                        anchorPoint={entryContextMenu_anchorPoint}
                                        state={entryContextMenu_isOpen ? "open" : "closed"}
                                        direction="right"
                                        onClose={(): void => void entryContextMenu_setOpen(false)}
                                    >
                                        <MenuItem
                                            onClick={async (): Promise<void> => {
                                                if (!pack.pack_id) return;
                                                if (!pack.version) return;
                                                try {
                                                    const worldBehaviorPacksJSON: WorldXPacksJSONSchema = json5.parse(
                                                        await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"), "utf-8")
                                                    ) as WorldXPacksJSONSchema;
                                                    const packIndex: number = worldBehaviorPacksJSON.findIndex(
                                                        (entry) =>
                                                            entry.pack_id === pack.pack_id &&
                                                            !!entry.version &&
                                                            semver
                                                                .parse(typeof pack.version === "string" ? pack.version : pack.version!.join("."))
                                                                ?.compareMain(typeof entry.version === "string" ? entry.version : entry.version.join(".")) === 0
                                                    );
                                                    if (packIndex !== -1) {
                                                        data.updateTablesContents?.(true);
                                                        return;
                                                    }
                                                    worldBehaviorPacksJSON.push({
                                                        pack_id: pack.pack_id,
                                                        version: pack.version,
                                                    });
                                                    await writeFile(
                                                        path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_packs.json"),
                                                        JSON.stringify(worldBehaviorPacksJSON, null, 4),
                                                        "utf-8"
                                                    );
                                                    data.tab.setFileAsModified("world_behavior_packs.json");
                                                    data.updateTablesContents?.(true);
                                                } catch (e) {
                                                    console.error("Error while activating pack:", e, "pack:", pack);
                                                    dialog.showMessageBox({
                                                        type: "error",
                                                        title: "Error",
                                                        message: `An error occured while activating the pack. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                        detail: String(e),
                                                        buttons: ["OK"],
                                                        noLink: true,
                                                    });
                                                }
                                            }}
                                        >
                                            Activate Pack
                                        </MenuItem>
                                        {pack.historyEntry && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(
                                                                path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                                "utf-8"
                                                            )
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from history:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from history. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From History
                                            </MenuItem>
                                        )}
                                        {/* TODO */}
                                        {/* {pack.packDetails?.storageLocation === "world" && (
                                            <MenuItem
                                                onClick={async (): Promise<void> => {
                                                    try {
                                                        const worldBehaviorPackHistoryJSON: WorldXPackHistoryJSONSchema = json5.parse(
                                                            await readFile(path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"), "utf-8")
                                                        ) as WorldXPackHistoryJSONSchema;
                                                        const packIndex: number = worldBehaviorPackHistoryJSON.packs.findIndex((entry) =>
                                                            typeof pack.version === "string" ?
                                                                pack.version === entry.version
                                                            :   !!pack.version?.every((vv, i) => vv === entry.version?.[i])
                                                        );
                                                        if (packIndex === -1) {
                                                            data.updateTablesContents?.(true);
                                                            return;
                                                        }
                                                        worldBehaviorPackHistoryJSON.packs.splice(packIndex, 1);
                                                        await writeFile(
                                                            path.join(data.tab.tempPath ?? data.tab.path, "world_behavior_pack_history.json"),
                                                            JSON.stringify(worldBehaviorPackHistoryJSON, null, 4),
                                                            "utf-8"
                                                        );
                                                        data.tab.setFileAsModified("world_behavior_pack_history.json");
                                                        data.updateTablesContents?.(true);
                                                    } catch (e) {
                                                        console.error("Error while deleting pack from world files:", e, "pack:", pack);
                                                        dialog.showMessageBox({
                                                            type: "error",
                                                            title: "Error",
                                                            message: `An error occured while deleting the pack from the world files. (UUID: ${pack.pack_id}, Version: ${pack.version})`,
                                                            detail: String(e),
                                                            buttons: ["OK"],
                                                            noLink: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                Delete Pack From World Files
                                            </MenuItem>
                                        )} */}
                                        <MenuItem disabled>Copy Cell Value</MenuItem>
                                    </ControlledMenu>
                                    <tr
                                        data-key={`${pack.pack_id}@${pack.version}`}
                                        onDblClick={onEntryRightClick}
                                        onClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            // Treat Alt+Click as a middle click.
                                            if (!event.altKey) return;
                                            onEntryMiddleClick(event);
                                        }}
                                        onAuxClick={(event: TargetedMouseEvent<HTMLTableRowElement>): void => {
                                            if (event.button !== 1) return;
                                            onEntryMiddleClick(event);
                                        }}
                                    >
                                        <td style={{ color: "red" }}>{String(e)}</td>
                                    </tr>
                                </>
                            );
                        }
                    }
                    return <Row />;
                }) ?? []
            );
        }
    }
}
