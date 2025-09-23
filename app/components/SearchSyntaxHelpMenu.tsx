import type { JSX, RefObject } from "preact";
import { render, useRef } from "preact/compat";

export interface SearchSyntaxHelpInfoCategory {
    /**
     * The category ID.
     *
     * If `undefined`, this is the category for things that don't have a category specified.
     */
    category: string | undefined;
    /**
     * The header label of this category.
     *
     * @default undefined
     */
    header?: string;
    /**
     * The label that goes below the header label of this category.
     *
     * @default undefined
     */
    label?: string;
}

export interface SearchSyntaxHelpInfo {
    /**
     * The main header text.
     *
     * @default "Search Syntax"
     */
    headerText?: string;
    /**
     * The main body text.
     *
     * @default undefined
     */
    bodyText?: string | JSX.Element;
    /**
     * A map of prefix operators to their details.
     */
    prefixOperators: {
        [prefixOperator: string]: {
            /**
             * The description of this prefix operator.
             */
            description: string;
            /**
             * The extended description of this prefix operator.
             *
             * @default description
             */
            extendedDescription?: string | JSX.Element;
            /**
             * Examples of this prefix operator.
             *
             * @default []
             */
            examples?: (string | JSX.Element)[];
            /**
             * The category ID of this prefix operator.
             *
             * @default undefined
             */
            category?: string;
        };
    };
    /**
     * A map of filters to their details.
     */
    filters: {
        [filter: string]: {
            /**
             * The description of this filter.
             */
            description: string;
            /**
             * The extended description of this filter.
             *
             * @default description
             */
            extendedDescription?: string | JSX.Element;
            /**
             * Examples of this filter.
             *
             * @default []
             */
            examples?: (string | JSX.Element)[];
            /**
             * The category ID of this filter.
             *
             * @default undefined
             */
            category?: string;
        };
    };
    /**
     * The categories.
     *
     * @default
     * ```typescript
     * [{category: undefined}]
     * ```
     */
    categories?: [firstCategory: SearchSyntaxHelpInfoCategory, ...additionalCategories: SearchSyntaxHelpInfoCategory[]];
    /**
     * The miscellaneous examples header.
     *
     * @default "Examples"
     */
    miscExamplesHeader?: string;
    /**
     * Miscellaneous examples.
     *
     * @default []
     */
    miscExamples?: string[];
}

/**
 * The props for the {@link SearchSyntaxHelpMenu} component.
 */
export interface SearchSyntaxHelpMenuProps {
    /**
     * The help info.
     */
    helpInfo: SearchSyntaxHelpInfo;
    /**
     * A callback for when the menu is closed.
     */
    onClose(): void;
}

/**
 * A search syntax help menu.
 *
 * @param props The props for the component.
 * @returns The JSX element.
 */
