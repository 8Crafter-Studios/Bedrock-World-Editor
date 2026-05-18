import json5 from "json5";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

namespace exports {
    /**
     * A locale ID.
     *
     * This type only includes known valid locale IDs for the app.
     */
    export type LocaleID = "en_US" /* 
        | "en_GB"
        | "de_DE"
        | "es_ES"
        | "es_MX"
        | "fr_FR"
        | "fr_CA"
        | "it_IT"
        | "ja_JP"
        | "ko_KR"
        | "pt_BR"
        | "pt_PT"
        | "ru_RU"
        | "zh_CN"
        | "zh_TW"
        | "nl_NL"
        | "bg_BG"
        | "cs_CZ"
        | "da_DK"
        | "el_GR"
        | "fi_FI"
        | "hu_HU"
        | "id_ID"
        | "nb_NO"
        | "pl_PL"
        | "sk_SK"
        | "sv_SE"
        | "tr_TR"
        | "uk_UA" */;

    /**
     * The translations for a locale.
     */
    export interface LocaleTranslations {
        [id: string]: string;
    }

    function getResourcesPath(): string {
        return (
            process.env.resourcesPath ?? (require("@electron/remote") as typeof import("@electron/remote")).process.env.resourcesPath ?? process.resourcesPath
        );
    }

    /**
     * The list of available locales.
     */
    export const locales: LocaleID[] = json5.parse(
        existsSync(path.join(getResourcesPath(), "texts/languages.json")) ? readFileSync(path.join(getResourcesPath(), "texts/languages.json"), "utf-8") : "[]"
    );

    /**
     * The list of available locales and their display names.
     */
    export const localeNames: [id: LocaleID, name: string][] = json5.parse(
        existsSync(path.join(getResourcesPath(), "texts/language_names.json")) ?
            readFileSync(path.join(getResourcesPath(), "texts/language_names.json"), "utf-8")
        :   "[]"
    );

    /**
     * Detects the system locale.
     *
     * @param noFallbackIfNotReady If true, will not fall back to the default locale if the Electron app is not ready.
     * @returns The detected locale.
     */
    export function detectSystemLocale(noFallbackIfNotReady: true): LocaleID | null;
    /**
     * Detects the system locale.
     *
     * @param noFallbackIfNotReady If true, will not fall back to the default locale if the Electron app is not ready.
     * @returns The detected locale.
     */
    export function detectSystemLocale(noFallbackIfNotReady?: false): LocaleID;
    /**
     * Detects the system locale.
     *
     * @param noFallbackIfNotReady If true, will not fall back to the default locale if the Electron app is not ready.
     * @returns The detected locale.
     */
    export function detectSystemLocale(noFallbackIfNotReady: boolean = false): LocaleID | null {
        const app = (require("electron") as typeof import("electron")).app ?? (require("@electron/remote") as typeof import("@electron/remote")).app;

        // 1. Primary: Chromium locale
        const primary = app.getLocale().replace("-", "_") as LocaleID;
        if (locales.includes(primary)) return primary;

        // 2. Secondary: preferred languages
        for (const lang of app.getPreferredSystemLanguages() ?? []) {
            const normalized = lang.replace("-", "_").split(".")[0] as LocaleID;
            if (locales.includes(normalized)) return normalized;

            const base: string | undefined = normalized.split("_")[0];
            const fallback: LocaleID | undefined = locales.find((l: LocaleID): boolean => l.startsWith(base + "_"));
            if (fallback) return fallback;
        }

        // 3. Optional: region hint (rarely needed)
        const sys = app.isReady() ? (app.getSystemLocale()?.replace("-", "_") as LocaleID) : null;
        if (sys !== null && locales.includes(sys)) return sys;
        if (noFallbackIfNotReady && sys === null) return null;

        // 4. Final fallback
        return "en_US";
    }

