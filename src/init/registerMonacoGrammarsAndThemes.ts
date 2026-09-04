/**
 * @see https://github.com/bolinfest/monaco-tm/tree/main
 */

import * as monaco from "monaco-editor";
type Monaco = typeof monaco;

// monaco.editor.registerCommand("paste", (accessor) => {
//     console.log(accessor);
//     // accessor.get(monaco.editor.IEditorService).getFocusedCodeEditor();
//     // const text = require("electron").clipboard.readText();
//     // monaco.editor.trigger("keyboard", "type", { text });
// });

// monaco.editor.addKeybindingRule({
//     keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
//     command: "paste",
//     when: "editorTextFocus",
// });

// import { StandaloneServices } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices';
// import { IProductService } from 'monaco-editor/esm/vs/platform/product/common/productService';

// Register the missing service
// StandaloneServices.initialize({
//   ["productService"]: IProductService,
// });

import type { IGrammar, IRawGrammar, IRawTheme, IOnigLib, StateStack } from "vscode-textmate";

import { INITIAL, Registry, parseRawGrammar } from "vscode-textmate";
// @ts-ignore
import { generateTokensCSSForColorMap } from "monaco-editor/esm/vs/editor/common/languages/supports/tokenization.js";
// @ts-ignore
import { TokenizationRegistry } from "monaco-editor/esm/vs/editor/common/tokenizationRegistry.js";
// @ts-ignore
import { Color } from "monaco-editor/esm/vs/base/common/color.js";
import { createOnigScanner, createOnigString, loadWASM } from "vscode-oniguruma";
import themeTomorrowNightBlue from "../themes/theme-tomorrow-night-blue";
import { loader } from "@monaco-editor/react";
import json5 from "json5";
import {
    extractSNBT,
    NBTSchemas,
    SNBTParseErrorDisplayNamespace,
    SNBTParseErrorTypeToCode,
    type DBEntryContentType,
    type ParseSNBTBaseOptions,
    type SNBTParseError,
    type SNBTParseErrorType,
} from "mcbe-leveldb";
import type * as NBT from "prismarine-nbt";
import { readFile } from "node:fs/promises";

// console.log((() => import("monaco-editor")).toString().split('"')[1]);

loader.config({
    monaco,
});

loader.init();

// @ts-ignore
globalThis.monaco = monaco; // DEBUG
// @ts-ignore
global.monacoLoader = loader; // DEBUG

//#region Register

/** String identifier like 'cpp' or 'java'. */
export type LanguageId = string;

export type LanguageInfo = {
    tokensProvider: monaco.languages.EncodedTokensProvider | null;
    configuration: monaco.languages.LanguageConfiguration | null;
};

/**
 * This function needs to be called before monaco.editor.create().
 *
 * @param languages the set of languages Monaco must know about up front.
 * @param fetchLanguageInfo fetches full language configuration on demand.
 * @param monaco instance of Monaco on which to register languages information.
 */
export function registerLanguages(
    languages: monaco.languages.ILanguageExtensionPoint[],
    fetchLanguageInfo: (language: LanguageId) => Promise<LanguageInfo>,
    monaco: Monaco
): void {
    // We have to register all of the languages with Monaco synchronously before
    // we can configure them.
    for (const extensionPoint of languages) {
        // Recall that the id is a short name like 'cpp' or 'java'.
        const { id: languageId } = extensionPoint;
        monaco.languages.register(extensionPoint);

        // Lazy-load the tokens provider and configuration data.
        monaco.languages.onLanguage(languageId, async (): Promise<void> => {
            const { tokensProvider, configuration } = await fetchLanguageInfo(languageId);

            if (tokensProvider != null) {
                monaco.languages.setTokensProvider(languageId, tokensProvider);
            }

            if (configuration != null) {
                monaco.languages.setLanguageConfiguration(languageId, configuration);
            }
        });
    }
}

//#endregion Register

//#region Providers

/** String identifier for a "scope name" such as 'source.cpp' or 'source.java'. */
export type ScopeName = string;

export type TextMateGrammar = {
    type: "json" | "plist";
    grammar: string;
};

export type SimpleLanguageInfoProviderConfig = {
    // Key is a ScopeName.
    grammars: { [scopeName: string]: ScopeNameInfo };

    fetchGrammar: (scopeName: ScopeName) => Promise<TextMateGrammar>;

    configurations: LanguageId[];

    fetchConfiguration: (language: LanguageId) => Promise<monaco.languages.LanguageConfiguration>;

    // This must be available synchronously to the SimpleLanguageInfoProvider
    // constructor, so the user is responsible for fetching the theme data rather
    // than SimpleLanguageInfoProvider.
    theme: IRawTheme;

    onigLib: Promise<IOnigLib>;
    monaco: Monaco;
};

// eslint-disable-next-line jsdoc/require-jsdoc
export interface ScopeNameInfo {
    /**
     * If set, this is the id of an ILanguageExtensionPoint. This establishes the
     * mapping from a MonacoLanguage to a TextMate grammar.
     */
    language?: LanguageId;

    /**
     * Scopes that are injected *into* this scope. For example, the
     * `text.html.markdown` scope likely has a number of injections to support
     * fenced code blocks.
     */
    injections?: ScopeName[];
}

/**
 * Basic provider to implement the fetchLanguageInfo() function needed to
 * power registerLanguages(). It is designed to fetch all resources
 * asynchronously based on a simple layout of static resources on the server.
 */
export class SimpleLanguageInfoProvider {
    private monaco: Monaco;
    private registry: Registry;
    private tokensProviderCache: TokensProviderCache;