export default function SearchSyntaxHelpMenu(props: SearchSyntaxHelpMenuProps): JSX.SpecificElement<"div"> {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const mainHelpInfoPageRef: RefObject<HTMLDivElement> = useRef(null);
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "max-content",
            }}
            ref={containerRef}
        >
            <div style={{ display: "contents" }} ref={mainHelpInfoPageRef}>
                <button
                    type="button"
                    onClick={props.onClose}
                    style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        cursor: "pointer",
                    }}
                >
                    Close
                </button>
                <h1>{props.helpInfo.headerText ?? "Search Syntax"}</h1>
                {props.helpInfo.bodyText !== undefined &&
                    (typeof props.helpInfo.bodyText === "string" ? <p>{props.helpInfo.bodyText}</p> : props.helpInfo.bodyText)}
                {(props.helpInfo.categories ?? [{ category: undefined }])?.map(
                    (category: SearchSyntaxHelpInfoCategory, index: number): JSX.SpecificElement<"div"> => (
                        <div key={index}>
                            {category.header !== undefined && <h2>{category.header}</h2>}
                            {category.label !== undefined && <p>{category.label}</p>}
                            {Object.keys(props.helpInfo.prefixOperators).length > 0 && <h3>Prefix Operators</h3>}
                            {Object.entries(props.helpInfo.prefixOperators)
                                .filter(([_prefixOperator, prefixOperatorInfo]) => prefixOperatorInfo.category === category.category)
                                .map(
                                    ([prefixOperator, prefixOperatorInfo], index: number): JSX.SpecificElement<"div"> => (
                                        <div key={prefixOperator + index}>
                                            <p>
                                                {prefixOperator}: {prefixOperatorInfo.description}
                                            </p>
                                            {((prefixOperatorInfo.examples && prefixOperatorInfo.examples.length > 0) ||
                                                prefixOperatorInfo.extendedDescription !== undefined) && (
                                                <>
                                                    <br />
                                                    <a
                                                        href=""
                                                        aria-label="See more"
                                                        class="emerald-green-link"
                                                        onClick={(event: JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
                                                            event.preventDefault();
                                                            if (containerRef.current && mainHelpInfoPageRef.current) {
                                                                Array.from(containerRef.current.children)
                                                                    .slice(1)
                                                                    .forEach((child: Element): void => child.remove());
                                                                $(mainHelpInfoPageRef.current).hide();
                                                                let tempElement: HTMLDivElement = document.createElement("div");
                                                                render(
                                                                    <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(): void => {
                                                                                containerRef.current &&
                                                                                    Array.from(containerRef.current.children)
                                                                                        .slice(1)
                                                                                        .forEach((child: Element): void => child.remove());
                                                                                mainHelpInfoPageRef.current && $(mainHelpInfoPageRef.current).show();
                                                                            }}
                                                                            style={{
                                                                                position: "absolute",
                                                                                top: "0",
                                                                                left: "0",
                                                                                cursor: "pointer",
                                                                            }}
                                                                        >
                                                                            Back
                                                                        </button>
                                                                        <h1>{prefixOperator}</h1>
                                                                        {prefixOperatorInfo.extendedDescription === undefined ||
                                                                        typeof prefixOperatorInfo.extendedDescription === "string" ? (
                                                                            <p>{prefixOperatorInfo.extendedDescription ?? prefixOperatorInfo.description}</p>
                                                                        ) : (
                                                                            prefixOperatorInfo.extendedDescription
                                                                        )}
                                                                        {prefixOperatorInfo.examples!.map(
                                                                            (example: string | JSX.Element, index: number): JSX.Element =>
                                                                                typeof example === "string" ? (
                                                                                    <p key={prefixOperator + "examples" + index}>{example}</p>
                                                                                ) : (
                                                                                    example
                                                                                )
                                                                        )}
                                                                    </div>,
                                                                    tempElement
                                                                );
                                                                Array.from(tempElement.children).forEach(
                                                                    (child: Element): void => void containerRef.current!.appendChild(child)
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        See more...
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    )
                                )}
                            {Object.keys(props.helpInfo.filters).length > 0 && <h3>Filters</h3>}
                            {Object.entries(props.helpInfo.filters)
                                .filter(([_filter, filterInfo]) => filterInfo.category === category.category)
                                .map(
                                    ([filter, filterInfo], index: number): JSX.SpecificElement<"div"> => (
                                        <div key={filter + index}>
                                            <p>
                                                {filter}: {filterInfo.description}
                                                {((filterInfo.examples && filterInfo.examples.length > 0) || filterInfo.extendedDescription !== undefined) && (
                                                    <>
                                                        <br />
                                                        <a
                                                            href=""
                                                            aria-label="See more"
                                                            class="emerald-green-link"
                                                            onClick={(event: JSX.TargetedMouseEvent<HTMLAnchorElement>): void => {
                                                                event.preventDefault();
                                                                if (containerRef.current && mainHelpInfoPageRef.current) {
                                                                    Array.from(containerRef.current.children)
                                                                        .slice(1)
                                                                        .forEach((child: Element): void => child.remove());
                                                                    $(mainHelpInfoPageRef.current).hide();
                                                                    let tempElement: HTMLDivElement = document.createElement("div");
                                                                    render(
                                                                        <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(): void => {
                                                                                    containerRef.current &&
                                                                                        Array.from(containerRef.current.children)
                                                                                            .slice(1)
                                                                                            .forEach((child: Element): void => child.remove());
                                                                                    mainHelpInfoPageRef.current && $(mainHelpInfoPageRef.current).show();
                                                                                }}
                                                                                style={{
                                                                                    position: "absolute",
                                                                                    top: "0",
                                                                                    left: "0",
                                                                                    cursor: "pointer",
                                                                                }}
                                                                            >
                                                                                Back
                                                                            </button>
                                                                            <h1>{filter}</h1>
                                                                            {filterInfo.extendedDescription === undefined ||
                                                                            typeof filterInfo.extendedDescription === "string" ? (
                                                                                <p>{filterInfo.extendedDescription ?? filterInfo.description}</p>
                                                                            ) : (
                                                                                filterInfo.extendedDescription
                                                                            )}
                                                                            <h2>Examples</h2>
                                                                            {filterInfo.examples &&
                                                                                filterInfo.examples.length > 0 &&
                                                                                filterInfo.examples.map(
                                                                                    (example: string | JSX.Element, index: number): JSX.Element =>
                                                                                        typeof example === "string" ? (
                                                                                            <p key={filter + "examples" + index}>{example}</p>
                                                                                        ) : (
                                                                                            example
                                                                                        )
                                                                                )}
                                                                        </div>,
                                                                        tempElement
                                                                    );
                                                                    Array.from(tempElement.children).forEach(
                                                                        (child: Element): void => void containerRef.current!.appendChild(child)
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            See more...
                                                        </a>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    )
                                )}
                        </div>
                    )
                )}
                {props.helpInfo.miscExamples && props.helpInfo.miscExamples.length > 0 && (
                    <>
                        <hr />
                        <div>
                            <h2>{props.helpInfo.miscExamplesHeader ?? "Examples"}</h2>
                            {props.helpInfo.miscExamples.map(
                                (example: string, index: number): JSX.SpecificElement<"p"> => (
                                    <p key={"miscExamples" + index}>{example}</p>
                                )
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
