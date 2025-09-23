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