    constructor(private config: SimpleLanguageInfoProviderConfig) {
        const { grammars, fetchGrammar, theme, onigLib, monaco } = config;
        this.monaco = monaco;

        this.registry = new Registry({
            onigLib,

            async loadGrammar(scopeName: ScopeName): Promise<IRawGrammar | null> {
                const scopeNameInfo = grammars[scopeName];
                if (scopeNameInfo == null) {
                    return null;
                }

                const { type, grammar } = await fetchGrammar(scopeName);
                // If this is a JSON grammar, filePath must be specified with a `.json`
                // file extension or else parseRawGrammar() will assume it is a PLIST
                // grammar.
                return parseRawGrammar(grammar, `example.${type}`);
            },

            // eslint-disable-next-line jsdoc/require-returns
            /**
             * For the given scope, returns a list of additional grammars that should be
             * "injected into" it (i.e., a list of grammars that want to extend the
             * specified `scopeName`). The most common example is other grammars that
             * want to "inject themselves" into the `text.html.markdown` scope so they
             * can be used with fenced code blocks.
             *
             * In the manifest of a VS Code extension, a grammar signals that it wants
             * to do this via the "injectTo" property:
             * https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars
             */
            getInjections(scopeName: ScopeName): string[] | undefined {
                const grammar = grammars[scopeName];
                return grammar ? grammar.injections : undefined;
            },

            // Note that nothing will display without the theme!
            theme,
        });

        this.tokensProviderCache = new TokensProviderCache(this.registry);
    }

    /**
     * Be sure this is done after Monaco injects its default styles so that the
     * injected CSS overrides the defaults.
     */
    injectCSS() {
        const cssColors = this.registry.getColorMap();
        const colorMap = cssColors.map(Color.Format.CSS.parseHex);
        // This is needed to ensure the minimap gets the right colors.
        TokenizationRegistry.setColorMap(colorMap);
        const css = generateTokensCSSForColorMap(colorMap);
        const style = createStyleElementForColorsCSS();
        style.innerHTML = css;
    }

    async fetchLanguageInfo(language: LanguageId): Promise<LanguageInfo> {
        const [tokensProvider, configuration] = await Promise.all([this.getTokensProviderForLanguage(language), this.config.fetchConfiguration(language)]);
        return { tokensProvider, configuration };
    }

    public getTokensProviderForLanguage(language: string): Promise<monaco.languages.EncodedTokensProvider | null> {
        const scopeName = this.getScopeNameForLanguage(language);
        if (scopeName == null) {
            return Promise.resolve(null);
        }

        const encodedLanguageId = this.monaco.languages.getEncodedLanguageId(language);
        // Ensure the result of createEncodedTokensProvider() is resolved before
        // setting the language configuration.
        return this.tokensProviderCache.createEncodedTokensProvider(scopeName, encodedLanguageId);
    }

    public getDecodedTokensProviderForLanguage(language: string): Promise<
        | (monaco.languages.TokensProvider & {
              tokenizeWithScopesArray(
                  line: string,
                  state: monaco.languages.IState
              ): Omit<monaco.languages.ILineTokens, "tokens"> & Pick<import("vscode-textmate").ITokenizeLineResult, "tokens">;
          })
        | null
    > {
        const scopeName = this.getScopeNameForLanguage(language);
        if (scopeName == null) {
            return Promise.resolve(null);
        }

        const encodedLanguageId = this.monaco.languages.getEncodedLanguageId(language);
        return this.tokensProviderCache.createTokensProvider(scopeName, encodedLanguageId);
    }

    private getScopeNameForLanguage(language: string): string | null {
        for (const [scopeName, grammar] of Object.entries(this.config.grammars)) {
            if (grammar.language === language) {
                return scopeName;
            }
        }
        return null;
    }
}

class TokensProviderCache {
    private scopeNameToGrammar: Map<string, Promise<IGrammar>> = new Map();

    constructor(private registry: Registry) {}

    async createEncodedTokensProvider(scopeName: string, encodedLanguageId: number): Promise<monaco.languages.EncodedTokensProvider> {
        const grammar = await this.getGrammar(scopeName, encodedLanguageId);

        return {
            getInitialState() {
                return INITIAL;
            },

            tokenizeEncoded(line: string, state: monaco.languages.IState): monaco.languages.IEncodedLineTokens {
                const tokenizeLineResult2 = grammar.tokenizeLine2(line, state as StateStack);
                const { tokens, ruleStack: endState } = tokenizeLineResult2;
                return { tokens, endState };
            },
        };
    }

    async createTokensProvider(
        scopeName: string,
        encodedLanguageId: number
    ): Promise<
        monaco.languages.TokensProvider & {
            tokenizeWithScopesArray(
                line: string,
                state: monaco.languages.IState
            ): Omit<monaco.languages.ILineTokens, "tokens"> & Pick<import("vscode-textmate").ITokenizeLineResult, "tokens">;
        }
    > {
        const grammar = await this.getGrammar(scopeName, encodedLanguageId);

        return {
            getInitialState() {
                return INITIAL;
            },

            tokenize(line: string, state: monaco.languages.IState): monaco.languages.ILineTokens {
                const tokenizeLineResult2 = grammar.tokenizeLine(line, state as StateStack);
                const { tokens, ruleStack: endState } = tokenizeLineResult2;
                return { tokens: tokens.map((token) => ({ ...token, scopes: token.scopes.join(", ") })), endState };
            },

            tokenizeWithScopesArray(
                line: string,
                state: monaco.languages.IState
            ): Omit<monaco.languages.ILineTokens, "tokens"> & Pick<import("vscode-textmate").ITokenizeLineResult, "tokens"> {
                const tokenizeLineResult = grammar.tokenizeLine(line, state as StateStack);
                const { tokens, ruleStack: endState } = tokenizeLineResult;
                return { tokens: tokens, endState };
            },
        };
    }

    getGrammar(scopeName: string, encodedLanguageId: number): Promise<IGrammar> {
        const grammar = this.scopeNameToGrammar.get(scopeName);
        if (grammar != null) {
            return grammar;
        }

        // This is defined in vscode-textmate and has optional embeddedLanguages
        // and tokenTypes fields that might be useful/necessary to take advantage of
        // at some point.
        const grammarConfiguration = {};
        // We use loadGrammarWithConfiguration() rather than loadGrammar() because
        // we discovered that if the numeric LanguageId is not specified, then it
        // does not get encoded in the TokenMetadata.
        //
        // Failure to do so means that the LanguageId cannot be read back later,
        // which can cause other Monaco features, such as "Toggle Line Comment",
        // to fail.
        const promise = this.registry.loadGrammarWithConfiguration(scopeName, encodedLanguageId, grammarConfiguration).then((grammar: IGrammar | null) => {
            if (grammar) {
                return grammar;
            } else {
                throw Error(`failed to load grammar for ${scopeName}`);
            }
        });
        this.scopeNameToGrammar.set(scopeName, promise);
        return promise;
    }
}

