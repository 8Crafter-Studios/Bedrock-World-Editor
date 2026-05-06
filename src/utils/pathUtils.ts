import path from "path";

/**
 * Checks if a string is a URI or a path.
 *
 * @param URIOrPath The string to check.
 * @returns `"URI"` if the string is a URI, `"Path"` if the string is a path.
 */
export function checkIsURIOrPath(URIOrPath: string): "URI" | "Path" {
    if (/^[^:/\\]+:\/\//.test(URIOrPath)) {
        return "URI" as const;
    } else {
        return "Path" as const;
    }
}

/**
 * Normalizes a path.
 *
 * The resulting format will be the result of {@link path.win32.normalize} with slashes normalized to `/`.
 *
 * Trailing slashes and leading double slashes will be preserved (trailing slashes will still be normalized to one slash and leading slashes will be replaced
 * with a single slash if the number of leading slashes is not equal to two).
 *
 * @param filePath The path to normalize.
 * @returns The normalized path.
 */
export function normalizePath(filePath: string): string {
    return normalizePathSlashes(path.win32.normalize(filePath));
}

/**
 * Replaces all the backslashes in a path with forward slashes.
 *
 * @param filePath The path to normalize.
 * @returns The normalized path.
 */
export function normalizePathSlashes(filePath: string): string {
    return filePath.split("\\").join("/");
}
