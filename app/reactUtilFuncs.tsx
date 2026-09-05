import type { RefObject } from "preact";
import _React, { useEffect, useState } from "preact/compat";
import { useDebouncedCallback } from "use-debounce";

/**
 * React hook that returns the size of an element.
 *
 * @param ref The element to get the size of.
 * @param debounceDelay The delay in milliseconds to debounce the resize event. If `null`, the resize event will not be debounced. Defaults to `50`.
 * @param debounceOptions Options to pass to {@link useDebouncedCallback}.
 * @returns The size of the element.
 */
export function useElementSize(
    ref: RefObject<Element>,
    debounceDelay: number | null = 50,
    debounceOptions?: Parameters<typeof useDebouncedCallback>[2]
): [x: number, y: number] {
    const [size, setSize] = useState<[x: number, y: number]>([0, 0]);
    function onResize_original(entries: ResizeObserverEntry[]): void {
        for (const entry of entries) {
            setSize([entry.contentRect.width, entry.contentRect.height]);
        }
    }
    const onResize: ResizeObserverCallback =
        debounceDelay === null ? onResize_original : useDebouncedCallback(onResize_original, debounceDelay, debounceOptions);
    useEffect((): (() => void) => {
        const observer = new ResizeObserver(onResize);
        if (ref.current) observer.observe(ref.current);
        return (): void => void (ref.current && observer.unobserve(ref.current));
    }, []);
    return size;
}