function createStyleElementForColorsCSS(): HTMLStyleElement {
    // We want to ensure that our <style> element appears after Monaco's so that
    // we can override some styles it inserted for the default theme.
    const style = document.createElement("style");
    // style.id = "theme-color-injection"

    // We expect the styles we need to override to be in an element with the class
    // name 'monaco-colors' based on:
    // https://github.com/microsoft/vscode/blob/f78d84606cd16d75549c82c68888de91d8bdec9f/src/vs/editor/standalone/browser/standaloneThemeServiceImpl.ts#L206-L214
    const monacoColors = document.getElementsByClassName("monaco-colors")[0];
    if (monacoColors) {
        monacoColors.parentElement?.insertBefore(style, monacoColors.nextSibling);
    } else {
        // Though if we cannot find it, just append to <head>.
        let { head } = document;
        if (head == null) {
            head = document.getElementsByTagName("head")[0]!;
        }
        head?.appendChild(style);
    }
    return style;
}

//#endregion Providers

//#region Configuration

/**
 * Fields that, if present in a LanguageConfiguration, must be a RegExp object
 * rather than a string literal.
 */
const REGEXP_PROPERTIES = [
    // indentation
    "indentationRules.decreaseIndentPattern",
    "indentationRules.increaseIndentPattern",
    "indentationRules.indentNextLinePattern",
    "indentationRules.unIndentedLinePattern",

    // code folding
    "folding.markers.start",
    "folding.markers.end",

    // language's "word definition"
    "wordPattern",
];

// eslint-disable-next-line jsdoc/require-returns
/**
 * Configuration data is read from JSON and JSONC files, which cannot contain
 * regular expression literals. Although Monarch grammars will often accept
 * either the source of a RegExp as a string OR a RegExp object, certain Monaco
 * APIs accept only a RegExp object, so we must "rehydrate" those, as appropriate.
 *
 * It would probably save everyone a lot of trouble if we updated the APIs to
 * accept a RegExp or a string literal. Possibly a small struct if flags need
 * to be specified to the RegExp constructor.
 */
export function rehydrateRegexps(rawConfiguration: string): monaco.languages.LanguageConfiguration {
    const out = json5.parse(rawConfiguration);
    for (const property of REGEXP_PROPERTIES) {
        const value = getProp(out, property);
        if (typeof value === "string") {
            setProp(out, property, new RegExp(value));
        }
    }
    return out;
}

function getProp(obj: { string: any }, selector: string): any {
    const components = selector.split(".");
    // @ts-ignore
    return components.reduce((acc, cur) => (acc != null ? acc[cur] : null), obj);
}

function setProp(obj: { string: any }, selector: string, value: RegExp): void {
    const components = selector.split(".");
    const indexToSet = components.length - 1;
    components.reduce((acc, cur, index) => {
        if (acc == null) {
            return acc;
        }

        if (index === indexToSet) {
            // @ts-ignore
            acc[cur] = value;
            return null;
        } else {
            // @ts-ignore
            return acc[cur];
        }
    }, obj);
}

//#endregion Configuration

//#region App

interface DemoScopeNameInfo extends ScopeNameInfo {
    path: `${string}.${"json" | "plist"}`;
}

main("snbt");

declare global {
    var MonacoEnvironment: monaco.Environment | undefined;
}

globalThis.MonacoEnvironment = {
    getWorkerUrl: function (moduleId: string, label: string) {
        if (label === "json") {
            if (location.protocol === "file:" && location.pathname.includes("/app.asar/.vite/")) {
                return location.href.slice(0, location.href.indexOf("/app.asar/.vite/")) + "/app.asar/.vite/build/json.worker.js";
            }
            return "node_modules/monaco-editor/esm/vs/language/json/json.worker.js";
        }
        if (label === "css") {
            if (location.protocol === "file:" && location.pathname.includes("/app.asar/.vite/")) {
                return location.href.slice(0, location.href.indexOf("/app.asar/.vite/")) + "/app.asar/.vite/build/css.worker.js";
            }
            return "node_modules/monaco-editor/esm/vs/language/css/css.worker.js";
        }
        if (label === "html") {
            if (location.protocol === "file:" && location.pathname.includes("/app.asar/.vite/")) {
                return location.href.slice(0, location.href.indexOf("/app.asar/.vite/")) + "/app.asar/.vite/build/html.worker.js";
            }
            return "node_modules/monaco-editor/esm/vs/language/html/html.worker.js";
        }
        if (label === "typescript" || label === "javascript") {
            if (location.protocol === "file:" && location.pathname.includes("/app.asar/.vite/")) {
                return location.href.slice(0, location.href.indexOf("/app.asar/.vite/")) + "/app.asar/.vite/build/ts.worker.js";
            }
            return "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js";
        }
        if (location.protocol === "file:" && location.pathname.includes("/app.asar/.vite/")) {
            return location.href.slice(0, location.href.indexOf("/app.asar/.vite/")) + "/app.asar/.vite/build/editor.worker.js";
        }
        return "node_modules/monaco-editor/esm/vs/editor/editor.worker.js";
    },
};