    /**
     * Fetches the translations for a locale.
     *
     * @param locale The locale to fetch.
     * @returns The translations for the locale.
     *
     * @throws {ReferenceError} If the locale is unknown.
     * @throws {ReferenceError} If the locale file is not found.
     */
    export function fetchLocale(locale: LocaleID): LocaleTranslations {
        if (!locales.includes(locale)) {
            throw new ReferenceError(`[Locale::fetchLocale] Unknown locale: ${locale}`);
        }

        const translations: LocaleTranslations = {};

        const resourcesPath: string = getResourcesPath();
        const textsPath: string = path.join(resourcesPath, "texts");

        if (!existsSync(path.join(textsPath, `${locale}.lang`))) {
            throw new ReferenceError(`[Locale::fetchLocale] Locale file "${textsPath.replaceAll("\\", "/").replace(/\/$/, "")}/${locale}.lang" not found.`);
        }
        const locdat: string = readFileSync(path.join(textsPath, `${locale}.lang`))
            .toString()
            .replaceAll(/##[^\n\r]*/g, "");
        for (const item of locdat.split(/[\n\r]+/g)) translations[item.split("=")[0]!] = item.split("=").slice(1).join("=").replace("\r", "");

        return translations;
    }

    /**
     * Loads the translations for a locale.
     *
     * @param locale The locale to load.
     *
     * @throws {ReferenceError} If the locale is unknown.
     * @throws {ReferenceError} If the locale file is not found.
     */
    export function loadLocale(locale: LocaleID): void {
        console.debug(`[Locale::loadLocale] Loading ${locale}.lang file...`);

        if (!locales.includes(locale)) {
            throw new ReferenceError(`[Locale::loadLocale] Unknown locale: ${locale}`);
        }

        translations = fetchLocale(locale);
    }

    /**
     * The translations for the last loaded locale.
     */
    export let translations: LocaleTranslations = {};

    /**
     * Refreshes the current locale.
     */
    function refreshCurrentLocale(): void {
        if (config.locale === "auto") {
            const locale: LocaleID | null = detectSystemLocale(true);
            if (locale === null) {
                console.warn("Could not detect system locale because app is not ready, falling back to default locale.");
                loadLocale("en_US");
                const app = (require("electron") as typeof import("electron")).app ?? (require("@electron/remote") as typeof import("@electron/remote")).app;
                app.whenReady().then(refreshCurrentLocale);
            } else {
                loadLocale(locale);
            }
        } else {
            try {
                loadLocale(config.locale);
            } catch (e) {
                console.error("Error loading user-defined locale, falling back to system locale:", e, "locale:", config.locale);
                const locale: LocaleID | null = detectSystemLocale(true);
                if (locale === null) {
                    console.warn("Could not detect system locale because app is not ready, falling back to default locale.");
                    loadLocale("en_US");
                    const app =
                        (require("electron") as typeof import("electron")).app ?? (require("@electron/remote") as typeof import("@electron/remote")).app;
                    app.whenReady().then(refreshCurrentLocale);
                } else {
                    loadLocale(locale);
                }
            }
        }
    }

    refreshCurrentLocale();

    config.on("settingChanged:locale", (locale: "auto" | LocaleID): void => loadLocale(locale === "auto" ? detectSystemLocale() : locale));

    /**
     * Translates a string.
     *
     * @param id The id of the string to translate.
     * @returns The translated string.
     */
    export function translate(id: string | TemplateStringsArray): string {
        const resolvedId: string = typeof id === "string" ? id : id[0]!;
        return translations[resolvedId]?.split("#")[0]?.trim() ?? (console.warn(`[Locale::translate] Translation "${resolvedId}" not found.`), resolvedId);
    }

    /**
     * Translates a string with parameters.
     *
     * @param id The id of the string to translate.
     * @param params The parameters to substitute into the string.
     * @returns The translated string.
     */
    export function translateWithParameters(id: TemplateStringsArray, ...params: string[]): string;
    /**
     * Translates a string with parameters.
     *
     * @param id The id of the string to translate.
     * @param params The parameters to substitute into the string.
     * @returns The translated string.
     */
    export function translateWithParameters(id: string, params: string[]): string;
    /**
     * Translates a string with parameters.
     *
     * @param id The id of the string to translate.
     * @param params The parameters to substitute into the string.
     * @returns The translated string.
     */
    export function translateWithParameters(id: string | TemplateStringsArray, ...params: string[] | [params: string[]]): string {
        const resolvedId: string = typeof id === "string" ? id : id[0]!;
        const resolvedParams: string[] =
            params.length ?
                typeof params[0] === "string" ?
                    (params as string[])
                :   params[0]!
            :   (params as []);
        let translation: string | undefined = translations[resolvedId]?.split("#")[0]?.trim();
        if (!translation) {
            console.warn(`[Locale::translateWithParameters] Translation "${resolvedId}" not found.`);
            return resolvedId;
        }
        if (/%\d+|$s/g.test(translation)) {
            for (let i = 1; i <= resolvedParams.length; i++) {
                translation = translation?.replaceAll("%" + i + "$s", resolvedParams[i - 1]!);
            }
        } else translation = translation?.replaceAll("%s", resolvedParams[0]!);

        return translation;
    }
}

Object.defineProperties(globalThis, {
    locales: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.locales,
    },
    localeNames: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.localeNames,
    },
    detectSystemLocale: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.detectSystemLocale,
    },
    fetchLocale: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.fetchLocale,
    },
    loadLocale: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.loadLocale,
    },
    translations: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.translations,
    },
    translate: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.translate,
    },
    translateWithParameters: {
        configurable: true,
        enumerable: true,
        writable: false,
        value: exports.translateWithParameters,
    },
});

declare global {
    export import LocaleID = exports.LocaleID;
    export import locales = exports.locales;
    export import localeNames = exports.localeNames;
    export import detectSystemLocale = exports.detectSystemLocale;
    export import fetchLocale = exports.fetchLocale;
    export import loadLocale = exports.loadLocale;
    export import translations = exports.translations;
    export import translate = exports.translate;
    export import translateWithParameters = exports.translateWithParameters;
}
