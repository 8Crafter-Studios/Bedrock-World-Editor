/**
 * src/utils/deepMerge.ts
 * @module
 * @description A file containing a deep merge function.
 * @supports Main, Preload, Renderer
 * @see https://www.geeksforgeeks.org/typescript/how-to-deep-merge-two-objects-in-typescript/#
 */

/**
 * Checks if an item is an object.
 *
 * @param item The item to check.
 * @returns Whether the item is an object.
 */
function isObject(item: any): boolean {
    return item !== null && typeof item === "object" && !Array.isArray(item);
}

/**
 * Deep merge multiple objects.
 * 
 * @param target The target object.
 * @param sources The source objects.
 * @returns The merged object.
 */
export function deepMerge<T extends object, U extends object[]>(target: T, ...sources: U): T & UnionToIntersection<U[number]> {
    if (!sources.length) return target as T & UnionToIntersection<U[number]>;
    const source: U[number] = sources.shift()!;

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const sourceValue = source[key];
                if (isObject(sourceValue) && isObject(target[key])) {
                    target[key] = deepMerge(target[key] as any, sourceValue as any);
                } else {
                    (target as any)[key] = sourceValue;
                }
            }
        }
    }
    return deepMerge(target, ...sources);
}
