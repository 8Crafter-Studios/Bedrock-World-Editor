import type { JSX, RefObject } from "preact";
import { render } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";

export interface PageNavigationProps {
    /**
     * @default 1
     */
    firstPage?: number | undefined;
    /**
     * @default firstPage
     */
    currentPage?: number | undefined;
    totalPages: number;
    /**
     * @default 5
     */
    maxVisiblePages?: number | undefined;
    onPageChange(page: number): void;
}

export function PageNavigation(props: PageNavigationProps): JSX.Element {
    const containerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null);
    const maxPagesToShow: number = props.maxVisiblePages ?? 5;
    const firstPage: number = props.firstPage ?? 1;
    let currentPage: number = props.currentPage ?? firstPage;
    const lastPage: number = props.totalPages + firstPage - 1;
    const pageNumbers: number[] = Array.from({ length: props.totalPages }, (_: unknown, i: number): number => i + firstPage);
    function updatePageContents(): void {
        if (!containerRef.current) return;
        render(null, containerRef.current);
        render(<Contents />, containerRef.current);
    }
    function Contents(): JSX.Element {
        const goToPageRef: RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);
        const pagesToShow: number[] = pageNumbers.slice(
            Math.max(0, currentPage - Math.ceil(maxPagesToShow / 2)),
            Math.min(currentPage + Math.floor(maxPagesToShow / 2) + (currentPage - Math.ceil(maxPagesToShow / 2) < 0 ? Math.max(0, Math.abs(currentPage - Math.ceil(maxPagesToShow / 2)) - 1) : 0), props.totalPages)
        );
        useEffect((): (() => void) | void => {
            function onGoToPageChange(event: Event): void {
                currentPage = Math.min(lastPage, Math.max(firstPage, Number((event.currentTarget as HTMLInputElement).value)));
                updatePageContents();
                props.onPageChange(currentPage);
            }
            if (goToPageRef.current) {
                goToPageRef.current.addEventListener("change", onGoToPageChange);
                return (): void => {
                    goToPageRef.current?.removeEventListener("change", onGoToPageChange);
                };
            }
        });
        return (
            <>
                {!pagesToShow.includes(firstPage) && (
                    <>
                        <button
                            type="button"
                            onClick={(): void => {
                                currentPage = firstPage;
                                updatePageContents();
                                props.onPageChange(firstPage);
                            }}
                            style={{ margin: "0 5px" }}
                        >
                            {firstPage}
                        </button>
                        <span>...</span>
                    </>
                )}
                {/* <button
                type="button"
                onClick={() => props.onPageChange(props.currentPage - 1)}
                disabled={props.currentPage === firstPage}
                style={{ margin: "0 5px" }}
            >
                Previous page
            </button> */}
                {pagesToShow.map(
                    (page: number): JSX.Element => (
                        <button
                            type="button"
                            key={page}
                            onClick={(): void => {
                                currentPage = page;
                                updatePageContents();
                                props.onPageChange(page);
                            }}
                            disabled={page === currentPage}
                            style={{ margin: "0 5px" }}
                        >
                            {page}
                        </button>
                    )
                )}
                {!pagesToShow.includes(lastPage) && (
                    <>
                        <span>...</span>
                        <button
                            type="button"
                            onClick={(): void => {
                                currentPage = lastPage;
                                updatePageContents();
                                props.onPageChange(lastPage);
                            }}
                            style={{ margin: "0 5px" }}
                        >
                            {lastPage}
                        </button>
                    </>
                )}
                <div style={{ display: "flex", alignItems: "center", margin: "0 5px" }}>
                    Go to page:{" "}
                    <input
                        type="number"
                        min={firstPage}
                        max={lastPage}
                        placeholder="#"
                        value={props.currentPage}
                        style={{ width: "50px", textAlign: "center" }}
                        ref={goToPageRef}
                    />
                </div>
            </>
        );
    }
    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }} ref={containerRef}>
            <Contents />
        </div>
    );
}
