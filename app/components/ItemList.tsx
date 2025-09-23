import type { JSX, RefObject } from "preact";
import _React, { useRef, useEffect } from "preact/compat";

export interface ItemListOptions {
    wrapperId?: string | undefined;
    headerTitle?: string | undefined;
    /**
     * The header info labels.
     *
     * These appear below the header title of the item list.
     *
     * If `undefined` or not specified, there will be no header info labels.
     */
    headerInfoLabels?:
        | {
              /**
               * The left header info label.
               */
              left?: ItemListHeaderInfoLabel | undefined;
              /**
               * The right header info label.
               */
              right?: ItemListHeaderInfoLabel | undefined;
          }
        | undefined;
    tableHeaders?: ItemListTableHeader[] | undefined;
    children?: any;
}

interface ItemListHeaderInfoLabel {
    id?: string | undefined;
    defaultText?: string | undefined;
}

interface ItemListTableHeader {
    /**
     * The label of the table header.
     *
     * @example "Item Name"
     */
    label: string;
    /**
     * The width of the table header.
     *
     * @default
     * ```typescript
     * options.tableHeaders!.length === 1
     *     ? "100%"
     *     : isFirst
     *     ? `${40 * (2 / options.tableHeaders!.length)}%`
     *     : isLast
     *     ? `${60 * (2 / options.tableHeaders!.length)}%`
     *     : `${100 / options.tableHeaders!.length}%`;
     * ```
     *
     * @example "10%"
     */
    width?: string | undefined;
    /**
     * The padding of the table header.
     */
    paddingOverride?: string | undefined;
}

export default function ItemList(options: ItemListOptions): JSX.HTMLAttributes<HTMLDivElement> {
    const headersContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    useEffect((): (() => void) => {
        function onResize(): void {
            if (headersContainerRef.current === null) return;
            const itemListElement: HTMLDivElement | null | undefined = headersContainerRef.current.parentElement?.querySelector("div.item-list-items");
            if (!itemListElement) return;
            const headerSizes: HTMLDivElement[] = Array.from(headersContainerRef.current.children).filter(
                (column: Element): column is HTMLDivElement => column instanceof HTMLDivElement
            );
            for (const row of itemListElement.children) {
                if (!(row instanceof HTMLDivElement)) continue;
                const columns: HTMLDivElement[] = Array.from(row.children).filter(
                    (column: Element): column is HTMLDivElement => column instanceof HTMLDivElement
                );
                columns.slice(0, -1).forEach((column: HTMLDivElement): void => {
                    const width: number | undefined =
                        headerSizes[Number(column.getAttribute("data-item-list-item-column") ?? "0")]?.getBoundingClientRect().width;
                    if (!width) return;
                    column.style.width = `${width}px`;
                });
            }
        }
        const resizeObserver: ResizeObserver = new ResizeObserver(onResize);
        if (headersContainerRef.current !== null) {
            resizeObserver.observe(headersContainerRef.current);
            onResize();
        }
        return (): void => {
            resizeObserver.disconnect();
        };
    }, []);
    return (
        <div id={options.wrapperId} class="d-contents item-list" style="width: 100%; background-color: #000000; color: #00ffff; text-align: center;">
            {(options.headerTitle !== undefined || options.headerInfoLabels !== undefined) && (
                <div class="item-list-header" style="text-align: center; padding: 10px; border: 1px solid #ffffff;">
                    {options.headerTitle !== undefined && <span class="item-list-header-title">{options.headerTitle}</span>}
                    {options.headerInfoLabels !== undefined && (
                        <div style="text-align: left;">
                            {options.headerInfoLabels.left !== undefined && (
                                <span id={options.headerInfoLabels.left.id} class="item-list-header-info-label item-list-header-info-label-left">
                                    {options.headerInfoLabels.left.defaultText}
                                </span>
                            )}
                            {options.headerInfoLabels.right !== undefined && (
                                <span
                                    id={options.headerInfoLabels.right.id}
                                    class="item-list-header-info-label item-list-header-info-label-right"
                                    style="float: right;"
                                >
                                    {options.headerInfoLabels.right.defaultText}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div
                class="d-contents item-list-table-headers"
                style="border: solid #ffffff; border-width: 0px 1px 1px 1px; font-size: 0; padding: 0px 10px;"
                ref={headersContainerRef}
            >
                {options.tableHeaders?.map((header: ItemListTableHeader, index: number): JSX.HTMLAttributes<HTMLDivElement> | undefined =>
                    index === 0 ? (
                        <div
                            style={`width: ${
                                header.width ?? (options.tableHeaders!.length === 1 ? "100%" : `${40 * (2 / options.tableHeaders!.length)}%`)
                            }; font-size: var(--base-font-size); padding: 10px 0px; border: solid #ffffff; border-width: 0px 0px 0px 0px; text-align: left; display: inline-block; line-height: 0; overflow-x: auto;`}
                        >
                            <span style={{ padding: header.paddingOverride ?? "8.5px 0px" }}>{header.label}</span>
                        </div>
                    ) : index === options.tableHeaders!.length - 1 ? (
                        <div
                            style={{
                                width: `calc(${header.width ?? `${60 * (2 / options.tableHeaders!.length)}%`} - 11px)`,
                                "font-size": "var(--base-font-size)",
                                padding: header.paddingOverride ?? "10px 0px 10px 10px",
                                border: "solid #ffffff",
                                "border-width": "0px 0px 0px 1px",
                                "text-align": "left",
                                display: "inline-block",
                                "overflow-x": "auto",
                            }}
                        >
                            {header.label}
                        </div>
                    ) : (
                        <div
                            style={{
                                width: `calc(${header.width ?? `${100 / options.tableHeaders!.length}%`} - 11px)`,
                                "font-size": "var(--base-font-size)",
                                padding: header.paddingOverride ?? "10px 0px 10px 10px",
                                border: "solid #ffffff",
                                "border-width": "0px 0px 0px 1px",
                                "text-align": "left",
                                display: "inline-block",
                                "overflow-x": "auto",
                            }}
                        >
                            {header.label}
                        </div>
                    )
                )}
            </div>
            <div
                class="d-contents item-list-items"
                style="min-height: 300px; max-height: 600px; overflow-y: auto; border: solid #ffffff; border-width: 0px 1px 1px 1px;"
                data-header-sizes={JSON.stringify(
                    options.tableHeaders?.map(
                        (header: ItemListTableHeader, index: number): string =>
                            header.width ??
                            (index === 0
                                ? options.tableHeaders!.length === 1
                                    ? "100%"
                                    : `${40 * (2 / options.tableHeaders!.length)}%`
                                : index === options.tableHeaders!.length - 1
                                ? `${60 * (2 / options.tableHeaders!.length)}%`
                                : `${100 / options.tableHeaders!.length}%`)
                    )
                )}
                onResize={(): void => {
                    // console.log(12);
                }}
            >
                {options.children}
            </div>
        </div>
    );
}