async function main(language: LanguageId): Promise<void> {
    // In this demo, the following values are hardcoded to support Python using
    // the VS Code Dark+ theme. Currently, end users are responsible for
    // extracting the data from the relevant VS Code extensions themselves to
    // leverage other TextMate grammars or themes. Scripts may be provided to
    // facilitate this in the future.
    //
    // Note that adding a new TextMate grammar entails the following:
    // - adding an entry in the languages array
    // - adding an entry in the grammars map
    // - making the TextMate file available in the grammars/ folder
    // - making the monaco.languages.LanguageConfiguration available in the
    //   configurations/ folder.
    //
    // You likely also want to add an entry in getSampleCodeForLanguage() and
    // change the call to main() above to pass your LanguageId.
    const languages: monaco.languages.ILanguageExtensionPoint[] = [
        {
            id: "snbt",
            aliases: ["S-NBT", "SNBT", "snbt"],
            extensions: [".snbt"],
        },
    ];
    const grammars: { [scopeName: string]: DemoScopeNameInfo } = {
        "source.snbt": {
            language: "snbt",
            path: "snbt.tmLanguage.json",
        },
    };

    async function fetchGrammar(scopeName: ScopeName): Promise<TextMateGrammar> {
        const { path } = grammars[scopeName]!;
        const uri = `resource://grammars/${path}`;
        const response = await fetch(uri);
        const grammar = await response.text();
        const type = path.endsWith(".json") ? "json" : "plist";
        return { type, grammar };
    }

    async function fetchConfiguration(language: LanguageId): Promise<monaco.languages.LanguageConfiguration> {
        const uri = `resource://grammar-configurations/${language}.json`;
        const response = await fetch(uri);
        const rawConfiguration = await response.text();
        return rehydrateRegexps(rawConfiguration);
    }

    const data: ArrayBuffer | Response = await loadVSCodeOnigurumWASM();
    loadWASM(data);
    const onigLib = Promise.resolve({
        createOnigScanner,
        createOnigString,
    });

    const provider = new SimpleLanguageInfoProvider({
        grammars,
        fetchGrammar,
        configurations: languages.map((language: monaco.languages.ILanguageExtensionPoint): string => language.id),
        fetchConfiguration,
        theme: themeTomorrowNightBlue.textmate,
        onigLib,
        monaco,
    });
    registerLanguages(languages, (language: LanguageId): Promise<LanguageInfo> => provider.fetchLanguageInfo(language), monaco);
    monaco.editor.defineTheme(themeTomorrowNightBlue.details.id, themeTomorrowNightBlue.monaco);

    // This script lists all content types that are missing from the setDiagnosticsOptions.
    // const missingContentTypes = Object.keys(require("mcbe-leveldb").entryContentTypeToFormatMap).filter(v=>!monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas.some(v2=>v2.uri===`inmemory://schemas/json/${v}`));
    // const missingContentTypesWithSchemas = missingContentTypes.filter(v=>v in require("mcbe-leveldb").NBTSchemas.nbtSchemas);
    function setJSONSchemas(attempt: number = 0, actionIfExistingSchemas: "skip" | "append" | "overwrite" = "overwrite"): void {
        if (actionIfExistingSchemas === "skip" && monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas?.length) {
            setTimeout(setJSONSchemas.bind(void 0, 0, "skip"), 500);
            return;
        }
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            ...monaco.languages.json.jsonDefaults.diagnosticsOptions,
            schemas: [
                ...(actionIfExistingSchemas === "append" && monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas?.length ?
                    monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas
                :   []),
                {
                    uri: "inmemory://schemas/json/LevelDat",
                    fileMatch: [
                        "level.dat",
                        "**?contentType=LevelDat",
                        "**?contentType=LevelDat&*",
                        "**/JSONSchema/LevelDat",
                        "**/ContentType:LevelDat",
                        "**/ContentType:LevelDat/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LevelDat,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Data3D",
                    fileMatch: [
                        "**?contentType=Data3D",
                        "**?contentType=Data3D&*",
                        "**/JSONSchema/Data3D",
                        "**/ContentType:Data3D",
                        "**/ContentType:Data3D/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Data3D,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Data2D",
                    fileMatch: [
                        "**?contentType=Data2D",
                        "**?contentType=Data2D&*",
                        "**/JSONSchema/Data2D",
                        "**/ContentType:Data2D",
                        "**/ContentType:Data2D/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Data2D,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Data2DLegacy",
                    fileMatch: [
                        "**?contentType=Data2DLegacy",
                        "**?contentType=Data2DLegacy&*",
                        "**/JSONSchema/Data2DLegacy",
                        "**/ContentType:Data2DLegacy",
                        "**/ContentType:Data2DLegacy/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Data2DLegacy,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/SubChunkPrefix",
                    fileMatch: [
                        "**?contentType=SubChunkPrefix",
                        "**?contentType=SubChunkPrefix&*",
                        "**/JSONSchema/SubChunkPrefix",
                        "**/ContentType:SubChunkPrefix",
                        "**/ContentType:SubChunkPrefix/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.SubChunkPrefix,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LegacyTerrain",
                    fileMatch: [
                        "**?contentType=LegacyTerrain",
                        "**?contentType=LegacyTerrain&*",
                        "**/JSONSchema/LegacyTerrain",
                        "**/ContentType:LegacyTerrain",
                        "**/ContentType:LegacyTerrain/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LegacyTerrain,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/BlockEntity",
                    fileMatch: [
                        "**?contentType=BlockEntity",
                        "**?contentType=BlockEntity&*",
                        "**/JSONSchema/BlockEntity",
                        "**/ContentType:BlockEntity",
                        "**/ContentType:BlockEntity/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        {
                            description: "A list of block entities associated with a chunk.",
                            type: "compound",
                            required: ["blockEntities"],
                            properties: {
                                blockEntities: {
                                    title: "Block Entities",
                                    description: "The list of block entities associated with this chunk.",
                                    type: "list",
                                    items: { $ref: "BlockEntity" },
                                },
                            },
                        },
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Entity",
                    fileMatch: [
                        "**?contentType=Entity",
                        "**?contentType=Entity&*",
                        "**/JSONSchema/Entity",
                        "**/ContentType:Entity",
                        "**/ContentType:Entity/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        {
                            description: "A list of entities associated with a chunk.",
                            type: "compound",
                            required: ["entities"],
                            properties: {
                                entities: {
                                    title: "Entities",
                                    description: "The list of entities associated with this chunk.",
                                    type: "list",
                                    items: { $ref: "Entity_Entity" },
                                },
                            },
                        },
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/PendingTicks",
                    fileMatch: [
                        "**?contentType=PendingTicks",
                        "**?contentType=PendingTicks&*",
                        "**/JSONSchema/PendingTicks",
                        "**/ContentType:PendingTicks",
                        "**/ContentType:PendingTicks/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.PendingTicks,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/RandomTicks",
                    fileMatch: [
                        "**?contentType=RandomTicks",
                        "**?contentType=RandomTicks&*",
                        "**/JSONSchema/RandomTicks",
                        "**/ContentType:RandomTicks",
                        "**/ContentType:RandomTicks/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.RandomTicks,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                // TODO: Uncomment this when this schema is implemented.
                // {
                //     uri: "inmemory://schemas/json/MVillages",
                //     fileMatch: [
                //         "**?contentType=MVillages",
                //         "**?contentType=MVillages&*",
                //         "**/JSONSchema/MVillages",
                //         "**/ContentType:MVillages",
                //         "**/ContentType:MVillages/**",
                //     ],
                //     schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                //         NBTSchemas.nbtSchemas.MVillages,
                //         undefined,
                //         { makeValueSchema: true },
                //         true
                //     ),
                // },
                // TODO: Uncomment this when this schema is implemented.
                // {
                //     uri: "inmemory://schemas/json/Villages",
                //     fileMatch: [
                //         "**?contentType=Villages",
                //         "**?contentType=Villages&*",
                //         "**/JSONSchema/Villages",
                //         "**/ContentType:Villages",
                //         "**/ContentType:Villages/**",
                //     ],
                //     schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                //         NBTSchemas.nbtSchemas.Villages,
                //         undefined,
                //         { makeValueSchema: true },
                //         true
                //     ),
                // },
                {
                    uri: "inmemory://schemas/json/VillageDwellers",
                    fileMatch: [
                        "**?contentType=VillageDwellers",
                        "**?contentType=VillageDwellers&*",
                        "**/JSONSchema/VillageDwellers",
                        "**/ContentType:VillageDwellers",
                        "**/ContentType:VillageDwellers/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.VillageDwellers,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/VillageInfo",
                    fileMatch: [
                        "**?contentType=VillageInfo",
                        "**?contentType=VillageInfo&*",
                        "**/JSONSchema/VillageInfo",
                        "**/ContentType:VillageInfo",
                        "**/ContentType:VillageInfo/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.VillageInfo,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/VillagePOI",
                    fileMatch: [
                        "**?contentType=VillagePOI",
                        "**?contentType=VillagePOI&*",
                        "**/JSONSchema/VillagePOI",
                        "**/ContentType:VillagePOI",
                        "**/ContentType:VillagePOI/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.VillagePOI,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/VillagePlayers",
                    fileMatch: [
                        "**?contentType=VillagePlayers",
                        "**?contentType=VillagePlayers&*",
                        "**/JSONSchema/VillagePlayers",
                        "**/ContentType:VillagePlayers",
                        "**/ContentType:VillagePlayers/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.VillagePlayers,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/VillageRaid",
                    fileMatch: [
                        "**?contentType=VillageRaid",
                        "**?contentType=VillageRaid&*",
                        "**/JSONSchema/VillageRaid",
                        "**/ContentType:VillageRaid",
                        "**/ContentType:VillageRaid/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.VillageRaid,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Player",
                    fileMatch: [
                        "**?contentType=Player",
                        "**?contentType=Player&*",
                        "**/JSONSchema/Player",
                        "**/ContentType:Player",
                        "**/ContentType:Player/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Player,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/PlayerClient",
                    fileMatch: [
                        "**?contentType=PlayerClient",
                        "**?contentType=PlayerClient&*",
                        "**/JSONSchema/PlayerClient",
                        "**/ContentType:PlayerClient",
                        "**/ContentType:PlayerClient/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.PlayerClient,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/ActorPrefix",
                    fileMatch: [
                        "**?contentType=ActorPrefix",
                        "**?contentType=ActorPrefix&*",
                        "**/JSONSchema/ActorPrefix",
                        "**/ContentType:ActorPrefix",
                        "**/ContentType:ActorPrefix/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.ActorPrefix,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Digest",
                    fileMatch: [
                        "**?contentType=Digest",
                        "**?contentType=Digest&*",
                        "**/JSONSchema/Digest",
                        "**/ContentType:Digest",
                        "**/ContentType:Digest/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Digest,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Map",
                    fileMatch: ["**?contentType=Map", "**?contentType=Map&*", "**/JSONSchema/Map", "**/ContentType:Map", "**/ContentType:Map/**"],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Map,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Portals",
                    fileMatch: [
                        "**?contentType=Portals",
                        "**?contentType=Portals&*",
                        "**/JSONSchema/Portals",
                        "**/ContentType:Portals",
                        "**/ContentType:Portals/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Portals,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/SchedulerWT",
                    fileMatch: [
                        "**?contentType=SchedulerWT",
                        "**?contentType=SchedulerWT&*",
                        "**/JSONSchema/SchedulerWT",
                        "**/ContentType:SchedulerWT",
                        "**/ContentType:SchedulerWT/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.SchedulerWT,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/StructureTemplate",
                    fileMatch: [
                        "**?contentType=StructureTemplate",
                        "**?contentType=StructureTemplate&*",
                        "**/JSONSchema/StructureTemplate",
                        "**/ContentType:StructureTemplate",
                        "**/ContentType:StructureTemplate/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.StructureTemplate,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/TickingArea",
                    fileMatch: [
                        "**?contentType=TickingArea",
                        "**?contentType=TickingArea&*",
                        "**/JSONSchema/TickingArea",
                        "**/ContentType:TickingArea",
                        "**/ContentType:TickingArea/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.TickingArea,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/PositionTrackingDB",
                    fileMatch: [
                        "**?contentType=PositionTrackingDB",
                        "**?contentType=PositionTrackingDB&*",
                        "**/JSONSchema/PositionTrackingDB",
                        "**/ContentType:PositionTrackingDB",
                        "**/ContentType:PositionTrackingDB/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.PositionTrackingDB,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/PositionTrackingLastId",
                    fileMatch: [
                        "**?contentType=PositionTrackingLastId",
                        "**?contentType=PositionTrackingLastId&*",
                        "**/JSONSchema/PositionTrackingLastId",
                        "**/ContentType:PositionTrackingLastId",
                        "**/ContentType:PositionTrackingLastId/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.PositionTrackingLastId,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Scoreboard",
                    fileMatch: [
                        "**?contentType=Scoreboard",
                        "**?contentType=Scoreboard&*",
                        "**/JSONSchema/Scoreboard",
                        "**/ContentType:Scoreboard",
                        "**/ContentType:Scoreboard/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Scoreboard,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LegacyOverworld",
                    fileMatch: [
                        "**?contentType=LegacyOverworld",
                        "**?contentType=LegacyOverworld&*",
                        "**/JSONSchema/LegacyOverworld",
                        "**/ContentType:LegacyOverworld",
                        "**/ContentType:LegacyOverworld/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LegacyOverworld,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LegacyNether",
                    fileMatch: [
                        "**?contentType=LegacyNether",
                        "**?contentType=LegacyNether&*",
                        "**/JSONSchema/LegacyNether",
                        "**/ContentType:LegacyNether",
                        "**/ContentType:LegacyNether/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LegacyNether,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LegacyTheEnd",
                    fileMatch: [
                        "**?contentType=LegacyTheEnd",
                        "**?contentType=LegacyTheEnd&*",
                        "**/JSONSchema/LegacyTheEnd",
                        "**/ContentType:LegacyTheEnd",
                        "**/ContentType:LegacyTheEnd/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LegacyTheEnd,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Overworld",
                    fileMatch: [
                        "**?contentType=Overworld",
                        "**?contentType=Overworld&*",
                        "**/JSONSchema/Overworld",
                        "**/ContentType:Overworld",
                        "**/ContentType:Overworld/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Overworld,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/Nether",
                    fileMatch: [
                        "**?contentType=Nether",
                        "**?contentType=Nether&*",
                        "**/JSONSchema/Nether",
                        "**/ContentType:Nether",
                        "**/ContentType:Nether/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.Nether,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/TheEnd",
                    fileMatch: [
                        "**?contentType=TheEnd",
                        "**?contentType=TheEnd&*",
                        "**/JSONSchema/TheEnd",
                        "**/ContentType:TheEnd",
                        "**/ContentType:TheEnd/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.TheEnd,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/AutonomousEntities",
                    fileMatch: [
                        "**?contentType=AutonomousEntities",
                        "**?contentType=AutonomousEntities&*",
                        "**/JSONSchema/AutonomousEntities",
                        "**/ContentType:AutonomousEntities",
                        "**/ContentType:AutonomousEntities/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.AutonomousEntities,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/BiomeData",
                    fileMatch: [
                        "**?contentType=BiomeData",
                        "**?contentType=BiomeData&*",
                        "**/JSONSchema/BiomeData",
                        "**/ContentType:BiomeData",
                        "**/ContentType:BiomeData/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.BiomeData,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/BiomeIdsTable",
                    fileMatch: [
                        "**?contentType=BiomeIdsTable",
                        "**?contentType=BiomeIdsTable&*",
                        "**/JSONSchema/BiomeIdsTable",
                        "**/ContentType:BiomeIdsTable",
                        "**/ContentType:BiomeIdsTable/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.BiomeIdsTable,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/MobEvents",
                    fileMatch: [
                        "**?contentType=MobEvents",
                        "**?contentType=MobEvents&*",
                        "**/JSONSchema/MobEvents",
                        "**/ContentType:MobEvents",
                        "**/ContentType:MobEvents/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.MobEvents,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LevelDat",
                    fileMatch: [
                        "**?contentType=LevelDat",
                        "**?contentType=LevelDat&*",
                        "**/JSONSchema/LevelDat",
                        "**/ContentType:LevelDat",
                        "**/ContentType:LevelDat/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LevelDat,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/DynamicProperties",
                    fileMatch: [
                        "**?contentType=DynamicProperties",
                        "**?contentType=DynamicProperties&*",
                        "**/JSONSchema/DynamicProperties",
                        "**/ContentType:DynamicProperties",
                        "**/ContentType:DynamicProperties/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.DynamicProperties,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/LevelChunkMetaDataDictionary",
                    fileMatch: [
                        "**?contentType=LevelChunkMetaDataDictionary",
                        "**?contentType=LevelChunkMetaDataDictionary&*",
                        "**/JSONSchema/LevelChunkMetaDataDictionary",
                        "**/ContentType:LevelChunkMetaDataDictionary",
                        "**/ContentType:LevelChunkMetaDataDictionary/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.LevelChunkMetaDataDictionary,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/ChunkLoadedRequest",
                    fileMatch: [
                        "**?contentType=ChunkLoadedRequest",
                        "**?contentType=ChunkLoadedRequest&*",
                        "**/JSONSchema/ChunkLoadedRequest",
                        "**/ContentType:ChunkLoadedRequest",
                        "**/ContentType:ChunkLoadedRequest/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.ChunkLoadedRequest,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/BorderBlocks",
                    fileMatch: [
                        "**?contentType=BorderBlocks",
                        "**?contentType=BorderBlocks&*",
                        "**/JSONSchema/BorderBlocks",
                        "**/ContentType:BorderBlocks",
                        "**/ContentType:BorderBlocks/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.BorderBlocks,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/HardcodedSpawners",
                    fileMatch: [
                        "**?contentType=HardcodedSpawners",
                        "**?contentType=HardcodedSpawners&*",
                        "**/JSONSchema/HardcodedSpawners",
                        "**/ContentType:HardcodedSpawners",
                        "**/ContentType:HardcodedSpawners/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.HardcodedSpawners,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/CustomDimension",
                    fileMatch: [
                        "**?contentType=CustomDimension",
                        "**?contentType=CustomDimension&*",
                        "**/JSONSchema/CustomDimension",
                        "**/ContentType:CustomDimension",
                        "**/ContentType:CustomDimension/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.CustomDimension,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/DimensionNameIdTable",
                    fileMatch: [
                        "**?contentType=DimensionNameIdTable",
                        "**?contentType=DimensionNameIdTable&*",
                        "**/JSONSchema/DimensionNameIdTable",
                        "**/ContentType:DimensionNameIdTable",
                        "**/ContentType:DimensionNameIdTable/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.DimensionNameIdTable,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/WorldClocks",
                    fileMatch: [
                        "**?contentType=WorldClocks",
                        "**?contentType=WorldClocks&*",
                        "**/JSONSchema/WorldClocks",
                        "**/ContentType:WorldClocks",
                        "**/ContentType:WorldClocks/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.WorldClocks,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/AABBVolumes",
                    fileMatch: [
                        "**?contentType=AABBVolumes",
                        "**?contentType=AABBVolumes&*",
                        "**/JSONSchema/AABBVolumes",
                        "**/ContentType:AABBVolumes",
                        "**/ContentType:AABBVolumes/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.AABBVolumes,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                {
                    uri: "inmemory://schemas/json/BiomeState",
                    fileMatch: [
                        "**?contentType=BiomeState",
                        "**?contentType=BiomeState&*",
                        "**/JSONSchema/BiomeState",
                        "**/ContentType:BiomeState",
                        "**/ContentType:BiomeState/**",
                    ],
                    schema: NBTSchemas.Utils.Conversion.ToJSONSchema.nbtSchemaToJsonSchema(
                        NBTSchemas.nbtSchemas.BiomeState,
                        undefined,
                        { makeValueSchema: true },
                        true
                    ),
                },
                ...[1, 2, 3, 4, 6, 8, 16, 32]
                    .flatMap(
                        (v: number) =>
                            [
                                { bits: v, signed: false, range: [0, 2 ** v - 1] },
                                { bits: v, signed: true, range: [-(2 ** (v - 1)), 2 ** (v - 1) - 1] },
                            ] as const
                    )
                    .map((v) => ({
                        uri: `inmemory://schemas/json/${v.signed ? "" : "u"}int${v.bits}`,
                        fileMatch: [`**/JSONSchema/${v.signed ? "" : "u"}int${v.bits}`],
                        schema: {
                            type: "number",
                            minimum: v.range[0],
                            maximum: v.range[1],
                        } satisfies monaco.languages.json.JSONSchema,
                    })),
            ],
        });
        if ((monaco.languages.json.jsonDefaults.diagnosticsOptions.schemas?.length ?? 0) > 0) {
            console.debug("Set JSON schemas.", monaco.languages.json.jsonDefaults);
            setTimeout(setJSONSchemas.bind(void 0, 0, "skip"), 500);
        } else {
            console.debug("Failed to set JSON schemas, retrying in 50ms (attempt " + (attempt + 1) + ").", monaco.languages.json.jsonDefaults);
            setTimeout(setJSONSchemas.bind(void 0, attempt + 1), 50);
        }
    }

    monaco.languages.onLanguage("json", () => {
        setTimeout(setJSONSchemas, 50);
    });

    function getSNBTErrorMessageFromErrorOrType(error: SNBTParseError<true> | SNBTParseErrorType): string {
        const errorType =
            typeof error === "string" ? error
            : "error" in error.cause.stack[0] && error.cause.stack[0].error ? error.cause.stack[0].error.type
            : undefined;
        const err: SNBTParseError<true> | undefined = typeof error === "string" ? undefined : error;

        switch (errorType) {
            case "MixedListTypesNotAllowed":
                return "This list contains elements of different types. Was this intentional?\n\nThis will be converted to a compound list if left in.";
            case "ExpectedEndOfInput":
                return "Expected end of input.";
            default:
                return err?.message ?? (error as string);
        }
    }

    function generateSNBTModelMarkers(
        model: monaco.editor.ITextModel,
        options: Pick<ParseSNBTBaseOptions, "mixedListsAllowed" | "convertMixedListsToCompoundLists"> = {}
    ): monaco.editor.IMarkerData[] {
        const markers: monaco.editor.IMarkerData[] = [];
        const value: string = model.getValue();
        const data: {
            value: NBT.Compound | NBT.List<NBT.TagType>;
            startPos: number;
            endPos: number;
            remaining: string;
            errors: SNBTParseError<true>[];
        } = extractSNBT(value, { ...options, keepGoingAfterError: true }) as any;
        if (data.errors.length > 0) {
            for (const error of data.errors) {
                const [startLineNumber, startColumn] = error.getErrorPosition();
                const [endLineNumber, endColumn] = error.getErrorPosition();
                const errorType = "error" in error.cause.stack[0] && error.cause.stack[0].error ? error.cause.stack[0].error.type : undefined;
                const errorMessage: string = getSNBTErrorMessageFromErrorOrType(error);
                markers.push({
                    severity: errorType === "MixedListTypesNotAllowed" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
                    startLineNumber: startLineNumber,
                    startColumn: startColumn,
                    endLineNumber: endLineNumber,
                    endColumn: endColumn,
                    message: errorMessage,
                    code: errorType ? SNBTParseErrorTypeToCode[errorType] : undefined!,
                    source: SNBTParseErrorDisplayNamespace,
                    origin: "a",
                });
            }
        }
        if (data.remaining.trim().length > 0) {
            const [startLineNumber, startColumn] = [
                value.slice(0, data.endPos).split("\n").length,
                data.endPos - value.slice(0, data.endPos).lastIndexOf("\n"),
            ];
            const [endLineNumber, endColumn] = [
                value.slice(0, data.endPos + data.remaining.length).split("\n").length,
                data.endPos - value.slice(0, data.endPos + data.remaining.length).lastIndexOf("\n") + data.remaining.length,
            ];
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber,
                startColumn,
                endLineNumber,
                endColumn,
                message: getSNBTErrorMessageFromErrorOrType("ExpectedEndOfInput"),
                code: SNBTParseErrorTypeToCode.ExpectedEndOfInput,
                source: SNBTParseErrorDisplayNamespace,
            });
        }
        if (!value.trim().startsWith("{") && !value.trim().startsWith("[")) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: 1,
                message: "Expected a compound or list.",
                code: SNBTParseErrorTypeToCode.ExpectedCompoundOrList,
                source: SNBTParseErrorDisplayNamespace,
            });
        }
        return markers;
    }

    monaco.editor.onDidCreateModel((model: monaco.editor.ITextModel) => {
        if (model.getLanguageId() === "snbt") {
            model.onDidChangeContent((): void => {
                monaco.editor.setModelMarkers(model, "snbt-error-provider", generateSNBTModelMarkers(model, { mixedListsAllowed: false }));
            });
        }
    });

    monaco.languages.registerCompletionItemProvider("snbt", {
        async provideCompletionItems(model, position, context, token) {
            const tokensProvider = await provider.getDecodedTokensProviderForLanguage(model.getLanguageId());
            if (!tokensProvider) {
                return {
                    suggestions: [
                        {
                            insertText: "",
                            kind: monaco.languages.CompletionItemKind.Issue,
                            label: "no tokens provider",
                            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        },
                    ],
                };
            }
            if (!tokensProvider.tokenizeWithScopesArray) {
                return {
                    suggestions: [
                        {
                            insertText: "",
                            kind: monaco.languages.CompletionItemKind.Issue,
                            label: "no tokenize with scopes array function",
                            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        },
                    ],
                };
            }
            let state = tokensProvider?.getInitialState();
            for (let i = 0; i < position.lineNumber - 1; i++) {
                const tokens = tokensProvider.tokenizeWithScopesArray(model.getLineContent(i + 1), state);
                if (tokens) {
                    state = tokens.endState;
                }
            }
            const tokens = tokensProvider.tokenizeWithScopesArray(model.getLineContent(position.lineNumber), state);
            if (tokens) {
                state = tokens.endState;
            }
            const mergedTokens: import("vscode-textmate").IToken[] = [];
            let currentTokenMerge: Mutable<import("vscode-textmate").IToken> = { ...tokens.tokens[0]! };
            for (const token of tokens.tokens.slice(1)) {
                if (
                    token.startIndex === currentTokenMerge.endIndex &&
                    token.scopes.every((scope: string, index: number): boolean => currentTokenMerge.scopes[index] === scope)
                ) {
                    currentTokenMerge.endIndex = token.endIndex;
                    continue;
                }
                mergedTokens.push(currentTokenMerge);
                currentTokenMerge = { ...token };
                continue;
            }
            mergedTokens.push(currentTokenMerge);
            const tokenAtCursor = mergedTokens.findLast((token) => token.startIndex < position.column - 1 && token.endIndex >= position.column - 1);
            console.debug("[MonacoEditorAutoCompletionData]:", tokenAtCursor?.scopes);
            console.debug("[MonacoEditorAutoCompletionData]:", tokenAtCursor);
            console.debug("[MonacoEditorAutoCompletionData]:", tokens);
            console.debug("[MonacoEditorAutoCompletionData]:", mergedTokens);
            console.debug("[MonacoEditorAutoCompletionData]:", model, model.id, model.uri);
            const contentType: DBEntryContentType = (new URLSearchParams(model.uri.query).get("contentType") as DBEntryContentType | null) ?? "Unknown";
            if (tokenAtCursor) {
                switch (true) {
                    case tokenAtCursor.scopes.some((scope: string): boolean => scope.startsWith("support.type.property-name.") && scope.endsWith(".snbt")): {
                        const text: string = model.getLineContent(position.lineNumber).slice(tokenAtCursor.startIndex ?? 0, position.column - 1);
                        switch (contentType) {
                            // TODO: Switch this to use NBT schemas.
                            case "LevelDat": {
                                return {
                                    suggestions: [
                                        ...(Object.values(monaco.languages.CompletionItemKind) as monaco.languages.CompletionItemKind[])
                                            .filter((kind) => typeof kind === "number")
                                            .map((kind) => ({
                                                insertText: "abilities",
                                                label: `(${kind} (${
                                                    monaco.languages.CompletionItemKind[kind as Extract<monaco.languages.CompletionItemKind, number>]
                                                })) abilities ${JSON.stringify(text)}`,
                                                kind /* : monaco.languages.CompletionItemKind.Property */,
                                                range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                            })),
                                    ],
                                };
                            }
                        }
                        break;
                    }
                    case tokenAtCursor.scopes.includes("punctuation.separator.dictionary.key-value.snbt"): {
                        return {
                            suggestions: [
                                {
                                    insertText: "true",
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    label: "true",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Boolean",
                                },
                                {
                                    insertText: "false",
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    label: "false",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Boolean",
                                },
                                {
                                    insertText: "0b",
                                    kind: monaco.languages.CompletionItemKind.Unit,
                                    label: "0b",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Byte",
                                },
                                {
                                    insertText: "0s",
                                    kind: monaco.languages.CompletionItemKind.Unit,
                                    label: "0s",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Short",
                                },
                                {
                                    insertText: "0",
                                    kind: monaco.languages.CompletionItemKind.Unit,
                                    label: "0",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Int",
                                },
                                {
                                    insertText: "0i",
                                    kind: monaco.languages.CompletionItemKind.Unit,
                                    label: "0i",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Int",
                                },
                                {
                                    insertText: "0L",
                                    kind: monaco.languages.CompletionItemKind.Unit,
                                    label: "0L",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Long",
                                },
                                {
                                    insertText: "[]",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    label: "[]",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "List",
                                },
                                {
                                    insertText: "[B;]",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    label: "[B;]",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Byte Array",
                                },
                                {
                                    insertText: "[I;]",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    label: "[I;]",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Int Array",
                                },
                                {
                                    insertText: "[L;]",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    label: "[L;]",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Long Array",
                                },
                                {
                                    insertText: "{}",
                                    kind: monaco.languages.CompletionItemKind.Struct,
                                    label: "{}",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    detail: "Compound",
                                },
                                {
                                    insertText: "bool()",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    label: "bool()",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    documentation: {
                                        value: "Converts a value to a boolean.\n\nArgument must be a number or boolean, other values will throw errors.\n\nIf argument is a boolean value, returns value directly.\n\nIf argument is a number value, returns false if it's 0, otherwise returns true.",
                                        isTrusted: true,
                                    },
                                },
                                {
                                    insertText: "uuid()",
                                    kind: monaco.languages.CompletionItemKind.Function,
                                    label: "uuid()",
                                    range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                    documentation: {
                                        value: 'Converts string representation of UUID to integer array.\n\n<span style="color:#b8f;">@example</span> `uuid(f81d4fae-7dec-11d0-a765-00a0c91e6bf6)` -> `[I; -132296786, 2112623056, -1486552928, -920753162]`',
                                        isTrusted: true,
                                    },
                                },
                            ],
                        };
                    }
                }
            }
            return {
                suggestions: [],
            };
        },
    });

    // const value = getSampleCodeForLanguage(language);
    // const id = "container";
    // const element = document.getElementById(id);
    // if (element == null) {
    //     throw Error(`could not find element #${id}`);
    // }

    // monaco.editor.create(element, {
    //     value,
    //     language,
    //     theme: "vs-dark",
    //     minimap: {
    //         enabled: true,
    //     },
    // });
    // provider.injectCSS();
}

// Taken from https://github.com/microsoft/vscode/blob/829230a5a83768a3494ebbc61144e7cde9105c73/src/vs/workbench/services/textMate/browser/textMateService.ts#L33-L40
async function loadVSCodeOnigurumWASM(): Promise<ArrayBuffer> {
    const response: Buffer<ArrayBuffer> = (await readFile(require.resolve("vscode-oniguruma/release/onig.wasm"))) as Buffer<ArrayBuffer>;
    return response.buffer;
}

function getSampleCodeForLanguage(language: LanguageId): string {
    if (language === "python") {
        return `\
import foo

async def bar(): string:
  f = await foo()
  f_string = f"Hooray {f}! format strings are not supported in current Monarch grammar"
  return foo_string
`;
    }

    throw Error(`unsupported language: ${language}`);
}

//#endregion App
