declare module "electron-progressbar" {
    import { app, BrowserWindowConstructorOptions } from "electron";

    class ProgressBar {
        public constructor(options: ProgressBarOptions, electronApp?: typeof app);

        public getOptions(): ProgressBarOptions;

        public on(eventName: "ready" | "progress" | "completed" | "aborted", listener: () => void): this;
        public on(eventName: "progress" | "completed" | "aborted", listener: (value: number) => void): this;

        public setCompleted(): void;

        public close(): void;

        public isInProgress(): boolean;

        public isCompleted(): boolean;

        public value: number;
        public text: string;
        public detail: string;
        public get title(): undefined;
        public set title(title: string);
        public _options: ProgressBarOptions;
    }

    interface ProgressBarOptions {
        abortOnError?: boolean | null | undefined;
        indeterminate?: boolean | null | undefined;
        initialValue?: number | null | undefined;
        maxValue?: number | null | undefined;
        closeOnComplete?: boolean | null | undefined;
        title?: string | null | undefined;
        text?: string | null | undefined;
        detail?: string | null | undefined;
        style?: StyleOptions | null | undefined;
        browserWindow?: BrowserWindowConstructorOptions | null | undefined;
        remoteWindow?: typeof BrowserWindow | null | undefined;
        debug?: boolean | null | undefined;
        lang?: string | null | undefined;
        customHTML?: string | null | undefined;
    }

    interface StyleOptions {
        text?: Partial<CSSStyleDeclaration> | null | undefined;
        detail?: Partial<CSSStyleDeclaration> | null | undefined;
        bar?: Partial<CSSStyleDeclaration> | null | undefined;
        value?: Partial<CSSStyleDeclaration> | null | undefined;
    }

    export = ProgressBar;
}

// declare module "search-query-parser" {
//     // @file
//     // Type definitions for search-query-parser.
//     // Project: https://github.com/nepsilon/search-query-parser
//     // Definitions by: Geoffrey Roberts <g.roberts@blackicemedia.com>
//     // Definitions: https://github.com/nepsilon/search-query-parser

//     export interface SearchParserOptions {
//         offsets?: boolean;
//         tokenize?: boolean;
//         keywords?: string[];
//         ranges?: string[];
//         alwaysArray?: boolean;
//     }

//     export type ISearchParserDictionaryTyped<T extends string = string, V extends string[] | string = string[] | string> = {
//         [key in T]?: V;
//     };

//     export type SearchParserOffset = (SearchParserKeyWordOffset<T> | SearchParserTextOffset) & {
//         offsetStart: number;
//         offsetEnd: number;
//     };

//     export type SearchParserKeyWordOffset<T extends string = string> = {
//         keyword: T;
//         value?: string;
//     };

//     export type SearchParserTextOffset = {
//         text: string;
//     };

//     export interface SearchParserResultTypedInner<T extends string, Tokenize extends boolean, AlwaysArray extends boolean> {
//         text?: boolean extends Tokenize ? string[] : Tokenize extends true ? string[] : string;
//         offsets?: SearchParserOffset<T>[];
//         exclude?: ISearchParserDictionaryTyped<T, boolean extends AlwaysArray ? string[] | string : AlwaysArray extends true ? string[] : string> & {
//             text?: [string, string, ...string[]] | string;
//         };
//     }

//     export type SearchParserResultTyped<
//         T extends string = string,
//         Tokenize extends boolean = boolean,
//         AlwaysArray extends boolean = boolean
//     > = SearchParserResultTypedInner<T, Tokenize, AlwaysArray> &
//         ISearchParserDictionaryTyped<T, boolean extends AlwaysArray ? string[] | string : AlwaysArray extends true ? string[] : string>;

//     export function parse(
//         string: string,
//         options?: SearchParserOptions & {
//             tokenize: false;
//         }
//     ): string;
//     export function parse<
//         T extends SearchParserOptions & {
//             tokenize: true;
//             keywords?: LooseAutocomplete<"">[] | [LooseAutocomplete<"">];
//         } = { tokenize: true }
//     >(string: string, options?: T): SearchParserResultTyped<T["keywords"][number], T["tokenize"], unknown extends T["alwaysArray"] ? false : T["alwaysArray"]>;
//     // export function parse(string: string, options?: SearchParserOptions): string | SearchParserResult;

//     export function stringify(searchParserResult: string | SearchParserResult, options?: SearchParserOptions): string;
// }

declare global {
    namespace React {
        /**
         * An alias for {@link React.ElementType | React.ElementType\<P\>} to fix the component types of {@link https://www.npmjs.com/package/@szhsin/react-menu | @szhsin/react-menu}.
         */
        export type NamedExoticComponent<P = any> = React.ElementType<P>;
    }
}
