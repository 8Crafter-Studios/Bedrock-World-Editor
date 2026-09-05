/**
 * Tests whether all properties and their values in the `base` object
 * are present in the `objectToTest` object.
 *
 * @param objectToTest - The object to be tested.
 * @param base - The base object containing properties and values to test against.
 * @returns `true` if all properties and values in `base` are present in `objectToTest`, otherwise `false`.
 *
 * @example
 * const obj1 = { a: 1, b: 2, c: 3 };
 * const obj2 = { a: 1, b: 2 };
 * console.log(testForObjectExtension(obj1, obj2)); // true
 *
 * @example
 * const obj3 = { a: 1, b: 2 };
 * const obj4 = { a: 1, b: 3 };
 * console.log(testForObjectExtension(obj3, obj4)); // false
 *
 * @example
 * const obj5 = { a: 1, b: 2 };
 * const obj6 = { a: 1, b: 2, c: 3 };
 * console.log(testForObjectExtension(obj5, obj6)); // false
 */
export function testForObjectExtension(objectToTest: object, base: object): boolean {
    return Object.entries(base).every((v) => {
        if (Object.keys(objectToTest).includes(v[0])) {
            const v2 = Object.entries(objectToTest).find((c) => c[0] == v[0])![1];
            if (typeof v2 !== typeof v[1]) return false;
            if (v2 === null && v[1] !== null) return false;
            if (typeof v2 === "object") return testForObjectExtension(v2, v[1]);
            return v2 === v[1];
        }
        return false;
    });
}

/**
 * An observable value.
 */
export interface Observable<T> {
    /**
     * Gets the current value of the observable.
     */
    get(): T;
    /**
     * Sets the value of the observable.
     *
     * @param newValue The new value to set.
     */
    set(newValue: T): void;
    /**
     * Observes the value of the observable.
     *
     * @param fn The function to call when the value of the observable changes.
     * @returns A function that can be called to stop observing the value of the observable, returning `true` if the observer was removed, or `false` if the observer was already removed.
     */
    observe(fn: (value: T) => void): () => boolean;
}

/**
 * Creates an observable value.
 *
 * @param initialValue The initial value of the observable.
 * @returns The observable value.
 */
export function createObservable<T>(initialValue: T): Observable<T> {
    let value: T = initialValue;
    const listeners: Set<(value: T) => void> = new Set();

    return {
        get(): T {
            return value;
        },

        set(newValue: T): void {
            value = newValue;
            for (const fn of listeners) fn(newValue);
        },

        observe(fn: (value: T) => void): () => boolean {
            listeners.add(fn);
            return (): boolean => listeners.delete(fn);
        },
    } satisfies Observable<T>;
}

let measureTextWidth_canvas: HTMLCanvasElement | null = null;

/**
 * Measures the width of a text using the given font.
 *
 * @param text The text to measure.
 * @param font The font to use.
 * @returns The width of the text in pixels.
 */
export function measureTextWidth(text: string, font: string): number {
    const canvas: HTMLCanvasElement = measureTextWidth_canvas ?? (measureTextWidth_canvas = document.createElement("canvas"));
    const context: CanvasRenderingContext2D = canvas.getContext("2d")!;
    context.font = font;
    return context.measureText(text).width;
}
