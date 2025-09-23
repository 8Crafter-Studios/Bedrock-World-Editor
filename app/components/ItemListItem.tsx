import type { JSX } from "preact";
import _React from "preact/compat";

export interface ItemListItemOptions<HeaderSizes extends string[]> {
    headerSizes: HeaderSizes;
    children: { [index in keyof HeaderSizes]?: JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions> | undefined };
}

export interface ItemListItemColumnOptions {
    containerType?: "Span" | "None";
    children?: any;
    contentType?: "Text" | "RawHTML" | "Other";
}

export function ItemListItemColumn(options: ItemListItemColumnOptions): JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions> {
    return (
        <div dangerouslySetInnerHTML={options.contentType === "RawHTML" ? { __html: options.children } : undefined}>
            {options.contentType !== "RawHTML" ? options.children : undefined}
        </div>
    );
}

export default function ItemListItem<HeaderSizes extends string[] | []>(options: ItemListItemOptions<HeaderSizes>): JSX.SpecificElement<"div"> {
    return (
        <div style="width: calc(100% - 20px); padding: 0px 10px; border: solid #ffffff; border-width: 0px 0px 1px 0px; text-align: left; font-size: 0; display: flex">
            {...options.children.map(
                (
                    child: JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions> | undefined,
                    index: number,
                    array: (JSX.SpecificElement<JSX.HTMLAttributes<HTMLDivElement> & ItemListItemColumnOptions> | undefined)[]
                ): JSX.SpecificElement<"div"> =>
                    index === 0 ? (
                        <div
                            class={`item-list-item-column item-list-item-column-${index}`}
                            style={`width: ${index === array.length - 1 ? 0 : options.headerSizes[index]}; font-size: var(--base-font-size); padding: 19px 0px; border: solid #ffffff; border-width: 0px 0px 0px 0px; text-align: left; vertical-align: middle; display: inline-block; line-height: 0; overflow-x: auto; flex-grow: ${index === array.length - 1 ? 1 : 0};`}
                            data-item-list-item-column={index}
                            dangerouslySetInnerHTML={
                                child && child.props.containerType === "None" && child.props.contentType === "RawHTML"
                                    ? { __html: child.props.children }
                                    : undefined
                            }
                        >
                            {!child ? undefined : child.props.containerType === "None" ? (
                                child.props.contentType === "RawHTML" ? undefined : (
                                    child.props.children
                                )
                            ) : (
                                <span
                                    style="padding: 8.5px 0px;"
                                    data-item-list-item-column={index}
                                    class="item-list-item-column-text"
                                    dangerouslySetInnerHTML={child.props.contentType === "RawHTML" ? { __html: child.props.children } : undefined}
                                >
                                    {child.props.contentType === "RawHTML" ? undefined : child.props.children}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div
                            class={`item-list-item-column item-list-item-column-${index}`}
                            style={`width: ${index === array.length - 1 ? 0 : `calc(${options.headerSizes[index]} - 1px)`}; font-size: var(--base-font-size); padding: 10px 0px; border: solid #ffffff; border-width: 0px 0px 0px 1px; text-align: left; display: inline-block; flex-grow: ${index === array.length - 1 ? 1 : 0};`}
                            data-item-list-item-column={index}
                            dangerouslySetInnerHTML={
                                child && child.props.containerType === "None" && child.props.contentType === "RawHTML"
                                    ? { __html: child.props.children }
                                    : undefined
                            }
                        >
                            {!child ? undefined : child.props.containerType === "None" ? (
                                child.props.contentType === "RawHTML" ? undefined : (
                                    child.props.children
                                )
                            ) : (
                                <span style="padding: 8.5px 0px;" data-item-list-item-column={index} class="item-list-item-column-text">
                                    {child.props.contentType === "RawHTML" ? undefined : child.props.children}
                                </span>
                            )}
                        </div>
                    )
            )}
        </div>
    );
}
